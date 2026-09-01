/* Debug mode — a way to see everything the game contains without playing the
   thirty days it normally takes to get there.

   Off by default and never reachable by accident: it turns on from `?debug=1`
   in the URL or from a clearly labelled button in Cài đặt. The switch itself
   lives in memory only, so reloading a save never silently leaves it on — but
   the things it *does* (money, ownership, recipes) are ordinary save changes
   and they stick, which is the point.

   DOM-free: every action here is a pure mutation of a save object. */

import { DISHES, FACADE, LEVELS, MISSIONS, NAME_SUGGESTIONS, SHOP, TUTORIAL_DAYS } from './data.js';
import { derived, todayKey } from './state.js';

export const RICH = 999999999;          // "unlimited" money, in đồng

export const state = {
  on: false,
  richMode: false,      // top the till back up after every purchase
  overlay: false,       // internals printed over the game
  speed: 1              // time multiplier during a ca
};

export const SPEEDS = [1, 2, 4];

/* the URL is the developer's door; the settings button is the player's */
export function enabledByUrl(search = '', hash = '') {
  return /(^|[?&])debug(=1|=true)?($|&)/.test(String(search).replace(/^\?/, ''))
      || /(^|#)debug($|&)/.test(String(hash).replace(/^#/, ''));
}

/* ── the actions ──────────────────────────────────────────────────────────*/

export function giveMoney(s, amount = 100000000) {
  s.money += amount;
  return `+${amount.toLocaleString('vi-VN')}₫`;
}

export function topUp(s) {
  if (s.money < RICH / 2) s.money = RICH;
}

/* Straight to owning the place: the whole tutorial marked done, the quán it
   would have grown into, and a name on the sign. */
export function becomeOwner(s) {
  if (s.owner) return 'Đã là chủ quán rồi';
  s.missionsDone = MISSIONS.map(m => m.id);
  s.tutorialDay = TUTORIAL_DAYS;
  s.bonusTables = 3;
  if (!s.recipes.includes('pho-bo')) s.recipes.push('pho-bo');
  s.targetBoost = 0;
  s.owner = true;
  if (!s.name) s.name = NAME_SUGGESTIONS[0];
  s.energy = derived(s).maxEnergy;
  s.energyDay = todayKey();
  return 'Đã sang tên quán';
}

export function unlockAllRecipes(s) {
  const before = s.recipes.length;
  s.recipes = [...new Set([...s.recipes, ...DISHES.map(d => d.id)])];
  return `+${s.recipes.length - before} công thức`;
}

/* Buys the whole catalogue, but never past what the floor and kitchen hold —
   an over-filled save would misreport its own capacity. */
export function buyAllShop(s) {
  let bought = 0;
  for (const it of SHOP) {
    if (s.owned[it.id]) continue;
    const d = derived(s);
    if (it.eff.tables && d.tables >= 8) continue;
    if (it.eff.chefs && d.chefs >= 3) continue;
    s.owned[it.id] = 1;
    bought++;
  }
  return `+${bought} món đồ`;
}

export function buyAllFacade(s) {
  let bought = 0;
  for (const f of FACADE) if (!s.facade[f.id]) { s.facade[f.id] = 1; bought++; }
  return `+${bought} thứ mặt tiền`;
}

/* Jump to a tier by writing the investment it represents. */
export function setTier(s, n) {
  const level = LEVELS.find(l => l.n === n);
  if (!level) return 'Không có cấp đó';
  s.invested = Math.max(s.invested, level.invested);
  s.energy = derived(s).maxEnergy;
  s.energyDay = todayKey();
  return `Quán lên ${level.name}`;
}

export function fillEnergy(s) {
  s.energy = derived(s).maxEnergy;
  s.energyDay = todayKey();
  return `Đầy ${s.energy} lượt`;
}

export function setTutorialDay(s, day) {
  s.tutorialDay = Math.max(0, Math.min(day, TUTORIAL_DAYS));
  return `Ngày học việc ${s.tutorialDay}`;
}

export function clearBuffs(s) {
  s.marketBuff = 0;
  s.trend = null;
  return 'Đã xoá hiệu ứng tạm';
}

/* ── the overlay text ─────────────────────────────────────────────────────
   Everything worth watching while poking at the simulation, in one block. */
export function overlayLines(sim, save) {
  if (!sim) return [];
  const d = sim.d;
  const k = sim.kitchen;
  const lines = [
    `chế độ    ${sim.mode}${sim.closing ? ' (đang dọn)' : ''}  t=${sim.t.toFixed(0)}s  x${state.speed}`,
    `bàn ${d.tables}  phục vụ ${d.waiters}  bếp ${d.chefs}  bưng ${d.carry}  hatch ${d.passSlots}`,
    `nhóm ${sim.stats.groups}  dĩa ${sim.stats.plates}  giận ${sim.stats.angry}  lỡ ${sim.stats.lost}  bỏ ${sim.stats.trashed}`,
    `doanh thu ${sim.stats.revenue.toLocaleString('vi-VN')}  chỉ tiêu ${sim.target.toLocaleString('vi-VN')}`,
    `bếp: đơn ${k.orders.length}  đang nấu ${k.stoves.filter(Boolean).length}  chờ bưng ${k.plated.length}  hatch ${k.pass.length}`,
    `tồn bếp ${sim.kitchenBacklog().toFixed(1)}s  tiền chợ ${(sim.foodCost * 100).toFixed(0)}%  hot ${sim.trendId || '—'}`,
    `hệ số chỉ tiêu x${(d.targetMult || 1).toFixed(2)}  khách ${d.draw.toFixed(2)}  kiên nhẫn ${d.comfort.toFixed(2)}`
  ];

  /* the invariant that used to break: is anything owed that nobody is making? */
  const bump = (m, id, n = 1) => m.set(id, (m.get(id) || 0) + n);
  const need = new Map(), have = new Map();
  for (const p of sim.parties) {
    if (!p.ordered || (p.state !== 'WAIT_FOOD' && p.state !== 'EATING')) continue;
    for (const m of p.members) {
      const w = new Map();
      for (const id of m.dishes) bump(w, id);
      for (const id of m.got) w.set(id, (w.get(id) || 0) - 1);
      for (const [id, n] of w) if (n > 0) bump(need, id, n);
    }
  }
  for (const pl of k.pass) bump(have, pl.dishId);
  for (const pl of k.plated) bump(have, pl.dishId);
  for (const o of k.orders) bump(have, o.dishId);
  for (const j of k.stoves) if (j) bump(have, j.dishId);
  for (const c of sim.chefs) if (c.holding) bump(have, c.holding.dishId);
  for (const w of [sim.player, ...sim.npcs]) for (const pl of w.carry) if (!pl.dead) bump(have, pl.dishId);
  const short = [];
  for (const [id, n] of need) { const s = n - (have.get(id) || 0); if (s > 0) short.push(`${id}×${s}`); }
  lines.push(`thiếu món: ${short.length ? short.join(' ') : 'không'}`);

  lines.push(`bàn: ${sim.world.tables.map(t => t.party ? t.party.state[0] : '·').join(' ')}`);
  return lines;
}
