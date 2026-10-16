/* Game rules for the hủ tiếu stall. Pure JS — no THREE, no DOM — so tests import it directly
   and the views simply read `state` every frame. Every player action is a tap on a station;
   each tap returns true/false and pushes events (sounds, floating text) onto state.events. */

export const COOK_TIME = 3.2;        // seconds in the boiling water until noodles are ready
export const HOLD_TIME = 9;          // then this long before they go mushy (nhũn)
export const TEA_TIME = 1.4;         // pouring a glass of trà đá
export const COIN_AUTO = 7;          // uncollected money is swept into the till after this
export const ENTER_TIME = 1.1;
export const LEAVE_TIME = 1.1;
export const MAX_TOPS = 4;
export const BOWL_SLOTS = 4;
export const BASKETS = 2;
export const GLASSES = 2;
export const CHOP_TIME = 1.3;        // chopping a bunch of hành lá on the thớt
export const CHOP_YIELD = 4;         // bowls' worth of chopped hành per chop
export const PILE_MAX = 8;

/* What finishes a bowl. Hành lá and giá go in every bowl unless the customer says "không";
   tiêu and ớt go in only when asked for. */
export const EXTRAS = {
  hanh: { name: 'Hành lá', def: true },
  gia: { name: 'Giá', def: true },
  tieu: { name: 'Tiêu', def: false },
  ot: { name: 'Ớt', def: false },
};
export const EXTRA_ORDER = ['hanh', 'gia', 'tieu', 'ot'];

export const NOODLES = {
  hu: { name: 'Hủ tiếu', price: 35000 },     // sợi hủ tiếu dai, trắng trong
  mi: { name: 'Mì', price: 35000 },          // mì trứng vàng
};
export const STYLES = {
  nuoc: { name: 'Nước', price: 0 },          // chan nước lèo xương heo, tôm khô, củ cải
  kho: { name: 'Khô', price: 5000 },         // trộn sốt, kèm chén nước lèo riêng
};
export const TOPPINGS = {
  thit: { name: 'Thịt nạc', price: 8000 },
  tom: { name: 'Tôm', price: 10000 },
  trung: { name: 'Trứng cút', price: 5000 },
  gan: { name: 'Gan', price: 6000 },
  bam: { name: 'Thịt bằm', price: 6000 },
  muc: { name: 'Mực', price: 10000 },
  top: { name: 'Tóp mỡ', price: 3000 },
};
export const TOPPING_ORDER = ['thit', 'tom', 'trung', 'gan', 'bam', 'muc', 'top'];
export const TEA_PRICE = 3000;

