import * as THREE from 'three';
import { createPixel } from './pixel.js';
import { buildStall, makeCamera, syncStall, anchors as makeAnchors } from './stall.js';
import { createHud } from './hud.js';
import { Sound } from './audio.js';
import * as G from './game.js';
import { LOOK } from './look.js';
import { setBands } from './models.js';

const $ = id => document.getElementById(id);
const canvas = $('view');
const stage = $('stage');

let pixel;
try { pixel = createPixel(canvas); } catch (e) { console.error(e); window.__bootFail('webgl'); throw e; }
const scene = new THREE.Scene();
const camera = makeCamera();
const stall = buildStall(scene);
const hud = createHud();

/* ------------------------------------------------------------------ progress */

const PROGRESS_KEY = 'huTieu.progress';
function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(PROGRESS_KEY));
    if (p && Array.isArray(p.stars)) return p;
  } catch { /* fall through */ }
  return { stars: [], best: [] };
}
const saveProgress = () => { try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch { /* private mode */ } };
const progress = loadProgress();
const unlockedUpTo = () => Math.min(G.LEVELS.length - 1, progress.stars.filter(s => s > 0).length);

/* ------------------------------------------------------------------ sizing & projection */

let rect = stage.getBoundingClientRect();
function resize() {
  rect = stage.getBoundingClientRect();
  pixel.resize(rect.width, rect.height);
  const cw = pixel.size.w * pixel.size.scale, ch = pixel.size.h * pixel.size.scale;
  camera.fit(cw, ch);
}
new ResizeObserver(resize).observe(stage);
resize();

const tmp = new THREE.Vector3();
/** World → stage CSS pixels (the canvas is centred in the stage). */
function project(v) {
  tmp.copy(v).project(camera);
  const cw = pixel.size.w * pixel.size.scale, ch = pixel.size.h * pixel.size.scale;
  const ox = (rect.width - cw) / 2, oy = (rect.height - ch) / 2;
  return { x: ox + (tmp.x + 1) / 2 * cw, y: oy + (1 - tmp.y) / 2 * ch };
}

/* ------------------------------------------------------------------ input */

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(stall.hits.filter(h => h.visible), true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.hit) o = o.parent;
    if (o && o.visible) return o;
  }
  return null;
}

const LABELS = {
  broth: 'Nồi nước lèo', sauce: 'Sốt trộn khô', tea: 'Bình trà đá', trash: 'Thùng rác',
  chop: 'Thớt — cắt hành lá', 'extra:hanh': 'Hành lá đã cắt', 'extra:gia': 'Rổ giá',
  'extra:tieu': 'Lọ tiêu', 'extra:ot': 'Chén ớt',
  'noodle:hu': 'Hủ tiếu', 'noodle:mi': 'Mì trứng',
};
function labelFor(hit) {
  if (LABELS[hit]) return LABELS[hit];
  const [kind, arg] = hit.split(':');
  if (kind === 'top') return G.TOPPINGS[arg].name;
  if (kind === 'basket') return 'Vợt trụng';
  if (kind === 'bowl') return 'Tô';
  if (kind === 'glass') return 'Ly trà đá';
  if (kind === 'coin') return 'Thu tiền';
  return '';
}

let game = null;
let paused = true;
let hovered = null;

function act(hit) {
  const [kind, arg] = hit.split(':');
  const i = Number(arg);
  switch (kind) {
    case 'noodle': return G.tapNoodleTray(game, arg);
    case 'basket': return G.tapBasket(game, i);
    case 'broth': return G.tapBroth(game);
    case 'sauce': return G.tapSauce(game);
    case 'top': return G.tapTopping(game, arg);
    case 'bowl': return G.tapBowl(game, i);
    case 'trash': return G.tapTrash(game);
    case 'tea': return G.tapTeaJug(game);
    case 'glass': return G.tapGlass(game, i);
    case 'coin': return G.collect(game, i);
    case 'chop': return G.tapChop(game);
    case 'extra': return G.tapExtra(game, arg);
  }
  return false;
}

