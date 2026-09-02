/* Replays the engine's event stream as animation. This is the only place that
   touches the DOM for a battle; engine/ stays clean. */

import { PROJECTILE, BURST, elName, mult } from '../engine/elements.js';
import { statOf, living, ULT_FULL } from '../engine/combat.js';
import { tagOf } from '../engine/moves.js';
import { buildScenery, formation, REDUCED } from './stage.js';
import { hasRelic } from '../state.js';
import { renderInspect } from './inspect.js';
import { sfx } from '../audio.js';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
export const wait = (ms) => new Promise(r => setTimeout(r, REDUCED ? Math.min(ms, 50) : ms));

let S = null, slots = { ally: [], foe: [] };

export function mount(state) {
  S = state;
  resetInspect();
  buildScenery(state.era);
  slots.ally = formation(living(state, 'ally').length, true, state.units.find(u => u.side === 'ally').tier === 'boss');
  slots.foe = formation(living(state, 'foe').length, false, state.units.find(u => u.side === 'foe').tier === 'boss');
  drawActors();
  drawMeta();
}

function drawActors() {
  const stage = $('stage');
  stage.querySelectorAll('.actor, .float, .proj, .spark').forEach(n => n.remove());
  for (const u of S.units) {
    const p = slots[u.side][u.slot] || slots[u.side].at(-1);
    // rank depth × the creature's own size: a rat is not a dragon is not a boss
    const px = Math.round(56 * p.s * (u.sz || 1));
    const el = document.createElement('div');
    const crowd = S.units.filter(x => x.side === u.side).length;
    el.className = `actor ${u.side}`
      + (u.tier === 'boss' ? ' boss' : '')
      + (crowd >= 7 ? ' packed' : crowd >= 5 ? ' tight' : '');
    el.style.cssText = `left:${p.x}%;top:${p.y}%;z-index:${Math.round(p.y)};`;
    el.innerHTML = `
      <span class="body" style="font-size:${px}px;animation-delay:${(u.slot * .37).toFixed(2)}s">${u.e}<i class="disc"></i></span>
      <div class="plate">
        <div class="nm">${u.n}</div>
        ${hasRelic('torch') ? `<div class="el">${elName(S.era, u.el)}</div>` : ''}
        <div class="bar"><i class="ghost"></i><i class="fill"></i></div>
        <div class="num"></div>
        <div class="sts"></div>
        ${u.ult ? '<div class="ultpip"><i></i></div>' : ''}
      </div>`;
    el.addEventListener('click', () => onPick ? onPick(u) : inspect(u));
    u.node = el;
    stage.appendChild(el);
    paint(u);
  }
}

export function paint(u) {
  if (!u.node) return;
  const pct = Math.max(0, u.hp / u.max) * 100;
  const fill = u.node.querySelector('.fill');
  fill.style.width = pct + '%';
  fill.className = 'fill' + (pct < 25 ? ' low' : pct < 55 ? ' mid' : '');
  u.node.querySelector('.ghost').style.width = pct + '%';
  u.node.querySelector('.num').textContent = `${Math.max(0, Math.round(u.hp))}/${u.max}`;
  const sts = [];
  if (u.shield > 0) sts.push('🛡️');
  if (u.taunt > 0) sts.push('🚩');
  if (u.marked > 0) sts.push('🎯');
  if (u.stunned > 0) sts.push('💫');
  if (u.silenced > 0) sts.push('🔇');
  if (u.dots.length) sts.push('☠️');
  for (const b of u.buffs) if (b.stat) sts.push(b.pct > 0 ? '🔼' : '🔽');
  u.node.querySelector('.sts').innerHTML = sts.slice(0, 5).map(s => `<span>${s}</span>`).join('');
  if (u.ult) {
    const pip = u.node.querySelector('.ultpip');
    pip.querySelector('i').style.width = u.charge + '%';
    pip.classList.toggle('full', u.charge >= ULT_FULL);
  }
  u.node.classList.toggle('dead', !u.alive);
}

export function drawMeta() {
  $('hud-meta').innerHTML = `
    <span>THỜI ĐẠI <b>${S.era.name} — ${S.title}</b></span>
    <span>DẠNG TRẬN <b>${S.format.name}</b></span>
    <span>ĐỘ KHÓ <b>${S.difficulty.stars}</b></span>
    <span>PHE BẠN <b>${S.yourSide}</b></span>
    <span>LƯỢT <b id="turn-n">${S.turns}</b></span>`;
}

export function drawTimeline(order) {
  const t = $('timeline');
  t.innerHTML = '<span class="lbl">DÒNG LƯỢT</span>';
  order.slice(0, 9).forEach((u, i) => {
    const c = document.createElement('span');
    c.className = `tchip ${u.side}` + (i === 0 ? ' now' : '');
    c.innerHTML = `<span class="em">${u.e}</span><span class="tn">${u.n}</span>`;
    t.appendChild(c);
  });
}

export const log = (html) => { $('log').innerHTML = html; };

/* ── the dossier rails ──────────────────────────────────────── */
const shown = { ally: null, foe: null };

