/* Warfield Chess — boot, frame loop, the camera rig, the field map, orders and the enemy turn.
   rules.js owns the position; this file only replays moves as marches and battles. The player
   (white, "Red") never sees enemy positions on the map — only through their units' eyes. */
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Unit, UNIT_INFO, TEAMS, setEnvironment, setOutlines } from './units.js';
import { createPost } from './post.js';
import { setViewer } from './unitfx.js';
import { H, squareCenter, SQ } from './geo.js';
import { newGame, fromFEN, applyMove, explain, status, inCheck, sqName, W, B, positionKey, legalMoves } from './rules.js';
import { chooseMove } from './ai.js';
import { Sound } from './audio.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const TIMESCALE = DEBUG && params.has('fast') ? 8 : 1;     // ?debug&fast: automated playtests
const $ = id => document.getElementById(id);
const canvas = $('view');

// ---------- renderer & scene ----------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  window.__bootFail('webgl');
  throw err;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.3, 2500);
const world = buildWorld(scene, (Math.random() * 1e9) | 0);

// steel and gold on the units reflect a blurred copy of the sky
{
  const pmrem = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(world.sky.geometry, world.sky.material));
  setEnvironment(pmrem.fromScene(envScene, 0.04).texture);
  pmrem.dispose();
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  post?.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
let post = null;
addEventListener('resize', resize);
resize();
post = createPost(renderer, scene, camera);
post.setSize(innerWidth, innerHeight);

// ---------- settings (⚙), saved under warfieldChess.settings ----------
// fx: outlines + colour grading · sfx/amb: volumes 0..1 · card/log: show the unit info and the
// dispatches · pov: 'shoulder' (behind the unit) or 'eyes' (through one figure's eyes)
const SETTINGS_KEY = 'warfieldChess.settings';
const settings = (() => {
  const base = { fx: true, sfx: 1, amb: 1, card: true, log: true, pov: 'shoulder' };
  try {
    if (localStorage.getItem('warfieldChess.fx') === '0') base.fx = false;           // the earlier ✨ toggle
    return { ...base, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch { return base; }
})();
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage blocked */ } }

function applySettings() {
  setOutlines(settings.fx);
  Sound.setVolumes(settings.sfx, settings.amb);
  document.body.classList.toggle('no-card', !settings.card);
  document.body.classList.toggle('no-log', !settings.log);
}
function syncSettingsForm() {
  $('setFx').checked = settings.fx;
  $('setCard').checked = settings.card;
  $('setLog').checked = settings.log;
  for (const [k, id] of [['sfx', 'setSfx'], ['amb', 'setAmb']]) {
    $(id).value = Math.round(settings[k] * 100);
    $(id + 'Val').textContent = Math.round(settings[k] * 100) + '%';
  }
  document.querySelectorAll('input[name=pov]').forEach(r => { r.checked = r.value === settings.pov; });
}
function setSetting(key, value) {
  settings[key] = value;
  saveSettings();
  applySettings();
  // switching the camera style takes effect at once on the unit being followed
  if (key === 'pov' && cam.follow && (cam.mode === 'pov' || cam.mode === 'eye')) povOn(cam.follow, false);
}
function toggleFx() { setSetting('fx', !settings.fx); syncSettingsForm(); }

// ---------- markers & dust ----------
const markerMat = new THREE.MeshBasicMaterial({ color: '#ffd77a', transparent: true, opacity: 0.85, fog: false, depthWrite: false, side: THREE.DoubleSide });
const target3d = new THREE.Group();
const ring = new THREE.Mesh(new THREE.RingGeometry(3.7, 4.3, 48).rotateX(-Math.PI / 2), markerMat);
const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 46, 12, 1, true),
  new THREE.MeshBasicMaterial({ color: '#ffd77a', transparent: true, opacity: 0.28, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
pillar.position.y = 23;
target3d.add(ring, pillar);
target3d.visible = false;
scene.add(target3d);

const selRing = new THREE.Mesh(new THREE.RingGeometry(4.0, 4.25, 48).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: '#fff0c0', transparent: true, opacity: 0.35, depthWrite: false }));
selRing.visible = false;
scene.add(selRing);

const dust = (() => {
  const N = 260, pos = new Float32Array(N * 3), life = new Float32Array(N), vel = new Float32Array(N * 3);
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), color: '#b8a582', size: 3.2, transparent: true, opacity: 0.55, depthWrite: false }));
  pts.frustumCulled = false;
  scene.add(pts);
  let next = 0;
  for (let i = 0; i < N; i++) pos[i * 3 + 1] = -999;
  return {
    burst(x, z, n = 40, spread = 3.5) {
      for (let k = 0; k < n; k++) {
        const i = next++ % N;
        pos[i * 3] = x + (Math.random() - 0.5) * spread; pos[i * 3 + 2] = z + (Math.random() - 0.5) * spread;
        pos[i * 3 + 1] = H(x, z) + Math.random() * 1.2;
        vel[i * 3] = (Math.random() - 0.5) * 2; vel[i * 3 + 1] = 0.6 + Math.random() * 1.2; vel[i * 3 + 2] = (Math.random() - 0.5) * 2;
        life[i] = 1.5 + Math.random() * 1.5;
      }
    },
    update(dt) {
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        if (life[i] <= 0) { pos[i * 3 + 1] = -999; continue; }
        for (let a = 0; a < 3; a++) pos[i * 3 + a] += vel[i * 3 + a] * dt;
        vel[i * 3 + 1] *= 0.97;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
})();

// ---------- camera rig ----------
// 'pov': over the shoulder of the followed unit · 'orbit': circling a point (menu, camp)
// 'overview': high above the field, mist lifted (end of battle, ?debug O)
const cam = {
  mode: 'orbit', yaw: 0.6, pitch: -0.33, dist: 105, pivot: new THREE.Vector3(0, 0, 0),
  want: new THREE.Vector3(), follow: null, turnTo: null, sight: 400, wantSight: 400, spin: 0.03,
};
const _fwd = new THREE.Vector3(), _tmp = new THREE.Vector3();
const angleDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const yawToward = (dx, dz) => Math.atan2(-dx, -dz);

