/* Boot, screen routing and the frame pump.

   Fixed timestep: the simulation only ever sees 1/60 s, so a guest's patience
   burns down at the same rate on a 144 Hz monitor as on a struggling laptop.
   Rendering happens once per animation frame regardless. */

import { Sound } from './audio.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { createSim } from './sim.js';
import { createStreet, ROW, marketReward } from './street.js';
import * as Debug from './debug.js';
import { createUI } from './ui.js';
import { vnd } from './config.js';
import { DISH, SHOP_BY_ID, FACADE_BY_ID } from './data.js';
import {
  advanceTutorialDay, buy, buyFacade, checkMissions, claimRestaurant, derived,
  displayName, learn, load, refreshEnergy, rollover, save as persist, setName,
  spendEnergy, wipe
} from './state.js';

const $ = id => document.getElementById(id);

const state = load();
const canvas = $('floor');
const renderer = createRenderer(canvas);
const input = createInput(canvas, $('stick'));

let sim = null;
let playing = false;
let paused = false;
let rulesBack = null;
let settingsBack = 'hub';
let pendingMode = 'shift';
let street = null;        // the block outside, only while the quán is open
let debugBack = 'hub';
/* Once the save is wiped, nothing may write to it again — reload fires
   `pagehide`, and that handler was cheerfully persisting the in-memory state
   straight back over the cleared slot, so "chơi lại từ đầu" reset nothing. */
let sealed = false;
const store = () => { if (!sealed) persist(state); };

let raf = 0, last = 0, acc = 0;
const STEP = 1 / 60;

Sound.init();
$('btn-mute').textContent = Sound.muted ? '🔇' : '🔊';

/* ── screen actions ───────────────────────────────────────────────────────*/
const ui = createUI(state, (act, data) => {
  Sound.unlock();
  if (Debug.state.richMode) Debug.topUp(state);
  switch (act) {
    case 'boot-go':
      state.seenIntro = true; store(); ui.showHub(); break;

    case 'wipe':
      if (confirm('Xoá toàn bộ tiến trình và chơi lại từ đầu? Không hoàn tác được.')) {
        sealed = true;
        wipe();
        location.reload();
      }
      break;

    case 'hub':      stopSim(); ui.showHub(); break;
    case 'shop':     ui.showShop(); break;
    case 'shop-tab': ui.showShop(data.cat); break;
    case 'missions': ui.showMissions(); break;
    case 'ledger':   ui.showLedger(); break;
    case 'settings':      settingsBack = ui.current() || 'hub'; ui.showSettings(Sound.muted); break;
    case 'settings-back': if (!ui.reopen(settingsBack)) ui.showHub(); break;
    case 'mute':
      $('btn-mute').textContent = Sound.toggle() ? '🔇' : '🔊';
      ui.showSettings(Sound.muted);
      break;
    case 'rules':      openRules(); break;
    case 'rules-back': closeRules(); break;

    case 'shift':    startRun('shift'); break;
    case 'idle':     startRun('idle'); break;
    case 'day-go':   beginRun(pendingMode); break;

    case 'name-save': {
      const why = setName(state, data.value ?? ui.nameInput());
      if (why) { ui.toast(why, 'bad'); return; }
      store();
      ui.toast(`📛 Quán giờ tên là <b>${displayName(state)}</b>.`, 'good');
      ui.showHub();
      break;
    }
    case 'rename':   ui.showName(true); break;

    case 'buy-facade': {
      const item = FACADE_BY_ID[data.id];
      if (!item) return;
      const why = buyFacade(state, item);
      if (why) { ui.toast(why, 'bad'); Sound.play('lose'); return; }
      store();
      Sound.play('buy');
      ui.showSigns();
      break;
    }

    case 'market-go':   ui.runMarket(res => finishMarket(res)); break;

    /* ── debug, reachable only from ?debug=1 on the URL ────────────────── */
    case 'dbg-back':
      if (!ui.reopen(debugBack)) ui.showHub();
      break;
    case 'dbg-owner':   dbgDo(Debug.becomeOwner(state)); break;
    case 'dbg-money':   dbgDo(Debug.giveMoney(state)); break;
    case 'dbg-recipes': dbgDo(Debug.unlockAllRecipes(state)); break;
    case 'dbg-shop':    dbgDo(Debug.buyAllShop(state)); break;
    case 'dbg-facade':  dbgDo(Debug.buyAllFacade(state)); break;
    case 'dbg-energy':  dbgDo(Debug.fillEnergy(state)); break;
    case 'dbg-tier':    dbgDo(Debug.setTier(state, Number(data.n))); break;
    case 'dbg-day':     dbgDo(Debug.setTutorialDay(state, Number(data.n))); break;
    case 'dbg-rich':
      Debug.state.richMode = !Debug.state.richMode;
      if (Debug.state.richMode) Debug.topUp(state);
      dbgDo(Debug.state.richMode ? 'Tiền vô hạn: BẬT' : 'Tiền vô hạn: TẮT');
      break;
    case 'dbg-speed':
      Debug.state.speed = Number(data.n);
      dbgDo(`Tốc độ ×${Debug.state.speed}`);
      break;
    case 'dbg-overlay':
      Debug.state.overlay = !Debug.state.overlay;
      dbgDo(Debug.state.overlay ? 'Hiện thông số' : 'Ẩn thông số');
      break;
    case 'dbg-guest':
      if (sim) { sim.spawnGuest(); ui.toast('🙋 Đã gọi thêm một nhóm khách.'); }
      paused = false; ui.hideAll();
      break;
    case 'dbg-endshift':
      /* straight to the report — running the closing stretch out would mean
         waiting on every seated table, which is not what "ngay" means */
      if (sim && sim.mode === 'shift' && !sim.over) { sim.timeLeft = 0; sim.finish(); }
      paused = false; ui.hideAll();
      break;
    case 'dbg-street':
      if (!playing || !sim || sim.mode !== 'idle') { startRun('idle'); }
      paused = false; ui.hideAll();
      setTimeout(goOutside, 60);
      break;
    case 'street-back': paused = false; ui.hideAll(); break;

    case 'buy':      doBuy(data.id); break;
    case 'learn':    doLearn(data.id); break;
    case 'claim':    doClaim(); break;

    case 'resume':   paused = false; ui.hideAll(); break;
    case 'quit':     stopSim(); ui.showHub(); break;
  }
});

