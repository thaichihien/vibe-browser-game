/* Seeded map generation.

   Fairness comes from rotational symmetry: every feature is expressed as a list
   of discs, and each disc is stamped `players` times around the map centre at
   equal angles. Two kingdoms get a 180° mirror of each other, three get a 120°
   pinwheel — either way nobody has a shorter walk to gold than anybody else.

   DOM-free: imported directly by the test suite. */

import {
  TILE, MAP_TILES, WORLD_PX, T, SOLID, TILE_RESOURCE, NODE_YIELD, TILE_SPENT, makeRng
} from './config.js';

const N = MAP_TILES;
const C = (N - 1) / 2;

/* ── tile access ──────────────────────────────────────────────────────────── */

export const tileIndex = (tx, ty) => ty * N + tx;
export const inBounds  = (tx, ty) => tx >= 0 && ty >= 0 && tx < N && ty < N;

export const tileAtPx = (w, px, py) => {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  return inBounds(tx, ty) ? w.tiles[tileIndex(tx, ty)] : T.ROCK;   // off-map reads as wall
};

export const solidAtPx = (w, px, py) => SOLID[tileAtPx(w, px, py)];
export const solidAtTile = (w, tx, ty) =>
  !inBounds(tx, ty) || SOLID[w.tiles[tileIndex(tx, ty)]];

/* Buildings sit in a separate overlay rather than in `tiles`, so razing one
   restores whatever terrain it was standing on without having to remember it. */
export const occupiedAtTile = (w, tx, ty) =>
  inBounds(tx, ty) && w.occupied[tileIndex(tx, ty)] !== 0;

export const blockedAtPx = (w, px, py) => {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (!inBounds(tx, ty)) return true;
  const i = tileIndex(tx, ty);
  return SOLID[w.tiles[i]] || w.occupied[i] !== 0;
};

/* stamp bumps whenever walkability changes, so cached flow fields know to rebuild */
export function markOccupied(w, tx, ty, value) {
  if (!inBounds(tx, ty)) return;
  w.occupied[tileIndex(tx, ty)] = value;
  w.stamp++;
}

export const tileCenter = (tx, ty) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });

/* ── generation ───────────────────────────────────────────────────────────── */

/* rotate a tile coordinate k steps of (2π / players) about the map centre */
function rotate(tx, ty, k, players) {
  if (k === 0) return [tx, ty];
  const a = (Math.PI * 2 * k) / players;
  const cos = Math.cos(a), sin = Math.sin(a);
  const dx = tx - C, dy = ty - C;
  return [Math.round(C + dx * cos - dy * sin), Math.round(C + dx * sin + dy * cos)];
}

/* Everything the generator produces is a disc. Discs are rotation-invariant, so
   stamping a rotated centre reproduces the feature exactly — which is what makes
   the symmetry hold without any special-casing. */
function disc(list, x, y, r, tile, priority = 0) {
  list.push({ x, y, r, tile, priority });
}

function blob(list, rng, x, y, r, tile, lobes = 3, spread = 1.6) {
  disc(list, x, y, r, tile);
  for (let i = 0; i < lobes; i++) {
    const a = rng() * Math.PI * 2;
    const d = r * spread * rng();
    disc(list, Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d),
      Math.max(1, Math.round(r * (0.5 + rng() * 0.6))), tile);
  }
}