const _eye = new THREE.Vector3();
function updateCamera(dt) {
  if (cam.mode === 'eye' && cam.follow) {
    // through one figure's eyes: the camera sits on that figure's eye anchor and turns freely
    cam.follow.eye.getWorldPosition(_eye);
    if (cam.pivot.distanceTo(_eye) < 2.5) cam.pivot.copy(_eye);     // ride along exactly
    else cam.pivot.lerp(_eye, 1 - Math.exp(-dt * 8));                // glide over when switching
    if (cam.turnTo !== null) {
      const d = angleDiff(cam.yaw, cam.turnTo);
      cam.yaw += d * (1 - Math.exp(-dt * 4));
      if (Math.abs(d) < 0.002) cam.turnTo = null;
    }
    cam.sight += (cam.wantSight - cam.sight) * (1 - Math.exp(-dt * 3));
    world.setSight(cam.sight);
    const cp = Math.cos(cam.pitch);
    _fwd.set(-Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), -Math.cos(cam.yaw) * cp);
    camera.position.copy(cam.pivot);
    camera.lookAt(_tmp.copy(camera.position).add(_fwd));
    return;
  }
  if (cam.follow) {
    const u = cam.follow;
    cam.want.set(u.x, H(u.x, u.z) + (cam.mode === 'pov' ? u.info.eye : 2.5), u.z);
  }
  cam.pivot.lerp(cam.want, 1 - Math.exp(-dt * 5));
  if (cam.turnTo !== null) {
    const d = angleDiff(cam.yaw, cam.turnTo);
    cam.yaw += d * (1 - Math.exp(-dt * 4));
    if (Math.abs(d) < 0.002) cam.turnTo = null;
  }
  if (cam.mode !== 'pov') cam.yaw += cam.spin * dt;
  cam.sight += (cam.wantSight - cam.sight) * (1 - Math.exp(-dt * 3));
  world.setSight(cam.sight);
  const cp = Math.cos(cam.pitch);
  _fwd.set(-Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), -Math.cos(cam.yaw) * cp);
  camera.position.copy(cam.pivot).addScaledVector(_fwd, -cam.dist);
  if (cam.mode === 'pov') camera.position.y += 0.6 + cam.dist * 0.1;
  const floor = H(camera.position.x, camera.position.z) + 0.9;
  if (camera.position.y < floor) camera.position.y = floor;
  camera.lookAt(_tmp.copy(camera.position).add(_fwd));
}

/** Ride with a unit, over its shoulder or through its eyes depending on the settings. */
function povOn(unit, faceForward = true) {
  cam.mode = settings.pov === 'eyes' ? 'eye' : 'pov';
  cam.follow = unit;
  cam.dist = unit.info.cam;
  cam.wantSight = unit.info.sight;
  cam.spin = 0;
  if (faceForward) { cam.turnTo = unit.color === W ? 0 : Math.PI; cam.pitch = -0.1; }
}
function orbitOn(x, z, dist, pitch, spin = 0, follow = null) {
  cam.mode = 'orbit';
  cam.follow = follow;
  cam.want.set(x, H(x, z) + 2, z);
  cam.dist = dist; cam.pitch = pitch; cam.spin = spin; cam.turnTo = null;
  cam.wantSight = 420;
}
function overviewOn() { orbitOn(0, 0, 118, -0.85, 0.025); cam.mode = 'overview'; cam.wantSight = 700; }

// ---------- input ----------
// In battle there are two states. LOOKING: the pointer is locked (cursor hidden), the mouse turns
// the view, and a click picks the unit under the centre dot. COMMANDING: the cursor is back, the
// view holds still, and the field map is lit for orders. Space switches between them, a click on
// the battlefield goes back to looking, and Esc (which the browser also uses to release the
// pointer) opens the pause menu. Outside battle — review camp, end of battle — the mouse drags the
// view, and the camp alone zooms with the wheel. Touch always drags.
const riding = () => cam.mode === 'pov' || cam.mode === 'eye';
const inBattle = () => phase === 'player' || phase === 'moving' || phase === 'ai';
const LOOK = 0.0024;
const turnBy = (dx, dy, k) => {
  cam.yaw -= dx * k;
  cam.pitch = Math.max(-1.25, Math.min(0.45, cam.pitch - dy * k * 0.85));
  cam.turnTo = null;
};

let looking = false;          // pointer locked to the canvas
let releasing = false;        // we asked for the release ourselves (Space, end of battle, menu)
let paused = false;

/** Hide the cursor and look around. Must run inside a click or key handler. */
function lookOn() {
  if (!inBattle() || paused || looking) return;
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => lookFailed());
  } catch { lookFailed(); }
}
/** Show the cursor and hold the view still. */
function lookOff() {
  if (document.pointerLockElement !== canvas) { syncLookUI(); return; }
  releasing = true;
  document.exitPointerLock();
}
function lookFailed() { toast('Click the battlefield to look around.'); syncLookUI(); }
function toggleLook() {
  if (looking) { lookOff(); focusMap(); } else lookOn();
}
function focusMap() {
  ui.field.classList.remove('pulse'); void ui.field.offsetWidth; ui.field.classList.add('pulse');
}
function syncLookUI() {
  const battle = inBattle() || phase === 'over';
  document.body.classList.toggle('looking', battle && looking);
  document.body.classList.toggle('commanding', inBattle() && !looking);
  document.body.classList.toggle('over', phase === 'over');
  $('crosshair').hidden = !looking;
  $('hintSpaceText').textContent = looking ? 'Field map' : 'Look around';
  $('hintSpace').hidden = !inBattle();
}
document.addEventListener('pointerlockchange', () => {
  looking = document.pointerLockElement === canvas;
  const asked = releasing;
  releasing = false;
  syncLookUI();
  // the browser released the pointer on Esc: that is the pause key
  if (!looking && !asked && inBattle() && !paused) openPause();
});
document.addEventListener('pointerlockerror', lookFailed);
document.addEventListener('mousemove', e => {
  if (looking) turnBy(e.movementX, e.movementY, LOOK);
});

