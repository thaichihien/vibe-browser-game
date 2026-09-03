/* Router: menu → the roll → battle → results → shop.
   Everything DOM-shaped lives here and in ui/; engine/ and data/ stay clean. */

import { ERAS } from './data/themes.js';
import { CONSUMABLES, RELICS, SHOP, byId } from './data/shop.js';
import { generate } from './engine/generator.js';
import { FORMAT_WORTH, fleeCost, FLEE_GRACE_TURNS, winShards, lossShards } from './engine/formats.js';
import { createBattle, nextActor, openTurn, turnOrder, resolve, legalMoves,
         targetsFor, needsTarget, living, checkEnd, statOf,
         hitChance, critChance } from './engine/combat.js';
import { chooseAction } from './engine/ai.js';
import { useItem } from './engine/items.js';
import { tagOf, WAIT_KIND, DMG } from './engine/moves.js';
import * as view from './ui/battle-view.js';
import { save, flush, buy, priceOf, hasRelic, isRelic, satchelSize, SATCHEL_MAX, setSatchel, consume, recordResult, muted } from './state.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const screens = ['menu', 'roll', 'battle', 'shop', 'satchel'];
const show = (name) => {
  screens.forEach(s => { $('screen-' + s).hidden = s !== name; });
  document.body.classList.toggle('in-battle', name === 'battle');
};

let B = null;              // live battle state
let busy = false;
let pending = null;        // { kind:'move'|'item', payload }
let usedHourglass = false;

/* ── menu ───────────────────────────────────────────────────── */
function renderMenu() {
  show('menu');
  $('purse').textContent = `⧗ ${save.shards}`;
  $('menu-stats').innerHTML = `
    <div><b>${save.score}</b>ĐIỂM TÍCH LUỸ</div>
    <div><b>${save.best}</b>TRẬN CAO NHẤT</div>
    <div><b>${save.wins}/${save.wins + save.losses}</b>THẮNG</div>
    <div><b>${save.seen.length}/${ERAS.length}</b>THỜI ĐẠI ĐÃ QUA</div>`;
  const bag = save.satchel.filter(id => (save.stock[id] || 0) > 0)
    .map(id => { const i = byId(id); return i ? `${i.icon} ${i.name} ×${save.stock[id]}` : null; }).filter(Boolean);
  const owned = Object.keys(save.stock).length;
  $('menu-satchel').textContent = bag.length
    ? `Túi đồ (${bag.length}/${satchelSize()}): ${bag.join(' · ')}`
    : owned
      ? `Bạn có đồ nhưng chưa xếp vào túi — bấm 🧳 SẮP TÚI.`
      : `Túi đồ trống — thắng vài trận rồi ghé 🎒 CỬA HÀNG mua đồ.`;
}

/* ── the roll ───────────────────────────────────────────────── */
async function rollAndStart() {
  const g = generate(ERAS);
  show('roll');
  $('btn-enter').hidden = true;
  const lines = [...document.querySelectorAll('.roll-line')];
  lines.forEach(l => l.classList.remove('in'));
  const text = {
    era: `${g.era.name} — ${g.title}`,
    sides: `${g.foeSide} ⚔ ${g.yourSide}`,
    fmt: `${g.format.name} · ${g.format.blurb}`,
    diff: `${g.difficulty.stars} ${g.difficulty.name}`,
    you: `${g.yourSide} — ${g.mine.length} chọi ${g.foes.length}`
  };
  for (const l of lines) {
    l.querySelector('b').textContent = text[l.dataset.k];
    l.classList.add('in');
    sfx.select();
    await view.wait(340);
  }
  $('btn-enter').hidden = false;
  $('btn-enter').onclick = () => startBattle(g);
}

/* ── battle ─────────────────────────────────────────────────── */
function startBattle(g) {
  B = createBattle({ era: g.era, format: g.format, mine: g.mine, foes: g.foes,
                     difficulty: g.difficulty, rng: g.rng, seed: g.seed });
  B.title = g.title; B.yourSide = g.yourSide; B.foeSide = g.foeSide;
  usedHourglass = false;

  // relics apply once, at the top of the battle
  for (const u of living(B, 'ally')) {
    if (hasRelic('gloves')) u.pwr = Math.round(u.pwr * 1.08);
    if (hasRelic('watch')) u.spd = Math.round(u.spd * 1.05);
    if (hasRelic('helmet')) u.buffs.push({ stat: 'grd', pct: 10, t: 999 }, { stat: 'wrd', pct: 10, t: 999 });
    if (hasRelic('marker')) u.charge = 25;
  }

  B.bag = save.satchel.filter(id => (save.stock[id] || 0) > 0);
  show('battle');
  view.mount(B);
  view.log(`Bạn trôi vào <b>${g.title}</b> — ${g.format.blurb} — chỉ huy <span class="g">${g.yourSide}</span>, ${g.mine.length} chọi ${g.foes.length}.`);
  turnLoop();
}