/* One entry per day. `menu` lists what can appear in orders (and so which stations show). */
export const LEVELS = [
  { customers: 5, seats: 3, patience: 40, gap: [5, 8], noodles: ['hu'], styles: ['nuoc'], tops: ['thit', 'tom'], maxTops: 2, tea: 0, double: 0, noHanh: 0, noGia: 0, tieu: 0, ot: 0,
    tip: 'Trụng sợi → vớt vào tô → chan nước lèo → topping. Tô nào cũng cần hành lá (bấm thớt để cắt) và giá. Xong bấm tô để phục vụ.' },
  { customers: 6, seats: 3, patience: 38, gap: [4.5, 7.5], noodles: ['hu'], styles: ['nuoc'], tops: ['thit', 'tom', 'trung'], maxTops: 2, tea: 0, double: 0, noHanh: 0.2, noGia: 0.2, tieu: 0.35, ot: 0,
    tip: 'Mới: trứng cút và tiêu (chỉ rắc khi khách gọi). Có khách dặn "không hành", "không giá" — để ý nhé!' },
  { customers: 7, seats: 3, patience: 36, gap: [4.5, 7], noodles: ['hu', 'mi'], styles: ['nuoc'], tops: ['thit', 'tom', 'trung'], maxTops: 3, tea: 0.35, double: 0, noHanh: 0.2, noGia: 0.2, tieu: 0.35, ot: 0.3,
    tip: 'Mới: mì trứng vàng, ớt tươi và trà đá. Bấm bình trà để rót, bấm ly để mời khách.' },
  { customers: 8, seats: 3, patience: 35, gap: [4, 7], noodles: ['hu', 'mi'], styles: ['nuoc', 'kho'], tops: ['thit', 'tom', 'trung', 'gan'], maxTops: 3, tea: 0.35, double: 0, noHanh: 0.25, noGia: 0.2, tieu: 0.4, ot: 0.3,
    tip: 'Mới: hủ tiếu KHÔ — bấm chai sốt thay cho nồi nước lèo. Và gan heo luộc.' },
  { customers: 9, seats: 4, patience: 34, gap: [3.5, 6.5], noodles: ['hu', 'mi'], styles: ['nuoc', 'kho'], tops: ['thit', 'tom', 'trung', 'gan', 'bam'], maxTops: 3, tea: 0.4, double: 0, noHanh: 0.25, noGia: 0.25, tieu: 0.4, ot: 0.35,
    tip: 'Mới: thịt bằm. Quán đông hơn — giờ có 4 chỗ cho khách.' },
  { customers: 10, seats: 4, patience: 32, gap: [3.5, 6], noodles: ['hu', 'mi'], styles: ['nuoc', 'kho'], tops: ['thit', 'tom', 'trung', 'gan', 'bam', 'muc'], maxTops: 4, tea: 0.4, double: 0.15, noHanh: 0.25, noGia: 0.25, tieu: 0.4, ot: 0.35,
    tip: 'Mới: mực. Có khách gọi 2 tô một lúc!' },
  { customers: 11, seats: 4, patience: 31, gap: [3, 6], noodles: ['hu', 'mi'], styles: ['nuoc', 'kho'], tops: TOPPING_ORDER, maxTops: 4, tea: 0.45, double: 0.2, noHanh: 0.3, noGia: 0.25, tieu: 0.45, ot: 0.4,
    tip: 'Mới: tóp mỡ giòn rụm. Đủ món Nam Vang rồi!' },
  { customers: 12, seats: 4, patience: 29, gap: [3, 5.5], noodles: ['hu', 'mi'], styles: ['nuoc', 'kho'], tops: TOPPING_ORDER, maxTops: 4, tea: 0.45, double: 0.25, noHanh: 0.3, noGia: 0.3, tieu: 0.45, ot: 0.4,
    tip: 'Giờ tan tầm — khách ít kiên nhẫn hơn.' },
  { customers: 13, seats: 4, patience: 27, gap: [2.5, 5], noodles: ['hu', 'mi'], styles: ['nuoc', 'kho'], tops: TOPPING_ORDER, maxTops: 4, tea: 0.5, double: 0.3, noHanh: 0.3, noGia: 0.3, tieu: 0.5, ot: 0.45,
    tip: 'Tối thứ Bảy, cả xóm kéo ra ăn.' },
  { customers: 15, seats: 4, patience: 26, gap: [2.5, 4.5], noodles: ['hu', 'mi'], styles: ['nuoc', 'kho'], tops: TOPPING_ORDER, maxTops: 4, tea: 0.5, double: 0.35, noHanh: 0.35, noGia: 0.3, tieu: 0.5, ot: 0.45,
    tip: 'Ngày cuối: food blogger ghé quán. Đừng để ai bỏ về!' },
];