export function generateWorld(seed = 1, players = 2) {
  const rng = makeRng(seed);
  const tiles = new Uint8Array(N * N).fill(T.GRASS);
  const shade = new Uint8Array(N * N);          // per-tile colour jitter, fixed at gen time
  const prop  = new Uint8Array(N * N);          // per-tile prop variant + offset, ditto

  const discs = [];      // the base sector; every one is stamped `players` times
  const starts = [];
  const camps = [];      // creep camps, also rotated

  /* start positions sit on a circle so every kingdom is equidistant from centre */
  const startR = N * 0.325;
  const startAngle = -Math.PI / 4;
  const home = {
    tx: Math.round(C + Math.cos(startAngle) * startR),
    ty: Math.round(C + Math.sin(startAngle) * startR)
  };

  /* ── scattered terrain ──────────────────────────────────────────────────── */
  for (let i = 0; i < 5; i++) {
    blob(discs, rng, Math.round(rng() * N), Math.round(rng() * N),
      Math.round(4 + rng() * 6), T.WATER, 4, 1.5);
  }
  for (let i = 0; i < 22; i++) {
    blob(discs, rng, Math.round(rng() * N), Math.round(rng() * N),
      Math.round(2 + rng() * 3), T.FOREST, 3, 1.9);
  }
  for (let i = 0; i < 12; i++) {
    blob(discs, rng, Math.round(rng() * N), Math.round(rng() * N),
      Math.round(2 + rng() * 2), T.ROCK, 2, 1.7);
  }
  for (let i = 0; i < 8; i++) {
    blob(discs, rng, Math.round(rng() * N), Math.round(rng() * N),
      Math.round(2 + rng() * 2), T.FIELD, 2, 1.5);
  }

  /* ── the guaranteed home kit ────────────────────────────────────────────── */
  /* Placed relative to the start and rotated with everything else, so all three
     of these exist at the same offsets for every kingdom. */
  const at = (dx, dy) => [home.tx + dx, home.ty + dy];

  blob(discs, rng, ...at(9, -4), 4, T.FOREST, 3, 1.4);     // firewood, close
  blob(discs, rng, ...at(-7, 8), 4, T.FOREST, 3, 1.4);
  blob(discs, rng, ...at(-2, -10), 3, T.FIELD, 2, 1.2);    // the wheat the king cuts first
  blob(discs, rng, ...at(11, 7), 3, T.FIELD, 2, 1.2);

  /* gold: one at a walk, one properly far — both guarded */
  const mines = [at(20, 16), at(-24, 22)];
  mines.forEach(([mx, my], i) => {
    disc(discs, mx, my, 2 + i, T.MINE, 2);
    camps.push({ tx: mx, ty: my, count: 3 + i * 2, ring: 3 + i });
  });

  /* a neutral seam at dead centre, worth fighting over */
  disc(discs, Math.round(C), Math.round(C), 3, T.MINE, 2);

  /* ── stamp every disc once per kingdom ──────────────────────────────────── */
  const ordered = [...discs].sort((a, b) => a.priority - b.priority);
  for (let k = 0; k < players; k++) {
    for (const d of ordered) {
      const [cx, cy] = rotate(d.x, d.y, k, players);
      stampDisc(tiles, cx, cy, d.r, d.tile);
    }
  }

  /* ── clear a buildable platform under each start ────────────────────────── */
  for (let k = 0; k < players; k++) {
    const [sx, sy] = rotate(home.tx, home.ty, k, players);
    stampDisc(tiles, sx, sy, 6, T.GRASS);
    stampDisc(tiles, sx, sy, 3, T.PATH);
    starts.push({ tx: sx, ty: sy, ...tileCenter(sx, sy) });
  }

  /* ── sand rims around water, so lakes do not sit flush on grass ─────────── */
  const rim = [];
  for (let ty = 0; ty < N; ty++) {
    for (let tx = 0; tx < N; tx++) {
      if (tiles[tileIndex(tx, ty)] !== T.GRASS) continue;
      if (neighbourIs(tiles, tx, ty, T.WATER)) rim.push(tileIndex(tx, ty));
    }
  }
  for (const i of rim) tiles[i] = T.SAND;

  /* ── per-tile jitter, baked once ────────────────────────────────────────── */
  for (let i = 0; i < tiles.length; i++) {
    shade[i] = Math.floor(rng() * 5);
    prop[i]  = Math.floor(rng() * 256);
  }

  /* ── the main connected region ──────────────────────────────────────────── */
  /* A tile can be walkable and still be a sealed pocket inside a rock ridge.
     Anything seated there — a wolf, a building, a rally point — is stranded for
     the whole match. One flood fill from a start settles it once, and every
     placement afterwards just asks this array. */
  const reachable = new Uint8Array(N * N);
  {
    const s0 = starts[0];
    const queue = [s0.tx, s0.ty];
    reachable[tileIndex(s0.tx, s0.ty)] = 1;
    for (let head = 0; head < queue.length; head += 2) {
      const cx = queue[head], cy = queue[head + 1];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (!inBounds(nx, ny)) continue;
        const i = tileIndex(nx, ny);
        if (reachable[i] || SOLID[tiles[i]]) continue;
        reachable[i] = 1;
        queue.push(nx, ny);
      }
    }
  }

  /* ── resource nodes, one per harvestable tile ───────────────────────────── */
  const nodes = [];
  for (let ty = 0; ty < N; ty++) {
    for (let tx = 0; tx < N; tx++) {
      const t = tiles[tileIndex(tx, ty)];
      const kind = TILE_RESOURCE[t];
      if (!kind) continue;
      const amount = NODE_YIELD[kind];
      nodes.push({
        tx, ty, ...tileCenter(tx, ty), kind, amount, max: amount, spent: false
      });
    }
  }

  /* ── creep camps, rotated with everything else ──────────────────────────── */
  const creepCamps = [];
  for (let k = 0; k < players; k++) {
    for (const c of camps) {
      const [cx, cy] = rotate(c.tx, c.ty, k, players);
      creepCamps.push({ tx: cx, ty: cy, ...tileCenter(cx, cy), count: c.count, ring: c.ring });
    }
  }
  /* and one pack on the centre seam, shared by everyone */
  creepCamps.push({
    tx: Math.round(C), ty: Math.round(C), ...tileCenter(Math.round(C), Math.round(C)),
    count: 6, ring: 4
  });

  const world = {
    seed, players, tiles, shade, prop, nodes, starts, creepCamps,
    occupied: new Uint8Array(N * N), stamp: 0, reachable,
    size: N, tile: TILE, px: WORLD_PX,
    nodeAt: new Map()
  };
  for (const n of world.nodes) world.nodeAt.set(tileIndex(n.tx, n.ty), n);
  return world;
}