/** Open a unit's dossier on their own side of the stage. */
export function inspect(u) {
  const el = $('inspect-' + u.side);
  shown[u.side] = u;
  el.hidden = false;
  el.style.visibility = 'visible';
  renderInspect(el, u, S.era);
  el.querySelector('.ins-close').onclick = () => closeInspect(u.side);
}

export function closeInspect(side) {
  shown[side] = null;
  const el = $('inspect-' + side);
  el.hidden = true;
  el.style.visibility = '';
  el.innerHTML = '';
}

/** Keep an open dossier honest while the battle changes it underneath. */
export function refreshInspect() {
  for (const side of ['ally', 'foe']) {
    const u = shown[side];
    if (!u) continue;
    const el = $('inspect-' + side);
    renderInspect(el, u, S.era);
    el.querySelector('.ins-close').onclick = () => closeInspect(side);
  }
}

export function resetInspect() {
  closeInspect('ally');
  closeInspect('foe');
}

/* ── targeting ──────────────────────────────────────────────── */
let onPick = null;

export function askTarget(ids) {
  return new Promise(resolve => {
    const set = new Set(ids);
    for (const u of S.units) u.node.classList.toggle('targetable', set.has(u.uid));
    onPick = (u) => {
      if (!set.has(u.uid)) return;
      clearTargeting();
      resolve(u.uid);
    };
    askTarget.cancel = () => { clearTargeting(); resolve(null); };
  });
}
export function clearTargeting() {
  onPick = null;
  askTarget.cancel = null;      // must not outlive its own targeting session
  for (const u of S.units) u.node.classList.remove('targetable');
}

/* ── the replay ─────────────────────────────────────────────── */

export async function play(events) {
  for (const e of events) {
    const tgt = e.tgt && S.units.find(u => u.uid === e.tgt);
    const src = e.src && S.units.find(u => u.uid === e.src);
    switch (e.t) {
      case 'log':   log(e.text.replace(/^(\S+[^—]*?) dùng (.+)\.$/, '<b>$1</b> dùng <span class="g">$2</span>.')); break;
      case 'ult':   await ultCutIn(src, e.name); break;
      case 'lunge': await lunge(src, tgt); break;
      case 'proj':  await projectile(src, tgt, e.el); burst(tgt, e.el); break;
      case 'dmg': {
        if (e.n > 130 || e.crit) shake();
        e.crit ? sfx.crit() : sfx.hit();
        floatText(tgt, `−${e.n}`, e.crit ? 'crit' : 'dmg');
        if (e.em > 1) floatText(tgt, 'KHẮC HỆ ×1.6', 'note', -34);
        else if (e.em < 1) floatText(tgt, 'bị kháng ×0.7', 'note', -34);
        flinch(tgt); paint(tgt); await wait(e.dot ? 220 : 90);
        break;
      }
      case 'heal':   if (e.n > 0) { sfx.heal(); burst(tgt, 'RADIANT'); floatText(tgt, `+${e.n}`, 'heal'); } paint(tgt); await wait(140); break;
      case 'revive': sfx.heal(); burst(tgt, 'RADIANT'); floatText(tgt, `⟲ ${e.n}`, 'heal'); paint(tgt); await wait(320); break;
      case 'shield': floatText(tgt, e.gain ? `🛡️ +${e.n}` : `🛡️ ${e.n}`, 'note'); paint(tgt); await wait(90); break;
      case 'buff':   sfx.buff(); burst(tgt, 'RADIANT'); floatText(tgt, `${e.label} ▲`, 'note'); paint(tgt); await wait(150); break;
      case 'debuff': sfx.debuff(); burst(tgt, 'UMBRA'); floatText(tgt, `${e.label} ▼`, 'note'); paint(tgt); await wait(150); break;
      case 'note':   floatText(tgt, e.text, 'note'); paint(tgt); await wait(180); break;
      case 'wait':   floatText(src, '+25 ⚡ nộ', 'note'); paint(src); await wait(360); break;
      case 'death':  sfx.death(); await die(tgt); break;
      case 'skip':   await wait(340); break;
      case 'end':    break;
    }
  }
  for (const u of S.units) paint(u);
  refreshInspect();
  const n = document.getElementById('turn-n');
  if (n) n.textContent = S.turns;
}

function centerOf(u) {
  const s = $('stage').getBoundingClientRect();
  const b = u.node.querySelector('.body').getBoundingClientRect();
  return { x: b.left + b.width / 2 - s.left, y: b.top + b.height / 2 - s.top };
}

export function floatText(u, text, cls, dy = 0) {
  if (!u || !u.node) return;
  const p = centerOf(u);
  const f = document.createElement('div');
  f.className = 'float ' + cls;
  f.textContent = text;
  f.style.left = p.x + 'px'; f.style.top = (p.y + dy) + 'px';
  $('stage').appendChild(f);
  f.animate([
    { transform: 'translate(-50%,-50%) scale(.5)', opacity: 0 },
    { transform: 'translate(-50%,-50%) scale(1.15)', opacity: 1, offset: .2 },
    { transform: 'translate(-50%,-140%) scale(1)', opacity: 0 }
  ], { duration: REDUCED ? 380 : 1050, easing: 'cubic-bezier(.2,.8,.3,1)' })
    .finished.then(() => f.remove()).catch(() => f.remove());
}