/** Seeded PRNG so a day always brings the same customers (and the same star targets). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (r, list) => list[Math.floor(r() * list.length)];

export const bowlPrice = b =>
  NOODLES[b.noodle].price + STYLES[b.style].price + b.tops.reduce((s, t) => s + TOPPINGS[t].price, 0);
export const itemPrice = it => (it.kind === 'tea' ? TEA_PRICE : bowlPrice(it));

export function randomBowl(r, lv) {
  const noodle = pick(r, lv.noodles);
  // khô is the less common order, as at a real stall
  const style = lv.styles.length > 1 && r() < 0.3 ? 'kho' : 'nuoc';
  const n = 1 + Math.floor(r() * lv.maxTops);
  const pool = [...lv.tops];
  const tops = [];
  while (tops.length < n && pool.length) tops.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return {
    kind: 'bowl', noodle, style, tops: sortTops(tops),
    hanh: !(r() < lv.noHanh), gia: !(r() < lv.noGia), tieu: r() < lv.tieu, ot: r() < lv.ot,
  };
}

export const sortTops = tops => [...tops].sort((a, b) => TOPPING_ORDER.indexOf(a) - TOPPING_ORDER.indexOf(b));

/** The day's customers: their orders, looks and arrival times. Deterministic per level. */
export function planDay(levelIdx) {
  const lv = LEVELS[levelIdx];
  const r = rng(1000 + levelIdx * 7919);
  const list = [];
  let t = 1.2;
  for (let i = 0; i < lv.customers; i++) {
    const items = [randomBowl(r, lv)];
    if (r() < lv.double) items.push(randomBowl(r, lv));
    if (r() < lv.tea) items.push({ kind: 'tea' });
    list.push({ id: i + 1, look: Math.floor(r() * 8), items, arriveAt: t });
    t += lv.gap[0] + r() * (lv.gap[1] - lv.gap[0]);
  }
  return list;
}

/** Star targets: base takings with no tips. 3★ needs every customer served plus some tips. */
export function targets(levelIdx) {
  const base = planDay(levelIdx).reduce((s, c) => s + c.items.reduce((a, it) => a + itemPrice(it), 0), 0);
  const round = v => Math.round(v / 1000) * 1000;
  return [round(base * 0.55), round(base * 0.8), round(base * 1.04)];
}

export function sameBowl(a, b) {
  if (!a.noodle || !b.noodle || a.noodle !== b.noodle || a.style !== b.style) return false;
  if (a.tops.length !== b.tops.length) return false;
  if (EXTRA_ORDER.some(k => !!a[k] !== !!b[k])) return false;
  const s = sortTops(a.tops), t = sortTops(b.tops);
  return s.every((x, i) => x === t[i]);
}

const emptyBowl = () => ({ noodle: null, style: null, tops: [], hanh: false, gia: false, tieu: false, ot: false });

export function newGame(levelIdx) {
  const lv = LEVELS[levelIdx];
  return {
    levelIdx, lv,
    time: 0,
    money: 0, tips: 0, served: 0, lost: 0, wasted: 0,
    targets: targets(levelIdx),
    queue: planDay(levelIdx),
    seats: Array(lv.seats).fill(null),
    baskets: Array.from({ length: BASKETS }, () => ({ noodle: null, t: 0 })),
    bowls: Array.from({ length: BOWL_SLOTS }, emptyBowl),
    glasses: Array.from({ length: GLASSES }, () => ({ state: 'empty', t: 0 })),
    coins: Array(lv.seats).fill(null),        // { amount, t } waiting on the counter
    scallion: { pile: 0, chopT: null },       // chopped hành on the thớt; chopT runs while chopping
    selected: null,
    over: false,
    events: [],
  };
}

const emit = (s, type, data = {}) => { s.events.push({ type, ...data }); };

export function basketState(b) {
  if (!b.noodle) return 'empty';
  if (b.t < COOK_TIME) return 'cooking';
  if (b.t < COOK_TIME + HOLD_TIME) return 'ready';
  return 'mushy';
}

const waiting = s => s.seats.filter(c => c && c.phase === 'wait');

/* ------------------------------------------------------------------ simulation */