/* ── the guide ────────────────────────────────────────────────────────────
   It can be opened from any panel, and from mid-ca via the top bar. Rather than
   tracking that by hand at every call site — which is how "Đã hiểu" ended up
   pointing at acts nobody handled — it just remembers whichever panel was on
   screen and puts it back exactly as it was. */
function openRules() {
  const open = ui.current();
  if (open && open !== 'rules') {
    rulesBack = open;
  } else if (playing) {
    paused = true;
    ui.showPause(sim);
    rulesBack = 'pause';
  } else {
    rulesBack = 'hub';
  }
  ui.showRules();
}

function closeRules() {
  if (rulesBack && ui.reopen(rulesBack)) return;
  ui.showHub();
}

/* ── shop ─────────────────────────────────────────────────────────────────*/
function withLevelWatch(fn) {
  const before = derived(state).level.n;
  const why = fn();
  if (why) { ui.toast(why, 'bad'); Sound.play('lose'); return; }
  const after = derived(state).level;
  store();
  Sound.play(after.n > before ? 'level' : 'buy');
  if (after.n > before) ui.toast(`${after.emoji} <b>Quán lên cấp: ${after.name}</b>`, 'good');
}

function doBuy(id) {
  const item = SHOP_BY_ID[id];
  if (!item) return;
  withLevelWatch(() => buy(state, item));
  ui.showShop();
}

function doLearn(id) {
  const dish = DISH[id];
  if (!dish) return;
  withLevelWatch(() => learn(state, dish));
  ui.showShop();
}

function doClaim() {
  const why = claimRestaurant(state);
  if (why) { ui.toast(why, 'bad'); return; }
  const done = checkMissions(state);
  store();
  Sound.play('level');
  ui.toast('📝 <b>Quán đã sang tên bạn!</b> Cửa hàng và chế độ mở cửa đã mở khoá.', 'good');
  for (const m of done) ui.toast(`🎉 ${m.title}${m.reward ? ` · +${vnd(m.reward)}` : ''}`, 'good');
  ui.showName(false);          // first thing a new owner does is name the place
}