function flinch(u) {
  if (REDUCED || !u.node) return;
  u.node.animate([{ filter: 'brightness(3) sepia(1) hue-rotate(-40deg)' }, { filter: 'none' }],
    { duration: 320, easing: 'ease-out' });
  u.node.animate([{ translate: '0 0' }, { translate: `${u.side === 'foe' ? 10 : -10}px 0` }, { translate: '0 0' }],
    { duration: 220, easing: 'ease-out' });
}

async function die(u) {
  floatText(u, '💀', 'dmg', -60);
  if (!REDUCED && u.node) {
    await u.node.animate(
      [{ opacity: 1, rotate: '0deg' }, { opacity: 0, rotate: '80deg', translate: '0 26px' }],
      { duration: 520, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
  }
  paint(u);
}

async function projectile(src, tgt, el) {
  if (REDUCED || !src || !tgt) return;
  const a = centerOf(src), b = centerOf(tgt);
  const p = document.createElement('div');
  p.className = 'proj';
  p.textContent = PROJECTILE[el] || '💥';
  p.style.left = a.x + 'px'; p.style.top = a.y + 'px';
  $('stage').appendChild(p);
  await p.animate([
    { transform: 'translate(-50%,-50%) scale(.6) rotate(0deg)' },
    { transform: `translate(${b.x - a.x}px, ${b.y - a.y - 24}px) translate(-50%,-50%) scale(1.25) rotate(220deg)`, offset: .7 },
    { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px) translate(-50%,-50%) scale(1) rotate(340deg)` }
  ], { duration: 320, easing: 'cubic-bezier(.35,.1,.6,1)' }).finished.catch(() => {});
  p.remove();
}

function burst(u, el) {
  if (REDUCED || !u || !u.node) return;
  const p = centerOf(u);
  const chars = BURST[el] || BURST.STEEL;
  for (let i = 0; i < 9; i++) {
    const s = document.createElement('div');
    s.className = 'spark';
    s.textContent = chars[i % chars.length];
    s.style.left = p.x + 'px'; s.style.top = p.y + 'px';
    $('stage').appendChild(s);
    const ang = (Math.PI * 2 * i) / 9 + rand(-.3, .3), d = rand(38, 78);
    s.animate([
      { transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
      { transform: `translate(${Math.cos(ang) * d}px, ${Math.sin(ang) * d}px) translate(-50%,-50%) scale(1.1)`, opacity: 0 }
    ], { duration: rand(420, 640), easing: 'cubic-bezier(.1,.7,.3,1)' })
      .finished.then(() => s.remove()).catch(() => s.remove());
  }
}

async function lunge(src, tgt) {
  if (REDUCED || !src || !tgt) return;
  const a = centerOf(src), b = centerOf(tgt);
  const dx = (b.x - a.x) * .3, dy = (b.y - a.y) * .3;
  await src.node.animate([
    { transform: 'translate(-50%,-100%)' },
    { transform: `translate(calc(-50% + ${dx}px), calc(-100% + ${dy}px))`, offset: .45 },
    { transform: 'translate(-50%,-100%)' }
  ], { duration: 400, easing: 'cubic-bezier(.3,1.4,.5,1)' }).finished.catch(() => {});
}

function shake() {
  if (REDUCED) return;
  const s = $('stage');
  s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake');
}

async function ultCutIn(actor, name) {
  sfx.ult();
  const b = $('banner'), f = $('flash'), sc = $('scrim');
  b.textContent = `★ ${name} ★`;
  b.style.color = actor.side === 'ally' ? '#ffd98a' : '#ff9a92';
  const dur = REDUCED ? 400 : 1250;
  sc.animate([{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 1, offset: .75 }, { opacity: 0 }], { duration: dur });
  await b.animate([
    { opacity: 0, transform: 'scale(.7)', filter: 'blur(8px)' },
    { opacity: 1, transform: 'scale(1)', filter: 'blur(0)', offset: .25 },
    { opacity: 1, transform: 'scale(1.04)', offset: .75 },
    { opacity: 0, transform: 'scale(1.2)' }
  ], { duration: dur, easing: 'ease-out' }).finished.catch(() => {});
  f.animate([{ opacity: 0 }, { opacity: .85, offset: .1 }, { opacity: 0 }], { duration: REDUCED ? 150 : 420 });
}

export function setActive(u) {
  for (const x of S.units) x.node.classList.toggle('active', x === u);
}

/** GPS shows the real number before you commit. */
export function previewDamage(actor, move, tgtUid) {
  if (!hasRelic('gps') || move.kind !== 'dmg') return '';
  const t = S.units.find(x => x.uid === tgtUid);
  if (!t) return '';
  const em = mult(move.el, t.el);
  const def = move.el === 'STEEL' ? statOf(t, 'grd') : statOf(t, 'wrd');
  const n = Math.round(statOf(actor, 'pwr') * (move.pow || 1) * (100 / (100 + def)) * em);
  return ` ≈${n}`;
}