async function turnLoop() {
  if (!B || B.over) return;
  if (checkEnd(B)) return finish();

  const actor = nextActor(B);
  if (!actor) return finish();

  view.setActive(actor);
  view.drawTimeline([actor, ...turnOrder(B, 8)]);

  const opening = openTurn(B, actor);
  if (opening.length) { busy = true; await view.play(opening); busy = false; }
  if (!actor.alive) return turnLoop();
  if (opening.some(e => e.t === 'skip')) return afterAction(actor);
  if (checkEnd(B)) return finish();

  if (actor.side === 'ally') showDeck(actor);
  else { showDeck(null, `${actor.n} đang suy tính…`); await view.wait(520); await aiTurn(actor); }
}

async function afterAction(actor) {
  if (B.over) return finish();
  if (actor.alive && actor.extraTurns > 0) {   // Time Stop, and the power bank
    actor.extraTurns--;
    view.setActive(actor);
    if (actor.side === 'ally') return showDeck(actor);
    await view.wait(420);
    return aiTurn(actor);
  }
  turnLoop();
}

/* The deck holds the move buttons and the log. Both used to resize as the battle
   went on — the grid emptied on every AI turn, the log grew from one entry to five —
   which walked the whole lower half of the screen up and down. Everything below now
   reserves its space: a fixed slot count, a uniform button height, five log rows. */
const MOVE_SLOTS = 6;

/** The one place a move button's markup is written, so a placeholder is exactly a
    blank one and the grid cannot change height between turns. */
const moveHTML = ({ key = '&nbsp;', name = '&nbsp;', cost = '', sub = '&nbsp;', odds = '&nbsp;' }) =>
  `<span class="top"><span class="key">${key}</span><span class="nm">${name}</span>${cost}</span>` +
  `<span class="sub"><span class="txt">${sub}</span><span class="odds">${odds}</span></span>`;

function padSlots(box) {
  for (let i = box.children.length; i < MOVE_SLOTS; i++) {
    const g = document.createElement('button');
    g.className = 'move ghost';
    g.disabled = true;
    g.tabIndex = -1;
    g.setAttribute('aria-hidden', 'true');
    g.innerHTML = moveHTML({});
    box.appendChild(g);
  }
}

function showDeck(actor, msg) {
  const box = $('moves');
  box.innerHTML = '';
  $('deck-who').textContent = actor ? actor.n : (B.actorName || '—');
  $('deck-ep').innerHTML = actor
    ? `<span class="ep-pip"><i style="width:${(actor.ep / actor.epMax) * 100}%"></i></span>`
      + `<span class="ep-num">${Math.round(actor.ep)}/${actor.epMax} NL</span>` : '';
  $('deck-hint').textContent = actor ? 'Chọn chiêu, rồi chọn mục tiêu.' : (msg || '');
  renderSatchel(actor);
  renderFlee(actor);
  if (!actor) { padSlots(box); return; }
  B.actorName = actor.n;

  legalMoves(B, actor).forEach((m, i) => {
    const b = document.createElement('button');
    b.className = 'move' + (m.isUlt ? ' ult' : '') + (m.kind === WAIT_KIND ? ' wait' : '');
    b.disabled = !!m.locked;
    const key = m.kind === WAIT_KIND ? '0' : String(i + 1);
    const sub = m.lockReason === 'charge' ? `đang nạp ${Math.round(actor.charge)}/100`
              : m.lockReason === 'silenced' ? 'bị câm lặng'
              : m.lockReason === 'ep' ? `thiếu năng lượng (cần ${m.cost}, còn ${Math.round(actor.ep)})`
              : tagOf(m, B.era);
    // odds are part of the decision, so they belong on the button
    const odds = m.kind === DMG
      ? `🎯 ${hitChance(actor, worstTarget(actor, m), m)}% · 💥 ${critChance(actor, m)}%` : '&nbsp;';
    const cost = m.cost > 0 ? `<span class="cost">${m.cost} NL</span>` : '';
    b.title = `${m.name} — ${sub}${m.cost ? ` · ${m.cost} năng lượng` : ''}`;
    b.innerHTML = moveHTML({ key, name: m.isUlt ? '★ ' + m.name : m.name, cost, sub, odds });
    b.onclick = () => pickMove(actor, m);
    box.appendChild(b);
  });
  padSlots(box);
}

