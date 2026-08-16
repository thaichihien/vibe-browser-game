/* Boot, input and the DOM around the canvas. */

import { createGame } from './game.js';
import { fitCanvas, BOARD_SIDE } from './render.js';
import { Sound } from './audio.js';
import { Music } from './music.js';
import { EVENTS, FIRST_EVENT } from './events/index.js';
import { FIRST_EVENT_AT } from './config.js';

const $ = sel => document.querySelector(sel);

const canvas   = $('#board');
const hudTime  = $('#hud-time');
const hudBest  = $('#hud-best');
const chips    = $('#chips');
const banner   = $('#banner');
const overlay  = $('#overlay');
const btnMute  = $('#btn-mute');
const btnMusic = $('#btn-music');
const btnRules = $('#btn-rules');
const rules    = $('#rules');

const BEST_KEY = 'gridStorm.best';
let best = Number(localStorage.getItem(BEST_KEY) || 0);
let paused = false;

// declared up here because buildDevPanel() runs before its own section
let devNextEl = null, devClockEl = null;

/* testing hatches: ?t=55 starts the clock late, ?dev=1 makes the codex
   entries clickable so any event can be fired on demand */
const params = new URLSearchParams(location.search);
const startAt = Number(params.get('t') || 0);
const devMode = params.get('dev') === '1';
const startEvent = params.get('event');   // ?event=laser queues it from the off

Sound.init();
Music.init();
Music.setMaster(Sound.muted);

btnMute.textContent = Sound.muted ? '🔇' : '🔊';
btnMusic.classList.toggle('dim', Music.off);

/* one place that keeps the two buttons honest about the current state */
function syncAudioUi() {
  btnMute.textContent = Sound.muted ? '🔇' : '🔊';
  btnMusic.classList.toggle('dim', Music.off || Sound.muted);
}

function toggleMute() {
  Music.setMaster(Sound.toggle());
  syncAudioUi();
}

function toggleMusic() {
  Music.toggle();
  syncAudioUi();
}

fitCanvas(canvas, BOARD_SIDE);

const game = createGame(canvas, {
  onTick: hud,
  onEvent: showBanner,
  onDeath: gameOver
});

/* the board takes the largest square the middle of the page can hold, so the
   page never scrolls and never leaves a band of dead space either */
const boardWrap = document.querySelector('.board-wrap');

function layout() {
  // the window bound is insurance: the wrap sizes itself from its content, so a
  // stray `align-items` somewhere could otherwise let the two feed each other
  const size = Math.max(200, Math.min(900,
    Math.floor(Math.min(
      boardWrap.clientWidth, boardWrap.clientHeight,
      window.innerWidth, window.innerHeight))));

  fitCanvas(canvas, size);
  if (!game.g.running) game.R.frame(game.g);   // repaint while paused or on the menu
}

new ResizeObserver(layout).observe(boardWrap);
window.addEventListener('resize', layout);
layout();

/* ── HUD ──────────────────────────────────────────────────────────────── */

let hudT = 0, lastSig = '';

function hud(g) {
  hudTime.textContent = g.time.toFixed(1);
  hudBest.textContent = best;

  hudT += 1;
  if (hudT % 6) return;

  if (devClockEl) {
    const until = g.firstDone ? g.nextEventAt - g.time : FIRST_EVENT_AT - g.time;
    devClockEl.textContent = until > 0 ? until.toFixed(1) + 's' : 'now';
  }

  const sig = g.events.map(e => e.def.id).join('|');
  if (sig !== lastSig) {
    lastSig = sig;
    chips.innerHTML = g.events.map(e => `
      <div class="chip" style="--tint:${e.def.tint}" data-id="${e.def.id}">
        <span class="chip-em">${e.def.emoji}</span>
        <span class="chip-name">${e.def.name}</span>
        <i class="chip-bar"></i>
      </div>`).join('');
  }
  for (const e of g.events) {
    const bar = chips.querySelector(`[data-id="${e.def.id}"] .chip-bar`);
    if (bar) bar.style.transform = `scaleX(${Math.max(0, 1 - e.t / e.duration)})`;
  }
}

let bannerT = 0;

function showBanner(def) {
  banner.innerHTML = `
    <div class="banner-in" style="--tint:${def.tint}">
      <div class="banner-em">${def.emoji}</div>
      <div>
        <div class="banner-name">${def.name}</div>
        <div class="banner-blurb">${def.blurb}</div>
      </div>
    </div>`;
  banner.classList.add('show');
  clearTimeout(bannerT);
  bannerT = setTimeout(() => banner.classList.remove('show'), 2800);
}

/* ── screens ──────────────────────────────────────────────────────────── */

const CODEX = [FIRST_EVENT, ...EVENTS];

