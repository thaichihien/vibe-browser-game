/* Cờ Thú: Rừng Xanh — boot, frame loop, picking, the input lock and the AI opponent. Rules
   state changes at once in rules.js; anim.js replays the event list while input is locked. */
import * as THREE from 'three';
import { shared } from './mesh.js';
import { createPixelRenderer } from './renderer.js';
import { buildWorld, createCamera, fitCamera, aimCamera, VIEW, WATER_Y } from './scene.js';
import { createDebugPanel } from './debug.js';
import { addBoardProps } from './board-props.js';
import { buildScenery } from './scenery.js';
import { createViews } from './views.js';
import { createAnimator } from './anim.js';
import { updateTweens, createParticles, shakeOffset } from './fx.js';
import { createGame, terrain, inBounds, SIDE_NAME, other } from './rules.js';
import { worldToCell, resolvePick } from './layout.js';
import { Sound } from './audio.js';
import { createHud } from './hud.js';
import { chooseMove, positionKey } from './ai.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('view');

let pixel;
try {
  pixel = createPixelRenderer(canvas);
} catch (err) {
  window.__bootFail('webgl');
  throw err;
}

const scene = new THREE.Scene();
const camera = createCamera();
const world = buildWorld(scene);
addBoardProps(world);
const scenery = buildScenery(scene);
const particles = createParticles(scene);
const camRig = { offset: new THREE.Vector3(), zoom: 1 };

const getPixel = () => ({ ppu: (camera.top - camera.bottom) / camera.zoom / pixel.size.h });
const views = createViews({ scene, camera, world, getPixel });
const game = createGame();

let busy = false;
let pendingRestart = false;
let selected = null;

// ---------- game mode: 2 players, or the computer plays red at one of three levels ----------
// The human always has blue, the side nearest the camera; who moves first is drawn each game.
const AI_SIDE = 'red';
const MODES = ['pvp', 'easy', 'normal', 'hard'];
const MODE_KEY = 'coThu.mode';
let mode = (() => { try { return localStorage.getItem(MODE_KEY); } catch { return null; } })();
if (!MODES.includes(mode)) mode = 'pvp';
let history = [];        // positionKey of every position this game, so the AI avoids repeating

const hud = createHud({
  onRestart: () => restart(),
  onPlayAgain: () => { hud.hideWin(); hud.showStart(mode, false); },
  onSoundToggle: () => { Sound.toggle(); hud.setSound(Sound.muted); },
  onMusicVolume: v => Sound.setMusicVolume(v),
  onSfxVolume: (v, done) => { Sound.setSfxVolume(v); if (done) Sound.select(); },
  onModeButton: () => hud.showStart(mode, true),
  onStart: m => startGame(m),
});
hud.setSound(Sound.muted);
hud.setVolumes(Sound.musicVolume, Sound.sfxVolume);
hud.setTurn('red');
hud.setMode(mode, AI_SIDE);

const animator = createAnimator({ scene, camera, world, views, particles, sound: Sound, hud, camRig });

pixel.setScaleOverride(VIEW.pixel ?? null);

function resize() {
  const r = stage.getBoundingClientRect();
  const s = pixel.resize(r.width, r.height);
  fitCamera(camera, s.w, s.h);
}
new ResizeObserver(resize).observe(stage);
resize();

// ---------- picking ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_Y);
const hitPt = new THREE.Vector3();

function cellAt(plane) {
  if (!ray.ray.intersectPlane(plane, hitPt)) return null;
  const cell = worldToCell(hitPt.x, hitPt.z);
  return inBounds(cell.row, cell.col) ? cell : null;
}

function cellFromEvent(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(views.hitboxes(), false);
  if (hits.length) {
    const p = game.pieces.find(q => q.id === hits[0].object.userData.pieceId);
    if (p) return { row: p.row, col: p.col };
  }
  const ground = cellAt(groundPlane);
  const water = cellAt(waterPlane);
  const isWater = cell => !!cell && terrain[cell.row][cell.col] === 'water';
  return resolvePick(ground, isWater(ground), water, isWater(water));
}

// ---------- input: the original handlePieceClick / handleCellClick semantics ----------
function select(piece) {
  selected = piece;
  hud.setCurrent(game.currentPlayer, piece);
  views.setSelected(piece ? piece.id : null);
  if (piece) animator.showMoves(game.getValidMoves(piece));
  else animator.clearMoves();
}

async function doMove(piece, row, col) {
  select(null);
  animator.setHover(null, game);
  busy = true;
  const events = game.applyMove(piece, row, col);
  history.push(positionKey(game.pieces, game.currentPlayer));
  await animator.play(events);
  hud.setCounts(game.pieces);
  if (game.gameOver) Sound.setScene('menu');
  else if (mode !== 'pvp' && piece.player === AI_SIDE) Sound.turn();   // your move again
  busy = false;
  if (pendingRestart) { pendingRestart = false; restart(); }
  else aiMove();
}

// ---------- the AI opponent ----------
const aiTurn = () => mode !== 'pvp' && !game.gameOver && game.currentPlayer === AI_SIDE;
const sleep = ms => new Promise(res => setTimeout(res, ms));

// The search runs in a module worker so Hard's full think time does not freeze the scene. If
// the worker cannot start (or dies), the same search runs here instead, a frame later, with
// Hard's budget cut so the stall it causes stays short.
const think = (() => {
  let worker = null, seq = 0;
  const waiting = new Map();
  const local = req => sleep(16).then(() =>
    chooseMove(req.pieces, req.player, req.level, { history: req.history, timeMs: 600 }));
  try {
    worker = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => { waiting.get(data.id)?.resolve(data.move); waiting.delete(data.id); };
    worker.onerror = e => {
      e.preventDefault?.();
      worker.terminate();
      worker = null;
      for (const { req, resolve } of waiting.values()) local(req).then(resolve);
      waiting.clear();
    };
  } catch { worker = null; }
  return req => {
    if (!worker) return local(req);
    return new Promise(resolve => {
      const id = ++seq;
      waiting.set(id, { req, resolve });
      worker.postMessage({ id, ...req });
    });
  };
})();

