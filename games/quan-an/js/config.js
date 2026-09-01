/* Tuning sheet for Quán Ăn Của Tôi.

   Distances are tiles, times are seconds, money is đồng (VND, integer).
   DOM-free on purpose so tests/quan-an.test.mjs can import it in a bare vm. */

/* ── the floor ────────────────────────────────────────────────────────────
   Fixed 19 × 15 grid. Rows 13-14 are the pavement outside the door where the
   queue forms, so arriving guests are visible before they take a seat. */
export const GRID_W = 19;
export const GRID_H = 15;

export const T = {
  VOID: 0, WALL: 1, FLOOR: 2, KITCHEN: 3, COUNTER: 4,
  PASS: 5, WINDOW: 6, DOOR: 7, PAVEMENT: 8, TABLE: 9
};

/* what nobody may walk through */
export const SOLID = {
  [T.VOID]: true, [T.WALL]: true, [T.COUNTER]: true,
  [T.PASS]: true, [T.WINDOW]: true, [T.TABLE]: true
};

/* the eight table anchors, filled in this order as tables are bought.
   Each table covers a 2 × 2 block from its anchor; seats sit on the ring. */
export const TABLE_SLOTS = [
  { x: 6,  y: 9 }, { x: 10, y: 9 },   // the two you inherit: front centre, either side of the door
  { x: 6,  y: 6 }, { x: 10, y: 6 },   // then back centre, still a short walk to the hatch
  { x: 2,  y: 9 }, { x: 14, y: 9 },   // then out to the front corners
  { x: 2,  y: 6 }, { x: 14, y: 6 }    // and finally the far back corners
];

export const DOOR_X = 9;
export const DOOR_Y = 12;

/* counter row: the kitchen hatch. WINDOW tiles take tickets, PASS tiles hand
   cooked plates back. Both are interacted with from the dining side (y = 5). */
export const COUNTER_Y = 4;
export const WINDOW_TILES = [3, 4];
export const PASS_TILES = [9, 10];

/* The stove line runs along the bottom of the kitchen, right behind the hatch,
   with the prep counter against the back wall — so a chef crossing from prep to
   stove to hatch reads as a kitchen and not as a sprite jittering in place. */
export const STOVE_SPOTS = [
  { x: 3, y: 3 }, { x: 7, y: 3 }, { x: 13, y: 3 }
];

/* where an idle chef drifts: along the back counter, chopping and fetching */
export const PREP_SPOTS = [
  { x: 2.4, y: 2.0 }, { x: 5.5, y: 2.0 }, { x: 8.5, y: 2.0 },
  { x: 11.5, y: 2.0 }, { x: 14.5, y: 2.0 }, { x: 16.6, y: 2.0 }
];

/* the bin, out in the dining room where a waiter can reach it */
export const BIN_TILE = { x: 13, y: 5 };

export const CHEF_SPEED = 2.9;

/* ── movement ─────────────────────────────────────────────────────────────*/
export const PLAYER_SPEED = 4.6;   // tiles / second
export const NPC_SPEED    = 3.4;
export const GUEST_SPEED  = 2.6;
export const REACH        = 1.45;  // interact radius, tiles

/* ── the two modes ────────────────────────────────────────────────────────*/
export const SHIFT_SECONDS = 210;  // 3.5 minutes of taking new guests

/* When the clock runs out the quán stops letting people in but keeps serving
   whoever is already sitting down — food is cooked, tables are mid-meal, and
   throwing all of that away at the bell is neither fair nor how a quán closes.
   The grace period is a backstop: everyone still inside times out well before
   it, so it only ever catches a wedged state. */
export const CLOSING_GRACE = 120;

/* Patience windows, in seconds, for the states that wait on a waiter.
   Comfort from decor stretches these; see state.derived(). */
export const PATIENCE = {
  WANT_MENU:  15,
  ORDER_READY: 17,
  WAIT_FOOD:   55,
  WANT_BILL:   19
};

/* fraction of the window still left when the mood drops a notch */
export const MOOD_GREEN  = 0.55;   // above this much time left → green
export const MOOD_YELLOW = 0.22;   // above this → yellow, below → red

/* tip multiplier applied to that guest's share of the bill */
export const TIP_BY_MOOD = { green: 0.30, yellow: 0.10, red: 0.0 };

export const READ_MENU_TIME = 4.5;   // deciding what to order
export const EAT_TIME       = 8;    // per plate
export const PAY_TIME       = 1.6;   // interaction hold at the table
export const HANDOFF_TIME   = 0.9;   // handing a ticket through the window

/* Arrivals, in seconds of demand *per table* — a bigger quán pulls a bigger
   crowd, so buying a table always means more guests and not just more empty
   furniture. The shift ramp is what turns the last minute into a rush.

   The chill loop deliberately scales on √tables instead: a ca is a rush hour
   you work for, and if the loop grew as fast as the floor did it would quietly
   become the better way to earn and there would be no reason to play. */
export const ARRIVAL = {
  shift: { base: 34, min: 20, rampPerMin: 4, sqrt: false },
  idle:  { base: 260, min: 260, rampPerMin: 0, sqrt: true }
};

/* groups per minute the loop brings in, before service capacity is applied */
export function idleArrivalsPerMin(tables, draw, flow) {
  return 60 * Math.sqrt(tables) * draw * flow / ARRIVAL.idle.base;
}

/* what one hired waiter can actually turn over in the loop, groups per minute —
   measured against the sim, not guessed */
export const WAITER_THROUGHPUT = 1.6;

/* how many plates the waiter can carry before upgrades */
export const BASE_CARRY = 2;
/* cooked plates that fit on the pass at once */
export const BASE_PASS_SLOTS = 4;

/* ── money ────────────────────────────────────────────────────────────────
   Ingredients are the real cost of running a Vietnamese eatery: about forty
   percent of the menu price walks straight back out the door as tiền chợ. */
export const FOOD_COST_RATIO = 0.40;

/* Daily overheads by restaurant level, đồng per day: mặt bằng, điện, nước, gas,
   đá, giấy ăn, rác — everything that gets paid whether anyone eats or not. */
export const DAILY_OVERHEAD = [0, 300000, 650000, 1250000, 2600000, 5200000];

/* offline earnings are capped so leaving the tab open is never the strategy */
export const OFFLINE_CAP_HOURS = 3;
export const OFFLINE_EFFICIENCY = 0.12;

/* ── energy ───────────────────────────────────────────────────────────────*/
export const BASE_ENERGY = 5;                 // shifts per real day
export const ENERGY_BY_LEVEL = [0, 5, 6, 7, 8, 8];

/* ── helpers ──────────────────────────────────────────────────────────────*/
export const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
export const dist  = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const pick  = (arr, rnd = Math.random) => arr[(rnd() * arr.length) | 0];

/* 45000 → "45.000₫" — Vietnamese grouping, no decimals, ever. */
export function vnd(n) {
  const s = Math.round(n).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '₫';
}

/* 12500000 → "12,5tr" for tight HUD slots */
export function vndShort(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace('.', ',') + ' tỷ';
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e8 ? 0 : 1).replace('.', ',') + 'tr';
  if (n >= 1e3) return Math.round(n / 1e3) + 'k';
  return String(Math.round(n));
}