let drag = null;
canvas.addEventListener('pointerdown', e => {
  Sound.unlock();
  if (looking) {                                       // pick whatever is under the centre dot
    const r = canvas.getBoundingClientRect();
    onFieldClick(r.left + r.width / 2, r.top + r.height / 2);
    return;
  }
  drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, id: e.pointerId, touch: e.pointerType !== 'mouse' };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!drag || drag.id !== e.pointerId) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
  drag.moved = true;
  if (!inBattle() || drag.touch) {
    canvas.classList.add('dragging');
    turnBy(-dx, -dy, 0.0055);
    cam.spin = 0;
  }
  drag.x = e.clientX; drag.y = e.clientY;
});
canvas.addEventListener('pointerup', e => {
  if (!drag) return;
  const click = !drag.moved, touch = drag.touch;
  drag = null;
  canvas.classList.remove('dragging');
  if (!click) return;
  // commanding: a click on one of our units selects it; anywhere else goes back to looking
  if (inBattle() && !touch && !onFieldClick(e.clientX, e.clientY)) lookOn();
  else if (!inBattle()) onFieldClick(e.clientX, e.clientY);
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (phase !== 'camp' || riding()) return;
  cam.dist = Math.max(8, Math.min(220, cam.dist + e.deltaY * 0.06));
}, { passive: false });

const keys = new Set();
const modalOpen = () => ['settingsModal', 'rulesModal', 'surrenderModal'].find(id => $(id).classList.contains('show'));
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input[type=range], textarea')) return;
  const k = e.key.toLowerCase();
  if (e.key === 'Escape') {
    const top = modalOpen();
    if (top) closeModal(top);
    else if (paused) resume();
    else if (phase !== 'menu') openPause();
    return;
  }
  if (paused || modalOpen()) return;
  keys.add(k);
  if (e.key === ' ' && inBattle()) { e.preventDefault(); toggleLook(); }
  if (k === 'v' && riding()) toggleCamera();
  if (e.key === 'Tab' && phase === 'player') { e.preventDefault(); cycleUnit(e.shiftKey ? -1 : 1); }
  if (e.key === 'Enter' && phase === 'player' && order) commit(order);
  if (k === 'm') toggleSound();
  if (k === 'g') toggleFx();
  if (k === 'o' && DEBUG && game) { cam.mode === 'overview' ? reselect() : (overviewOn(), revealMap(true)); }
  if (phase === 'camp' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) campStep(e.key === 'ArrowRight' ? 1 : -1);
  if (phase === 'camp' && e.key === '1') animWalk();
  if (phase === 'camp' && e.key === '2') animAttack();
  if (phase === 'camp' && e.key === '3') animDie();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
function keyLook(dt) {
  if (paused || (inBattle() && !looking)) return;      // commanding: the view holds still
  if (phase === 'camp' && (keys.has('arrowleft') || keys.has('arrowright'))) return;
  const turn = (keys.has('arrowleft') || keys.has('a') ? 1 : 0) - (keys.has('arrowright') || keys.has('d') ? 1 : 0);
  const tilt = (keys.has('arrowup') || keys.has('w') ? 1 : 0) - (keys.has('arrowdown') || keys.has('s') ? 1 : 0);
  if (turn) { cam.yaw += turn * dt * 1.6; cam.turnTo = null; }
  if (tilt) cam.pitch = Math.max(-1.25, Math.min(0.45, cam.pitch + tilt * dt * 1.1));
}
/** V: over the shoulder ⇄ through their eyes. */
function toggleCamera() {
  setSetting('pov', settings.pov === 'eyes' ? 'shoulder' : 'eyes');
  toast(settings.pov === 'eyes' ? '👁 Through their eyes' : '🎥 Over the shoulder', false, 1200);
}

/** Nearest unit to a screen point, among those `ok` accepts. */
function pickUnit(cx, cy, ok) {
  const rect = canvas.getBoundingClientRect();
  let best = null, bestD = 80;
  for (const u of units.values()) {
    if (u.dead || !ok(u)) continue;
    _tmp.set(u.x, H(u.x, u.z) + 1.8, u.z).project(camera);
    if (_tmp.z > 1) continue;
    const sx = (_tmp.x * 0.5 + 0.5) * rect.width, sy = (-_tmp.y * 0.5 + 0.5) * rect.height;
    const d = Math.hypot(sx - (cx - rect.left), sy - (cy - rect.top));
    if (d < bestD) { bestD = d; best = u; }
  }
  return best;
}

function onFieldClick(cx, cy) {
  if (phase === 'player') {
    const u = pickUnit(cx, cy, u => u.color === W && u !== cam.follow);
    if (u) { select(u.pieceId); return true; }
  } else if (phase === 'camp') {
    const u = pickUnit(cx, cy, () => true);
    if (u) { campIndex = campUnits.indexOf(u); campFocus(); return true; }
  }
  return false;
}

// ---------- game state ----------
let phase = 'menu';            // menu · player · moving · ai · over · camp
let game = null;
let level = 'captain';
let units = new Map();         // piece id → Unit
let selectedId = null;
let order = null;              // the move waiting for confirmation
let history = [];
let battle = 0;                // bumps on every new battle, so stale async work can tell
let lastMove = null;
const marches = [];

function clearUnits() {
  for (const u of units.values()) { scene.remove(u.group); u.dispose(); }
  units = new Map();
  marches.length = 0;
}

function spawn(piece, sq) {
  const u = new Unit(piece.t, piece.c, piece.id * 7919 + 13);
  const c = squareCenter(sq);
  u.place(c.x, c.z);
  u.pieceId = piece.id;
  u.homeYaw = u.yaw;
  scene.add(u.group);
  units.set(piece.id, u);
  return u;
}

