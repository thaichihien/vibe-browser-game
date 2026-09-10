/* Arena layouts, 15 × 13, as string art.
 *
 * Legend:  # HARD (indestructible)   o SOFT (breakable, may drop)
 *          . EMPTY                   ~ HAZARD (permanent flood)
 *          1 / 2 player spawns       B top-left tile of the boss footprint
 *
 * These are not arenas — they are the geometry half of a puzzle. Crazy Arcade's
 * monster maps are hand-built so that a *specific* set of monsters on *specific*
 * tiles behaves a specific way, and the layout exists to serve that: patrol
 * lanes that only run one axis, vertical shafts that let you cut a lane off,
 * cages of SOFT you have to blast or Throw into, chokepoints where one balloon
 * covers two approaches. See data/stages.js for the monsters that go in them —
 * neither file makes sense without the other.
 *
 * Boss arenas keep HARD pillars on the flanks. Those are the 걸치기 anchors:
 * you stand with your centre on a dry tile behind one, body overlapping the
 * boss's tile, and bomb it while its spray passes you.
 */

/* ── Octopus Raid — 문어대습격 ────────────────────────────────────────── */

/* A grid of corridors: six horizontal lanes crossed by four vertical shafts.
 * Cannonballs patrol the lanes; the shafts are where you get out of their way. */
export const DOCK = [
  '###############',
  '#1..o.....o..o#',
  '#.###.###.###.#',
  '#....o...o....#',
  '#.###.###.###.#',
  '#o...........o#',
  '#.###.###.###.#',
  '#....o...o....#',
  '#.###.###.###.#',
  '#o..o.....o..o#',
  '#.###.###.###.#',
  '#o...........2#',
  '###############',
];

/* A ring of crates around a sealed inner chamber. The monsters inside cannot
 * reach you and you cannot reach them — until you spend bombs opening it. */
export const WAREHOUSE = [
  '###############',
  '#1...........o#',
  '#.ooooooooooo.#',
  '#.o.........o.#',
  '#.o.ooooo...o.#',
  '#.o.o...o...o.#',
  '#...o.#.o....2#',
  '#.o.o...o...o.#',
  '#.o.ooooo...o.#',
  '#.o.........o.#',
  '#.ooooooooooo.#',
  '#o...........o#',
  '###############',
];

export const TRENCH = [
  '###############',
  '#1...........2#',
  '#.o.........o.#',
  '#..#.......#..#',
  '#.o.........o.#',
  '#.....B......o#',
  '#..#.......#..#',
  '#.o.........o.#',
  '#..#.......#..#',
  '#.o.........o.#',
  '#..#.......#..#',
  '#o...........o#',
  '###############',
];

/* ── Penguin Raid — 황제의귀환 ────────────────────────────────────────── */

/* Seven vertical shafts. Fuzzies run one shaft each and never turn, so the
 * whole stage is about which lane you are standing in. */
export const RINK = [
  '###############',
  '#1..o.o.o.o..o#',
  '#.#.#.#.#.#.#.#',
  '#.............#',
  '#.#.#.#.#.#.#.#',
  '#o.....o.....o#',
  '#.#.#.#.#.#.#.#',
  '#.............#',
  '#.#.#.#.#.#.#.#',
  '#o.....o.....o#',
  '#.#.#.#.#.#.#.#',
  '#o..o.o.o.o..2#',
  '###############',
];

export const CAVERN = [
  '###############',
  '#1.o.......o..#',
  '#.###.o.o.###.#',
  '#..o.......o..#',
  '#o.#.#####.#.o#',
  '#....o...o....#',
  '#.#.##...##.#.#',
  '#....o...o....#',
  '#o.#.#####.#.o#',
  '#..o.......o..#',
  '#.###.o.o.###.#',
  '#..o.......o.2#',
  '###############',
];

export const THRONE = [
  '###############',
  '#1...........2#',
  '#.o.#.....#.o.#',
  '#...........o.#',
  '#.o.#.....#...#',
  '#.....B.......#',
  '#..#.......#..#',
  '#.o.........o.#',
  '#.o.#.....#.o.#',
  '#...........o.#',
  '#.o.#.....#.o.#',
  '#o...........o#',
  '###############',
];

/* ── Seal Raid — 물개의분노 ───────────────────────────────────────────── */

export const HILL = [
  '###############',
  '#1..o.....o..o#',
  '#.o.o.ooo.o.o.#',
  '#.............#',
  '#o.#.#...#.#.o#',
  '#....ooooo....#',
  '#.#.#.....#.#.#',
  '#....ooooo....#',
  '#o.#.#...#.#.o#',
  '#.............#',
  '#.o.o.ooo.o.o.#',
  '#o..o.....o..2#',
  '###############',
];

export const SHOAL = [
  '###############',
  '#1.........o..#',
  '#.#.#.#.#.#.#.#',
  '#..o.ooooo.o..#',
  '#.#.#.#.#.#.#.#',
  '#o...o...o...o#',
  '#.#.#.#.#.#.#.#',
  '#o...o...o...o#',
  '#.#.#.#.#.#.#.#',
  '#..o.ooooo.o..#',
  '#.#.#.#.#.#.#.#',
  '#..o.........2#',
  '###############',
];

/* Long clear rows, because the Seal King's whole threat is rolling down one.
 * The only safety is being on a different row when it commits. */
export const BAY = [
  '###############',
  '#1...........2#',
  '#.o.o.....o.o.#',
  '#.............#',
  '#.o.#.....#.o.#',
  '#.....B.......#',
  '#.............#',
  '#.o.#.....#.o.#',
  '#.............#',
  '#.o.o.....o.o.#',
  '#.............#',
  '#o...........o#',
  '###############',
];
