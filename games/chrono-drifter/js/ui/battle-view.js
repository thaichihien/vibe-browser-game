/* Replays the engine's event stream as animation. This is the only place that
   touches the DOM for a battle; engine/ stays clean. */

import { PROJECTILE, BURST, elName, mult } from '../engine/elements.js';
import { statOf, living, ULT_FULL } from '../engine/combat.js';
import { tagOf } from '../engine/moves.js';
import { buildScenery, layout, separate, pickComposition, REDUCED } from './stage.js';
import { mulberry32 } from '../engine/rng.js';
import { STAT_ICON } from '../data/effects.js';
import { hasRelic } from '../state.js';
import { renderInspect } from './inspect.js';
import { sfx } from '../audio.js';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
export const wait = (ms) => new Promise(r => setTimeout(r, REDUCED ? Math.min(ms, 50) : ms));

let S = null, slots = { ally: [], foe: [] };
let generation = 0;   // bumped per battle, so a stale replay can tell it is stale

export function mount(state) {
  S = state;
  generation++;
  resetInspect();
  resetLog();
  // stable per battle, so a redraw never reshuffles the field under the player
  const rng = mulberry32((state.seed ^ 0x9e3779b9) >>> 0);
  const mine = state.units.filter(u => u.side === 'ally');
  const foes = state.units.filter(u => u.side === 'foe');
  S.composition = pickComposition(rng, state.format.key, { ally: mine.length, foe: foes.length });
  buildScenery(state.era, S.composition);
  relayout();
  drawActors();
  drawMeta();
}

/** Rebuild the field after the roster changes — an era event can add a fighter. */
export function refield() {
  relayout();
  drawActors();
}

/** Positions depend on real pixel sizes, so they are recomputed against the live stage. */
export function relayout() {
  const st = $('stage').getBoundingClientRect();
  const w = st.width || 900, h = st.height || 420;
  const mine = S.units.filter(u => u.side === 'ally');
  const foes = S.units.filter(u => u.side === 'foe');
  slots.ally = layout(mine, 'ally', S.composition, w, h);
  slots.foe = layout(foes, 'foe', S.composition, w, h);
  // one pass over the whole field: a sprite may only be hidden by nobody, ally or enemy
  separate([...slots.ally, ...slots.foe], w, h);
  // the engine has no DOM, but a meteor needs to know who is standing next to whom
  for (const sl of [...slots.ally, ...slots.foe]) sl.unit.pos = { x: sl.x, y: sl.y };
}

function drawActors() {
  const stage = $('stage');
  stage.querySelectorAll('.actor, .float, .proj, .spark').forEach(n => n.remove());
  for (const u of S.units) {
    const side = slots[u.side];
    const p = side.find(sl => sl.unit === u) || side[u.slot] || side.at(-1);
    const px = p.px;
    const el = document.createElement('div');
    const crowd = S.units.filter(x => x.side === u.side).length;
    el.className = `actor ${u.side}`
      + (u.tier === 'boss' ? ' boss' : '')
      + (crowd >= 7 ? ' packed' : crowd >= 5 ? ' tight' : '');
    el.style.cssText = `left:${p.x}%;top:${p.y}%;z-index:${Math.round(p.y)};`;
    el.innerHTML = `
      <i class="pad" style="width:${Math.round(px * 1.05)}px"></i>
      <span class="body" style="font-size:${px}px;animation-delay:${(u.slot * .37).toFixed(2)}s">${u.e}<i class="disc"></i></span>
      <div class="plate">
        <div class="nm">${u.n}</div>
        ${hasRelic('torch') ? `<div class="el">${elName(S.era, u.el)}</div>` : ''}
        <div class="bar"><i class="ghost"></i><i class="fill"></i></div>
        <div class="bar ep"><i class="epfill"></i></div>
        <div class="num"></div>
        <div class="sts"></div>
        ${u.ult ? '<div class="ultpip"><i></i></div>' : ''}
      </div>`;
    el.addEventListener('click', () => onPick ? onPick(u) : inspect(u));
    u.node = el;
    stage.appendChild(el);
    paint(u);
  }
  ensureClickable();
}