const squareOf = id => game.board.findIndex(p => p && p.id === id);

function setupArmies() {
  clearUnits();
  game = DEBUG && params.get('fen') ? fromFEN(params.get('fen')) : newGame();
  game.board.forEach((p, sq) => { if (p) spawn(p, sq); });
}

// ---------- HUD ----------
const ui = {
  turn: $('turnBadge'), card: $('unitCard'), field: $('field'), dispatch: $('dispatch'), board: $('board'),
  eye: $('eye'), orders: $('orders'), ordersText: $('ordersText'), toast: $('toast'), camp: $('campBar'),
};
const GL = t => UNIT_INFO[t].glyph + '\uFE0E';               // text, not emoji, presentation

const cells = [];
(function buildBoard() {
  for (let row = 0; row < 8; row++) {
    const r = 7 - row;
    $('ranks').insertAdjacentHTML('beforeend', `<span>${r + 1}</span>`);
    for (let f = 0; f < 8; f++) {
      const sq = r * 8 + f, el = document.createElement('div');
      el.className = 'cell ' + ((r + f) % 2 ? 'l' : 'd');
      el.dataset.sq = sq;
      el.title = sqName(sq);
      el.addEventListener('click', () => onCell(sq));
      ui.board.appendChild(el);
      cells[sq] = el;
    }
  }
  for (const f of 'abcdefgh') $('files').insertAdjacentHTML('beforeend', `<span>${f}</span>`);
})();

let revealed = false;
function revealMap(on) { revealed = on; renderMap(); }

function renderMap() {
  if (!game) return;
  const selSq = selectedId !== null ? squareOf(selectedId) : -1;
  for (let sq = 0; sq < 64; sq++) {
    const p = game.board[sq], el = cells[sq];
    const show = p && (p.c === W || revealed);
    el.innerHTML = show ? `<span class="pc${p.c === B ? ' foe' : ''}">${GL(p.t)}</span>` : '';
    el.classList.toggle('sel', sq === selSq);
    el.classList.toggle('target', !!order && order.to === sq);
    el.classList.toggle('from', !!lastMove && lastMove.from === sq);
    el.classList.toggle('to', !!lastMove && lastMove.to === sq);
  }
}

function updateEye() {
  const show = phase !== 'menu' && phase !== 'camp' && riding() && cam.follow && !cam.follow.dead;
  ui.eye.hidden = !show;
  if (!show) return;
  const u = cam.follow, s = ui.board.clientWidth / 8;
  const fx = u.x / SQ + 4, fz = 4 - u.z / SQ;          // board units, rank up
  ui.eye.style.left = fx * s + 'px';
  ui.eye.style.top = (8 - fz) * s + 'px';
  ui.eye.style.transform = `rotate(${-cam.yaw}rad)`;
}

function showCard(u, sq) {
  ui.card.hidden = false;
  $('unitGlyph').textContent = GL(u.type);
  $('unitGlyph').style.color = u.color === W ? '' : '#6b98e8';
  $('unitName').textContent = u.info.name;
  $('unitSub').textContent = `${sq >= 0 ? sqName(sq) + ' · ' : ''}${TEAMS[u.color].name}`;
  $('unitRule').textContent = u.info.rule;
  $('unitSight').textContent = `Eye height ${u.info.eye.toFixed(1)} m · sight ${u.info.sight} m (${(u.info.sight / SQ).toFixed(1)} squares)`;
}

function setTurn(text, enemy = false) {
  ui.turn.hidden = false;
  ui.turn.textContent = text;
  ui.turn.classList.toggle('enemy', enemy);
}

let toastTimer = 0;
function toast(text, bad = false, ms = 2800) {
  ui.toast.textContent = text;
  ui.toast.classList.toggle('bad', bad);
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), ms);
}

function dispatch(text, kind = '') {
  ui.dispatch.hidden = false;
  const li = document.createElement('li');
  li.textContent = text;
  if (kind) li.className = kind;
  ui.dispatch.prepend(li);
  while (ui.dispatch.children.length > 6) ui.dispatch.lastChild.remove();
}

function flashCell(sq, cls) {
  const el = cells[sq];
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), cls === 'lost' ? 3300 : 600);
}

// ---------- selecting & giving orders ----------
function select(id, quiet = false) {
  const u = units.get(id);
  if (!u || u.dead || u.color !== W) return;
  selectedId = id;
  clearOrder(true);
  povOn(u);
  showCard(u, squareOf(id));
  renderMap();
  if (!quiet) Sound.select();
}

function reselect() {
  revealMap(false);
  const u = units.get(selectedId);
  if (u && !u.dead) povOn(u, false);
  else selectKing();
}

function selectKing() {
  const k = game.board.find(p => p && p.c === W && p.t === 'k');
  if (k) select(k.id, true);
}

function cycleUnit(dir) {
  const own = [];
  game.board.forEach(p => { if (p && p.c === W) own.push(p.id); });
  if (!own.length) return;
  const i = own.indexOf(selectedId);
  select(own[(i + dir + own.length) % own.length]);
}

const REFUSE = {
  own: () => 'Our own troops already hold that ground.',
  pattern: u => `${u.info.name} cannot move like that. ${u.info.rule}`,
  blocked: () => 'The way is blocked — something stands in the path.',
  noenemy: () => 'Pawns only strike diagonally at an enemy — there is none there.',
  pawnblock: () => 'Pawns cannot attack straight ahead — that ground is held.',
  nocastle: () => 'The King cannot castle now.',
  exposed: () => 'Refused — that would leave the King exposed to attack.',
};

