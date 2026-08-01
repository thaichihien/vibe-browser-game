/* Last Quarter — tuning constants and debug switches.
 *
 * Everything the game "feels" like lives here so a balance pass is one file.
 * Nothing in this module touches the DOM.
 */

/* ── geometry ─────────────────────────────────────────────────────────── */
export const TILE = 32;
export const COLS = 20;                 // tiles across the CRT
export const ROWS = 12;                 // tiles down — levels are exactly this tall
export const VIEW_W = COLS * TILE;      // 640
export const VIEW_H = ROWS * TILE;      // 384

/* Global pace. Scaling `dt` slows the character, the hand at the cabinet and
 * both meters by the same factor, so every trajectory and every gap stays
 * exactly as reachable as before — you simply get more real time to read the
 * screen and react. This is the honest dial for "too fast"; do not try to slow
 * the game by lowering runSpeed, which would silently shorten jump reach and
 * make gaps uncrossable. */
export const TIME_SCALE = 0.8;

/* ── platformer feel ──────────────────────────────────────────────────── */
export const PHYS = {
  gravity: 1900,
  maxFall: 760,
  runSpeed: 215,
  accel: 1500,
  airAccel: 1000,
  friction: 2000,
  /* 95px apex (just under 3 tiles, so a 3-tile wall still blocks) and 136px of
   * reach, which clears a 3-tile hole with room to spare and nothing wider.
   * Every gap in the levels is either under that or has a platform in it. */
  jumpVel: 600,
  jumpCut: 0.42,       // vy multiplier when jump is released early
  coyote: 0.15,
  buffer: 0.17,
  springVel: 800,
  stompBounce: 400,
  conveyor: 70,
  bodyW: 20,
  bodyH: 26,
  respawnDelay: 0.85,
};

/* ── the two hidden meters ────────────────────────────────────────────── */
export const METER = {
  hearts: 3,

  /* FUN — how entertained the human is. Never drawn as a bar. */
  funStart: 60,
  funMax: 100,
  /* Boredom is not a flat drain: it accelerates the longer you go without
   * doing anything worth watching. Safe, slow play is what actually kills you. */
  boredomBase: 0.9,
  boredomPeak: 2.5,
  boredomRamp: 7.5,        // seconds of nothing before boredom is at full strength
  progressGain: 0.030,     // per px of new furthest-right distance
  coinGain: 4,
  stompGain: 7,
  nearMissGain: 11,
  checkpointGain: 10,
  idleAfter: 2.0,
  idleDrain: 4,
  deathFirst: 4,           // the first death of a level is a thrill, not a bore
  deathAfter: -11,

  /* SUS — how convinced the human is that the cabinet is broken. */
  susMax: 100,
  susDirRate: 32,          // points/sec while your direction contradicts theirs
  susDecay: 6,
  /* Jump is judged as a call-and-response with a timing window rather than a
   * silent tolerance. Their press opens an accept window; land your jump inside
   * it and it reads as the machine obeying. Press well before they do and it is
   * a ghost jump; let the window lapse and it is a dead button. */
  jumpAcceptEarly: 0.26,   // how far ahead of their press you may jump
  jumpAcceptLate: 0.30,    // how long after their press the window stays open
  susJumpHit: 1.5,         // a clean match reassures them a little
  /* Mistimed jumps are the loudest tell there is — a button that visibly did
   * nothing, or a jump nobody asked for. Priced above the direction weights
   * below on purpose: the joystick is a held state you can drift back into
   * sync on, the button is a discrete promise you either kept or broke. */
  susGhostJump: 28,        // you jumped, they never pressed
  susIgnoredJump: 16,      // they pressed jump, the window lapsed
  graceTime: 0.28,         // brief mismatches read as input lag and cost nothing
  /* Attention scales with boredom: an absorbed human stops watching the buttons.
   * Keeping FUN high is literally what buys you room to disobey. */
  attentionAtZeroFun: 1.4,
  attentionAtFullFun: 0.6,
  wWrongDir: 1.0,          // they hold right, you run left
  wFrozen: 0.7,            // they hold a direction, you stand there
  /* Coasting on after they let go is the mildest of the three — the machine
   * carrying on is far less damning than it going the wrong way. Kept cheap on
   * purpose: a flailing player lets go constantly, and suspicion accrued while
   * you were simply making progress feels like it was nothing to do with you. */
  wGhostMove: 0.35,
  /* Pulling left is a deliberate, infrequent input — they hold right by default
   * and barely watch it, but when they consciously haul the stick back the other
   * way and nothing happens, that is the moment they notice. */
  wLeftBias: 1.35,

  coverSpring: 1.2,        // seconds of free divergence after a spring launch
  coverRide: 0.4,         // grace after stepping off a platform/conveyor
  nearMissDist: 34,
  nearMissCooldown: 0.7,
};

/* ── debug ────────────────────────────────────────────────────────────────
 * Off in the shipped build — the whole point of the game is reading the human
 * instead of a HUD. Flip any of these here, or add ?debug=1 to the URL to turn
 * the lot on for a tuning or verification pass.
 */
export const DEBUG = {
  meters: false,       // live FUN / SUS / cover readout
  hitboxes: false,     // player, entity and hazard boxes
  humanIntent: false,  // what the simulated human is currently trying to do
  tileGrid: false,
};

if (typeof location !== 'undefined' && /[?&]debug=1/.test(location.search)) {
  for (const k of Object.keys(DEBUG)) DEBUG[k] = true;
}

export const STORE_MUTED = 'lastQuarter.muted';
export const STORE_PROGRESS = 'lastQuarter.progress';
