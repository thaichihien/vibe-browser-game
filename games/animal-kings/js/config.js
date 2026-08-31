/* Tuning sheet for Vương Quốc Muông Thú.

   Distances are world pixels, times are seconds. Tiles exist only for terrain
   and pathfinding — every entity lives in pixel space, so nothing is snapped to
   a grid and the map can be re-tuned without touching movement code.

   DOM-free on purpose: this module is imported directly by tests/animal-kings.test.mjs. */

export const TILE      = 40;
export const MAP_TILES = 160;
export const WORLD_PX  = TILE * MAP_TILES;     // 6400 × 6400

/* terrain ids — the map is one Uint8Array of these */
export const T = {
  GRASS: 0, PATH: 1, WATER: 2, FOREST: 3, ROCK: 4, FIELD: 5, MINE: 6, SAND: 7
};

/* what a unit cannot walk through, indexed by terrain id */
export const SOLID = [false, false, true, true, true, false, true, false];

export const TERRAIN_COLOR = [
  '#2f7a3c',  // grass
  '#8a6b3f',  // path
  '#17527f',  // water
  '#2b7139',  // forest floor — near-grass on purpose, the canopy says 'forest'
  '#585c69',  // rock
  '#9c8a2e',  // field
  '#6a5f47',  // mine
  '#c4a862'   // sand
];

/* Props stamped on a terrain tile. Several variants per terrain, chosen by the
   per-tile `prop` byte — one glyph repeated across a whole forest reads as
   wallpaper and makes the tile grid impossible to unsee. */
export const TERRAIN_PROPS = [
  null,                                   // grass — decals handled separately
  null,                                   // path
  null,                                   // water
  ['🌲', '🌳', '🌲', '🌲', '🌳', '🌲', '🌲', '🌳'],   // forest
  ['🪨', '🪨', '⛰️', '🪨', '🪨', '🪨', '🪨', '⛰️'],   // rock
  ['🌾', '🌾', '🌾', '🌾', '🌿', '🌾', '🌾', '🌾'],   // field
  ['⛰️', '💎', '⛰️', '⛰️', '🪙', '⛰️', '💎', '⛰️'],   // mine
  null                                    // sand
];

/* sparse dressing on otherwise empty ground, so grass is not a flat colour */
export const GRASS_DECALS = ['🌿', '🌱', '🍀', '🌼', '🌾', '🪻'];

/* ── the three kingdom slots ──────────────────────────────────────────────── */
export const SLOT_COLORS = ['#ffc247', '#ff5470', '#8b7bff'];
export const SLOT_NAMES  = ['Bạn', 'Địch I', 'Địch II'];

/* ── the king ─────────────────────────────────────────────────────────────── */
export const KING = {
  hp:           420,
  dmg:          32,
  range:        52,
  arc:          1.5,      // radians of the swing cone
  atkEvery:     0.5,
  speed:        168,
  sprint:       1.45,
  radius:       17,
  regenNearCastle: 14,    // hp/s inside CASTLE_AURA
  rangedResist: 0.45,     // ranged hits land at this fraction — no off-screen sniping
  abilityCd:    52,

  /* one stamina pool, shared by sprinting, swinging and harvesting — spending it
     on wood is deciding to be tired when something arrives */
  staminaMax:   100,
  staminaRegen: 13,       // per second, only while not spending
  staminaRest:  0.55,      // seconds of no spending before regen resumes
  sprintDrain:  16,
  swingCost:    3,        // a fight has to be sustainable — the pool is ~16s of swinging
  harvestDrain: 9.5,      // ≈10s of continuous work empties the pool

  harvestRate:  6.5,      // per second — slower than a worker, but banked instantly
  repairRate:   26,       // hp/s, paid for in wood
  repairCost:   0.12      // wood per hp
};

export const CASTLE_AURA    = 260;
export const INTERACT_RANGE = 78;    // how close the king stands to talk
export const ENLIST_RANGE   = 150;   // how far `E` reaches to gather soldiers
export const BUILD_RANGE    = 420;   // territory radius around anything you own

/* ── economy ──────────────────────────────────────────────────────────────── */
export const START_RES   = { food: 300, wood: 240, gold: 40 };
export const START_WORKERS = 3;      // deliberately one short of a fourth worker's food
export const CARRY       = 22;       // what a worker hauls per trip
export const GATHER_RATE = 9.5;      // worker harvest, per second
export const POP_START   = 14;
export const POP_MAX     = 70;

/* per-tile node yield — a tile is exhausted and reverts to bare ground */
export const NODE_YIELD = { wood: 90, food: 70, gold: 120 };

export const RES_KEYS  = ['food', 'wood', 'gold'];
export const RES_ICON  = { food: '🌾', wood: '🪵', gold: '🪙' };
export const RES_NAME  = { food: 'Thức ăn', wood: 'Gỗ', gold: 'Vàng' };

/* which node type each terrain tile yields */
export const TILE_RESOURCE = {
  [T.FOREST]: 'wood', [T.FIELD]: 'food', [T.MINE]: 'gold'
};
/* what a tile becomes once its node is exhausted */
export const TILE_SPENT = { [T.FOREST]: T.GRASS, [T.FIELD]: T.GRASS, [T.MINE]: T.SAND };

/* ── retinue ──────────────────────────────────────────────────────────────── */
export const RETINUE_BASE = 8;
export const RETINUE_STEP = 4;
export const RETINUE_MAX  = 24;
export const FOLLOW_GAP   = 44;

export const ORDERS = {
  FOLLOW: 'follow', ATTACK: 'attack', HOLD: 'hold', HOME: 'home', SCOUT: 'scout'
};

/* ── couriers ─────────────────────────────────────────────────────────────── */
export const COURIER = {
  speed: 210, hp: 34, radius: 11, maxLive: 3, cooldown: 4.5
};

/* ── camera ───────────────────────────────────────────────────────────────── */
/* lookAhead 0: the king sits dead centre. A lead offset reads fine in a shooter
   where you aim independently of where you walk — here facing *is* movement, so
   leading the camera just makes the king drift off the middle of his own view. */
export const CAMERA = { ease: 7.5, lookAhead: 0, zoom: 1 };

/* ── day / night ──────────────────────────────────────────────────────────── */
export const DAY_LENGTH = 165;   // seconds for a full cycle

/* ── helpers ──────────────────────────────────────────────────────────────── */
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp  = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
export const rnd   = (a, b) => a + Math.random() * (b - a);
export const rndi  = (a, b) => Math.floor(rnd(a, b + 1));
export const pick  = arr => arr[Math.floor(Math.random() * arr.length)];
export const dist  = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const dist2 = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; };
export const norm  = (dx, dy) => { const d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; };

/* shortest signed difference between two angles */
export const angleDiff = (a, b) => {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/* mulberry32 — a seeded RNG, so one seed always regenerates the same world */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