function codexHtml() {
  return CODEX.map(d => `
    <li style="--tint:${d.tint}" data-id="${d.id}" class="${devMode ? 'dev' : ''}">
      <b>${d.emoji} ${d.name}</b><span>${d.blurb}</span>
    </li>`).join('');
}

function titleScreen() {
  overlay.className = 'overlay show';
  overlay.innerHTML = `
    <div class="panel">
      <h1 class="title">GRID <span>STORM</span></h1>
      <p class="tag">One cube. Five by five. It does not stay that way.</p>

      <div class="keys">
        <div class="keycap">W</div><div class="keycap">A</div>
        <div class="keycap">S</div><div class="keycap">D</div>
        <span>or arrow keys — one cell per press</span>
      </div>
      <p class="touch-hint">Use the ▲ ◀ ▼ ▶ pad below to move, ⏸ to pause.</p>

      <button class="btn big" id="btn-play">▶ START</button>
      <button class="btn ghost" id="btn-codex">📖 EVENT CODEX (${CODEX.length})</button>
    </div>`;

  $('#btn-play').onclick = play;
  $('#btn-codex').onclick = () => rules.classList.add('show');
}

let overT = 0;

function gameOver(score, reason, emoji) {
  if (score > best) {
    best = score;
    localStorage.setItem(BEST_KEY, String(best));
  }

  // held back so the death explosion plays — but a restart in that window must
  // cancel it, or the panel drops on top of a live run
  clearTimeout(overT);
  overT = setTimeout(() => {
    overlay.className = 'overlay show dead';
    overlay.innerHTML = `
      <div class="panel">
        <div class="dead-em">${emoji}</div>
        <h1 class="title small">GAME OVER</h1>
        <p class="tag">${reason}</p>
        <div class="scores">
          <div><span>SURVIVED</span><b>${score}s</b></div>
          <div><span>BEST</span><b>${best}s</b></div>
        </div>
        <button class="btn big" id="btn-again">↻ RUN IT BACK</button>
        <button class="btn ghost" id="btn-home">← ARCADE.SYS</button>
      </div>`;

    $('#btn-again').onclick = play;
    $('#btn-home').onclick = () => { window.location.href = '../../index.html'; };
  }, 900);
}

function play() {
  Sound.unlock();
  Music.begin();          // the click that got us here is the gesture audio needs
  Music.resume();
  clearTimeout(overT);
  overlay.className = 'overlay';
  rules.classList.remove('show');
  chips.innerHTML = '';
  lastSig = '';
  paused = false;
  game.start({ time: startAt });
}

function togglePause() {
  if (!game.g.alive || !game.g.time) return;
  paused = !paused;

  if (paused) {
    game.stop();
    Music.pause();
    overlay.className = 'overlay show soft';
    overlay.innerHTML = `
      <div class="panel">
        <h1 class="title small">PAUSED</h1>
        <p class="tag">Press <b>P</b> or <b>Esc</b>, or tap resume.</p>
        <button class="btn big" id="btn-resume">▶ RESUME</button>
      </div>`;
    $('#btn-resume').onclick = togglePause;
  } else {
    overlay.className = 'overlay';
    Music.resume();
    game.resume();
  }
}

/* a tab in the background should not keep playing */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) Music.pause();
  else if (!paused) Music.resume();
});

/* ── input ────────────────────────────────────────────────────────────── */

const DIRS = {
  w: [0, -1], arrowup: [0, -1],
  s: [0, 1],  arrowdown: [0, 1],
  a: [-1, 0], arrowleft: [-1, 0],
  d: [1, 0],  arrowright: [1, 0]
};

const held = new Set();
let repeatT = 0;

document.addEventListener('keydown', ev => {
  const k = ev.key.toLowerCase();

  if (k === 'm') { toggleMute(); return; }
  if (k === 'n') { toggleMusic(); return; }
  if (k === 'p' || k === 'escape') { togglePause(); return; }
  if (k === 'r' && !game.g.alive) { play(); return; }

  const dir = DIRS[k];
  if (!dir) return;
  ev.preventDefault();

  if (!held.has(k)) {
    held.add(k);
    if (!paused) game.move(dir[0], dir[1]);
    repeatT = performance.now() + 190;
  }
});

document.addEventListener('keyup', ev => held.delete(ev.key.toLowerCase()));
window.addEventListener('blur', () => held.clear());

/* whichever input is currently asking for a direction */
let padDir = null;

function currentDir() {
  if (padDir) return padDir;
  for (const k of held) if (DIRS[k]) return DIRS[k];
  return null;
}

/* hold-to-repeat, on its own clock so it is frame-rate independent */
setInterval(() => {
  if (paused || !game.g.alive) return;
  const dir = currentDir();
  if (!dir) return;

  const now = performance.now();
  if (now < repeatT) return;
  repeatT = now + 105;
  game.move(dir[0], dir[1]);
}, 16);

/* touch: swipe anywhere on the board, plus a d-pad for thumbs */
let tx = 0, ty = 0;

