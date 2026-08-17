/* Tuning constants. Everything the game measures in "cells", never pixels —
   pixels only appear at draw time, so the grid can grow without touching logic. */

export const BASE_SIZE = 5;    // the grid you start on (plain Grid Survival)
export const BIG_SIZE  = 9;    // after the first event, permanently
export const CELL      = 54;   // px per cell
export const PAD       = 1.5;  // cells of margin so off-grid bullets stay visible
export const BOARD_PX  = (BIG_SIZE + PAD * 2) * CELL;

export const CENTER = (BIG_SIZE - 1) / 2;   // 7 — same centre at both sizes

/* the opening act: plain missiles, one at a time, then more.
   `speed` is a constant on purpose — a run gets harder by throwing *more*
   missiles (COUNT_STEPS) and by the storm events, never by making the same
   missile faster. Events still scale off it (`g.speed * 1.6` and friends), so
   they all keep their relative pace whatever this is set to. */
export const BASE_SPAWN = {
  every:  [1.30, 0.55],   // seconds between volleys, t=0 -> t=RAMP
  count:  [1, 3],         // missiles per volley, before the grid expands
  speed:  2.4,            // cells per second, start to finish
  ramp:   150             // seconds to reach the right-hand values
};

/* Once the grid expands the volley size stops sliding and steps instead:
   frozen at whatever the expansion set it to, then one more missile at each of
   these marks — measured from the start of the run, not from the expansion.
   Four steps and that is the ceiling; past 600s the storm escalates through
   events alone. */
export const COUNT_STEPS = [100, 200, 400, 600];

/* Breathing room after any event that owned the spawner: the first plain volley
   waits this long once the board is handed back. */
export const SPAWN_GRACE = 1.4;

export const FIRST_EVENT_AT = 20;   // grid expansion fires here, always
export const EVENT_GAP      = [18, 25];  // then a new event every 18-25s, jittered
export const MAX_CONCURRENT = 2;

export const PLAYER = {
  half:      0.34,   // hitbox half-extent, in cells
  tapDelay:  0.17,   // hold-to-repeat: first repeat
  repeat:    0.105,  // hold-to-repeat: subsequent
  ease:      18      // smoothing speed toward the target cell
};

export const COLORS = {
  bg:     '#080b14',
  cell:   '#1d2942',
  cellAlt:'#182338',
  edge:   '#3c5484',
  player: '#3ff07a',
  warn:   '#ffb300',
  danger: '#ff2e5b'
};

export const PALETTE = [
  '#ff5252', '#ff9800', '#ffeb3b', '#4caf50',
  '#00e5ff', '#2196f3', '#b388ff', '#ff4dd2'
];

export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const rnd  = (a, b) => a + Math.random() * (b - a);
export const rndi = (a, b) => Math.floor(rnd(a, b + 1));
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
