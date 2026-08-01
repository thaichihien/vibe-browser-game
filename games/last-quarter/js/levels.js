/* Level data.
 *
 * Every map is exactly ROWS (12) rows tall, so the camera only ever scrolls
 * horizontally. Rows are padded to the longest row on load, so a short row is
 * a cosmetic slip rather than a crash.
 *
 * Tiles
 *   .  empty            #  solid            =  one-way platform
 *   ^  spike            ~  lava             >  conveyor right    <  conveyor left
 * Markers (lifted out of the grid into entities, leaving the cell empty)
 *   P  player start     F  finish flag      C  checkpoint
 *   o  coin             E  enemy            S  spring            -  moving platform
 *
 * Rows 10–11 are the walking surface; row 9 is where anything standing on the
 * ground goes. A `-` sits at row 9, i.e. one tile above the surface, so the
 * platform must be jumped onto and stays clear of lava underneath it.
 */

/* ── level 1 — a gentle side of town ──────────────────────────────────── */
const L1 = [
  '.'.repeat(100),
  '.'.repeat(100),
  '.'.repeat(100),
  '.'.repeat(61) + 'oooooo' + '.'.repeat(33),
  '.'.repeat(60) + '=======' + '.'.repeat(33),
  '.'.repeat(45) + 'ooo' + '.'.repeat(52),
  '.'.repeat(23) + 'oo' + '.'.repeat(20) + '===' + '.'.repeat(52),
  '.'.repeat(22) + '====' + '.'.repeat(15) + 'ooo' + '.'.repeat(56),
  '.'.repeat(6) + 'ooo' + '.'.repeat(32) + '===' + '.'.repeat(44) + 'ooooo' + '.'.repeat(7),
  '..P' + '.'.repeat(15) + 'E' + '.'.repeat(9) + 'C' + '.'.repeat(7) + '^^' + '.'.repeat(12) +
    'E' + '.'.repeat(7) + 'S' + '.'.repeat(10) + 'C..^^' + '....' + 'E' + '.'.repeat(17) + 'F...',
  '#'.repeat(12) + '..' + '#'.repeat(16) + '..' + '#'.repeat(21) + '..' + '#'.repeat(28) + '..' + '#'.repeat(15),
  '#'.repeat(12) + '..' + '#'.repeat(16) + '..' + '#'.repeat(21) + '..' + '#'.repeat(28) + '..' + '#'.repeat(15),
];

/* ── level 2 — lava, ceilings, and one carried platform per crossing ──── */
const L2 = [
  '#'.repeat(110),
  '.'.repeat(110),
  '.'.repeat(110),
  '.'.repeat(110),
  '.'.repeat(46) + 'oooooo' + '.'.repeat(58),
  '.'.repeat(45) + '========' + '.'.repeat(57),
  '.'.repeat(110),
  '.'.repeat(12) + 'o' + '.'.repeat(10) + 'o' + '.'.repeat(10) + 'o' + '.'.repeat(40) + 'o' + '.'.repeat(34),
  '.'.repeat(5) + 'ooooo' + '.'.repeat(72) + 'ooooo' + '.'.repeat(23),
  '..P' + '.'.repeat(14) + 'E' + '.'.repeat(8) + 'C.^^' + '....' + '-' + '.'.repeat(5) + 'E..S' +
    '.'.repeat(12) + 'C' + '.'.repeat(9) + '^^..E' + '....' + '-' + '.'.repeat(22) + 'E..^^...F...',
  '#'.repeat(11) + '~~~' + '#'.repeat(8) + '~~~' + '#'.repeat(8) + '~~~~' + '#'.repeat(23) + '~~~' +
    '#'.repeat(11) + '~~~~~' + '#'.repeat(11) + '~~~' + '#'.repeat(17),
  '#'.repeat(11) + '~~~' + '#'.repeat(8) + '~~~' + '#'.repeat(8) + '~~~~' + '#'.repeat(23) + '~~~' +
    '#'.repeat(11) + '~~~~~' + '#'.repeat(11) + '~~~' + '#'.repeat(17),
];

/* ── level 3 — floating islands; most gaps are wider than a jump ───────── */
const L3 = [
  '.'.repeat(120),
  '.'.repeat(120),
  '.'.repeat(120),
  '.'.repeat(120),
  '.'.repeat(120),
  '.'.repeat(45) + 'ooooo' + '.'.repeat(70),
  '.'.repeat(44) + '=======' + '.'.repeat(69),
  '.'.repeat(33) + 'o' + '.'.repeat(37) + 'o' + '.'.repeat(13) + 'o' + '.'.repeat(34),
  '.'.repeat(9) + 'ooo' + '.'.repeat(9) + 'oo' + '.'.repeat(34) + 'oo' + '.'.repeat(40) + 'oo' + '.'.repeat(19),
  '..P..^^' + '.'.repeat(8) + 'E' + '.'.repeat(9) + 'C.E' + '.....' + '-' + '.'.repeat(6) + 'E..S' +
    '.'.repeat(8) + 'E' + '.'.repeat(9) + 'C...^^...' + '-' + '.'.repeat(6) + 'E' + '.'.repeat(6) + '-....C.E' +
    '.'.repeat(12) + '^^.E' + '.'.repeat(7) + 'F...',
  '#'.repeat(9) + '...' + '#'.repeat(8) + '>>>>' + '#'.repeat(7) + '.....' + '#'.repeat(8) + '....' +
    '#'.repeat(8) + '>>>>' + '#'.repeat(9) + '.....' + '#'.repeat(9) + '.....' + '#'.repeat(9) + '<<<<<' + '#'.repeat(18),
  '#'.repeat(9) + '...' + '#'.repeat(19) + '.....' + '#'.repeat(8) + '....' + '#'.repeat(21) + '.....' +
    '#'.repeat(9) + '.....' + '#'.repeat(32),
];