/* ── running a shift or an open day ───────────────────────────────────────
   The day has to turn over *before* the ca is built, not after it. Rolling it
   at the bell meant day 3's table only showed up for day 4, and the day-8
   target rise landed after the last tutorial ca and was then cleared at the
   handover — so it never applied to a single shift. */
function startRun(mode) {
  if (mode === 'shift' && !spendEnergy(state)) {
    ui.toast('Hết lượt ca hôm nay. Đầy lại lúc 00:00.', 'bad');
    return;
  }

  if (mode === 'shift') {
    const events = advanceTutorialDay(state);
    store();
    if (events.length) {
      pendingMode = mode;
      ui.showDayBriefing(state.tutorialDay, events);
      return;
    }
  }
  beginRun(mode);
}

function beginRun(mode) {
  store();
  sim = createSim(state, mode);
  playing = true;
  paused = false;
  ui.hideAll();
  ui.setHudVisible(true);
  if (mode === 'idle' && state.owner) {
    ui.toast('🚶 Quán đang mở — <b>bước ra cửa</b> là ra phố dạo được.', 'good');
  }
  $('touch').hidden = !isTouch();
  renderer.resize();
  last = performance.now();
  acc = 0;
  if (!raf) raf = requestAnimationFrame(frame);
}

/* every debug action re-renders the panel so its read-out stays honest */
function dbgDo(message) {
  store();
  if (message) ui.toast(`🐞 ${message}`);
  ui.showDebug(playing);
}

function finishMarket(hits) {
  const r = marketReward(hits);
  if (r.ca > 0) {
    state.marketBuff = { ca: r.ca, cut: r.cut };
    store();
  }
  ui.showMarketResult(hits, r);
}

function stopSim() {
  street = null;
  playing = false;
  paused = false;
  sim = null;
  rulesBack = null;
  ui.setHudVisible(false);
  ui.setPrompt(null);
  $('touch').hidden = true;
  store();
}

function endShift() {
  street = null;
  const r = sim.report;
  state.stats.shifts++;
  state.stats.revenue += r.revenue;
  state.stats.tips += r.tips;
  if (r.revenue > state.stats.bestShift) state.stats.bestShift = r.revenue;

  /* the market run and the trending dish each cover a number of ca */
  if (state.marketBuff?.ca > 0 && --state.marketBuff.ca <= 0) state.marketBuff = 0;
  if (state.trend?.ca > 0 && --state.trend.ca <= 0) state.trend = null;

  const earned = checkMissions(state, r);
  store();

  playing = false;
  ui.setHudVisible(false);
  ui.setPrompt(null);
  $('touch').hidden = true;
  Sound.play(r.passed ? 'win' : 'lose');
  for (const m of earned) Sound.play('mission');
  ui.showResult(r, earned);
  sim = null;
}

