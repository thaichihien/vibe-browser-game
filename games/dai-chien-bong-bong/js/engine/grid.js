/* The tile map.
 *
 * Terrain only. Balloons, water and items are *entities* keyed by tile index in
 * the game state, not tile types — a balloon has a fuse and an owner, water has
 * a lifetime and an owner, and baking those into a Uint8Array would mean losing
 * exactly the fields the damage model needs.
 */

import { COLS, ROWS, TILE, DROP_TABLE } from '../config.js';

export const EMPTY = 0;
export const HARD = 1;
export const SOFT = 2;
/* Permanent flood left behind by Tide (§3.6). Walkable, but it bubbles you the
 * same way water does — the arena itself becomes the hazard. */
export const HAZARD = 3;

export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class Grid {
  constructor(cols = COLS, rows = ROWS) {
    this.cols = cols;
    this.rows = rows;
    this.tiles = new Uint8Array(cols * rows);
  }

  idx(c, r) { return r * this.cols + c; }
  inBounds(c, r) { return c >= 0 && r >= 0 && c < this.cols && r < this.rows; }
  at(c, r) { return this.inBounds(c, r) ? this.tiles[r * this.cols + c] : HARD; }
  set(c, r, t) { if (this.inBounds(c, r)) this.tiles[r * this.cols + c] = t; }

  colOf(x) { return Math.floor(x / TILE); }
  rowOf(y) { return Math.floor(y / TILE); }
  centerX(c) { return c * TILE + TILE / 2; }
  centerY(r) { return r * TILE + TILE / 2; }

  /* Blocks walking. HAZARD deliberately does not — you can run through a flood,
   * you just get bubbled for it. */
  blocks(c, r) {
    const t = this.at(c, r);
    return t === HARD || t === SOFT;
  }

  clone() {
    const g = new Grid(this.cols, this.rows);
    g.tiles.set(this.tiles);
    return g;
  }
}

/* Parse a map out of string art. See data/maps.js for the legend.
 * Returns the grid plus every marker position, so a map file stays one readable
 * block instead of a grid and three coordinate lists that can drift apart. */
export function parseMap(lines) {
  const rows = lines.length;
  const cols = lines[0].length;
  const grid = new Grid(cols, rows);
  const marks = { p1: null, p2: null, minions: [], boss: null };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = lines[r][c];
      let t = EMPTY;
      if (ch === '#') t = HARD;
      else if (ch === 'o') t = SOFT;
      else if (ch === '~') t = HAZARD;
      else if (ch === '1') marks.p1 = { c, r };
      else if (ch === '2') marks.p2 = { c, r };
      else if (ch === 'm') marks.minions.push({ c, r });
      else if (ch === 'B') marks.boss = { c, r };
      grid.set(c, r, t);
    }
  }
  return { grid, marks };
}

/* Roll one drop for a destroyed SOFT tile. `rand` is injectable so the tests
 * can pin it. */
export function rollDrop(rand = Math.random) {
  let total = 0;
  for (const [, w] of DROP_TABLE) total += w;
  let n = rand() * total;
  for (const [kind, w] of DROP_TABLE) {
    n -= w;
    if (n < 0) return kind;
  }
  return null;
}

/* Tiles a cross blast covers from an origin, stopping at HARD and consuming the
 * *first* SOFT in each direction (§2.2.4). Used for previews and for the AI's
 * idea of danger; the real burst in balloons.js also has to handle chaining, so
 * it walks the same rules rather than calling this.
 */
export function crossTiles(grid, c, r, power) {
  const out = [{ c, r, dist: 0 }];
  for (const [dc, dr] of DIRS) {
    for (let k = 1; k <= power; k++) {
      const nc = c + dc * k, nr = r + dr * k;
      if (!grid.inBounds(nc, nr)) break;
      const t = grid.at(nc, nr);
      if (t === HARD) break;
      out.push({ c: nc, r: nr, dist: k });
      if (t === SOFT) break;
    }
  }
  return out;
}