export function step(s, dt) {
  if (s.over) return;
  s.time += dt;

  for (const b of s.baskets) if (b.noodle) {
    const before = basketState(b);
    b.t += dt;
    const after = basketState(b);
    if (before !== after) emit(s, after === 'ready' ? 'noodleReady' : 'noodleMushy', { basket: s.baskets.indexOf(b) });
  }
  const sc = s.scallion;
  if (sc.chopT != null) {
    sc.chopT += dt;
    if (sc.chopT >= CHOP_TIME) {
      sc.chopT = null;
      sc.pile = Math.min(PILE_MAX, sc.pile + CHOP_YIELD);
      emit(s, 'chopped');
    }
  }
  s.glasses.forEach((g, i) => {
    if (g.state !== 'filling') return;
    g.t += dt;
    if (g.t >= TEA_TIME) { g.state = 'full'; emit(s, 'teaReady', { glass: i }); }
  });

  // arrivals: the next customer takes a random free seat once their time has come
  const free = s.seats.map((c, i) => (c ? -1 : i)).filter(i => i >= 0);
  if (s.queue.length && s.queue[0].arriveAt <= s.time && free.length) {
    const c = s.queue.shift();
    const r = rng(c.id * 31 + s.levelIdx);
    const seat = free[Math.floor(r() * free.length)];
    const patience = s.lv.patience + 6 * (c.items.length - 1);
    s.seats[seat] = { ...c, seat, served: c.items.map(() => false), patience, maxPatience: patience, phase: 'enter', phaseT: 0, happy: true };
    emit(s, 'arrive', { seat });
  } else if (s.queue.length && s.queue[0].arriveAt <= s.time) {
    s.queue[0].arriveAt = s.time;     // stall is full: they wait at the kerb, no clock running
  }

  s.seats.forEach((c, i) => {
    if (!c) return;
    c.phaseT += dt;
    if (c.phase === 'enter' && c.phaseT >= ENTER_TIME) { c.phase = 'wait'; c.phaseT = 0; }
    else if (c.phase === 'wait') {
      c.patience -= dt;
      if (c.patience <= 0) {
        c.patience = 0; c.phase = 'leave'; c.phaseT = 0; c.happy = false;
        s.lost++;
        emit(s, 'angry', { seat: i });
      }
    } else if (c.phase === 'leave' && c.phaseT >= LEAVE_TIME) s.seats[i] = null;
  });

  s.coins.forEach((m, i) => {
    if (!m) return;
    m.t += dt;
    if (m.t >= COIN_AUTO) collect(s, i);
  });

  if (!s.queue.length && s.seats.every(c => !c) && s.coins.every(m => !m)) {
    s.over = true;
    emit(s, 'dayOver');
  }
}

/* ------------------------------------------------------------------ actions */

/** The bowl a tap on an ingredient lands in: the selected one if it can take it, else the first that can. */
function targetBowl(s, ok) {
  if (s.selected != null && ok(s.bowls[s.selected])) return s.selected;
  const i = s.bowls.findIndex(ok);
  return i >= 0 ? i : null;
}

export function tapNoodleTray(s, kind) {
  if (!s.lv.noodles.includes(kind)) return false;
  const i = s.baskets.findIndex(b => !b.noodle);
  if (i < 0) { emit(s, 'nope'); return false; }
  s.baskets[i] = { noodle: kind, t: 0 };
  emit(s, 'splash', { basket: i });
  return true;
}

export function tapBasket(s, i) {
  const b = s.baskets[i];
  const st = basketState(b);
  if (st === 'mushy') {
    s.baskets[i] = { noodle: null, t: 0 };
    s.wasted++;
    emit(s, 'trash');
    return true;
  }
  if (st !== 'ready') { emit(s, 'nope'); return false; }
  const bi = targetBowl(s, w => !w.noodle);
  if (bi == null) { emit(s, 'nope'); return false; }
  s.bowls[bi].noodle = b.noodle;
  s.baskets[i] = { noodle: null, t: 0 };
  emit(s, 'plop', { bowl: bi });
  return true;
}

function addStyle(s, style) {
  if (!s.lv.styles.includes(style)) return false;
  const bi = targetBowl(s, w => w.noodle && !w.style);
  if (bi == null) { emit(s, 'nope'); return false; }
  s.bowls[bi].style = style;
  emit(s, style === 'nuoc' ? 'pour' : 'squeeze', { bowl: bi });
  return true;
}
export const tapBroth = s => addStyle(s, 'nuoc');
export const tapSauce = s => addStyle(s, 'kho');

export function tapTopping(s, t) {
  if (!s.lv.tops.includes(t)) return false;
  const bi = targetBowl(s, w => w.noodle && !w.tops.includes(t) && w.tops.length < MAX_TOPS);
  if (bi == null) { emit(s, 'nope'); return false; }
  s.bowls[bi].tops = sortTops([...s.bowls[bi].tops, t]);
  emit(s, 'topping', { bowl: bi });
  return true;
}