/* The analytic layout gets the composition right, but only the browser knows where
   a glyph really lands — the actor box is anchored at its name plate, not its feet,
   and emoji metrics vary by era. So the last word goes to the rendered geometry: if
   a fighter's centre is not its own body, it is not clickable, and it moves. */
function ensureClickable() {
  const stage = $('stage');
  const rect = stage.getBoundingClientRect();
  if (!rect.width) return;
  const live = S.units.filter(u => u.alive && u.node);

  const centreOf = (u) => {
    const r = u.node.querySelector('.body').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), r };
  };

  for (let pass = 0; pass < 30; pass++) {
    let moved = false;
    for (const u of live) {
      const { x, y } = centreOf(u);
      const hit = document.elementFromPoint(x, y);
      if (hit === u.node.querySelector('.body')) continue;
      const blocker = hit && hit.closest ? hit.closest('.actor') : null;
      if (!blocker) continue;
      // step away from whatever is covering it, and lift it slightly clear
      const mine = centreOf(u), theirs = blocker.getBoundingClientRect();
      const dir = mine.x < theirs.left + theirs.width / 2 ? -1 : 1;
      const stepX = (Math.max(18, mine.r.width * 0.3) / rect.width) * 100;
      const left = parseFloat(u.node.style.left) || 50;
      const top = parseFloat(u.node.style.top) || 90;
      const nextLeft = Math.max(4, Math.min(96, left + dir * stepX));
      if (nextLeft === left || pass > 18) {
        // boxed in sideways: lift it clear instead, and let it sit further back
        const nextTop = Math.max(34, top - (mine.r.height * 0.45 / rect.height) * 100);
        u.node.style.top = nextTop + '%';
        u.node.style.zIndex = Math.round(nextTop);
      } else {
        u.node.style.left = nextLeft + '%';
      }
      moved = true;
    }
    if (!moved) return;
  }
}

