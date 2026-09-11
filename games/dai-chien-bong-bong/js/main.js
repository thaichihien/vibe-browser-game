/* Router and game loop: menu → chapter select → stage → stage → boss → results.
 *
 * The only module that touches the DOM besides ui/. Everything under engine/ and
 * data/ is importable from Node, which is how tests/bong-bong.test.mjs runs the
 * simulation with no browser at all.
 */

import { CHAPTERS } from './data/chapters.js';
import { BOSSES } from './data/bosses.js';
import { createStage, updateStage, carryFrom } from './engine/stage.js';
import { rankOf, breakdown, fmt } from './engine/rank.js';
import { createInput } from './input.js';
import { render } from './ui/render.js';
import * as hud from './ui/hud.js';
import { sfx, unlock, isMuted, toggleMute } from './audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('screen');
const ctx = canvas.getContext('2d');
const overlay = $('overlay');
const input = createInput();

const CLEARED_KEY = 'daiChienBongBong.cleared';
const BEST_KEY = 'daiChienBongBong.best';

const run = {
  /* Solo is the default. Two people at one keyboard is the better way to play
   * it, but it is the thing you opt *into*. */
  seats: 1,
  ci: 0,
  si: 0,
  carried: [],
  /* Kills, total time and deaths across all three stages — the rank is measured
   * over a whole raid, so this survives from stage to stage and only resets
   * when you start (or restart) a raid. */
  run: { kills: 0, time: 0, deaths: 0 },
  state: null,
  paused: false,
  screen: 'menu',
};

/* Which chapters have been beaten. Nothing is ever *locked* — Crazy Arcade lets
 * you walk into whichever boss room you like, and the three chapters here are
 * balanced to be equally hard for exactly that reason. This is a record of what
 * you have done, not a gate on what you may do. */
function loadCleared() {
  try {
    const raw = JSON.parse(localStorage.getItem(CLEARED_KEY));
    return new Set(Array.isArray(raw) ? raw : []);
  } catch { return new Set(); }
}
function saveCleared() {
  try { localStorage.setItem(CLEARED_KEY, JSON.stringify([...cleared])); } catch { /* private mode */ }
}
let cleared = loadCleared();

/* Best rank per raid, so the picker can show what you have already managed. */
function loadBest() {
  try { return JSON.parse(localStorage.getItem(BEST_KEY)) || {}; } catch { return {}; }
}
function saveBest() {
  try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch { /* private mode */ }
}
let best = loadBest();
const RANK_ORDER = ['D', 'C', 'B', 'A', 'S', 'SS'];

/* ── screens ──────────────────────────────────────────────────────────── */

function show(name) {
  run.screen = name;
  for (const s of ['menu', 'chapters', 'play']) $(`screen-${s}`).hidden = s !== name;
  input.setEnabled(name === 'play');
}

function applySeats(n) {
  run.seats = n;
  input.setSolo(n === 1);
  document.body.classList.toggle('solo', n === 1);
}

function renderMenu() {
  const ranks = CHAPTERS.map(c => best[c.id]).filter(Boolean);
  $('menu-progress').textContent = ranks.length
    ? `Đã hạ ${cleared.size}/${CHAPTERS.length} con trùm — hạng ${ranks.join(' · ')}.`
    : 'Ba con trùm, khó ngang nhau — chọn con nào trước cũng được.';
  for (const b of document.querySelectorAll('.seat')) {
    const on = +b.dataset.seats === run.seats;
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  }
}

function renderChapters() {
  const grid = $('chapter-grid');
  grid.innerHTML = '';
  CHAPTERS.forEach((ch, i) => {
    const boss = BOSSES[ch.boss];
    const done = cleared.has(ch.id);
    const btn = document.createElement('button');
    btn.className = `chapter${done ? ' cleared' : ''}`;
    btn.innerHTML = `
      <div class="ch-top"><span>${ch.icon}</span><span class="ch-boss-icon">${boss.icon}</span>
        <span class="ch-name">${ch.name}</span>
        ${best[ch.id] ? `<span class="ch-rank">${best[ch.id]}</span>`
          : done ? '<span class="ch-done" title="Đã hạ">✔</span>' : ''}</div>
      <div class="ch-boss"><b>${boss.name}</b> — ${boss.blurb}</div>
      <div class="ch-threat">${boss.threat}</div>
      <div class="ch-stages">
        ${ch.stages.map((s, k) => `<span>${k === 2 ? '👑 TRÙM' : `MÀN ${k + 1}`}</span>`).join('')}
      </div>
      <div class="ch-ss">Hạng SS: ${ch.ss.kills} mạng quái · dưới ${fmt(ch.ss.time)}</div>`;
    btn.addEventListener('click', () => { sfx.ui(); startChapter(i); });
    grid.appendChild(btn);
  });
}

/* ── overlays ─────────────────────────────────────────────────────────── */