canvas.addEventListener('pointerdown', e => {
  if (!game || paused || game.over) return;
  Sound.unlock();
  const o = pick(e);
  if (o) act(o.userData.hit);
});
canvas.addEventListener('pointermove', e => {
  if (!game || paused || e.pointerType === 'touch') { hovered = null; return; }
  hovered = pick(e);
  canvas.style.cursor = hovered ? 'pointer' : 'default';
  const r = stage.getBoundingClientRect();
  hud.setHover(hovered ? labelFor(hovered.userData.hit) : null, e.clientX - r.left, e.clientY - r.top);
});
canvas.addEventListener('pointerleave', () => { hovered = null; hud.setHover(null); });

/* ------------------------------------------------------------------ events → sound & text */

function drainEvents() {
  const A = makeAnchors(stall, game);
  for (const ev of game.events) {
    switch (ev.type) {
      case 'noodleReady': Sound.play('ready'); break;
      case 'noodleMushy': Sound.play('mushy'); hud.float('Nhũn rồi!', project(A.basket(ev.basket)), 'bad'); break;
      case 'teaReady': Sound.play('click'); break;
      case 'nope':
        Sound.play('nope');
        if (ev.why === 'noHanh') hud.float('Cắt hành trước!', project(A.hanh()), 'bad');
        break;
      case 'paid':
        if (ev.tip) hud.float(`Tip ${G.formatVnd(ev.tip)}`, project(A.head(ev.seat)), 'tip');
        break;
      case 'cash': Sound.play('cash'); hud.float(`+${G.formatVnd(ev.amount)}`, project(A.coin(ev.seat)), 'cash'); break;
      case 'angry': Sound.play('angry'); hud.float('Lâu quá!', project(A.head(ev.seat)), 'bad'); break;
      case 'dayOver': endDay(); break;
      default: Sound.play(ev.type);
    }
  }
  game.events.length = 0;
}

/* ------------------------------------------------------------------ screens */

const show = (id, on = true) => $(id).classList.toggle('show', on);

function renderLevels() {
  const max = unlockedUpTo();
  $('levels').innerHTML = G.LEVELS.map((lv, i) => {
    const st = progress.stars[i] || 0;
    const locked = i > max;
    return `<button class="lvl${locked ? ' locked' : ''}" data-level="${i}" ${locked ? 'disabled' : ''}>
      <b>${locked ? '🔒' : i + 1}</b><span>${'★'.repeat(st)}${'☆'.repeat(3 - st)}</span></button>`;
  }).join('');
}

function openMenu() {
  paused = true;
  renderLevels();
  show('menu');
  show('result', false);
  show('intro', false);
  $('menuClose').hidden = !game || game.over;
}

function startDay(i) {
  hud.clear();
  game = G.newGame(i);
  hud.dayIntro(i, game.targets);
  $('dayBadge').textContent = `Ngày ${i + 1}`;
  show('menu', false);
  show('result', false);
  show('intro');
  paused = true;
}

