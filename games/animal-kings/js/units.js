/* Movement. Everything that walks in this game goes through `moveEntity`, so
   collision behaves identically for the king, a worker and a wolf.

   Axes are resolved separately, which is what makes a unit slide along a
   treeline instead of sticking to it. */

import { TILE, CARRY, GATHER_RATE, clamp, dist, rnd } from './config.js';
import { blockedAtPx, nearestNode, harvestNode } from './world.js';

function blocked(world, x, y, r) {
  /* four corners of the entity's box — cheaper than a circle test and, at these
     radii against 40 px tiles, indistinguishable */
  return blockedAtPx(world, x - r, y - r) || blockedAtPx(world, x + r, y - r)
      || blockedAtPx(world, x - r, y + r) || blockedAtPx(world, x + r, y + r);
}

export function moveEntity(world, e, dx, dy, dt, speed = e.speed) {
  if (!dx && !dy) return false;
  const d = Math.hypot(dx, dy) || 1;
  const step = speed * dt;
  const mx = (dx / d) * step, my = (dy / d) * step;

  /* Escape hatch: if we are *already* inside something solid — a building went
     up on top of us, a wool wall landed on our head — collision is what is
     keeping us there, so ignore it until we are out. Without this a king can be
     sealed into his own farm and the match simply stops. */
  const trapped = blocked(world, e.x, e.y, e.radius);

  let moved = false;
  const nx = e.x + mx;
  if (trapped || !blocked(world, nx, e.y, e.radius)) { e.x = nx; moved = true; }
  const ny = e.y + my;
  if (trapped || !blocked(world, e.x, ny, e.radius)) { e.y = ny; moved = true; }

  e.x = clamp(e.x, e.radius, world.px - e.radius);
  e.y = clamp(e.y, e.radius, world.px - e.radius);
  if (moved) e.face = Math.atan2(my, mx);
  return moved;
}

/* Nudge overlapping bodies apart. Without this a retinue collapses into one
   pixel and reads as a single unit.

   Bucketed rather than pairwise: bodies can only overlap if they share a cell or
   sit in adjacent ones, so there is no reason to compare a wolf on the east
   ridge with a worker at home. The pairwise version cost 65 ms a frame once a
   few hundred units crowded into one battle. */
const SEP_CELL = 48;
const sepBuckets = new Map();

export function separate(list, strength = 0.5) {
  sepBuckets.clear();
  for (const e of list) {
    if (!e.alive) continue;
    const key = (Math.floor(e.x / SEP_CELL) << 12) ^ Math.floor(e.y / SEP_CELL);
    let bucket = sepBuckets.get(key);
    if (!bucket) { bucket = []; sepBuckets.set(key, bucket); }
    bucket.push(e);
  }

  /* only the four "forward" neighbours, so every pair is visited exactly once */
  const NEIGHBOURS = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 1]];

  for (const [key, bucket] of sepBuckets) {
    const cx = key >> 12, cy = key ^ (cx << 12);
    for (const [dx, dy] of NEIGHBOURS) {
      const other = dx === 0 && dy === 0
        ? bucket
        : sepBuckets.get(((cx + dx) << 12) ^ (cy + dy));
      if (!other) continue;
      const same = other === bucket;
      for (let i = 0; i < bucket.length; i++) {
        const a = bucket[i];
        for (let j = same ? i + 1 : 0; j < other.length; j++) {
          const b = other[j];
          const ddx = b.x - a.x, ddy = b.y - a.y;
          const min = a.radius + b.radius;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 >= min * min || d2 === 0) continue;
          const d = Math.sqrt(d2);
          const push = ((min - d) / 2) * strength;
          const ux = ddx / d, uy = ddy / d;
          a.x -= ux * push; a.y -= uy * push;
          b.x += ux * push; b.y += uy * push;
        }
      }
    }
  }
}

/* A cheap uniform-grid neighbour index. Rebuilt every frame; at a few hundred
   entities that is far cheaper than the pairwise scan it replaces. */
export function makeSpatialHash(cell = 96) {
  return { cell, map: new Map() };
}

export function rebuildHash(hash, entities) {
  hash.map.clear();
  for (const e of entities) {
    if (!e.alive) continue;
    const k = (Math.floor(e.x / hash.cell) << 12) ^ Math.floor(e.y / hash.cell);
    let bucket = hash.map.get(k);
    if (!bucket) { bucket = []; hash.map.set(k, bucket); }
    bucket.push(e);
  }
}

export function queryHash(hash, x, y, radius, out = []) {
  out.length = 0;
  const r = Math.ceil(radius / hash.cell);
  const cx = Math.floor(x / hash.cell), cy = Math.floor(y / hash.cell);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const bucket = hash.map.get(((cx + dx) << 12) ^ (cy + dy));
      if (bucket) for (const e of bucket) out.push(e);
    }
  }
  return out;
}