function showOverlay({ icon, title, body, hint, buttons }) {
  run.paused = true;
  overlay.hidden = false;
  overlay.innerHTML = `
    ${icon ? `<div class="ov-icon">${icon}</div>` : ''}
    <h2>${title}</h2>
    ${body ? `<p>${body}</p>` : ''}
    ${hint ? `<p class="hint">💡 ${hint}</p>` : ''}
    <div class="row"></div>`;
  const row = overlay.querySelector('.row');
  for (const b of buttons) {
    const el = document.createElement('button');
    el.className = `ctl${b.primary ? ' primary' : ''}`;
    el.textContent = b.label;
    el.addEventListener('click', () => { sfx.ui(); hideOverlay(); b.action(); });
    row.appendChild(el);
  }
  row.firstChild?.focus();
}

function hideOverlay() {
  overlay.hidden = true;
  overlay.innerHTML = '';
  run.paused = false;
}

/* ── flow ─────────────────────────────────────────────────────────────── */

function startChapter(ci) {
  run.ci = ci;
  run.si = 0;
  run.carried = [];                        // items reset between raids
  run.run = { kills: 0, time: 0, deaths: 0 };
  show('play');
  openStage();
}

function openStage() {
  const ch = CHAPTERS[run.ci];
  const spec = ch.stages[run.si];
  run.state = createStage(ch, run.si, { carried: run.carried, seats: run.seats, run: run.run });
  hud.mount($('panel-left'), $('stage-top'), run.seats === 1);
  hud.update(run.state);
  render(ctx, run.state, 0);

  const isBoss = !!spec.boss;
  const boss = isBoss ? BOSSES[spec.boss] : null;
  showOverlay({
    icon: isBoss ? boss.icon : ch.icon,
    title: isBoss ? boss.name : `MÀN ${run.si + 1} — ${spec.title}`,
    body: isBoss
      ? `${boss.blurb}<br />Đổ nước cho nó <b>ngấm đầy</b> — rồi 4 giây bọc bong bóng là lúc bạn dồn sát thương.`
      : `Tiêu diệt toàn bộ quái vật để qua màn.`,
    hint: spec.hint || (isBoss ? 'Đặt sẵn bóng quanh trùm <i>trước khi</i> nó bão hoà. 4 giây không đủ để đặt mới.' : null),
    buttons: [{ label: 'VÀO TRẬN', primary: true, action: () => {} }],
  });
}

function finishStage(outcome) {
  const ch = CHAPTERS[run.ci];
  const last = run.si === ch.stages.length - 1;

  if (outcome === 'fail') {
    sfx.fail();
    showOverlay({
      icon: '💧',
      title: run.seats === 1 ? 'HẾT MẠNG' : 'CẢ HAI ĐỀU HẾT MẠNG',
      body: 'Chơi lại màn này từ đầu. Trùm cũng hồi đầy máu — sòng phẳng.',
      buttons: [
        { label: 'THỬ LẠI', primary: true, action: openStage },
        { label: '← CHỌN TRÙM', action: () => { show('chapters'); renderChapters(); } },
      ],
    });
    return;
  }

  sfx.clear();
  run.carried = carryFrom(run.state);

  if (!last) {
    run.si += 1;
    showOverlay({
      icon: '✨',
      title: `QUA MÀN ${run.si}`,
      body: 'Đồ đạc của bạn được giữ nguyên sang màn sau — nhưng sẽ mất khi đổi chương.',
      buttons: [{ label: 'MÀN TIẾP THEO', primary: true, action: openStage }],
    });
    return;
  }

  /* raid cleared — grade it */
  cleared.add(ch.id);
  saveCleared();
  showRank(ch);
}

/* The D→SS card. Crazy Arcade grades kills + total time + deaths across the
 * whole raid, and that grade is the reason to come back to a map you have
 * already beaten — so it gets its own screen, not a line in a corner. */
