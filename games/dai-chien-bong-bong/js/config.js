/* Đại Chiến Bong Bóng — every number the game "feels" like.
 *
 * A balance pass is this one file. Nothing here touches the DOM, and nothing
 * here imports anything, so the engine modules and the Node tests can both
 * pull from it freely.
 */

/* Flip to true to draw raw numbers — boss HP, timers, cooldowns — on top of
 * the readouts. Off by default. */
export const DEBUG = false;

/* ── geometry ─────────────────────────────────────────────────────────── */
/* The one dial for board scale. Everything below is expressed as a fraction of
 * a tile or in tiles-per-second rather than in pixels, so changing TILE resizes
 * the board without changing how the game plays: a hard-coded 74 px/s would
 * silently become a *slower* walk in tile terms the moment tiles got bigger. */
export const TILE = 48;
export const COLS = 15;
export const ROWS = 13;
export const VIEW_W = COLS * TILE;   // 720
export const VIEW_H = ROWS * TILE;   // 624

/* Tiles per second → pixels per second. */
const tps = (t) => t * TILE;

/* The player is deliberately smaller than a tile. That slack is what makes
 * 걸치기 — "edging" — possible: you can stand with your body half over the
 * boss's tile while your *centre* stays on a dry one, which is how Crazy
 * Arcade players actually kill bosses. Water and monster contact are both
 * judged on the centre tile alone, and that is the whole reason why. */
export const HITBOX = Math.round(TILE * 0.70);

/* Corner-slip assist. Push into a wall corner and, if an open lane sits within
 * SLIP_PX perpendicular, you get nudged into it instead of stopping dead. */
export const SLIP_PX = Math.round(TILE * 0.28);
export const SLIP_SPEED = 0.9;       // fraction of walk speed spent on the nudge

/* ── balloon → water ──────────────────────────────────────────────────── */
export const FUSE_TIME = 2.3;
export const WATER_LINGER = 0.6;
/* Seconds of delay per tile of blast travel — what makes a chain read as a
 * chain instead of one silent flash. */
export const WAVE_STAGGER = 0.045;

export const KICK_SPEED = tps(6.5);
export const THROW_TILES = 5;
export const THROW_TIME = 0.55;

/* ── the player ───────────────────────────────────────────────────────── */
/* Indexed by speed tier 1..8, in tiles per second.
 *
 * Crazy Arcade's monster mode values these stats 물줄기 > 속도 > 물풍선 —
 * blast length first, speed second, bomb count a distant third ("there is never
 * an occasion to lay ten balloons at once"). The drop table below is weighted
 * to match, and the caps keep count low while power runs high. */
export const SPEED_TIERS = [0, 1.85, 2.30, 2.70, 3.05, 3.35, 3.63, 3.88, 4.10].map(tps);

export const BASE = { balloons: 1, power: 2, speedTier: 2, lives: 3 };
export const CAP = { balloons: 6, power: 8, speedTier: 8, lives: 5 };

/* The bubble state. Water never damages a player, it traps them — but a
 * *monster* is a different matter entirely; see MONSTER_CONTACT below. */
export const BUBBLE_DURATION = 6.0;
export const STRUGGLE_MASHES = 14;       // direction presses needed to break out
export const BUBBLE_SPEED = 0.15;        // fraction of walk speed while bubbled
export const ESCAPE_INVULN = 1.0;
export const RESPAWN_DELAY = 1.6;
export const SPAWN_INVULN = 2.0;

/* Touching a monster or the boss costs a life outright — no bubble, no
 * struggle, no rescue. This is the rule that makes Crazy Arcade's monster mode
 * what it is: monsters are not damage, they are walls that move, and a stage is
 * a routing problem before it is a shooting problem. */
export const MONSTER_CONTACT = 'lethal';
export const CONTACT_RANGE = 0.62;       // fraction of a tile, centre to centre

/* ── equipped actives (max 2, own cooldowns) ──────────────────────────── */
export const ACTIVES = {
  needle:    { icon: '📌', name: 'Kim Chọc', cd: 20 },
  shield:    { icon: '🛡️', name: 'Khiên Nước', cd: 30 },
  shockwave: { icon: '💥', name: 'Kích Nổ', cd: 25 },
  anchor:    { icon: '⚓', name: 'Neo Đá', cd: 20 },
};
export const ANCHOR_TIME = 2.0;