function onCell(sq) {
  Sound.unlock();
  if (phase === 'camp' || phase === 'menu') return;
  if (phase === 'over') { toast('The battle is over.'); return; }
  if (phase !== 'player') { toast('Hold — the armies are moving.'); return; }
  const p = game.board[sq];
  if (p && p.c === W) { select(p.id); return; }
  if (selectedId === null) { toast('Choose one of your units first.'); return; }
  if (order && order.to === sq) { commit(order); return; }
  const from = squareOf(selectedId);
  const res = explain(game, from, sq);
  const u = units.get(selectedId);
  if (!res.ok) {
    clearOrder(true);
    toast(REFUSE[res.why](u), true, 3600);
    flashCell(sq, 'no');
    ui.board.classList.remove('shake'); void ui.board.offsetWidth; ui.board.classList.add('shake');
    Sound.refuse();
    renderMap();
    return;
  }
  order = res.move;
  const c = squareCenter(sq);
  target3d.position.set(c.x, H(c.x, c.z) + 0.15, c.z);
  target3d.visible = true;
  cam.turnTo = yawToward(c.x - u.x, c.z - u.z);
  cam.pitch = -0.12;
  ui.orders.classList.remove('empty');
  ui.ordersText.textContent = `${u.info.name}: ${sqName(from)} → ${sqName(sq)}`;
  Sound.target();
  renderMap();
}

function clearOrder(silent = false) {
  order = null;
  target3d.visible = false;
  ui.orders.classList.add('empty');
  ui.ordersText.textContent = 'Pick a square to give orders';
  if (!silent) renderMap();
}

// ---------- marching ----------
function pathFor(m) {
  const a = squareCenter(m.from), b = squareCenter(m.to);
  const pts = [a];
  const df = (m.to & 7) - (m.from & 7), dr = (m.to >> 3) - (m.from >> 3);
  if (Math.abs(df) + Math.abs(dr) === 3 && df && dr) {        // knight: the long leg first
    const corner = Math.abs(dr) === 2 ? squareCenter(m.from + dr * 8) : squareCenter(m.from + df);
    pts.push(corner);
  }
  pts.push(b);
  return pts.map(p => new THREE.Vector2(p.x, p.z));
}

const BASE_SPEED = { p: 5, n: 8, b: 6.5, r: 4, q: 6, k: 5.5 };

/** Walk a unit along points; if `victim` is given, stop short and fight it first. */
function march(unit, pts, victim = null, rush = 1) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += pts[i].distanceTo(pts[i - 1]);
  const speed = Math.max(BASE_SPEED[unit.type], len / 5) * rush;
  return new Promise(resolve => marches.push({ unit, pts, seg: 1, speed, victim, fight: -1, resolve, token: battle }));
}

function updateMarches(dt) {
  for (let i = marches.length - 1; i >= 0; i--) {
    const m = marches[i], u = m.unit;
    if (m.fight >= 0) {                                  // holding while the battle plays out
      m.fight += dt;
      u.walking = Math.max(0, u.walking - dt * 3);
      u.speed = 0;
      if (Math.random() < dt * 6) dust.burst((u.x + m.victim.x) / 2, (u.z + m.victim.z) / 2, 6, 5);
      if (m.fight > 0.6) m.victim.kill();                // the defenders fight back briefly, then fall
      if (m.fight > 1.9) { m.fight = -2; u.attack = false; }
      continue;
    }
    const tgt = m.pts[m.seg];
    const dx = tgt.x - u.x, dz = tgt.y - u.z, d = Math.hypot(dx, dz);
    const last = m.seg === m.pts.length - 1;
    if (last && m.victim && m.fight === -1 && d < 6.5) {
      m.fight = 0;
      u.attack = true;
      m.victim.attack = true;
      m.victim.homeYaw = yawToward(u.x - m.victim.x, u.z - m.victim.z);   // turn to face the attackers
      m.victim.turnHome = true;
      const near = camera.position.distanceTo(_tmp.set(u.x, camera.position.y, u.z)) < cam.sight + 10;
      near ? Sound.clash() : Sound.farBattle();
      dust.burst(m.victim.x, m.victim.z, 50, 7);
      continue;
    }
    u.walking = Math.min(1, u.walking + dt * 3);
    u.speed = m.speed;
    u.yaw += angleDiff(u.yaw, yawToward(dx, dz)) * (1 - Math.exp(-dt * 7));
    const step = m.speed * dt;
    if (step >= d) {
      u.place(tgt.x, tgt.y, u.yaw);
      if (!last) { m.seg++; continue; }
      u.walking = 0; u.speed = 0;
      u.turnHome = true;
      marches.splice(i, 1);
      m.resolve();
    } else {
      u.place(u.x + (dx / d) * step, u.z + (dz / d) * step, u.yaw);
    }
  }
}

/** Play a move as a march (and a castling rook's march alongside). Rules state is already updated. */
async function playMove(m, mover, victim, rush = 1) {
  const jobs = [march(mover, pathFor(m), victim, rush)];
  if (m.castle) {
    const rf = m.castle === 'K' ? m.from + 3 : m.from - 4, rt = m.castle === 'K' ? m.from + 1 : m.from - 1;
    const rook = units.get(game.board[rt].id);
    jobs.push(march(rook, pathFor({ from: rf, to: rt }), null, rush));
  }
  Sound.marchStart();
  await Promise.all(jobs);
  Sound.marchStop();
  if (m.promo) promote(mover, m.to);
}

function promote(old, sq) {
  const p = game.board[sq];
  scene.remove(old.group);
  old.dispose();
  const u = spawn(p, sq);
  dust.burst(u.x, u.z, 40, 6);
  if (cam.follow === old) povOn(u, false);
}

