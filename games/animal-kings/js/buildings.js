/* Buildings: what they are, where they may go, how they get raised, and what
   they produce.

   A placed building is a *site* first — cost is paid immediately, but nothing
   exists until a worker walks over and builds it. Piling workers on one site
   genuinely rushes it, which is what makes pulling three off wood a decision. */

import {
  TILE, BUILD_RANGE, POP_MAX, clamp, dist, rnd
} from './config.js';
import { tileIndex, inBounds, markOccupied, reachableTile } from './world.js';
import { passable } from './pathfind.js';
import { canAfford, spend, nextId } from './entities.js';

/* ── the seven shared types ───────────────────────────────────────────────── */

export const BUILDINGS = {
  castle: {
    key: 'castle', name: 'Lâu Đài', glyph: '🏰', foot: 3, hp: 3000,
    cost: { food: 0, wood: 0, gold: 0 }, build: 0, pop: 12,
    dropoff: true, unique: true,
    desc: 'Nhà của Vua. Nhận mọi tài nguyên, hồi máu cho Vua. Không luyện quân.'
  },
  outpost: {
    key: 'outpost', name: 'Tiền Đồn', glyph: '🏕️', foot: 2, hp: 900,
    cost: { food: 0, wood: 120, gold: 0 }, build: 14, pop: 4,
    dropoff: true, anchor: true,
    desc: 'Nhận tài nguyên ở xa. Đây là cách chiếm một mỏ vàng.'
  },
  farm: {
    key: 'farm', name: 'Nông Trại', glyph: '🌾', foot: 2, hp: 550,
    cost: { food: 0, wood: 80, gold: 0 }, build: 12, pop: 2,
    trickle: { food: 2.2 },
    desc: 'Tự sinh 2.2 thức ăn mỗi giây, mãi mãi, không cần thợ.'
  },
  lumber: {
    key: 'lumber', name: 'Trại Gỗ', glyph: '🪓', foot: 2, hp: 500,
    cost: { food: 30, wood: 60, gold: 0 }, build: 10, pop: 2,
    dropoff: 'wood', haulBonus: 0.25,
    desc: 'Nhận gỗ và tăng 25% tốc độ thu hoạch. Dựng sát bìa rừng.'
  },
  barracks: {
    key: 'barracks', name: 'Trại Lính', glyph: '🛖', foot: 3, hp: 1200,
    cost: { food: 60, wood: 140, gold: 0 }, build: 18, pop: 6,
    trains: ['worker', 'scout', 'warrior', 'ranged', 'champion'],
    desc: 'Nơi duy nhất ra quân — kể cả thợ. Mỗi trại là một hàng đợi riêng, '
        + 'nên nhiều trại là nhiều quân cùng lúc.'
  },
  tower: {
    key: 'tower', name: 'Tháp Canh', glyph: '🗼', foot: 1, hp: 800,
    cost: { food: 0, wood: 90, gold: 40 }, build: 12, pop: 0,
    attack: { range: 260, dmg: 18, every: 1.1 },
    desc: 'Tự bắn kẻ địch lại gần.'
  },
  shrine: {
    key: 'shrine', name: 'Đền Thờ', glyph: '🏛️', foot: 2, hp: 700,
    cost: { food: 0, wood: 140, gold: 120 }, build: 24, pop: 2,
    unlocks: 'champion', abilityCd: 0.75,
    desc: 'Mở khóa quân đặc biệt của vương quốc và giảm 25% hồi chiêu của Vua.'
  }
};

/* what the builder panel offers: the six placeable shared types, then the
   kingdom's own eighth */
export const PLACEABLE = ['outpost', 'farm', 'lumber', 'barracks', 'tower', 'shrine'];

export function defsFor(kd) {
  const list = PLACEABLE.map(k => BUILDINGS[k]);
  const own = kd.faction.building;
  return own ? [...list, { ...own, faction: true }] : list;
}

export function defOf(kd, key) {
  if (BUILDINGS[key]) return BUILDINGS[key];
  const own = kd.faction.building;
  return own && own.key === key ? { ...own, faction: true } : null;
}

/* ── placement ────────────────────────────────────────────────────────────── */

export function footTiles(def, tx, ty) {
  const out = [];
  for (let y = 0; y < def.foot; y++) {
    for (let x = 0; x < def.foot; x++) out.push([tx + x, ty + y]);
  }
  return out;
}

export function centerOf(def, tx, ty) {
  return { x: (tx + def.foot / 2) * TILE, y: (ty + def.foot / 2) * TILE };
}

/* Why a spot is refused, in the player's words — the ghost turns red and the
   builder panel says which of these it is. */
export function placementError(G, kd, def, tx, ty) {
  for (const [x, y] of footTiles(def, tx, ty)) {
    if (!inBounds(x, y)) return 'Ngoài bản đồ';
    if (!passable(G.world, x, y)) return 'Vướng địa hình';
    if (!reachableTile(G.world, x, y)) return 'Không tới được';
  }
  if (!canAfford(kd, def.cost)) return 'Không đủ tài nguyên';
  if (kd.pop + 0 > POP_MAX && def.pop) return 'Đã kịch dân số';

  const c = centerOf(def, tx, ty);
  const near = kd.buildings.some(b => b.alive && dist(b, c) <= BUILD_RANGE + b.def.foot * TILE * 0.5);
  if (!near) return 'Quá xa lãnh thổ';
  return null;
}