/** Chop a bunch of hành lá on the thớt (while the pile has room). */
export function tapChop(s) {
  const sc = s.scallion;
  if (sc.chopT != null || sc.pile >= PILE_MAX) { emit(s, 'nope'); return false; }
  sc.chopT = 0;
  emit(s, 'chop');
  return true;
}

/** Add one of the finishing extras (hành, giá, tiêu, ớt) to a bowl that has noodles. */
export function tapExtra(s, k) {
  if ((k === 'tieu' || k === 'ot') && !s.lv[k]) return false;
  if (k === 'hanh' && s.scallion.pile <= 0) { emit(s, 'nope', { why: 'noHanh' }); return false; }
  const bi = targetBowl(s, w => w.noodle && !w[k]);
  if (bi == null) { emit(s, 'nope'); return false; }
  s.bowls[bi][k] = true;
  if (k === 'hanh') s.scallion.pile--;
  emit(s, k === 'tieu' ? 'pepper' : 'topping', { bowl: bi });
  return true;
}

/** Who a finished item goes to: the least patient waiting customer still owed a match. */
function findOwed(s, match) {
  let best = null, bestIdx = -1;
  for (const c of waiting(s)) {
    const idx = c.items.findIndex((it, k) => !c.served[k] && match(it));
    if (idx >= 0 && (!best || c.patience < best.patience)) { best = c; bestIdx = idx; }
  }
  return best ? { c: best, idx: bestIdx } : null;
}

function deliver(s, c, idx) {
  c.served[idx] = true;
  c.patience = Math.min(c.maxPatience, c.patience + c.maxPatience * 0.15);
  emit(s, 'serve', { seat: c.seat });
  if (c.served.every(Boolean)) {
    const base = c.items.reduce((a, it) => a + itemPrice(it), 0);
    const tip = Math.round((base * 0.25 * (c.patience / c.maxPatience)) / 1000) * 1000;
    c.phase = 'leave'; c.phaseT = 0; c.happy = true;
    s.served++;
    s.tips += tip;
    const m = s.coins[c.seat];
    s.coins[c.seat] = { amount: (m ? m.amount : 0) + base + tip, t: 0 };
    emit(s, 'paid', { seat: c.seat, base, tip });
  }
}

export function tapBowl(s, i) {
  const b = s.bowls[i];
  if (b.noodle && b.style) {
    const owed = findOwed(s, it => it.kind === 'bowl' && sameBowl(it, b));
    if (owed) {
      s.bowls[i] = emptyBowl();
      if (s.selected === i) s.selected = null;
      deliver(s, owed.c, owed.idx);
      return true;
    }
  }
  s.selected = s.selected === i ? null : i;
  emit(s, 'select', { bowl: i });
  return true;
}

export function tapTrash(s) {
  if (s.selected == null || !s.bowls[s.selected].noodle) { emit(s, 'nope'); return false; }
  s.bowls[s.selected] = emptyBowl();
  s.selected = null;
  s.wasted++;
  emit(s, 'trash');
  return true;
}

export function tapTeaJug(s) {
  if (!s.lv.tea) return false;
  const i = s.glasses.findIndex(g => g.state === 'empty');
  if (i < 0) { emit(s, 'nope'); return false; }
  s.glasses[i] = { state: 'filling', t: 0 };
  emit(s, 'teaPour', { glass: i });
  return true;
}

export function tapGlass(s, i) {
  if (s.glasses[i].state !== 'full') { emit(s, 'nope'); return false; }
  const owed = findOwed(s, it => it.kind === 'tea');
  if (!owed) { emit(s, 'nope'); return false; }
  s.glasses[i] = { state: 'empty', t: 0 };
  deliver(s, owed.c, owed.idx);
  return true;
}

export function collect(s, seat) {
  const m = s.coins[seat];
  if (!m) return false;
  s.money += m.amount;
  s.coins[seat] = null;
  emit(s, 'cash', { seat, amount: m.amount });
  return true;
}

export function starsFor(s) {
  return s.targets.filter(t => s.money >= t).length;
}

export const formatVnd = v => `${Math.round(v).toLocaleString('vi-VN')}đ`;