// ---------- turns ----------
async function commit(m) {
  if (phase !== 'player') return;
  const token = battle;
  phase = 'moving';
  const mover = units.get(game.board[m.from].id);
  const victimPiece = m.capture >= 0 ? game.board[m.capture] : null;
  const victim = victimPiece ? units.get(victimPiece.id) : null;
  game = applyMove(game, m);
  history.push(positionKey(game));
  lastMove = m;
  clearOrder(true);
  renderMap();
  setTurn('Marching');
  Sound.horn();
  if (cam.follow !== mover) povOn(mover, false);
  lookOn();                                  // watch the march (March was a click or Enter)
  await playMove(m, mover, victim);
  if (token !== battle) return;
  showCard(units.get(selectedId) || mover, squareOf(selectedId));
  if (victimPiece) {
    dispatch(`Our ${mover.info.name} overran the enemy ${UNIT_INFO[victimPiece.t].name} at ${sqName(m.to)}!`);
    toast(`⚔ Enemy ${UNIT_INFO[victimPiece.t].name} destroyed at ${sqName(m.to)}`);
  } else if (m.castle) dispatch('The King castles behind the Rook.');
  else dispatch(`${mover.info.name} advances ${sqName(m.from)} → ${sqName(m.to)}.`);
  if (m.promo) dispatch('Our Pawn reached the far edge — promoted to Queen!');
  if (checkEnd()) return;
  enemyTurn();
}

// The enemy thinks in a worker; if that fails, on the main thread.
let worker = null, reqId = 0;
const pending = new Map();
function startWorker() {
  try {
    worker = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = e => { const job = pending.get(e.data.id); pending.delete(e.data.id); job?.resolve(e.data.move); };
    worker.onerror = e => {
      e.preventDefault?.();
      worker = null;
      for (const [id, job] of pending) { pending.delete(id); job.resolve(chooseMove(...job.args)); }
    };
  } catch { worker = null; }
}
startWorker();
function askEnemy(state, depth, noise, seen) {
  return new Promise(resolve => {
    if (!worker) { setTimeout(() => resolve(chooseMove(state, depth, noise, seen)), 30); return; }
    const id = ++reqId;
    pending.set(id, { resolve, args: [state, depth, noise, seen] });
    worker.postMessage({ id, state, depth, noise, seen });
  });
}

const LEVELS = { recruit: { depth: 1, noise: 90 }, captain: { depth: 2, noise: 25 }, warlord: { depth: 3, noise: 6 } };

async function enemyTurn() {
  const token = battle;
  phase = 'ai';
  setTurn('The enemy is moving', true);
  const started = performance.now();
  const { depth, noise } = LEVELS[level];
  const m = await askEnemy(game, depth, noise, history.slice(-12));
  const wait = 900 / TIMESCALE - (performance.now() - started);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  if (token !== battle || !m) return;
  const mover = units.get(game.board[m.from].id);
  const victimPiece = m.capture >= 0 ? game.board[m.capture] : null;
  const victim = victimPiece ? units.get(victimPiece.id) : null;
  game = applyMove(game, m);
  history.push(positionKey(game));
  // Moves far beyond the mist play out faster — no one is watching them.
  const seen = [m.from, m.to].some(sq => { const c = squareCenter(sq); return Math.hypot(c.x - camera.position.x, c.z - camera.position.z) < cam.sight; });
  Sound.distantHorn();
  await playMove(m, mover, victim, seen ? 1 : 2.5);
  if (token !== battle) return;
  if (victimPiece) {
    const name = UNIT_INFO[victimPiece.t].name;
    flashCell(m.capture, 'lost');
    toast(`⚠ Our ${name} at ${sqName(m.capture)} has been overrun!`, true, 3600);
    dispatch(`Our ${name} fell at ${sqName(m.capture)}.`, 'bad');
    if (victimPiece.id === selectedId) selectedId = null;
  } else {
    dispatch(seen ? `Enemy ${mover.info.name} on the move!` : 'Drums beyond the mist — the enemy has moved.', 'enemy');
  }
  renderMap();
  if (checkEnd()) return;
  if (selectedId === null) selectKing();
  if (inCheck(game, W)) {
    toast('👑 The King is under attack! Protect him.', true, 3600);
    dispatch('Messengers ride in: the King is threatened!', 'bad');
    Sound.alarm();
  }
  phase = 'player';
  setTurn('Your orders');
  showCard(units.get(selectedId), squareOf(selectedId));
}

function checkEnd() {
  let st = status(game);
  const key = positionKey(game);
  if (st === 'play' && history.filter(k => k === key).length >= 3) st = 'repetition';
  if (st === 'play') return false;
  finishBattle(st);
  return true;
}

/** End the battle: `st` is a status() result, 'repetition' or 'surrender'. */
function finishBattle(st) {
  phase = 'over';
  lookOff();
  syncLookUI();
  ui.turn.hidden = true;
  const won = st === 'checkmate' && game.turn === B;
  const lost = (st === 'checkmate' && game.turn === W) || st === 'surrender';
  const reasons = {
    checkmate: won ? 'The enemy King is surrounded with nowhere to run. The field is yours.' : 'Our King is trapped. The banners fall one by one.',
    stalemate: 'Stalemate — the side to move has no legal move, yet its King is safe. A draw.',
    fifty: 'Fifty moves without a clash or a pawn advance. The armies withdraw — a draw.',
    insufficient: 'Neither side has strength left to force a win. A draw.',
    repetition: 'The same position three times over — the generals call a truce. A draw.',
    surrender: 'You lowered the banners and yielded the field.',
  };
  $('endCrest').textContent = won ? '🏆' : lost ? '💀' : '🤝';
  $('endTitle').textContent = won ? 'Victory' : lost ? 'Defeat' : 'Draw';
  $('endReason').textContent = reasons[st] + ' The mist lifts…';
  won ? Sound.victory() : lost ? Sound.defeat() : Sound.horn();
  overviewOn();
  revealMap(true);
  setTimeout(() => { if (phase === 'over') { ui.dispatch.hidden = true; $('endCard').classList.add('show'); } }, 2600);   // the card takes the dispatches' corner
}

// ---------- modes ----------
function hideBattleHud() {
  for (const el of [ui.turn, ui.card, ui.field, ui.dispatch, ui.camp]) el.hidden = true;
}

