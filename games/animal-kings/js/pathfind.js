/* Group movement.

   A twenty-strong retinue does not need twenty A* searches — it needs one field.
   `getField` runs a BFS out from the goal across the whole tile grid and caches
   the result; every unit heading there just reads the local gradient. Fields are
   keyed by goal tile and evicted least-recently-used, so repeated orders to the
   same place cost nothing.

   DOM-free: imported directly by the test suite. */

import { TILE, MAP_TILES, SOLID } from './config.js';
import { tileIndex, inBounds } from './world.js';

const N = MAP_TILES;
export const UNREACHABLE = 65535;

/* 8-way, straights first so the gradient prefers them on ties */
const DIRS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1]
];

export function passable(world, tx, ty) {
  if (!inBounds(tx, ty)) return false;
  const i = tileIndex(tx, ty);
  return !SOLID[world.tiles[i]] && !world.occupied[i];
}

export function makeFieldCache(limit = 20) {
  return { limit, map: new Map(), stamp: -1 };
}

export function buildField(world, gx, gy) {
  const dist = new Uint16Array(N * N).fill(UNREACHABLE);
  if (!inBounds(gx, gy)) return dist;

  /* If the goal itself is blocked — a building, a treeline — seed from the ring
     around it, so "go to the barracks" resolves to "go to its doorstep". */
  const queue = [];
  if (passable(world, gx, gy)) {
    dist[tileIndex(gx, gy)] = 0;
    queue.push(gx, gy);
  } else {
    for (let r = 1; r <= 4 && queue.length === 0; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = gx + dx, ny = gy + dy;
          if (!passable(world, nx, ny)) continue;
          dist[tileIndex(nx, ny)] = 0;
          queue.push(nx, ny);
        }
      }
    }
  }

  for (let head = 0; head < queue.length; head += 2) {
    const cx = queue[head], cy = queue[head + 1];
    const d = dist[tileIndex(cx, cy)] + 1;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!passable(world, nx, ny)) continue;
      /* no cutting a diagonal through a corner gap */
      if (dx && dy && (!passable(world, cx + dx, cy) || !passable(world, cx, cy + dy))) continue;
      const i = tileIndex(nx, ny);
      if (dist[i] <= d) continue;
      dist[i] = d;
      queue.push(nx, ny);
    }
  }
  return dist;
}

export function getField(cache, world, gx, gy) {
  /* placing or razing a building changes what is walkable — every cached field
     is stale the moment the map's stamp moves */
  if (cache.stamp !== world.stamp) { cache.map.clear(); cache.stamp = world.stamp; }

  const key = gy * N + gx;
  const hit = cache.map.get(key);
  if (hit) {
    cache.map.delete(key);          // refresh LRU position
    cache.map.set(key, hit);
    return hit;
  }
  const field = { dist: buildField(world, gx, gy), gx, gy };
  cache.map.set(key, field);
  if (cache.map.size > cache.limit) cache.map.delete(cache.map.keys().next().value);
  return field;
}

export function fieldTo(cache, world, x, y) {
  return getField(cache, world, Math.floor(x / TILE), Math.floor(y / TILE));
}

/* Read the gradient at a world position. Returns a unit vector, or null when the
   caller has arrived or is standing somewhere the field never reached — in which
   case they should fall back to plain steering. */
export function steerField(field, x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (!inBounds(tx, ty)) return null;
  const here = field.dist[tileIndex(tx, ty)];
  if (here === 0) return null;

  let best = here, bx = 0, by = 0;
  for (const [dx, dy] of DIRS) {
    const nx = tx + dx, ny = ty + dy;
    if (!inBounds(nx, ny)) continue;
    const d = field.dist[tileIndex(nx, ny)];
    if (d < best) { best = d; bx = dx; by = dy; }
  }
  if (!bx && !by) return null;

  /* aim at the centre of the winning tile rather than along the raw axis — that
     is what keeps a column from scraping every corner on the way */
  const cx = (tx + bx) * TILE + TILE / 2, cy = (ty + by) * TILE + TILE / 2;
  const vx = cx - x, vy = cy - y;
  const len = Math.hypot(vx, vy) || 1;
  return [vx / len, vy / len];
}

export function fieldReaches(field, x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  return inBounds(tx, ty) && field.dist[tileIndex(tx, ty)] !== UNREACHABLE;
}