function showRank(ch) {
  const r = rankOf(run.run, ch.ss);
  const rows = breakdown(run.run, ch.ss);
  const prev = best[ch.id];
  const improved = !prev || RANK_ORDER.indexOf(r.id) > RANK_ORDER.indexOf(prev);
  if (improved) { best[ch.id] = r.id; saveBest(); }

  const next = CHAPTERS.findIndex((c, i) => i !== run.ci && !cleared.has(c.id));
  const all = CHAPTERS.every(c => cleared.has(c.id));

  run.paused = true;
  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="rank-card">
      <div class="rank-badge" style="--rk:${r.color}">${r.id}</div>
      <h2>HẠ GỤC ${BOSSES[ch.boss].name.toUpperCase()}</h2>
      ${improved && prev ? `<p class="rank-new">Kỷ lục mới! (trước: ${prev})</p>`
        : prev ? `<p class="rank-new dim">Kỷ lục của bạn: ${prev}</p>` : ''}
      <table class="rank-table">
        ${rows.map(x => `<tr class="${x.ok ? 'ok' : ''}">
          <td>${x.label}</td><td><b>${x.got}</b></td>
          <td class="target">mục tiêu SS ${x.target}</td>
          <td class="mark">${x.ok ? '✔' : '✗'}</td></tr>`).join('')}
      </table>
      ${all ? '<p>Cả ba con trùm đã ngã.</p>'
            : `<p>Còn ${CHAPTERS.length - cleared.size} con trùm nữa — chọn con nào cũng được.</p>`}
      <div class="row"></div>
    </div>`;
  const row = overlay.querySelector('.row');
  const add = (label, primary, action) => {
    const el = document.createElement('button');
    el.className = `ctl${primary ? ' primary' : ''}`;
    el.textContent = label;
    el.addEventListener('click', () => { sfx.ui(); hideOverlay(); action(); });
    row.appendChild(el);
  };
  add('CHƠI LẠI RAID', false, () => startChapter(run.ci));
  if (next >= 0) add(`TRÙM TIẾP: ${BOSSES[CHAPTERS[next].boss].icon}`, true, () => startChapter(next));
  add('← CHỌN TRÙM', all, () => { show('chapters'); renderChapters(); });
  row.querySelector('.primary')?.focus();
}

/* ── loop ─────────────────────────────────────────────────────────────── */

/* Fixed timestep. Fuse timing, the 0.25s soak tick and the 0.7s telegraph lead
 * all have to be frame-rate independent — and a headless verification pass runs
 * at ~24fps, which would otherwise change the balance out from under us. */
const STEP = 1 / 60;
const MAX_CATCHUP = 0.25;
let acc = 0;
let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  const wall = Math.min(MAX_CATCHUP, (now - last) / 1000);
  last = now;
  if (run.screen !== 'play' || !run.state) return;

  const state = run.state;
  if (!run.paused && !state.outcome) {
    acc += wall;
    while (acc >= STEP) {
      acc -= STEP;
      const intents = {};
      for (const p of state.players) intents[p.id] = input.read(p.id);
      updateStage(state, STEP, intents);
      drainEvents(state);
      if (state.outcome) { finishStage(state.outcome); break; }
    }
  } else {
    acc = 0;
  }

  render(ctx, state, now / 1000);
  hud.update(state);
}

/* The engine reports what happened as plain strings; the sound lives out here. */
function drainEvents(state) {
  if (!state.events.length) return;
  const seen = new Set(state.events);   // collapse duplicates within one step
  state.events.length = 0;
  for (const name of seen) sfx[name]?.();
}

/* ── wiring ───────────────────────────────────────────────────────────── */

$('btn-start').addEventListener('click', () => {
  unlock();
  sfx.ui();
  show('chapters');
  renderChapters();
});
$('btn-menu').addEventListener('click', () => { sfx.ui(); show('menu'); renderMenu(); });

for (const b of document.querySelectorAll('.seat')) {
  b.addEventListener('click', () => {
    applySeats(+b.dataset.seats);
    sfx.ui();
    renderMenu();
  });
}

const rulesModal = $('modal-rules');
const openRules = () => { rulesModal.hidden = false; input.setEnabled(false); };
const closeRules = () => { rulesModal.hidden = true; input.setEnabled(run.screen === 'play' && !run.paused); };
$('btn-rules').addEventListener('click', openRules);
$('btn-rules-close').addEventListener('click', closeRules);
rulesModal.addEventListener('click', (e) => { if (e.target === rulesModal) closeRules(); });

const muteBtn = $('btn-mute');
const paintMute = () => { muteBtn.textContent = isMuted() ? '🔇' : '🔊'; };
muteBtn.addEventListener('click', () => { toggleMute(); paintMute(); });
paintMute();

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && !rulesModal.hidden) { closeRules(); return; }
  if (e.target.tagName === 'BUTTON' && e.code === 'Enter') return;
  if (e.code === 'KeyM') { toggleMute(); paintMute(); }
  if (e.code === 'KeyP' && run.screen === 'play' && run.state && !run.state.outcome) {
    if (overlay.hidden) {
      showOverlay({
        icon: '⏸️',
        title: 'TẠM DỪNG',
        buttons: [
          { label: 'TIẾP TỤC', primary: true, action: () => {} },
          { label: 'CHƠI LẠI MÀN', action: openStage },
          { label: '← CHỌN CHƯƠNG', action: () => { show('chapters'); renderChapters(); } },
        ],
      });
    } else if (overlay.textContent.includes('TẠM DỪNG')) hideOverlay();
  }
});

applySeats(run.seats);
renderMenu();
show('menu');
requestAnimationFrame(frame);

/* Handy for a headless verification pass. */
window.game = { run, CHAPTERS, startChapter, openStage, input, applySeats };