function startBattle(lv) {
  $('hints').hidden = false;
  battle++;
  level = lv;
  phase = 'player';
  closeOverlays();
  $('startMenu').classList.remove('show');
  $('endCard').classList.remove('show');
  setupArmies();
  history = [positionKey(game)];
  lastMove = null;
  selectedId = null;
  revealed = false;
  ui.dispatch.innerHTML = '';
  hideBattleHud();
  ui.field.hidden = false;
  setTurn('Your orders');
  selectKing();
  dispatch('Morning mist hangs over the field. The enemy is out there somewhere.');
  dispatch('Move the mouse to look around. Space: field map · V: camera · Esc: pause.');
  Sound.horn();
  syncLookUI();
  lookOn();                                  // started from a click, so the pointer may lock
}

// review camp: every unit type of both sides lined up for inspection
let campUnits = [], campIndex = 0, campMist = false;
function startCamp() {
  lookOff();
  $('hints').hidden = false;
  battle++;
  phase = 'camp';
  game = null;
  closeOverlays();
  $('startMenu').classList.remove('show');
  clearUnits();
  hideBattleHud();
  ui.camp.hidden = false;
  campUnits = [];
  let id = 1000;
  for (const color of [W, B]) {
    'pnbrqk'.split('').forEach((t, i) => {
      const u = new Unit(t, color, i * 31 + (color === W ? 7 : 3));
      u.seed = i * 31 + (color === W ? 7 : 3);
      const c = squareCenter((color === W ? 2 : 5) * 8 + i + 1);       // ranks 3 and 6, files b–g
      u.place(c.x, c.z);
      u.homeYaw = u.yaw;
      u.pieceId = id++;
      scene.add(u.group);
      units.set(u.pieceId, u);
      campUnits.push(u);
    });
  }
  campIndex = 0;
  syncLookUI();
  $('animAll').checked = false;
  campFocus();
}
function campFocus(view = 'orbit') {
  const u = campUnits[campIndex];
  if (view === 'pov') povOn(u);
  else { orbitOn(u.x, u.z, 15, -0.28, 0.12, u); cam.yaw = u.yaw + 0.7; cam.wantSight = campMist ? u.info.sight : 420; }
  $('campName').textContent = `${u.info.name}`;
  $('campSub').textContent = `${TEAMS[u.color].name} · eye ${u.info.eye} m · sight ${u.info.sight} m`;
  $('campView').textContent = view === 'pov' ? '🔄 Orbit view' : '👁 Unit view';
  showCard(u, -1);
  syncAnimButtons();
}
function campStep(d) { campIndex = (campIndex + d + campUnits.length) % campUnits.length; campFocus(riding() ? 'pov' : 'orbit'); Sound.select(); }

// animation debug: drive the walk, attack and death of the focused unit (or every unit) in place
const animTargets = () => ($('animAll').checked ? campUnits : [campUnits[campIndex]]).filter(u => !u.dead);
function syncAnimButtons() {
  const u = campUnits[campIndex];
  $('animWalk').classList.toggle('on', u.walking > 0.5);
  $('animAttack').classList.toggle('on', !!u.attack);
}
function animWalk() {
  const on = !(campUnits[campIndex].walking > 0.5);
  for (const u of animTargets()) { u.walking = on ? 1 : 0; u.speed = on ? 3 : 0; }
  syncAnimButtons();
}
function animAttack() {
  const on = !campUnits[campIndex].attack;
  for (const u of animTargets()) u.attack = on;
  if (on) Sound.clash();
  syncAnimButtons();
}
function animDie() {
  for (const u of animTargets()) { u.kill(); dust.burst(u.x, u.z, 40, 6); }
  Sound.farBattle();
}
/** A camp unit finished dying: stand a fresh one up in its place. */
function campRespawn(old) {
  const i = campUnits.indexOf(old);
  if (i < 0) return;
  const u = new Unit(old.type, old.color, old.seed);
  u.seed = old.seed;
  u.place(old.x, old.z, old.homeYaw);
  u.homeYaw = old.homeYaw;
  u.pieceId = old.pieceId + 100;
  scene.add(u.group);
  units.set(u.pieceId, u);
  campUnits[i] = u;
  if (i === campIndex) { riding() ? povOn(u, false) : (cam.follow = u); syncAnimButtons(); }
}

function toMenu() {
  lookOff();
  $('hints').hidden = true;
  battle++;
  phase = 'menu';
  closeOverlays();
  $('endCard').classList.remove('show');
  hideBattleHud();
  setupArmies();
  selectedId = null;
  overviewOn();
  cam.mode = 'orbit';
  cam.dist = 100; cam.pitch = -0.3; cam.wantSight = 420;
  $('startMenu').classList.add('show');
  syncLookUI();
}

function closeOverlays() { for (const id of ['rulesModal', 'surrenderModal', 'settingsModal']) $(id).classList.remove('show'); }
function closeModal(id) {
  $(id).classList.remove('show');
  if (paused) $('resumeBtn').focus();
}
function openModal(id) {
  if (id === 'settingsModal') syncSettingsForm();
  $(id).classList.add('show');
}

// ---------- pause (Esc) ----------
// In battle the pause freezes everything: marches, fights and the enemy's move wait for Resume.
function openPause() {
  if (phase === 'menu' || paused) return;
  paused = true;
  if (looking) lookOff();
  Sound.setPaused(true);
  const battle = inBattle();
  $('pauseSurrender').hidden = !battle;
  $('pauseMenu').hidden = battle;
  $('pauseSub').textContent = battle ? 'The armies hold their ground.' : phase === 'camp' ? 'The camp is quiet.' : 'The battle is over.';
  syncSoundLabel();
  $('pauseModal').classList.add('show');
  $('resumeBtn').focus();
}
function resume() {
  if (!paused) return;
  closeOverlays();
  $('pauseModal').classList.remove('show');
  paused = false;
  Sound.setPaused(false);
  lookOn();                                          // Resume is a click or a key: allowed to lock
}
function syncSoundLabel() { $('pauseSound').textContent = Sound.muted ? '🔇 Sound: off' : '🔊 Sound: on'; }