/* ── themes ───────────────────────────────────────────────────────────── */
const THEMES = {
  grass: {
    skyTop: '#082f2a', skyBottom: '#0f766e',
    hillFar: '#0b4a43', hillNear: '#115e59',
    groundTop: '#22c55e', groundBody: '#14532d', groundLine: '#166534',
    accent: '#4ade80', coinGlow: '#fde047',
    deco: ['🌿', '🌴', '🌸', '🍄'], sky: ['☁️', '☁️'],
    enemy: '🐛', hazardTint: '#ef4444',
  },
  magma: {
    skyTop: '#1b0606', skyBottom: '#450a0a',
    hillFar: '#2a0d0d', hillNear: '#3f1414',
    groundTop: '#b45309', groundBody: '#3f1a05', groundLine: '#7c2d12',
    accent: '#fb923c', coinGlow: '#fbbf24',
    deco: ['🪨', '💀', '🔥', '🦴'], sky: ['🔥', '✨'],
    enemy: '🦂', hazardTint: '#f97316',
  },
  sky: {
    skyTop: '#0b1033', skyBottom: '#3730a3',
    hillFar: '#161c4d', hillNear: '#1e276b',
    groundTop: '#38bdf8', groundBody: '#1e3a8a', groundLine: '#2563eb',
    accent: '#67e8f9', coinGlow: '#fde68a',
    deco: ['🛰️', '⭐', '🔷', '📡'], sky: ['☁️', '⭐'],
    enemy: '🤖', hazardTint: '#f43f5e',
  },
};

/* ── the people at the cabinet ────────────────────────────────────────────
 * Each one intends roughly the right thing and executes it badly. The numbers
 * are how badly.
 *   reactionMs   delay between deciding and pressing — this is also the window
 *                you get to see their intent before their hand moves, so it
 *                doubles as how much warning the keycaps give you
 *   aimErrorPx   spread on where they think the jump should start
 *   panicChance  odds of backing away instead of dealing with an enemy
 *   mashPerSec   stray jump presses per second
 *   wanderPerSec per second odds of just letting go or pulling the wrong way
 *   attention    multiplier on how hard they scrutinise the buttons
 *   hat / acc    worn above the head and held beside it, so each person at the
 *                cabinet is recognisable at a glance rather than being the same
 *                yellow circle with a different mouth
 */
const PLAYERS = {
  dave: { name: 'DAVE', tag: 'plays now and then', face: '🙂', hat: '🧢', acc: '☕',
          reactionMs: 300, aimErrorPx: 36, panicChance: 0.12,
          mashPerSec: 0.30, wanderPerSec: 0.16, attention: 1.00, boredScale: 1.00 },
  meg:  { name: 'MEG', tag: 'no patience at all', face: '😤', hat: '🎧', acc: '🧋',
          reactionMs: 400, aimErrorPx: 48, panicChance: 0.30,
          mashPerSec: 0.90, wanderPerSec: 0.45, attention: 0.92, boredScale: 1.20 },
  /* Toby is the hardest on both meters at once, which is what makes 3-1 the
   * finale rather than just a longer level. He scrutinises the machine hardest
   * because he has no idea what it is supposed to do, so anything odd reads as
   * broken — and being a kid on his first go, he loses interest fastest too.
   * Beating him means playing entertainingly *and* staying in sync. */
  toby: { name: 'TOBY', tag: 'never played before', face: '😯', hat: '🎈', acc: '🧸',
          reactionMs: 560, aimErrorPx: 78, panicChance: 0.46,
          mashPerSec: 1.60, wanderPerSec: 0.72, attention: 1.15, boredScale: 1.45 },
};

export const LEVELS = [
  {
    id: 1, code: '1-1', name: 'NEON GRASS', map: L1, theme: THEMES.grass, player: PLAYERS.dave,
    blurb: 'A quiet Tuesday. Dave is fine at this. Mostly do what he says.',
  },
  {
    id: 2, code: '2-1', name: 'MAGMA CAVES', map: L2, theme: THEMES.magma, player: PLAYERS.meg,
    blurb: 'Meg mashes when she panics. Every stray press is a jump you can borrow.',
  },
  {
    id: 3, code: '3-1', name: 'SKY CIRCUIT', map: L3, theme: THEMES.sky, player: PLAYERS.toby,
    blurb: "Toby has never held a joystick. You are playing this one. He must not find out.",
  },
];

/* Pad every row to the longest one so a miscounted map degrades gracefully. */
export function normalizeMap(map) {
  const w = map.reduce((m, r) => Math.max(m, r.length), 0);
  return map.map(r => r.padEnd(w, '.'));
}