async function aiMove() {
  if (busy || !aiTurn()) return;
  busy = true;
  const started = performance.now();
  const move = await think({
    pieces: game.pieces.map(({ type, player, row, col }) => ({ type, player, row, col })),
    player: AI_SIDE, level: mode, history,
  });
  await sleep(Math.max(0, 550 - (performance.now() - started)));   // never answer instantly
  busy = false;
  if (pendingRestart) { pendingRestart = false; restart(); return; }
  if (!aiTurn()) return;

  const piece = move && game.pieceAt(move.from.row, move.from.col);
  if (!piece) {
    // no legal move: the rules have no draw, so the side that cannot move loses
    game.gameOver = true;
    game.winner = other(AI_SIDE);
    hud.showWin(game.winner, `${SIDE_NAME[AI_SIDE]} không còn nước đi!`);
    Sound.win(game.winner);
    Sound.setScene('menu');
    return;
  }
  // show the pick for a moment, the way a player's selection looks, then move
  busy = true;
  select(piece);
  Sound.select();
  Sound.voice(piece.type, 0.5);
  await sleep(380);
  busy = false;
  if (pendingRestart) { pendingRestart = false; select(null); restart(); return; }
  doMove(piece, move.to.row, move.to.col);
}

/** A pick on the start screen: remember the mode and deal a new game in it. */
function startGame(next) {
  if (!MODES.includes(next)) return;
  mode = next;
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* storage blocked: session-only */ }
  hud.setMode(mode, AI_SIDE);
  Sound.setAiSide(mode === 'pvp' ? null : AI_SIDE);
  Sound.ensure();
  Sound.setScene('game');
  restart();
}

function onCell(cell) {
  if (busy || game.gameOver || aiTurn() || !cell) return;
  Sound.ensure();
  const { row, col } = cell;
  const piece = game.pieceAt(row, col);
  const legal = selected && game.getValidMoves(selected).some(m => m.row === row && m.col === col);

  if (piece && piece.player !== game.currentPlayer) {
    if (!selected) return;
    if (legal) doMove(selected, row, col);
    else { hud.toast('Nước đi không hợp lệ', 'error'); Sound.error(); }
    return;
  }
  if (piece) {
    if (selected === piece) { select(null); return; }
    select(piece);
    Sound.select();
    Sound.voice(piece.type, 0.5);
    return;
  }
  if (legal) doMove(selected, row, col);
}

canvas.addEventListener('click', e => onCell(cellFromEvent(e)));
canvas.addEventListener('pointermove', e => {
  if (busy || game.gameOver || aiTurn() || e.pointerType === 'touch') return;
  animator.setHover(cellFromEvent(e), game);
});
canvas.addEventListener('pointerleave', () => animator.setHover(null, game));

// ---------- restart ----------
async function restart() {
  if (busy) { pendingRestart = true; return; }
  busy = true;
  select(null);
  animator.reset();
  const first = Math.random() < 0.5 ? 'red' : 'blue';
  game.restart(first);
  history = [positionKey(game.pieces, game.currentPlayer)];
  views.setActive(first);
  hud.hideWin();
  hud.setTurn(first);
  hud.setCounts(game.pieces);
  hud.toast(mode === 'pvp' ? `🎲 ${first === 'red' ? '🔴 ĐỎ' : '🔵 XANH'} đi trước!`
    : first === AI_SIDE ? '🎲 Máy đi trước!' : '🎲 Bạn đi trước!', 'info');
  Sound.dice();
  Sound.setScene('game');
  await animator.spawnAll(game.pieces);
  busy = false;
  if (pendingRestart) { pendingRestart = false; restart(); }
  else aiMove();
}

// ---------- frame loop ----------
// camera axes; refreshed whenever the debug panel turns the view
const right = new THREE.Vector3(), up = new THREE.Vector3(), forward = new THREE.Vector3();
function readAxes() {
  right.set(1, 0, 0).applyQuaternion(camera.quaternion);
  up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
}
readAxes();

createDebugPanel({
  view: VIEW,
  onChange(scale) {
    aimCamera(camera, VIEW);
    readAxes();
    pixel.setScaleOverride(scale);
    resize();
  },
});

function placeCamera(dt) {
  const { ppu } = getPixel();
  // keep the push-in offset and the shake on whole low-res pixels so the frame stays crisp
  const o = camRig.offset;
  const ox = Math.round(o.dot(right) / ppu) * ppu, oy = Math.round(o.dot(up) / ppu) * ppu;
  const [sx, sy] = shakeOffset(dt);
  camera.position.copy(camera.userData.base)
    .addScaledVector(right, ox + sx * ppu)
    .addScaledVector(up, oy + sy * ppu)
    .addScaledVector(forward, o.dot(forward));
  if (camera.zoom !== camRig.zoom) { camera.zoom = camRig.zoom; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  shared.uTime.value = t;
  updateTweens(dt * 1000);
  particles.update(dt);
  placeCamera(dt);
  views.update(dt, t);
  animator.update(t);
  scenery.update(dt, t);
  pixel.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// The board waits empty behind the start screen; picking a mode deals the pieces.
hud.showStart(mode, false);
window.__booted = true;
