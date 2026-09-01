/* The floor plan: a tile grid rebuilt whenever the player buys a table, plus
   the breadth-first pathfinder every walker shares.

   Coordinates are tiles throughout. Entities live at fractional tile positions
   so nothing snaps to the grid; only collision and pathing quantise. */

import {
  GRID_W, GRID_H, T, SOLID, TABLE_SLOTS, DOOR_X, DOOR_Y,
  COUNTER_Y, WINDOW_TILES, PASS_TILES, STOVE_SPOTS, PREP_SPOTS, BIN_TILE
} from './config.js';

export function buildWorld(tableCount) {
  const tiles = new Uint8Array(GRID_W * GRID_H).fill(T.VOID);
  const at = (x, y) => y * GRID_W + x;

  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      let t;
      if (y >= DOOR_Y + 1) t = T.PAVEMENT;
      else if (y === 0 || x === 0 || x === GRID_W - 1 || y === DOOR_Y) t = T.WALL;
      else if (y < COUNTER_Y) t = T.KITCHEN;
      else if (y === COUNTER_Y) t = T.COUNTER;
      else t = T.FLOOR;
      tiles[at(x, y)] = t;
    }
  }

  tiles[at(DOOR_X, DOOR_Y)] = T.DOOR;
  tiles[at(DOOR_X + 1, DOOR_Y)] = T.DOOR;
  for (const x of WINDOW_TILES) tiles[at(x, COUNTER_Y)] = T.WINDOW;
  for (const x of PASS_TILES)   tiles[at(x, COUNTER_Y)] = T.PASS;

  /* tables, in purchase order, each a 2 × 2 block with seats on the ring */
  const tables = [];
  for (let i = 0; i < Math.min(tableCount, TABLE_SLOTS.length); i++) {
    const s = TABLE_SLOTS[i];
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) tiles[at(s.x + dx, s.y + dy)] = T.TABLE;
    const cx = s.x + 1, cy = s.y + 1;   // shared corner = table centre
    tables.push({
      id: i, x: cx, y: cy,
      seats: [
        { x: cx - 1.3, y: cy },               // left
        { x: cx + 1.3, y: cy },               // right
        { x: cx, y: cy - 1.3 },               // top
        { x: cx, y: cy + 1.3 }                // bottom
      ],
      /* Where a waiter stands to reach this table — off the bottom corner, so
         the waiter never ends up drawn on top of the guest in the near seat. */
      stand: { x: cx + 0.8, y: cy + 1.55 },
      /* and where their speech bubble floats, clear of all four seats */
      bubble: { x: cx + 1.55, y: cy - 1.55 },
      party: null
    });
  }

  return {
    tiles, tables, w: GRID_W, h: GRID_H,
    at,
    tileAt: (x, y) => (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) ? T.VOID : tiles[at(x, y)],
    solid(x, y) { return !!SOLID[this.tileAt(x | 0, y | 0)]; },

    door:   { x: DOOR_X + 0.5, y: DOOR_Y + 0.5 },
    queue:  { x: DOOR_X + 0.5, y: DOOR_Y + 1.8 },
    window: { x: WINDOW_TILES[0] + 0.5, y: COUNTER_Y + 1.6 },   // hand a ticket in
    pass:   { x: PASS_TILES[0] + 0.5,   y: COUNTER_Y + 1.6 },   // pick a plate up
    windowTile: { x: WINDOW_TILES[0], y: COUNTER_Y },
    passTile:   { x: PASS_TILES[0],   y: COUNTER_Y },
    /* the bin is scenery, not an obstacle — you walk up to it, not around it */
    bin:    { x: BIN_TILE.x + 0.5, y: BIN_TILE.y + 0.5 },
    /* where a chef sets a finished dish down on the kitchen side of the hatch */
    plating: { x: PASS_TILES[0] + 1, y: COUNTER_Y - 0.55 },
    stoves: STOVE_SPOTS,
    prep: PREP_SPOTS
  };
}

/* ── collision ────────────────────────────────────────────────────────────
   Axis-separated so sliding along a table edge feels right instead of sticking. */
export function moveWithCollision(world, ent, dx, dy, r = 0.32) {
  const tryAxis = (nx, ny) => {
    for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
      if (world.solid(nx + ox, ny + oy)) return false;
    }
    return true;
  };
  if (dx && tryAxis(ent.x + dx, ent.y)) ent.x += dx;
  if (dy && tryAxis(ent.x, ent.y + dy)) ent.y += dy;
}

/* ── pathfinding ──────────────────────────────────────────────────────────
   Plain BFS over walkable tiles. The floor is 19 × 15, so a full flood is a few
   hundred cells — cheaper than keeping a cache correct across table purchases. */
export function findPath(world, from, to) {
  const sx = Math.floor(from.x), sy = Math.floor(from.y);
  const gx = Math.floor(to.x),   gy = Math.floor(to.y);
  if (sx === gx && sy === gy) return [{ x: to.x, y: to.y }];

  const walk = (x, y) => !world.solid(x, y);
  const start = world.at(sx, sy), goal = world.at(gx, gy);
  const prev = new Int32Array(GRID_W * GRID_H).fill(-1);
  const seen = new Uint8Array(GRID_W * GRID_H);
  let queue = [start], next = [];
  seen[start] = 1;

  /* If the goal tile itself is solid (a table, the hatch) aim for whichever
     neighbour of it is reachable instead — callers ask for the thing, not the
     square in front of it. */
  const goals = new Set();
  if (walk(gx, gy)) goals.add(goal);
  else for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    if (walk(gx + dx, gy + dy)) goals.add(world.at(gx + dx, gy + dy));
  }
  if (!goals.size) return null;

  let found = -1;
  outer: while (queue.length) {
    for (const cur of queue) {
      const cx = cur % GRID_W, cy = (cur / GRID_W) | 0;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
        const id = world.at(nx, ny);
        if (seen[id] || !walk(nx, ny)) continue;
        seen[id] = 1; prev[id] = cur;
        if (goals.has(id)) { found = id; break outer; }
        next.push(id);
      }
    }
    queue = next; next = [];
  }
  if (found < 0) return null;

  const path = [];
  for (let id = found; id !== -1 && id !== start; id = prev[id]) {
    path.push({ x: (id % GRID_W) + 0.5, y: ((id / GRID_W) | 0) + 0.5 });
  }
  path.reverse();
  path.push({ x: to.x, y: to.y });
  return path;
}

/* Advance an entity along a stored path. Returns true once it has arrived. */
export function followPath(ent, speed, dt) {
  if (!ent.path || !ent.path.length) return true;
  let budget = speed * dt;
  while (budget > 0 && ent.path.length) {
    const node = ent.path[0];
    const dx = node.x - ent.x, dy = node.y - ent.y;
    const d = Math.hypot(dx, dy);
    if (d <= budget) {
      ent.x = node.x; ent.y = node.y; budget -= d; ent.path.shift();
    } else {
      ent.x += dx / d * budget; ent.y += dy / d * budget;
      ent.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u');
      return false;
    }
  }
  return ent.path.length === 0;
}