/** Yield: the battle ends as a defeat, the mist lifts and the end card offers a rematch. */
function surrender() {
  closeOverlays();
  $('pauseModal').classList.remove('show');
  if (paused) { paused = false; Sound.setPaused(false); }
  if (phase !== 'player' && phase !== 'moving' && phase !== 'ai') return;
  battle++;                               // in-flight marches and the enemy's reply are abandoned
  Sound.marchStop();
  clearOrder(true);
  dispatch('Our banners are lowered. The battle is over.', 'bad');
  finishBattle('surrender');
}
function toggleSound() { Sound.toggle(); syncSoundLabel(); }

// ---------- wiring ----------
document.querySelectorAll('[data-level]').forEach(b => b.addEventListener('click', () => { Sound.unlock(); startBattle(b.dataset.level); }));
$('campBtn').addEventListener('click', () => { Sound.unlock(); startCamp(); });
$('startRules').addEventListener('click', () => $('rulesModal').classList.add('show'));
$('rulesClose').addEventListener('click', () => closeModal('rulesModal'));
$('rulesOk').addEventListener('click', () => closeModal('rulesModal'));
for (const id of ['settingsClose', 'settingsDone']) $(id).addEventListener('click', () => closeModal('settingsModal'));
$('hintV').addEventListener('click', toggleCamera);
$('hintSpace').addEventListener('click', toggleLook);
$('hintEsc').addEventListener('click', openPause);
$('resumeBtn').addEventListener('click', resume);
$('pauseSettings').addEventListener('click', () => openModal('settingsModal'));
$('pauseRules').addEventListener('click', () => openModal('rulesModal'));
$('pauseSound').addEventListener('click', toggleSound);
$('pauseSurrender').addEventListener('click', () => { openModal('surrenderModal'); $('keepFighting').focus(); });
$('pauseMenu').addEventListener('click', () => { paused = false; Sound.setPaused(false); $('pauseModal').classList.remove('show'); toMenu(); });
$('setFx').addEventListener('change', e => setSetting('fx', e.target.checked));
$('setCard').addEventListener('change', e => setSetting('card', e.target.checked));
$('setLog').addEventListener('change', e => setSetting('log', e.target.checked));
for (const [k, id] of [['sfx', 'setSfx'], ['amb', 'setAmb']]) {
  $(id).addEventListener('input', e => { setSetting(k, e.target.value / 100); $(id + 'Val').textContent = e.target.value + '%'; });
  $(id).addEventListener('change', () => { if (k === 'sfx') Sound.select(); });
}
document.querySelectorAll('input[name=pov]').forEach(r => r.addEventListener('change', () => setSetting('pov', r.value)));
applySettings();
$('marchBtn').addEventListener('click', () => order && commit(order));
$('cancelBtn').addEventListener('click', () => clearOrder());
$('againBtn').addEventListener('click', () => startBattle(level));
$('endMenuBtn').addEventListener('click', toMenu);
$('keepFighting').addEventListener('click', () => closeModal('surrenderModal'));
$('surrenderClose').addEventListener('click', () => closeModal('surrenderModal'));
$('confirmSurrender').addEventListener('click', surrender);
$('campPrev').addEventListener('click', () => campStep(-1));
$('campNext').addEventListener('click', () => campStep(1));
$('campView').addEventListener('click', () => campFocus(riding() ? 'orbit' : 'pov'));
$('animWalk').addEventListener('click', animWalk);
$('animAttack').addEventListener('click', animAttack);
$('animDie').addEventListener('click', animDie);
$('campMist').addEventListener('click', () => {
  campMist = !campMist;
  $('campMist').textContent = `🌫 Mist: ${campMist ? 'on' : 'off'}`;
  if (!riding()) cam.wantSight = campMist ? campUnits[campIndex].info.sight : 420;
});

// ---------- frame loop ----------
let last = performance.now(), time = 0;
function frame(now) {
  const real = Math.min(0.05, (now - last) / 1000) * TIMESCALE;
  const dt = paused && inBattle() ? 0 : real;
  last = now;
  time += dt;
  keyLook(real);
  updateMarches(dt);
  setViewer(camera.position, cam.sight);
  for (const [id, u] of units) {
    if (u.turnHome && !u.walking) {
      const d = angleDiff(u.yaw, u.homeYaw);
      u.yaw += d * (1 - Math.exp(-dt * 3));
      if (Math.abs(d) < 0.01) u.turnHome = false;
    }
    u.hideEye = cam.mode === 'eye' && cam.follow === u;
    u.update(dt, time);
    if (u.gone) {
      scene.remove(u.group); u.dispose(); units.delete(id);
      if (cam.follow === u) cam.follow = null;
      if (phase === 'camp') setTimeout(() => { if (phase === 'camp') campRespawn(u); }, 600);
    }
  }
  const sel = phase === 'camp' ? campUnits[campIndex] : units.get(selectedId);
  selRing.visible = !!sel && !sel.dead && cam.mode !== 'overview' && phase !== 'menu';
  if (selRing.visible) selRing.position.set(sel.x, H(sel.x, sel.z) + 0.12, sel.z);
  if (target3d.visible) { const s = 1 + Math.sin(time * 4) * 0.05; ring.scale.set(s, 1, s); }
  dust.update(dt);
  updateCamera(real);
  world.update(time);
  if (settings.fx) post.render(); else renderer.render(scene, camera);
  updateEye();
  requestAnimationFrame(frame);
}

setupArmies();
overviewOn();
cam.mode = 'orbit'; cam.dist = 100; cam.pitch = -0.3; cam.wantSight = 420; cam.sight = 420;
cam.pivot.copy(cam.want);
requestAnimationFrame(frame);
window.__booted = true;
if (DEBUG) Object.assign(window, { __wc: { get game() { return game; }, get units() { return units; }, cam, get phase() { return phase; }, select, onCell, commit, legalMoves } });