function stampDisc(tiles, cx, cy, r, tile) {
  const r2 = r * r;
  const x0 = Math.max(0, cx - r), x1 = Math.min(N - 1, cx + r);
  const y0 = Math.max(0, cy - r), y1 = Math.min(N - 1, cy + r);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const dx = tx - cx, dy = ty - cy;
      if (dx * dx + dy * dy <= r2) tiles[tileIndex(tx, ty)] = tile;
    }
  }
}

function neighbourIs(tiles, tx, ty, want) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = tx + dx, ny = ty + dy;
      if (!inBounds(nx, ny)) continue;
      if (tiles[tileIndex(nx, ny)] === want) return true;
    }
  }
  return false;
}

/* ── mutation during play ─────────────────────────────────────────────────── */

/* Take from a node. When it runs dry the tile reverts, so a cut forest visibly
   thins out rather than staying a wall of trees with nothing in it. */
export function harvestNode(world, node, amount) {
  if (node.spent) return 0;
  const took = Math.min(amount, node.amount);
  node.amount -= took;
  if (node.amount <= 0) {
    node.spent = true;
    const i = tileIndex(node.tx, node.ty);
    world.tiles[i] = TILE_SPENT[world.tiles[i]] ?? T.GRASS;
    world.nodeAt.delete(i);
  }
  return took;
}

/* nearest live node of a kind, searched outward in rings so it stays cheap */
export function nearestNode(world, x, y, kind, maxTiles = 26) {
  const ctx = Math.floor(x / TILE), cty = Math.floor(y / TILE);
  for (let r = 0; r <= maxTiles; r++) {
    let best = null, bestD = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;   // ring only
        const n = world.nodeAt.get(tileIndex(ctx + dx, cty + dy));
        if (!n || n.spent || (kind && n.kind !== kind)) continue;
        const d = (n.x - x) ** 2 + (n.y - y) ** 2;
        if (d < bestD) { bestD = d; best = n; }
      }
    }
    if (best) return best;
  }
  return null;
}

/* Walkable *and* connected to the rest of the map. Placement and spawning both
   ask this rather than `passable`, which cannot see a sealed pocket. */
export const reachableTile = (w, tx, ty) =>
  inBounds(tx, ty) && w.reachable[tileIndex(tx, ty)] === 1;
