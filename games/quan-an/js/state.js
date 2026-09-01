/* The save file, the derived stat block, and the money that moves between days.

   Everything the player owns is a flat map of shop ids, so a save from an older
   build still loads — unknown ids are ignored, missing ones just read as 0.
   DOM-free apart from localStorage, which is fenced behind try/catch. */

import {
  BASE_CARRY, BASE_PASS_SLOTS, DAILY_OVERHEAD, ENERGY_BY_LEVEL, FOOD_COST_RATIO,
  OFFLINE_CAP_HOURS, OFFLINE_EFFICIENCY, WAITER_THROUGHPUT, clamp, idleArrivalsPerMin
} from './config.js';
import { DISH, LEVELS, SHOP_BY_ID, FACADE_BY_ID, weightedAvgPrice, weightedAvgCook,
  STARTER_DISHES, levelFor, MISSIONS, CLAIM_FEE, TUTORIAL_EVENTS } from './data.js';

const KEY = 'quanAn.save';
export const MUTE_KEY = 'quanAn.muted';

export const STARTING_TABLES = 2;   // the quán you inherit already has two

/* local calendar day — energy resets at 00:00 the player's own midnight */
export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function fresh() {
  return {
    v: 1,
    money: 0,
    owner: false,
    owned: {},                       // shop id -> 1
    recipes: [...STARTER_DISHES],
    invested: 0,
    tutorialDay: 0,
    bonusTables: 0,
    targetBoost: 0,   // the old owner raising the bar as the quán fills up
    name: '',         // what the sign outside says, chosen at the handover
    facade: {},       // shopfront pieces bought from the sign shop
    marketBuff: 0,    // ca remaining on a cheap run at the wholesale market   // tables the old owner added while you worked here
    energy: 5,
    energyDay: todayKey(),
    ledgerDay: todayKey(),
    missionsDone: [],
    progress: { groups: 0, tickets: 0, plates: 0, green: 0, angry: 0 },
    stats: { shifts: 0, revenue: 0, tips: 0, days: 0, bestShift: 0 },
    lastSeen: Date.now(),
    seenIntro: false
  };
}

export function load() {
  let s;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { s = null; }
  if (!s || typeof s !== 'object') return fresh();
  const base = fresh();
  return {
    ...base, ...s,
    owned: { ...s.owned },
    recipes: [...new Set([...STARTER_DISHES, ...(s.recipes || [])])],
    facade: { ...(s.facade || {}) },
    progress: { ...base.progress, ...(s.progress || {}) },
    stats: { ...base.stats, ...(s.stats || {}) },
    missionsDone: [...(s.missionsDone || [])]
  };
}