function endDay() {
  paused = true;
  const s = game;
  const stars = G.starsFor(s);
  const i = s.levelIdx;
  if (stars > (progress.stars[i] || 0)) progress.stars[i] = stars;
  progress.best[i] = Math.max(progress.best[i] || 0, s.money);
  saveProgress();
  $('resStars').innerHTML = [0, 1, 2].map(k => `<span class="${k < stars ? 'on' : ''}" style="animation-delay:${0.3 + k * 0.35}s">★</span>`).join('');
  $('resTitle').textContent = stars ? (stars === 3 ? 'Quán đắt khách!' : 'Hết ngày rồi!') : 'Chưa đạt mục tiêu…';
  $('resMoney').textContent = G.formatVnd(s.money);
  $('resDetail').innerHTML =
    `<li>Khách vui lòng <b>${s.served}</b></li><li>Khách bỏ về <b>${s.lost}</b></li>` +
    `<li>Tiền tip <b>${G.formatVnd(s.tips)}</b></li><li>Đồ bỏ phí <b>${s.wasted}</b></li>`;
  const hasNext = stars > 0 && i + 1 < G.LEVELS.length;
  $('nextBtn').hidden = !hasNext;
  $('resNote').textContent = stars ? (i + 1 === G.LEVELS.length ? '🎉 Bạn đã hoàn thành cả 10 ngày bán hủ tiếu!' : '') : `Cần ${G.formatVnd(s.targets[0])} để qua ngày.`;
  show('result');
  Sound.play(stars ? 'win' : 'lose');
  if (stars) [0, 1, 2].slice(0, stars).forEach(k => setTimeout(() => Sound.play('star'), 300 + k * 350));
}

$('levels').addEventListener('click', e => {
  const b = e.target.closest('[data-level]');
  if (!b || b.disabled) return;
  Sound.unlock();
  Sound.startMusic();
  startDay(Number(b.dataset.level));
});
$('introGo').addEventListener('click', () => { show('intro', false); paused = false; Sound.play('arrive'); });
$('menuBtn').addEventListener('click', openMenu);
$('menuClose').addEventListener('click', () => { show('menu', false); paused = false; });
$('retryBtn').addEventListener('click', () => startDay(game.levelIdx));
$('nextBtn').addEventListener('click', () => startDay(game.levelIdx + 1));
$('resMenuBtn').addEventListener('click', openMenu);
$('rulesBtn').addEventListener('click', () => { if (game && !game.over) paused = true; show('rules'); });
$('menuRules').addEventListener('click', () => show('rules'));
$('rulesOk').addEventListener('click', () => {
  show('rules', false);
  if (game && !game.over && !$('menu').classList.contains('show') && !$('intro').classList.contains('show')) paused = false;
});
const soundBtn = $('soundBtn');
const paintSound = () => { soundBtn.textContent = Sound.muted ? '🔇' : '🔊'; };
soundBtn.addEventListener('click', () => {
  Sound.toggle();
  paintSound();
  if (!Sound.muted) Sound.startMusic();
});
paintSound();
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && game && !game.over) {
    if ($('menu').classList.contains('show')) { show('menu', false); paused = false; } else openMenu();
  }
});

/* ------------------------------------------------------------------ loop */

// an idle scene for the menu: a quiet day-1 stall with no customers
const idle = G.newGame(0);
idle.queue = [];

let last = performance.now();
let clock = 0;
function advance(dt) {
  clock += dt;
  stall.lights.hemi.intensity = LOOK.sky;
  stall.lights.sun.intensity = LOOK.sun;
  const s = game || idle;
  if (game && !paused) {
    G.step(game, dt);
    drainEvents();
  }
  syncStall(stall, s, paused ? 0 : dt, clock, hovered && !paused ? hovered : null);
  if (paused) stall.steam.update(dt);
  pixel.render(scene, camera);
  hud.update(s, project, makeAnchors(stall, s));
}
function frame(now) {
  advance(Math.min(0.05, (now - last) / 1000));
  last = now;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

openMenu();
$('boot').remove();

setBands(LOOK.bands);

// ?debug: drive the game by hand (a hidden tab gets no animation frames), and tune the look
if (new URLSearchParams(location.search).has('debug')) {
  import('./debug.js').then(({ createLookPanel }) => createLookPanel(path => {
    if (path === '*' || path.startsWith('bands')) setBands(LOOK.bands);
    if (path === '*' || path === 'pixelRows') resize();
  }));
  window.__hu = {
    G, get game() { return game; },
    start(i) { startDay(i); show('intro', false); paused = false; },
    tick(sec) { for (let t = 0; t < sec; t += 1 / 30) advance(1 / 30); },
    tap(hit) { act(hit); advance(1 / 30); },
  };
}