let fleeArmed = false;

function renderFlee(actor) {
  const b = $('btn-flee');
  const live = actor && actor.side === 'ally' && !B.over;
  b.hidden = false;                       // stays in the layout; only its ink changes
  b.disabled = !live;
  b.style.visibility = live ? 'visible' : 'hidden';
  if (!live) { fleeArmed = false; return; }
  const cost = Math.min(save.shards, fleeCost(B.difficulty, B.format, B.turns));
  b.className = 'ctl flee' + (fleeArmed ? ' armed' : '') + (cost ? ' costly' : '');
  b.textContent = fleeArmed
    ? 'BẤM LẦN NỮA ĐỂ CHẠY'
    : cost ? `🏳️ BỎ CHẠY (−${cost} ⧗)` : '🏳️ BỎ CHẠY';
  b.title = cost
    ? `Bỏ chạy trong ${FLEE_GRACE_TURNS} lượt đầu phải trả ${cost} ⧗ mảnh thời gian.`
    : `Sau lượt ${FLEE_GRACE_TURNS} thì bỏ chạy không mất phí, nhưng cũng không có thưởng.`;
}

function onFlee() {
  if (busy || B.over) return;
  if (!fleeArmed) { fleeArmed = true; sfx.select(); return renderFlee(B.units.find(u => u.node.classList.contains('active'))); }
  fleeArmed = false;
  B.fled = true;
  B.over = true;
  B.won = false;
  finish();
}

/** Show the odds against the likeliest target, so the number means something. */
function worstTarget(actor, m) {
  const foes = living(B, actor.side === 'ally' ? 'foe' : 'ally');
  const wall = foes.filter(f => f.taunt > 0);
  const pool = wall.length && !m.all ? wall : foes;
  return pool.reduce((a, b) => statOf(a, 'spd') >= statOf(b, 'spd') ? a : b, pool[0]) || actor;
}

function renderSatchel(actor) {
  const row = $('satchel-row');
  row.innerHTML = '';
  if (!actor || actor.side !== 'ally') {
    row.innerHTML = '<span class="sat-note">&nbsp;</span>';
    return;
  }
  if (!B.bag.length) {
    // never leave the player staring at a blank strip wondering where items went
    row.innerHTML = Object.keys(save.stock).length
      ? `<span class="sat-note">Túi rỗng trận này — xếp đồ ở 🧳 SẮP TÚI trước khi vào trận.</span>`
      : `<span class="sat-note">Chưa có đồ. Thắng trận để lấy ⧗ rồi ghé 🎒 CỬA HÀNG.</span>`;
    return;
  }
  const keys = ['Q', 'W', 'E', 'R', 'T'];
  row.innerHTML = '<span class="sat-note">TÚI ĐỒ</span>';
  B.bag.forEach((id, i) => {
    const item = byId(id);
    const b = document.createElement('button');
    b.className = 'sat';
    b.title = item.desc;
    b.innerHTML = `<span class="k">${keys[i]}</span>${item.icon} ${item.name}`
      + `<span class="n">×${save.stock[item.id] || 0}</span>`;
    b.onclick = () => pickItem(actor, item);
    row.appendChild(b);
  });
}

async function pickMove(actor, m) {
  if (busy || B.over || m.locked) return;
  sfx.select();
  let tgt = null;
  if (needsTarget(m)) {
    const ids = targetsFor(B, actor, m);
    if (!ids.length) return;
    $('deck-hint').textContent = m.kind === 'heal' ? 'Chọn đồng đội.' : 'Chọn mục tiêu.';
    pending = { kind: 'move' };
    tgt = await view.askTarget(ids);
    pending = null;
    if (!tgt) return showDeck(actor);
  }
  busy = true;
  $('moves').innerHTML = ''; padSlots($('moves'));
  $('deck-hint').textContent = 'đang xử lý…';
  sfx.confirm();
  const ev = resolve(B, actor, m, tgt);
  view.record(actor, m.kind === WAIT_KIND ? null : m.name, ev);
  await view.play(ev);
  busy = false;
  afterAction(actor);
}

