/* The stage state object and the queries every system shares.
 *
 * DOM-free on purpose — ui/ reads this, it never writes to it, and the Node
 * tests build one of these directly.
 */

import { parseMap, HAZARD } from './grid.js';
import { HITBOX, TILE } from '../config.js';

export function createState(mapLines, opts = {}) {
  const { grid, marks } = parseMap(mapLines);
  return {
    grid,
    marks,
    t: 0,                       // seconds since the stage started
    players: [],
    /* An array, not a tile map: balloons get kicked and thrown, so their tile
     * is not a stable key. There are never more than ~16, so the linear scans
     * below cost nothing. */
    balloons: [],
    water: new Map(),           // tileIdx -> { c, r, owner, life }
    items: new Map(),           // tileIdx -> item kind
    pending: [],                // scheduled water spawns, the blast stagger
    monsters: [],
    clones: [],
    kills: 0,
    deaths: 0,
    firstKill: false,
    boss: null,
    telegraphs: [],             // { tiles, kind, at, lead, resolve }
    fx: [],                     // purely visual, safe to drop
    shake: 0,
    outcome: null,              // null | 'clear' | 'fail'
    /* Named beats the UI drains each frame to fire sound. The engine stays
     * DOM-free and audio-free; it just says what happened. */
    events: [],
    rand: opts.rand || Math.random,
  };
}

/* ── tile queries ─────────────────────────────────────────────────────── */

export function emit(state, name) { state.events.push(name); }

export function balloonAt(state, c, r) {
  for (const b of state.balloons) {
    if (b.flight) continue;                 // in the air, not on the board yet
    if (b.c === c && b.r === r) return b;
  }
  return null;
}

export function waterAt(state, c, r) {
  return state.water.get(state.grid.idx(c, r)) || null;
}

/* True if `p` cannot walk into this tile. Pass p = null for "solid to anything".
 *
 * Neither the boss nor the minions appear here: bodies do not block movement,
 * they bubble you on contact. That keeps a 3×3 boss from ever crushing a player
 * into geometry, which is a whole class of bug the game simply doesn't have.
 */
export function solidFor(state, p, c, r) {
  if (state.grid.blocks(c, r)) return true;
  const b = balloonAt(state, c, r);
  if (b && !(p && b.phasing.has(p.id))) return true;
  return false;
}

/* Does an entity's hitbox overlap this tile? */
export function overlapsTile(e, c, r, size = HITBOX) {
  const h = size / 2;
  return e.x + h > c * TILE && e.x - h < (c + 1) * TILE &&
         e.y + h > r * TILE && e.y - h < (r + 1) * TILE;
}

/* The tile an entity is "standing on" — its centre. Water contact, item pickup
 * and balloon placement all use this rather than the full hitbox, so clipping a
 * corner of a flooded tile never bubbles you. */
export function tileUnder(state, e) {
  return { c: state.grid.colOf(e.x), r: state.grid.rowOf(e.y) };
}

/* Water or permanent flood — the two things that bubble you. */
export function wetAt(state, c, r) {
  const w = waterAt(state, c, r);
  if (w) return w;
  if (state.grid.at(c, r) === HAZARD) return { c, r, owner: -1, hazard: true };
  return null;
}

/* Every EMPTY tile, grouped into connected regions. Used to pick minion spawns
 * that are not sealed inside a one-tile pocket. */
export function emptyRegions(state) {
  const { grid } = state;
  const seen = new Uint8Array(grid.cols * grid.rows);
  const regions = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const i = grid.idx(c, r);
      if (seen[i] || grid.blocks(c, r)) continue;
      const region = [];
      const stack = [[c, r]];
      seen[i] = 1;
      while (stack.length) {
        const [cc, rr] = stack.pop();
        region.push({ c: cc, r: rr });
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = cc + dc, nr = rr + dr;
          if (!grid.inBounds(nc, nr) || grid.blocks(nc, nr)) continue;
          const j = grid.idx(nc, nr);
          if (seen[j]) continue;
          seen[j] = 1;
          stack.push([nc, nr]);
        }
      }
      regions.push(region);
    }
  }
  return regions.sort((a, b) => b.length - a.length);
}