/* ── frame pump ───────────────────────────────────────────────────────────*/
function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.25, (now - last) / 1000) * (Debug.state.on ? Debug.state.speed : 1);
  last = now;
  if (Debug.state.richMode) Debug.topUp(state);
  if (!sim) { ui.updateDebug(null); return; }

  /* Outside, the street owns the frame — including while one of its screens is
     open, so the market or the sign shop sits over the pavement rather than
     over a dining room the player is not standing in. */
  if (playing && street) {
    if (!paused) {
      const { ax, ay } = input.axis();
      street.movePlayer(ax, ay, dt);
      street.update(dt);
      if (input.consumeInteract()) {
        enterBuilding(street.interact());
        if (!street) return;          // walked back into the quán
      }
      if (input.consumePause()) { paused = true; ui.showPause(sim); }
    }
    const t = !paused ? street.targetFor() : null;
    ui.setPrompt(t ? t.prompt : null);
    renderer.drawStreet(street, state, t, dt);
    ui.updateHud(sim, true);
    ui.updateDebug(sim);
    return;
  }

  if (playing && !paused) {
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard++ < 8) {
      const { ax, ay } = input.axis();
      sim.movePlayer(ax, ay, STEP);
      sim.update(STEP);
      acc -= STEP;
      if (sim.over) break;
    }
    /* stepping out of the door, but only when the quán is just ticking over */
    if (sim.mode === 'idle' && sim.player.y > sim.world.door.y - 0.35) goOutside();
    if (input.consumeInteract() && !sim.over) {
      if (!sim.interact()) Sound.play('step');
    }
    if (input.consumePause()) { paused = true; ui.showPause(sim); }
    drainEvents();
  }

  const target = sim.targetFor(sim.player);
  ui.setPrompt(playing && !paused ? promptFor(target, sim) : null);
  renderer.draw(sim, state, target, dt);
  if (playing && !paused) { ui.updateHud(sim); ui.updateOrders(sim); }
  ui.updateDebug(sim);

  if (sim.over) { endShift(); return; }

  /* the open-day mode has no bell, so the till is written back periodically */
  if (playing && sim.mode === 'idle' && (sim.t | 0) % 15 === 0 && sim.t - (sim.lastSave || 0) > 15) {
    sim.lastSave = sim.t;
    store();
  }
}

function promptFor(target, sim) {
  if (!target) return null;
  switch (target.kind) {
    case 'menu':    return 'Đưa menu cho khách';
    case 'ticket':  return 'Lấy phiếu gọi món';
    case 'serve':   return 'Bưng món ra bàn';
    case 'bill':    return `Thu tiền bàn ${target.table.id + 1}`;
    case 'handoff': return `Báo bếp (${sim.player.tickets.length} phiếu)`;
    case 'pickup':  return `Lấy món (${sim.kitchen.pass.length} dĩa đang chờ)`;
    case 'trash':   return target.dead
      ? `Bỏ ${target.count} món hỏng vào thùng`
      : `Bỏ ${target.count} món vào thùng rác`;
  }
  return null;
}

function drainEvents() {
  for (const e of sim.drainEvents()) {
    Sound.play(e.kind);
    if (e.kind === 'pay' && e.x != null) renderer.floater(e.x, e.y, e.text, '#8ef7a8');
    if (e.kind === 'angry' && e.x != null) renderer.floater(e.x, e.y, e.text, '#ff8a80');
    if (e.kind === 'ticket' && e.player) ui.toast(`🎫 <b>Bàn ${e.table}</b> gọi: ${e.text}`);
    if (e.kind === 'serve' && e.player)  ui.toast(`🍽️ <b>Bàn ${e.table}</b> nhận: ${e.text}`, 'good');
    if (e.kind === 'closing') {
      ui.toast(e.tables
        ? `🧹 <b>Hết giờ!</b> Không nhận khách mới — phục vụ nốt ${e.tables} bàn đang ngồi.`
        : '🧹 <b>Hết giờ!</b> Quán đã sạch bàn.', 'good');
    }
    if (e.kind === 'trash') ui.toast(`🗑️ Đã bỏ ${e.n} món vào thùng rác.`);
    if (e.kind === 'waste') ui.toast(`😖 ${e.n} món hỏng — khách bàn đó về mất rồi. Mang ra <b>thùng rác</b> để trống tay.`, 'bad');
    if (e.kind === 'lost' && sim.mode === 'shift') ui.toast('Khách thấy quán đông quá, đi luôn.', 'bad');
  }
}

/* ── stepping outside ─────────────────────────────────────────────────────
   Only in the open-quán mode: during a ca there is no time, and before the
   handover it is not your shopfront to look at. */
function goOutside() {
  if (street || !state.owner || !sim || sim.mode !== 'idle') return;
  street = createStreet(state, displayName(state));
  street.player.x = 16;
  street.player.y = ROW.WALK_TOP + 0.4;
  Sound.play('seat');
  ui.toast('🚶 Ra ngoài dạo phố. Quán vẫn mở, nhân viên trông giúp.', 'good');
}

function goInside() {
  street = null;
  if (sim) { sim.player.x = sim.world.door.x; sim.player.y = sim.world.door.y - 1.4; }
  Sound.play('seat');
}