/* ── the boss ─────────────────────────────────────────────────────────── */
/* Plain HP, counted in *hits*, because that is what Crazy Arcade does and
 * because "nine more bombs" is a thing a player can actually hold in their
 * head. One water tile touching the boss is one hit, with a per-tile cooldown
 * so a lingering puddle cannot machine-gun it. */
export const BOSS_HIT_COOLDOWN = 0.28;
export const BOSS_STAGGER = 1.6;         // frozen briefly after a burst of hits
export const STAGGER_AT_HITS = 4;        // hits within STAGGER_WINDOW to trigger it
export const STAGGER_WINDOW = 1.2;

export const PHASE_AT = [0.60, 0.30];    // fraction of HP where patterns escalate
export const PHASE_INVULN = 1.2;

/* Every boss pattern telegraphs on the grid for at least this long. */
export const TELEGRAPH_MIN = 0.7;
export const TELEGRAPH_FINAL = 0.5;

/* Solo scaling — the mode goes down to one player in CA too. */
export const SOLO_HP = 0.7;

/* ── monsters ─────────────────────────────────────────────────────────── */
/* Three reactions to water, one per raid — exactly Crazy Arcade's three
 * monster-mode subtypes:
 *
 *   🎱 🧨  Octopus Raid — cannonball monsters, dead on the first hit.
 *   ⛄     Penguin Raid — frozen by water; a player must touch them to shatter
 *                        them, and they thaw if left alone.
 *   🐊     Seal Raid    — shrivelled by water; needs a *second* hit before it
 *                        recovers.
 */
export const MONSTER = {
  cannon: { icon: '🎱', name: 'Đạn Pháo',  die: 'instant', speed: tps(1.4) },
  rusher: { icon: '🧨', name: 'Bom Xù',    die: 'instant', speed: tps(2.0) },
  fuzzy:  { icon: '⛄', name: 'Cục Bông',  die: 'freeze',  speed: tps(1.5), freeze: 3.2 },
  croc:   { icon: '🐊', name: 'Cá Sấu',    die: 'shrivel', speed: tps(1.7), shrivel: 3.6 },
  egg:    { icon: '🥚', name: 'Trứng',     die: 'instant', speed: tps(1.1), hatch: 'fuzzy', hatchAt: 6 },
};

/* Every monster speeds up once the stage has dragged on, which is CA's way of
 * saying "stop farming, finish it". */
export const HURRY_AT = 60;
export const HURRY_MUL = 1.55;

/* ── items ────────────────────────────────────────────────────────────── */
/* Weighted toward power, then speed, then count — the order that actually
 * matters in this mode. `null` is most of the table on purpose. */
export const DROP_TABLE = [
  [null, 50], ['power', 16], ['shoe', 11], ['balloon', 8],
  ['throw', 4], ['kick', 4], ['heart', 2],
  ['needle', 1], ['shield', 2], ['shockwave', 1], ['anchor', 1],
];

export const ITEMS = {
  balloon:   { icon: '💣', name: 'Thêm Bom' },
  power:     { icon: '🔥', name: 'Sức Nước' },
  shoe:      { icon: '👟', name: 'Giày' },
  kick:      { icon: '🦵', name: 'Đá Bom' },
  throw:     { icon: '🤾', name: 'Ném Bom' },
  heart:     { icon: '❤️', name: 'Mạng' },
  needle:    { icon: '📌', name: 'Kim Chọc' },
  shield:    { icon: '🛡️', name: 'Khiên Nước' },
  shockwave: { icon: '💥', name: 'Kích Nổ' },
  anchor:    { icon: '⚓', name: 'Neo Đá' },
};

/* ── rank ─────────────────────────────────────────────────────────────── */
/* Crazy Arcade grades every run D→SS on kills + total time + deaths, and it is
 * the reason people replay a map they have already cleared. Time is summed
 * across all three stages, so a slow stage 1 can be paid back later. */
export const RANKS = [
  { id: 'SS', at: 0.94, color: '#ffd166' },
  { id: 'S',  at: 0.85, color: '#ffd166' },
  { id: 'A',  at: 0.72, color: '#2dd4bf' },
  { id: 'B',  at: 0.57, color: '#7cf7ff' },
  { id: 'C',  at: 0.40, color: '#9fb6c4' },
  { id: 'D',  at: 0,    color: '#7fa9be' },
];
export const RANK_WEIGHTS = { kills: 0.42, time: 0.42, noDeath: 0.16 };
/* Half the clean-run credit per death, which is steep on purpose: it means SS
 * is only reachable on a run where nothing touched you. A grade you can get
 * while dying is not the grade CA hands out. */
export const DEATH_PENALTY = 0.5;