/* Walk toward a point, sliding around whatever is in the way.

   Short hops — a worker between a tree and a drop-off, a wolf onto an intruder —
   do not get a flow field. They get a direct heading plus a fan of fallbacks.
   That handles a treeline fine, but not a concave pocket: a creep camped in a
   notch of the gold seam would fan left, fan right, and stay exactly where it
   was. So a body that fails to move at all commits to one side for a beat and
   walks along it, which is enough to get out of the notch. */
const FANS = [0, 0.45, -0.45, 0.95, -0.95, 1.5, -1.5, 2.1, -2.1];

export function moveToward(world, e, tx, ty, dt, speed = e.speed) {
  const dx = tx - e.x, dy = ty - e.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return false;
  const base = Math.atan2(dy, dx);

  if (e.detourT > 0) {
    e.detourT -= dt;
    const a = base + e.detour;
    if (moveEntity(world, e, Math.cos(a), Math.sin(a), dt, speed)) { e.face = base; return true; }
    e.detourT = 0;
  }

  for (const off of FANS) {
    const a = base + off;
    if (moveEntity(world, e, Math.cos(a), Math.sin(a), dt, speed)) {
      e.face = base;                 // face the goal even while sliding past a tree
      e.stuckT = 0;
      return true;
    }
  }

  e.stuckT = (e.stuckT || 0) + dt;
  if (e.stuckT > 0.3) {
    e.stuckT = 0;
    e.detour = (Math.random() < 0.5 ? 1 : -1) * (1.7 + Math.random() * 0.9);
    e.detourT = 0.9;
  }
  return false;
}

/* nearest place this kingdom can bank a resource */
export function nearestDropoff(kd, x, y, kind) {
  let best = null, bestD = Infinity;
  for (const b of kd.buildings) {
    if (!b.alive || !b.built) continue;
    const d = b.def.dropoff;
    if (!d || (d !== true && d !== kind)) continue;
    const dd = (b.x - x) ** 2 + (b.y - y) ** 2;
    if (dd < bestD) { bestD = dd; best = b; }
  }
  return best;
}

/* ── the worker loop ──────────────────────────────────────────────────────── */

/* walk → harvest → haul → bank → repeat, with a detour for construction.
   A worker with no drop-off in range simply cannot bank — which is the rule that
   makes an unclaimed gold seam the king's job and nobody else's. */
export function updateWorker(G, u, dt, hooks = {}) {
  const world = G.world, kd = u.kingdom;

  /* construction outranks everything: a site with nobody on it never finishes */
  if (u.site && u.site.alive && !u.site.built) {
    const b = u.site;
    const reach = b.radius + u.radius + 26;
    if (dist(u, b) > reach) { u.state = 'toSite'; moveToward(world, u, b.x, b.y, dt); }
    else { u.state = 'build'; u.face = Math.atan2(b.y - u.y, b.x - u.x); b.builders++; }
    u.bob += dt * (u.state === 'build' ? 13 : 9);
    return;
  }
  if (u.site && (!u.site.alive || u.site.built)) u.site = null;

  /* hauling home */
  if (u.carry >= CARRY) {
    const drop = nearestDropoff(kd, u.x, u.y, u.carryKind);
    if (!drop) { u.state = 'stranded'; return; }
    const reach = drop.radius + u.radius + 18;
    if (dist(u, drop) > reach) { u.state = 'haul'; moveToward(world, u, drop.x, drop.y, dt); }
    else {
      hooks.onDeposit?.(u, drop, u.carry, u.carryKind);
      u.carry = 0; u.carryKind = null; u.node = null;
    }
    u.bob += dt * 9;
    return;
  }

  /* find something to work */
  if (!u.node || u.node.spent) {
    /* Preference first, then anything at all. A worker told to cut wood in a
       place with no trees used to stand there for the rest of the match. */
    u.node = nearestNode(world, u.x, u.y, u.want || null, 30)
          || nearestNode(world, u.x, u.y, null, 34);
    if (!u.node) {
      u.state = 'idle';
      u.idleT -= dt;
      if (u.idleT <= 0) {
        u.idleT = rnd(1.5, 3.5);
        const home = kd.castle || { x: u.x, y: u.y };
        u.wander = { x: home.x + rnd(-90, 90), y: home.y + rnd(-90, 90) };
      }
      if (u.wander) moveToward(world, u, u.wander.x, u.wander.y, dt, u.speed * 0.5);
      return;
    }
  }

  const n = u.node;
  const reach = u.radius + 30;
  if (dist(u, n) > reach) {
    u.state = 'walk';
    moveToward(world, u, n.x, n.y, dt);
    u.bob += dt * 9;
  } else {
    u.state = 'gather';
    u.face = Math.atan2(n.y - u.y, n.x - u.x);
    const bonus = nearestDropoff(kd, u.x, u.y, n.kind)?.def.haulBonus || 0;
    const took = harvestNode(world, n, GATHER_RATE * (1 + bonus) * dt);
    u.carry += took;
    u.carryKind = n.kind;
    u.bob += dt * 15;
    hooks.onHarvest?.(u, n, took);
  }
}