async function pickItem(actor, item) {
  if (busy || B.over) return;
  let tgt = null;
  if (item.target) {
    const side = item.target === 'ally' ? 'ally' : 'foe';
    const ids = living(B, actor.side === 'ally' ? (side === 'ally' ? 'ally' : 'foe') : side).map(u => u.uid);
    if (!ids.length) return;
    $('deck-hint').textContent = 'Chọn mục tiêu cho vật phẩm.';
    tgt = await view.askTarget(ids);
    if (!tgt) return showDeck(actor);
  }
  const ev = useItem(B, actor, item, tgt);
  if (!ev) { view.log('Không dùng được lúc này.'); return showDeck(actor); }
  consume(item.id);
  B.bag = B.bag.filter(id => id !== item.id || (save.stock[id] || 0) > 0);
  busy = true;
  $('moves').innerHTML = ''; padSlots($('moves'));
  sfx.coin();
  view.record(actor, `${item.icon} ${item.name}`, ev);
  await view.play(ev);
  busy = false;
  if (checkEnd(B)) return finish();
  afterAction(actor);
}

async function aiTurn(actor) {
  const { move, targetUid } = chooseAction(B, actor);
  busy = true;
  const ev = resolve(B, actor, move, targetUid);
  view.record(actor, move.kind === WAIT_KIND ? null : move.name, ev);
  await view.play(ev);
  busy = false;
  afterAction(actor);
}

/* ── results ────────────────────────────────────────────────── */
function finish() {
  const won = B.won;
  if (B.fled) return finishFlight();
  const rounds = Math.ceil(B.turns / Math.max(1, B.units.length));
  const noDeaths = B.units.filter(u => u.side === 'ally').every(u => u.alive);
  const worth = FORMAT_WORTH[B.format.key] || 2;

  let score = 0, shards = 0;
  if (won) {
    score = Math.round(100 * B.difficulty.reward * worth);
    if (noDeaths) score += 150;
    if (B.turns <= B.format.par) score += 100;
    shards = winShards(B.difficulty, B.format);
  } else {
    shards = lossShards(B.difficulty, B.format);
  }
  recordResult({ won, score, shards, eraKey: B.era.key });
  won ? sfx.win() : sfx.lose();

  $('ov-title').textContent = won ? 'CHIẾN THẮNG' : 'THẤT BẠI';
  $('ov-title').style.color = won ? 'var(--gold)' : 'var(--foe)';
  $('ov-body').innerHTML = won
    ? `Bạn đã giữ vững <b>${B.yourSide}</b> qua <b>${B.title}</b> sau ${B.turns} lượt.<br>
       +${score} điểm · +${shards} ⧗ mảnh thời gian${noDeaths ? '<br>Không thiệt một ai.' : ''}`
    : `<b>${B.yourSide}</b> tan vỡ tại <b>${B.title}</b>.<br>
       +${shards} ⧗ mảnh thời gian — chút an ủi của kẻ chứng kiến.`;
  $('overlay').hidden = false;
  view.setActive(null);
  showDeck(null, won ? 'Thời đại thả bạn đi.' : 'Thời đại giữ bạn lại.');
}

function finishFlight() {
  const cost = Math.min(save.shards, fleeCost(B.difficulty, B.format, B.turns));
  recordResult({ won: false, score: 0, shards: -cost, eraKey: B.era.key, fled: true });
  sfx.lose();
  $('ov-title').textContent = 'BỎ CHẠY';
  $('ov-title').style.color = 'var(--ink-dim)';
  $('ov-body').innerHTML = cost
    ? `Bạn rút khỏi <b>${B.title}</b> sau ${B.turns} lượt — quá sớm để thời đại tha cho.<br>
       −${cost} ⧗ mảnh thời gian.`
    : `Bạn rút khỏi <b>${B.title}</b> sau ${B.turns} lượt.<br>
       Không mất gì, nhưng cũng không mang được gì về.`;
  $('overlay').hidden = false;
  view.setActive(null);
  showDeck(null, 'Thời đại khép lại sau lưng bạn.');
}