export function save(s) {
  s.lastSeen = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

export function wipe() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/* ── derived stats ────────────────────────────────────────────────────────
   One pure function so the sim, the shop preview and the HUD never disagree
   about what a purchase actually does. */
export function derived(s) {
  const d = {
    tables: STARTING_TABLES + (s.bonusTables || 0), waiters: 0, chefs: 1,
    carry: BASE_CARRY, passSlots: BASE_PASS_SLOTS,
    comfort: 1, charm: 1, draw: 1,
    cookMult: 1, menuMult: 1, payMult: 1,
    autoPay: false, wages: 0
  };

  for (const id of Object.keys(s.facade || {})) {
    const f = FACADE_BY_ID[id];
    if (f && s.facade[id]) d.draw += f.draw || 0;
  }

  for (const id of Object.keys(s.owned)) {
    const item = SHOP_BY_ID[id];
    if (!item || !s.owned[id]) continue;
    const e = item.eff || {};
    d.tables    += e.tables    || 0;
    d.waiters   += e.waiters   || 0;
    d.chefs     += e.chefs     || 0;
    d.carry     += e.carry     || 0;
    d.passSlots += e.passSlots || 0;
    d.comfort   += e.comfort   || 0;
    d.charm     += e.charm     || 0;
    d.draw      += e.draw      || 0;
    if (e.cookSpeed) d.cookMult *= (1 - e.cookSpeed);
    if (e.menuSpeed) d.menuMult *= (1 - e.menuSpeed);
    if (e.payFast)   d.payMult  *= (1 - e.payFast);
    if (e.autoPay)   d.autoPay = true;
    if (item.wage)   d.wages += item.wage;
  }

  d.tables   = Math.min(d.tables, 8);
  d.chefs    = Math.min(d.chefs, 3);
  d.cookMult = clamp(d.cookMult, 0.35, 1);
  d.menuMult = clamp(d.menuMult, 0.5, 1);
  d.payMult  = clamp(d.payMult, 0.4, 1);

  d.targetMult = 1 + (s.targetBoost || 0);
  d.level     = levelFor(s.invested);
  d.overhead  = DAILY_OVERHEAD[d.level.n];
  d.maxEnergy = ENERGY_BY_LEVEL[d.level.n];
  d.dailyCost = d.overhead + d.wages;
  d.menu      = s.recipes.map(id => DISH[id]).filter(Boolean);
  d.avgCheck  = d.menu.length
    ? d.menu.reduce((a, x) => a + x.price, 0) / d.menu.length
    : 0;
  /* A group's bill tracks the mains, not the menu average — trà đá being on the
     board does not make the till smaller — and it tracks them the way guests
     actually order, weighted toward the best the quán does. */
  const mains = d.menu.filter(x => x.kind === 'main');
  const sides = d.menu.filter(x => x.kind !== 'main');
  d.mains = mains;
  d.mainAvg = mains.length ? weightedAvgPrice(mains, d.level.n) : d.avgCheck;

  d.sides = sides;
  /* Sides never reach the stove — they go straight on the bill — so a table is
     worth its one cooked meal plus roughly one drink per head. */
  const sideAvg = sides.length ? sides.reduce((a, x) => a + x.price, 0) / sides.length : 0;
  d.sideBonus = sideAvg * 2.2 * 0.55;
  d.tableBill = d.mainAvg + d.sideBonus;

  /* Stove-seconds a table costs: exactly one meal, weighted the way guests
     order, so a menu of lẩu costs the kitchen far more than one of bánh mì. */
  d.cookPerGroup = (mains.length ? weightedAvgCook(mains, d.level.n) : 6) * d.cookMult;

  /* What one group is worth once the chợ has been paid. Same arithmetic the sim
     does per settle, so the ledger and the till cannot drift apart. */
  d.groupNet = d.tableBill * (1 - FOOD_COST_RATIO) * (1 + 0.04 * d.charm);

  /* The loop only earns as fast as somebody carries plates. Nobody hired means
     nobody minds the shop: the player has to stand there and work it themselves,
     and closing the tab closes the quán. */
  d.idleGroupsPerMin = Math.min(
    idleArrivalsPerMin(d.tables, d.draw, d.level.flow),
    d.waiters * WAITER_THROUGHPUT
  );
  d.offlineNetPerMin = Math.max(0, d.idleGroupsPerMin * d.groupNet);
  d.idleNetPerMin = d.offlineNetPerMin;

  return d;
}

/* progress towards the next tier, 0..1 */
export function tierProgress(s) {
  const cur = levelFor(s.invested);
  const next = LEVELS.find(l => l.n === cur.n + 1) || null;
  if (!next) return { pct: 1, cur, next: null };
  const span = next.invested - cur.invested;
  return { pct: clamp((s.invested - cur.invested) / span, 0, 1), cur, next };
}

/* ── money ────────────────────────────────────────────────────────────────*/
export function earn(s, amount) { s.money += Math.round(amount); }

export function spend(s, amount) {
  if (s.money < amount) return false;
  s.money -= Math.round(amount);
  s.invested += Math.round(amount);
  return true;
}

export function canBuy(s, item) {
  const d = derived(s);
  if (s.owned[item.id]) return 'Đã mua rồi';
  if (item.minLevel && d.level.n < item.minLevel) return `Cần quán cấp ${item.minLevel}`;
  if (item.needs && !s.owned[item.needs]) return `Cần mua ${SHOP_BY_ID[item.needs].name} trước`;
  if (item.eff.tables && d.tables >= 8) return 'Hết chỗ kê bàn';
  if (item.eff.chefs && d.chefs >= 3) return 'Bếp đã đủ người';
  if (s.money < item.price) return 'Không đủ tiền';
  return null;
}

export function buy(s, item) {
  const why = canBuy(s, item);
  if (why) return why;
  spend(s, item.price);
  s.owned[item.id] = 1;
  return null;
}

/* the quán level a recipe needs before it makes sense on the board */
export function dishNeedsLevel(dish) {
  return dish.tier <= 1 ? 1 : dish.tier === 2 ? 3 : 4;
}

export function canLearn(s, dish) {
  if (s.recipes.includes(dish.id)) return 'Đã biết nấu';
  const need = dishNeedsLevel(dish);
  if (derived(s).level.n < need) return `Cần quán cấp ${need}`;
  if (s.money < dish.unlock) return 'Không đủ tiền';
  return null;
}

export function learn(s, dish) {
  const why = canLearn(s, dish);
  if (why) return why;
  spend(s, dish.unlock);
  s.recipes.push(dish.id);
  return null;
}

/* ── the day boundary ─────────────────────────────────────────────────────
   Called once on boot. Refills energy, charges rent and wages for the days
   that went by, and pays out whatever the staff earned while nobody watched.
   Returns a report so the game can show a "sáng hôm sau" panel, or null when
   no calendar day has turned over. */
export function rollover(s) {
  const today = todayKey();
  const d = derived(s);

  const offlineMs = Math.max(0, Date.now() - (s.lastSeen || Date.now()));
  const offlineMin = Math.min(offlineMs / 60000, OFFLINE_CAP_HOURS * 60);
  const offlineEarned = s.owner
    ? Math.round(d.offlineNetPerMin * offlineMin * OFFLINE_EFFICIENCY) : 0;

  if (today === s.ledgerDay) {
    if (offlineEarned > 0) { earn(s, offlineEarned); return { days: 0, offlineEarned, cost: 0, offlineMin }; }
    return null;
  }

  const days = Math.min(daysBetween(s.ledgerDay, today), 3);
  const cost = s.owner ? d.dailyCost * days : 0;

  earn(s, offlineEarned);
  s.money = Math.max(0, s.money - cost);
  s.energy = d.maxEnergy;
  s.energyDay = today;
  s.ledgerDay = today;
  s.stats.days += days;

  return { days, offlineEarned, offlineMin, cost, wages: d.wages * days, overhead: d.overhead * days };
}

function daysBetween(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.max(1, Math.round(ms / 86400000));
}

export function refreshEnergy(s) {
  const today = todayKey();
  if (s.energyDay !== today) { s.energy = derived(s).maxEnergy; s.energyDay = today; }
  return s.energy;
}

/* Energy only starts counting once the quán is yours. The tutorial ca are
   mandatory — gating them at five a day would mean waiting out real calendar
   days before the game proper is even unlocked. */
export function energyLimited(s) { return !!s.owner; }

export function spendEnergy(s) {
  if (!energyLimited(s)) return true;
  refreshEnergy(s);
  if (s.energy <= 0) return false;
  s.energy--;
  return true;
}

/* seconds until the next local midnight — the energy refill countdown */
export function untilMidnight(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return Math.max(0, (next - now) / 1000);
}

/* ── missions ─────────────────────────────────────────────────────────────
   Strictly ordered: only the first unfinished mission is ever live, so the
   tutorial reads as a list and never fires two rewards at once. */
export function activeMission(s) {
  return MISSIONS.find(m => !s.missionsDone.includes(m.id)) || null;
}

/* `report` is a finished ca, or null when checking the standing counters. */
export function checkMissions(s, report = null) {
  const done = [];
  for (;;) {
    const m = activeMission(s);
    if (!m || !missionMet(s, m, report)) break;
    s.missionsDone.push(m.id);
    if (m.reward) earn(s, m.reward);
    done.push(m);
  }
  return done;
}

function missionMet(s, m, report) {
  const g = m.goal;
  switch (g.type) {
    case 'groups':   return s.progress.groups  >= g.n;
    case 'tickets':  return s.progress.tickets >= g.n;
    case 'plates':   return s.progress.plates  >= g.n;
    case 'green':    return s.progress.green   >= g.n;
    case 'money':    return s.money >= g.n;
    case 'claim':    return !!s.owner;
    case 'days':     return (s.tutorialDay || 0) >= g.n;
    case 'shiftRevenue': return !!report && report.revenue >= g.n;
    case 'shiftGroups':  return !!report && report.groups  >= g.n;
    case 'cleanShift':   return !!report && report.angry === 0 && report.groups >= 3;
    default: return false;
  }
}

/* One finished ca is one day on the job. Returns whatever the old owner did
   that day, so the ca result can show it. */
export function advanceTutorialDay(s) {
  if (s.owner) return [];
  s.tutorialDay = (s.tutorialDay || 0) + 1;
  const fired = TUTORIAL_EVENTS.filter(e => e.day === s.tutorialDay);
  for (const e of fired) {
    if (e.kind === 'table') s.bonusTables = (s.bonusTables || 0) + 1;
    if (e.kind === 'recipe' && !s.recipes.includes(e.id)) s.recipes.push(e.id);
    if (e.kind === 'target') s.targetBoost = (s.targetBoost || 0) + e.mult;
  }
  return fired;
}

/* ── the sign outside ─────────────────────────────────────────────────────*/
export const MAX_NAME = 28;

export function cleanName(raw) {
  return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
}

export function setName(s, raw) {
  const name = cleanName(raw);
  if (!name) return 'Quán phải có tên';
  s.name = name;
  return null;
}

export function displayName(s) {
  return s.name || 'Quán Ăn Của Tôi';
}

export function canBuyFacade(s, item) {
  if (s.facade[item.id]) return 'Đã có rồi';
  if (item.minLevel && derived(s).level.n < item.minLevel) return `Cần quán cấp ${item.minLevel}`;
  if (s.money < item.price) return 'Không đủ tiền';
  return null;
}

export function buyFacade(s, item) {
  const why = canBuyFacade(s, item);
  if (why) return why;
  spend(s, item.price);
  s.facade[item.id] = 1;
  return null;
}

export function claimRestaurant(s) {
  if (s.owner) return 'Quán đã là của bạn';
  if (activeMission(s)?.id !== 'm9') return 'Chưa xong nhiệm vụ trước';
  if (s.money < CLAIM_FEE) return 'Không đủ phí sang nhượng';
  spend(s, CLAIM_FEE);
  s.owner = true;
  /* The raised bar belonged to the old owner's expectations. From here the
     target follows what your own quán can actually turn over. */
  s.targetBoost = 0;
  /* and start the metered part of the game with a full tank */
  s.energy = derived(s).maxEnergy;
  s.energyDay = todayKey();
  return null;
}