function enterBuilding(kind) {
  if (!kind) return;
  switch (kind) {
    case 'home':    goInside(); break;
    case 'market':  paused = true; ui.showMarket(); break;
    case 'signs':   paused = true; ui.showSigns(); break;
    case 'cafe':    paused = true; ui.showCafe(cafeVisit()); break;
    case 'flavour': ui.toast(pickOne([
      '🏪 Bà Năm: "Dạo này quán con đông ha, cô mừng."',
      '🏪 Bà Năm: "Mai cô nhập được mớ rau ngon, ghé lấy nghen."',
      '🏪 Bà Năm: "Thằng nhỏ nhà cô cứ đòi qua ăn hoài đó."'
    ])); break;
  }
}

const pickOne = a => a[(Math.random() * a.length) | 0];

/* a coffee with a neighbour: small money, or word that a dish is trending */
function cafeVisit() {
  const menu = derived(state).mains;
  const roll = Math.random();
  if (roll < 0.45 && menu.length) {
    const dish = menu[(Math.random() * menu.length) | 0];
    state.trend = { id: dish.id, ca: 1 };
    store();
    return { kind: 'trend', dish, text: `Cả xóm đang thèm ${dish.name}. Ca sau bán món đó được giá hơn.` };
  }
  if (roll < 0.75) {
    const tip = 30000 + Math.floor(Math.random() * 12) * 10000;
    state.money += tip;
    store();
    return { kind: 'tip', amount: tip, text: 'Ông Bảy hàng xóm gửi tiền cà phê tháng trước.' };
  }
  return { kind: 'chat', text: pickOne([
    'Chú Tư kể chuyện hồi xưa cả buổi. Cũng vui.',
    'Bàn bên cạnh cãi nhau vụ bóng đá. Nghe ké cũng đỡ mệt.',
    'Cô chủ quán cà phê khen biển hiệu quán bạn đẹp.'
  ]) };
}

/* ── chrome ───────────────────────────────────────────────────────────────*/
$('btn-rules').addEventListener('click', () => { Sound.unlock(); openRules(); });

$('btn-mute').addEventListener('click', () => {
  Sound.unlock();
  $('btn-mute').textContent = Sound.toggle() ? '🔇' : '🔊';
});

$('btn-pause').addEventListener('click', () => {
  if (!playing) return;
  paused = true;
  ui.showPause(sim);
});

const act = $('btn-act');
act.addEventListener('touchstart', e => { e.preventDefault(); Sound.unlock(); input.tapInteract(); }, { passive: false });
act.addEventListener('click', () => { Sound.unlock(); input.tapInteract(); });

window.addEventListener('keydown', e => {
  if (e.code === 'KeyM') { $('btn-mute').textContent = Sound.toggle() ? '🔇' : '🔊'; }
  /* the console key, once debug mode is on */
  if (e.code === 'Backquote' && Debug.state.on) {
    e.preventDefault();
    if (ui.openScreen('debug')) { paused = false; ui.hideAll(); return; }
    debugBack = ui.current() || 'hub';
    if (playing) paused = true;
    ui.showDebug(playing);
  }
});

window.addEventListener('resize', () => renderer.resize());
window.addEventListener('orientationchange', () => setTimeout(() => renderer.resize(), 120));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (playing) { paused = true; if (sim) ui.showPause(sim); } store(); }
});
window.addEventListener('pagehide', () => store());

/* A desktop with a touchscreen still has a mouse as its primary pointer, and
   Chrome defines `ontouchstart` on desktop regardless — so neither of those is
   the question. What matters is whether the primary input can hover and aim
   precisely, which is exactly what this media query asks. */
function isTouch() {
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

/* Module scope is invisible to devtools and to the headless driver, so the two
   things worth poking at get an explicit handle. Read-only by convention. */
window.__quanAn = {
  state,
  get sim() { return sim; },
  get street() { return street; },
  get playing() { return playing; }
};

/* ── boot ─────────────────────────────────────────────────────────────────*/
if (Debug.enabledByUrl(location.search, location.hash)) Debug.state.on = true;
renderer.resize();
refreshEnergy(state);
const dayReport = rollover(state);
store();
ui.showBoot(dayReport);