export function paint(u) {
  if (!u || !u.node) return;   // events from a battle that has since been replaced
  const pct = Math.max(0, u.hp / u.max) * 100;
  const fill = u.node.querySelector('.fill');
  fill.style.width = pct + '%';
  fill.className = 'fill' + (pct < 25 ? ' low' : pct < 55 ? ' mid' : '');
  u.node.querySelector('.ghost').style.width = pct + '%';
  u.node.querySelector('.epfill').style.width = Math.max(0, u.ep / u.epMax) * 100 + '%';
  u.node.querySelector('.num').textContent = `${Math.max(0, Math.round(u.hp))}/${u.max}`;
  const sts = [];
  if (u.shield > 0) sts.push({ icon: '🛡️' });
  if (u.taunt > 0) sts.push({ icon: '🚩' });
  if (u.marked > 0) sts.push({ icon: '🎯' });
  if (u.stunned > 0) sts.push({ icon: '💫' });
  if (u.silenced > 0) sts.push({ icon: '🔇' });
  if (u.dots.length) sts.push({ icon: '☠️' });
  // the stat's own face, with the direction as a corner badge
  for (const b of u.buffs) if (b.stat) sts.push({ icon: STAT_ICON[b.stat] || '🔼', dir: b.pct > 0 ? 'up' : 'down' });
  u.node.querySelector('.sts').innerHTML = sts.slice(0, 5)
    .map(s => `<span class="st${s.dir ? ' dir-' + s.dir : ''}">${s.icon}</span>`).join('');
  if (u.ult) {
    const pip = u.node.querySelector('.ultpip');
    pip.querySelector('i').style.width = u.charge + '%';
    pip.classList.toggle('full', u.charge >= ULT_FULL);
  }
  u.node.classList.toggle('dead', !u.alive);
  // A revived fighter kept the death animation's forwards fill — rotated 80deg,
  // dropped 26px and held at opacity 0 — so "Hồi Quang" put them back on the field
  // invisible, off their tile and impossible to click. Standing up clears it.
  if (u.alive && u.node._death) { u.node._death.cancel(); u.node._death = null; }
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

/* ── the action log ─────────────────────────────────────────────
   One line was never enough to follow a fight: by the time you read it the next
   unit had already acted. Fifteen entries, newest first, each saying who did what
   to whom and how it landed; the oldest falls off the bottom. Numbers stay on the
   floating combat text. It lives in its own column now, so growing to fifteen
   scrolls the panel instead of moving the move buttons. */
const HISTORY_MAX = 15;
let history = [];

export const log = (html) => { notice = html; renderLog(); };
let notice = '';

export function resetLog() { history = []; notice = ''; renderLog(); }

function renderLog() {
  const rows = history.map((h, i) =>
    `<li class="${i === 0 ? 'fresh' : ''}" title="${h.plain}">${h.html}</li>`);
  $('log-notice').innerHTML = notice || '&nbsp;';
  $('log-count').textContent = history.length ? `${history.length}/${HISTORY_MAX}` : '';
  $('log').innerHTML = rows.length
    ? `<ol class="log-list">${rows.join('')}</ol>`
    : '<div class="log-empty">Chưa ai ra đòn.</div>';
  $('log').scrollTop = 0;   // the newest line is at the top, so that is where you look
}

const who = (u) => u ? `<b>${u.e} ${u.n}</b>` : '?';

/** Turn one resolved action into a single readable line. */
export function record(actor, label, events, opts = {}) {
  const by = (id) => S.units.find(u => u.uid === id);
  const hits = [], misses = [], heals = [], lifts = [], falls = [];
  let crits = 0;

  for (const e of events) {
    const t = by(e.tgt);
    switch (e.t) {
      case 'dmg':
        if (e.dot || e.self || !t) break;
        hits.push(t); if (e.crit) crits++;
        break;
      case 'miss':   if (t) misses.push(t); break;
      case 'heal':   if (t && e.n > 0) heals.push(t); break;
      case 'revive': if (t) lifts.push(t); break;
      case 'buff':
      case 'debuff': if (t) lifts.push(t); break;
      case 'death':  if (t) falls.push(t); break;
    }
  }

  let line;
  if (opts.era) {
    // the era is not a combatant, so its line reads as what it did to the field
    const bits = [];
    if (hits.length) bits.push(`${hits.length} trúng`);
    if (crits) bits.push(`<i class="crit">${crits} chí mạng</i>`);
    if (heals.length) bits.push(`hồi máu ${heals.length}`);
    if (lifts.length) bits.push(`${new Set(lifts).size} chịu ảnh hưởng`);
    const tail = bits.length ? ` <span class="era-tally">(${bits.join(', ')})</span>` : '';
    const flavour = opts.blurb ? ` <span class="era-flavour">${opts.blurb}</span>` : '';
    line = `<i class="era">⌛ ${label}</i> — ${opts.effect || ''}${tail}${flavour}`;
  } else if (label === null) {
    line = `${who(actor)} chờ, hồi sức.`;
  } else {
    const parts = [];
    const total = hits.length + misses.length;
    if (total === 1) {
      const target = hits[0] || misses[0];
      const how = misses.length ? '<i class="miss">TRƯỢT</i>'
                : crits ? '<i class="crit">CHÍ MẠNG</i>' : 'trúng';
      parts.push(`lên ${who(target)} — ${how}`);
    } else if (total > 1) {
      const bits = [];
      if (hits.length) bits.push(`${hits.length} trúng`);
      if (crits) bits.push(`<i class="crit">${crits} chí mạng</i>`);
      if (misses.length) bits.push(`<i class="miss">${misses.length} trượt</i>`);
      parts.push(`— ${bits.join(', ')}`);
    }
    if (heals.length) parts.push(`hồi máu ${heals.map(who).join(', ')}`);
    if (!parts.length && lifts.length) {
      const uniq = [...new Set(lifts)];
      parts.push(uniq.length > 2 ? `lên ${uniq.length} mục tiêu` : `lên ${uniq.map(who).join(', ')}`);
    }
    line = `${who(actor)} dùng <span class="g">${label}</span>${parts.length ? ' ' + parts.join(' · ') : ''}.`;
  }
  if (falls.length) line += ` <i class="fell">${falls.map(u => u.e + ' ' + u.n).join(', ')} gục ngã.</i>`;

  const plain = line.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().replace(/"/g, '&quot;');
  history.unshift({ html: line, plain });
  if (history.length > HISTORY_MAX) history.length = HISTORY_MAX;
  notice = '';
  renderLog();
}

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
  const era = generation;
  for (const e of events) {
    if (era !== generation) return;   // the battle was replaced mid-animation
    const tgt = e.tgt && S.units.find(u => u.uid === e.tgt);
    const src = e.src && S.units.find(u => u.uid === e.src);
    switch (e.t) {
      case 'log':   if (e.sys) log(e.text); break;   // action lines live in the history instead
      case 'ult':   await ultCutIn(src, e.name); break;
      case 'era':   await eraCutIn(e.leadIn, e.name, e.effect); break;
      case 'spawn': refield(); await wait(260); break;
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
      case 'ep':     paint(tgt); break;
      case 'miss':   sfx.miss(); await missDodge(tgt); floatText(tgt, 'TRƯỢT', 'miss'); await wait(260); break;
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

async function missDodge(u) {
  if (REDUCED || !u || !u.node) return;
  await u.node.animate(
    [{ transform: 'translate(-50%,-100%)' },
     { transform: `translate(calc(-50% + ${u.side === 'foe' ? 16 : -16}px), -104%)`, offset: .45 },
     { transform: 'translate(-50%,-100%)' }],
    { duration: 300, easing: 'ease-out' }).finished.catch(() => {});
}

function flinch(u) {
  if (REDUCED || !u || !u.node) return;
  u.node.animate([{ filter: 'brightness(3) sepia(1) hue-rotate(-40deg)' }, { filter: 'none' }],
    { duration: 320, easing: 'ease-out' });
  u.node.animate([{ translate: '0 0' }, { translate: `${u.side === 'foe' ? 10 : -10}px 0` }, { translate: '0 0' }],
    { duration: 220, easing: 'ease-out' });
}

async function die(u) {
  if (!u || !u.node) return;
  floatText(u, '💀', 'dmg', -60);
  if (!REDUCED && u.node) {
    // fill:forwards is what keeps the body down after the keyframes end — and it
    // outlives the death, so paint() cancels it if the unit ever stands back up
    const anim = u.node.animate(
      [{ opacity: 1, rotate: '0deg' }, { opacity: 0, rotate: '80deg', translate: '0 26px' }],
      { duration: 520, easing: 'ease-in', fill: 'forwards' });
    u.node._death = anim;
    await anim.finished.catch(() => {});
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

/** The era interrupting reads differently from a unit acting: cold, and centred. */
async function eraCutIn(leadIn, name, effect) {
  sfx.ult();
  const b = $('banner'), f = $('flash'), sc = $('scrim');
  // three tiers: who is speaking, what it is, what it does
  b.innerHTML = (leadIn ? `<span class="era-lead">${leadIn}</span>` : '')
    + `<span class="era-name">${name}</span>`
    + (effect ? `<span class="era-effect">${effect}</span>` : '');
  b.style.color = '#9fd8ff';
  const dur = REDUCED ? 500 : 2200;   // long enough to actually read the effect
  sc.animate([{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 1, offset: .8 }, { opacity: 0 }], { duration: dur });
  shake();
  await b.animate([
    { opacity: 0, transform: 'scale(.86)', filter: 'blur(10px)' },
    { opacity: 1, transform: 'scale(1)', filter: 'blur(0)', offset: .2 },
    { opacity: 1, transform: 'scale(1.02)', offset: .8 },
    { opacity: 0, transform: 'scale(1.1)' }
  ], { duration: dur, easing: 'ease-out' }).finished.catch(() => {});
  b.innerHTML = '';
  f.animate([{ opacity: 0 }, { opacity: .5, offset: .1 }, { opacity: 0 }], { duration: REDUCED ? 150 : 380 });
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
