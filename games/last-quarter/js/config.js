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
 * the meter by the same factor, so every trajectory and every gap stays
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
  /* Nothing is held, so a direction tap is an impulse: velocity jumps straight
   * to full speed and then bleeds off. The decay is deliberately gentle — one
   * tap has to carry far enough that a corridor costs a press every couple of
   * seconds rather than every stride, or the keycaps become noise again. */
  dashDecay: 95,           // px/s of speed lost per second while coasting
  /* Exactly zero. A jump has to keep every pixel per second it left the ground
   * with, because the 136px reach that every gap in every level is measured
   * against is `runSpeed × airtime`. Bleeding even 30px/s in the air shortened
   * that to ~129 and turned clean jumps into 5px-margin coin flips. */
  airDecay: 0,
  turnBoost: 1.0,          // a tap the other way reverses outright
  /* 95px apex (just under 3 tiles, so a 3-tile wall still blocks) and 136px of
   * reach, which clears a 3-tile hole with room to spare and nothing wider.
   * Every gap in the levels is either under that or has a platform in it. */
  jumpVel: 600,
  coyote: 0.15,
  buffer: 0.17,
  springVel: 800,
  stompBounce: 400,
  conveyor: 70,
  bodyW: 20,
  bodyH: 26,
  respawnDelay: 0.85,
};

/* ── the one hidden meter ─────────────────────────────────────────────────
 * PATIENCE: how much longer this person believes the joystick is connected to
 * anything. A press of yours that matched theirs adds; a miss subtracts. That
 * is the whole ledger — nothing else in the game touches it.
 *
 * There are exactly two ways to lose, and each has its own resource:
 *   patience → 0   they decide the cabinet is broken and fetch the attendant
 *   hearts   → 0   the character is dead three times over
 *
 * Obeying kills you on hearts, defying kills you on patience, and that squeeze
 * is the game. Boredom used to be a third pressure bleeding the meter on a
 * timer; it is gone, so nothing runs out while you are playing well.
 *
 * Never drawn as a bar during play.
 */
export const METER = {
  hearts: 3,

  patienceStart: 60,
  patienceMax: 100,

  /* The only income. A press of yours that matched theirs, in time, on the
   * right key. One hand can strike about 1.4 keys a second, so a run that
   * answers everything climbs at roughly 4/s — fast enough that a clean patch
   * genuinely buys back room to disobey later. */
  hitGain: 2.0,

  /* The only drain, charged once on a verdict and never continuously. A miss is
   * worth two to three obedient presses, so you can afford to defy them every
   * few seconds — not every second. */
  missGhost: 7,            // you acted, they never pressed
  missIgnored: 5,          // they pressed, the window lapsed


  /* The hit window, which is the whole of divergence. Their press opens an
   * accept window; land yours inside it and the machine reads as obedient. Act
   * well before they ask and it is a ghost input; let the window lapse and the
   * button looks dead. */
  jumpAcceptEarly: 0.26,   // how far ahead of their press you may act
  jumpAcceptLate: 0.30,    // how long after their press the window stays open

  /* How visibly the picture falls apart. Not a resource — it is recent miss
   * pressure, decaying, so the CRT reacts to what you just did while the face
   * reports where patience stands. Two instruments, one number underneath. */
  heatPerMiss: 0.34,
  heatDecay: 0.5,

  /* Attention scales with patience: someone who believes the machine is working
   * stops scrutinising it, so a clean patch is literally what buys room to
   * disobey. Kept narrow on purpose — low patience making misses dearer feeds
   * straight back into patience, and too wide a range is a death spiral. */
  attentionAtEmpty: 1.3,
  attentionAtFull: 0.7,
  coverSpring: 1.2,        // seconds of free divergence after a spring launch
  coverRide: 0.4,          // grace after stepping off a platform/conveyor
  nearMissDist: 34,
  nearMissCooldown: 0.7,
};

/* ── debug ────────────────────────────────────────────────────────────────
 * Off in the shipped build — the whole point of the game is reading the human
 * instead of a HUD. Flip any of these here, or add ?debug=1 to the URL to turn
 * the lot on for a tuning or verification pass.
 */
export const DEBUG = {
  meters: false,       // live patience / heat / cover readout
  hitboxes: false,     // player, entity and hazard boxes
  humanIntent: false,  // what the simulated human is currently trying to do
  tileGrid: false,
  unlockAll: false,    // every cabinet playable without clearing the earlier ones
};

if (typeof location !== 'undefined') {
  if (/[?&]debug=1/.test(location.search)) {
    for (const k of Object.keys(DEBUG)) DEBUG[k] = true;
  }
  /* Kept separate from ?debug=1 on purpose: that one draws the real patience
   * number, which spoils the whole point of reading it off the person. Use
   * ?unlock=1 to jump straight to a level and still play it honestly. */
  if (/[?&]unlock=1/.test(location.search)) DEBUG.unlockAll = true;
}

export const STORE_MUTED = 'lastQuarter.muted';
export const STORE_PROGRESS = 'lastQuarter.progress';