export const canPlace = (G, kd, def, tx, ty) => placementError(G, kd, def, tx, ty) === null;

export function placeBuilding(G, kd, def, tx, ty, { instant = false, free = false } = {}) {
  if (!free) {
    if (!canAfford(kd, def.cost)) return null;
    spend(kd, def.cost);
  }

  const c = centerOf(def, tx, ty);
  const b = {
    id: nextId(), kind: 'building', key: def.key, def, kd: kd.id, kingdom: kd,
    tx, ty, foot: def.foot, x: c.x, y: c.y,
    radius: (def.foot * TILE) / 2,
    maxHp: def.hp, hp: instant ? def.hp : Math.max(1, Math.round(def.hp * 0.12)),
    built: instant, progress: instant ? 1 : 0, builders: 0,
    queue: [], trainT: 0, spawnT: 0, atkCd: 0, alive: true,
    rally: { x: c.x, y: c.y + (def.foot / 2 + 1.2) * TILE },
    smoke: 0
  };

  for (const [x, y] of footTiles(def, tx, ty)) markOccupied(G.world, x, y, 1);
  evict(G, b);

  kd.buildings.push(b);
  G.buildings.push(b);
  if (instant) onBuilt(G, b);
  return b;
}

export function onBuilt(G, b) {
  b.built = true;
  b.progress = 1;
  b.hp = b.maxHp;
  b.kingdom.popCap = Math.min(POP_MAX, b.kingdom.popCap + (b.def.pop || 0));
  b.kingdom.stats.built++;
  if (b.key === 'castle') b.kingdom.castle = b;
  G.hooks.onBuilt?.(b);
}

export function razeBuilding(G, b) {
  if (!b.alive) return;
  b.alive = false;
  for (const [x, y] of footTiles(b.def, b.tx, b.ty)) markOccupied(G.world, x, y, 0);
  if (b.built) b.kingdom.popCap = Math.max(0, b.kingdom.popCap - (b.def.pop || 0));
  b.kingdom.stats.razed++;
  const i = b.kingdom.buildings.indexOf(b);
  if (i >= 0) b.kingdom.buildings.splice(i, 1);
  if (b.kingdom.castle === b) b.kingdom.castle = null;
  G.hooks.onRazed?.(b);
}

/* ── construction ─────────────────────────────────────────────────────────── */

/* Diminishing returns past three: a crowd helps, a mob does not. */
export function buildSpeed(n) {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n === 2) return 1.7;
  if (n === 3) return 2.2;
  return 2.2 + (n - 3) * 0.15;
}

export function advanceBuild(G, b, dt) {
  if (b.built || !b.alive) return;
  const rate = buildSpeed(b.builders) / b.def.build;
  b.progress = clamp(b.progress + rate * dt, 0, 1);
  b.hp = Math.max(1, Math.round(b.maxHp * (0.12 + 0.88 * b.progress)));
  if (b.progress >= 1) onBuilt(G, b);
}

/* ── production ───────────────────────────────────────────────────────────── */

export function canTrain(kd, b, classKey, stats) {
  if (!b.built || !b.def.trains?.includes(classKey)) return 'Không luyện được ở đây';
  if (stats.needs === 'shrine' && !kd.buildings.some(x => x.built && x.key === 'shrine')) {
    return 'Cần Đền Thờ';
  }
  if (kd.pop + stats.pop > kd.popCap) return 'Hết chỗ ở';
  if (!canAfford(kd, stats.cost)) return 'Không đủ tài nguyên';
  return null;
}

export function enqueue(kd, b, classKey, stats) {
  spend(kd, stats.cost);
  b.queue.push({ cls: classKey, time: stats.build });
  if (b.queue.length === 1) b.trainT = stats.build;
  return true;
}

/* The barracks a new order should go to: built, able to train this, shortest
   queue. This is what the captain NPC uses from across town. */
export function bestProducer(kd, classKey) {
  let best = null;
  for (const b of kd.buildings) {
    if (!b.alive || !b.built || !b.def.trains?.includes(classKey)) continue;
    if (!best || b.queue.length < best.queue.length) best = b;
  }
  return best;
}

export function rallyPoint(b) {
  return { x: b.rally.x + rnd(-18, 18), y: b.rally.y + rnd(-18, 18) };
}

/* Shove anyone standing in a new footprint out to its edge. The escape hatch in
   moveEntity would eventually free them anyway, but a unit visibly standing
   inside a barracks reads as a bug even when it walks out a second later. */
function evict(G, b) {
  const half = (b.foot * TILE) / 2;
  for (const e of G.actors) {
    if (!e.alive) continue;
    const dx = e.x - b.x, dy = e.y - b.y;
    if (Math.abs(dx) > half + e.radius || Math.abs(dy) > half + e.radius) continue;
    const push = Math.abs(dx) > Math.abs(dy)
      ? { x: b.x + Math.sign(dx || 1) * (half + e.radius + 4), y: e.y }
      : { x: e.x, y: b.y + Math.sign(dy || 1) * (half + e.radius + 4) };
    e.x = push.x; e.y = push.y;
  }
}