/* ── shop ───────────────────────────────────────────────────── */
let shopTab = 'consumable';
function renderShop() {
  show('shop');
  $('purse').textContent = `⧗ ${save.shards}`;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === shopTab));
  const list = shopTab === 'consumable' ? CONSUMABLES : RELICS;
  const grid = $('shop-grid');
  grid.innerHTML = '';
  for (const item of list) {
    const price = priceOf(item);
    const owned = shopTab === 'relic' ? hasRelic(item.id) : (save.stock[item.id] || 0);
    const b = document.createElement('button');
    b.className = 'item';
    b.disabled = save.shards < price || (shopTab === 'relic' && owned);
    b.innerHTML = `
      <span class="row"><span class="ico">${item.icon}</span><span class="nm">${item.name}</span>
      <span class="pr">⧗ ${price}</span></span>
      <span class="ds">${item.desc}</span>
      ${owned ? `<span class="own">${shopTab === 'relic' ? 'ĐÃ SỞ HỮU' : 'ĐANG CÓ ' + owned}</span>` : ''}`;
    b.onclick = () => {
      if (!buy(item)) return;
      sfx.coin();
      if (!isRelic(item.id)) {
        const armed = save.satchel.includes(item.id);
        $('shop-msg').textContent = armed
          ? `${item.icon} ${item.name} đã vào túi — dùng được ngay trận sau.`
          : `${item.icon} ${item.name} đã mua, nhưng túi đã đầy (${satchelSize()} ô). Đổi đồ ở 🧳 SẮP TÚI.`;
      }
      renderShop();
    };
    grid.appendChild(b);
  }
}

/* ── satchel loadout ────────────────────────────────────────── */
function renderSatchelScreen() {
  show('satchel');
  const cap = satchelSize();
  $('satchel-note').textContent =
    `Chọn tối đa ${cap} món mang theo trận sau. Dùng một món tốn nguyên lượt của nhân vật đó.`;
  const grid = $('satchel-grid');
  grid.innerHTML = '';
  const owned = CONSUMABLES.filter(i => (save.stock[i.id] || 0) > 0);
  if (!owned.length) {
    grid.innerHTML = `<p class="note">Chưa có món nào. Ghé cửa hàng trước đã.</p>`;
    return;
  }
  for (const item of owned) {
    const picked = save.satchel.includes(item.id);
    const b = document.createElement('button');
    b.className = 'item' + (picked ? ' picked' : '');
    b.innerHTML = `
      <span class="row"><span class="ico">${item.icon}</span><span class="nm">${item.name}</span>
      <span class="pr">×${save.stock[item.id]}</span></span>
      <span class="ds">${item.desc}</span>
      ${picked ? '<span class="own">ĐANG MANG THEO</span>' : ''}`;
    b.onclick = () => {
      const next = picked ? save.satchel.filter(x => x !== item.id)
                          : [...save.satchel, item.id].slice(0, cap);
      setSatchel(next);
      sfx.select();
      renderSatchelScreen();
    };
    grid.appendChild(b);
  }
}

/* ── wiring ─────────────────────────────────────────────────── */
$('btn-play').onclick = () => { $('overlay').hidden = true; rollAndStart(); };
$('btn-shop').onclick = renderShop;
$('btn-satchel').onclick = renderSatchelScreen;
$('btn-shop-back').onclick = renderMenu;
$('btn-satchel-back').onclick = renderMenu;
document.querySelectorAll('.tab').forEach(t => t.onclick = () => { shopTab = t.dataset.tab; renderShop(); });
$('ov-again').onclick = () => { $('overlay').hidden = true; rollAndStart(); };
$('ov-menu').onclick = () => { $('overlay').hidden = true; renderMenu(); };
$('btn-flee').onclick = onFlee;
$('btn-rules').onclick = () => { $('rules').hidden = false; };
$('rules-close').onclick = () => { $('rules').hidden = true; };

const muteBtn = $('btn-mute');
const paintMute = () => { muteBtn.textContent = muted.value ? '🔇' : '🔊'; };
muteBtn.onclick = () => { muted.value = !muted.value; paintMute(); };
paintMute();

addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!$('rules').hidden) return void ($('rules').hidden = true);
    if (view.askTarget.cancel) { view.askTarget.cancel(); return; }
    view.resetInspect();
    return;
  }
  if (e.key.toLowerCase() === 'm') { muted.value = !muted.value; paintMute(); return; }
  if (busy || !B || B.over || $('screen-battle').hidden) return;
  const bagKeys = { q: 0, w: 1, e: 2, r: 3, t: 4 };
  const k = e.key.toLowerCase();
  if (k in bagKeys) { document.querySelectorAll('.sat')[bagKeys[k]]?.click(); return; }
  const idx = e.key === '0' ? 99 : parseInt(e.key, 10) - 1;
  const btns = [...$('moves').querySelectorAll('.move:not(.ghost)')];   // never the placeholders
  if (idx === 99) btns.at(-1)?.click();
  else if (btns[idx] && !btns[idx].disabled) btns[idx].click();
});

// expose a little surface for the verification harness
window.CD = { get battle() { return B; }, ERAS, save, generate, renderMenu, view, satchelSize };

renderMenu();
