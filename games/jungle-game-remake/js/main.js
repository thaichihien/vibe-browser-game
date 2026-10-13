/* Cờ Thú: Rừng Xanh — boot, frame loop, picking and the input lock. Rules state changes at
   once in rules.js; anim.js replays the event list while input is locked. */
import * as THREE from 'three';
import { shared } from './mesh.js';
import { createPixelRenderer } from './pixel.js';
import { buildWorld, createCamera, fitCamera, aimCamera, VIEW, WATER_Y } from './scene.js';
import { createDebugPanel } from './debug.js';
import { addBoardProps } from './board-props.js';
import { buildScenery } from './scenery.js';
import { createViews, makePortraits } from './views.js';
import { createAnimator } from './anim.js';
import { updateTweens, createParticles, shakeOffset } from './fx.js';
import { createGame, terrain, inBounds } from './rules.js';
import { worldToCell, resolvePick } from './layout.js';
import { Sound } from './audio.js';
import { createHud } from './hud.js';

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

const hud = createHud({
  onRestart: () => restart(),
  onSoundToggle: () => { Sound.toggle(); hud.setSound(Sound.muted); },
});
hud.setSound(Sound.muted);
hud.setTurn('red');
hud.setPortraits(makePortraits(pixel));

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
  const water = cellAt(waterPlane);
  return resolvePick(cellAt(groundPlane), water, !!water && terrain[water.row][water.col] === 'water');
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
  await animator.play(events);
  busy = false;
  if (pendingRestart) { pendingRestart = false; restart(); }
}

function onCell(cell) {
  if (busy || game.gameOver || !cell) return;
  Sound.ensure();
  const { row, col } = cell;
  const piece = game.pieceAt(row, col);
  const legal = selected && game.getValidMoves(selected).some(m => m.row === row && m.col === col);

  if (piece && piece.player !== game.currentPlayer) {
    if (!selected) return;
    if (legal) doMove(selected, row, col);
    else hud.toast('Nước đi không hợp lệ', 'error');
    return;
  }
  if (piece) {
    if (selected === piece) { select(null); return; }
    select(piece);
    Sound.select();
    return;
  }
  if (legal) doMove(selected, row, col);
}

canvas.addEventListener('click', e => onCell(cellFromEvent(e)));
canvas.addEventListener('pointermove', e => {
  if (busy || game.gameOver || e.pointerType === 'touch') return;
  animator.setHover(cellFromEvent(e), game);
});
canvas.addEventListener('pointerleave', () => animator.setHover(null, game));

// ---------- restart ----------
async function restart() {
  if (busy) { pendingRestart = true; return; }
  busy = true;
  select(null);
  animator.reset();
  game.restart();
  hud.hideWin();
  hud.setTurn('red');
  hud.toast('Bàn cờ đã được đặt lại 🌿', 'info');
  await animator.spawnAll(game.pieces);
  busy = false;
  if (pendingRestart) { pendingRestart = false; restart(); }
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

busy = true;
animator.spawnAll(game.pieces).then(() => {
  busy = false;
  if (pendingRestart) { pendingRestart = false; restart(); }
});
window.__booted = true;