canvas.addEventListener('touchstart', ev => {
  tx = ev.touches[0].clientX; ty = ev.touches[0].clientY;
}, { passive: true });

canvas.addEventListener('touchend', ev => {
  const dx = ev.changedTouches[0].clientX - tx;
  const dy = ev.changedTouches[0].clientY - ty;
  if (Math.hypot(dx, dy) < 24) return;
  if (Math.abs(dx) > Math.abs(dy)) game.move(Math.sign(dx), 0);
  else game.move(0, Math.sign(dy));
}, { passive: true });

/* d-pad: press to step, hold to keep stepping, on the same clock as the keys */
document.querySelectorAll('.dpad .key').forEach(btn => {
  const [dx, dy] = btn.dataset.dir.split(',').map(Number);

  const press = ev => {
    ev.preventDefault();
    btn.classList.add('down-state');
    padDir = [dx, dy];
    if (!paused) game.move(dx, dy);
    repeatT = performance.now() + 190;
    if (btn.setPointerCapture && ev.pointerId !== undefined) btn.setPointerCapture(ev.pointerId);
  };

  const release = () => {
    btn.classList.remove('down-state');
    // only clear if this button is the one still held
    if (padDir && padDir[0] === dx && padDir[1] === dy) padDir = null;
  };

  btn.addEventListener('pointerdown', press);
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('pointerleave', release);
  btn.addEventListener('contextmenu', ev => ev.preventDefault());
});

$('#btn-pause').addEventListener('click', ev => { ev.preventDefault(); togglePause(); });

btnMute.onclick = toggleMute;
btnMusic.onclick = toggleMusic;
btnRules.onclick = () => rules.classList.toggle('show');
$('#rules-close').onclick = () => rules.classList.remove('show');
$('#codex-list').innerHTML = codexHtml();

if (devMode) {
  $('#codex-list').addEventListener('click', ev => {
    const li = ev.target.closest('li');
    if (!li) return;
    if (game.trigger(li.dataset.id)) rules.classList.remove('show');
  });
  buildDevPanel();
}

/* ── debug panel (?dev=1) ─────────────────────────────────────────────────

   QUEUE puts an event at the front of the scheduler: it starts when the next
   storm is due, so you actually play into it. NOW starts it this instant.
   LOCK keeps re-picking the queued one, so you can practise a single event.  */

function buildDevPanel() {
  const panel = document.createElement('aside');
  panel.className = 'devpanel';
  panel.innerHTML = `
    <header>
      <b>DEBUG</b>
      <button id="dev-hide" title="hide (backtick)">–</button>
    </header>
    <div class="dev-state">
      <div>next: <span id="dev-next">random</span></div>
      <div>in: <span id="dev-clock">—</span></div>
    </div>
    <div class="dev-row">
      <label><input type="checkbox" id="dev-lock"> lock repeat</label>
      <button id="dev-soon">SKIP WAIT</button>
    </div>
    <ul class="dev-list">
      ${CODEX.map(d => `
        <li>
          <button class="dev-pick" data-id="${d.id}" style="--tint:${d.tint}">
            ${d.emoji} ${d.name}
          </button>
          <button class="dev-now" data-id="${d.id}" title="start right now">NOW</button>
        </li>`).join('')}
    </ul>`;

  document.body.appendChild(panel);
  devNextEl = $('#dev-next');
  devClockEl = $('#dev-clock');

  panel.addEventListener('click', ev => {
    const pick = ev.target.closest('.dev-pick');
    const now = ev.target.closest('.dev-now');

    if (pick) {
      const id = game.g.forcedNext === pick.dataset.id ? null : pick.dataset.id;
      game.setNext(id);
      markQueued(panel);
    }
    if (now) game.trigger(now.dataset.id);
    if (ev.target.id === 'dev-soon') game.skipWait();
    if (ev.target.id === 'dev-hide') panel.classList.toggle('collapsed');
  });

  $('#dev-lock').onchange = ev => game.setLock(ev.target.checked);

  // a queued event survives a restart, so reflect anything set by ?event=
  if (startEvent) { game.setNext(startEvent); markQueued(panel); }
  if (params.get('lock') === '1') { game.setLock(true); $('#dev-lock').checked = true; }

  // backtick, because every obvious letter is already a control
  document.addEventListener('keydown', ev => {
    if (ev.key === '`') panel.classList.toggle('collapsed');
  });
}

function markQueued(panel) {
  const id = game.g.forcedNext;
  devNextEl.textContent = id ? (CODEX.find(d => d.id === id)?.name || id) : 'random';
  panel.querySelectorAll('.dev-pick').forEach(b =>
    b.classList.toggle('queued', b.dataset.id === id));
}

titleScreen();

// handy for a headless verification pass
window.game = game;
window.music = Music;
window.sound = Sound;
