/* Vương Quốc Muông Thú — unit tests over the DOM-free modules.

   These are plain ES modules, so unlike `games/monster-battle.html` they need no
   extraction step and no `node:vm` sandbox: they are imported directly. That is
   also the contract being enforced here — if any of these modules ever reaches
   for `document` or `window`, this file stops loading. */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAP_TILES, TILE, T, SOLID, KING, makeRng, clamp, lerp, angleDiff
} from '../games/animal-kings/js/config.js';
import {
  FACTIONS, CLASS_ORDER, ARCHETYPES, unitStats, roster, factionList
} from '../games/animal-kings/js/factions.js';
import {
  generateWorld, tileIndex, reachableTile, harvestNode, nearestNode
} from '../games/animal-kings/js/world.js';
import {
  buildField, steerField, fieldReaches, passable, UNREACHABLE
} from '../games/animal-kings/js/pathfind.js';
import {
  makeKingdom, makeKing, makeUnit, makeCreep, applyDamage, healEntity,
  canAfford, spend, resetIds
} from '../games/animal-kings/js/entities.js';
import {
  BUILDINGS, PLACEABLE, buildSpeed, footTiles, centerOf, defsFor
} from '../games/animal-kings/js/buildings.js';
import { PROFILES } from '../games/animal-kings/js/ai.js';
import { DUTIES } from '../games/animal-kings/js/duties.js';

/* ── factions ─────────────────────────────────────────────────────────────── */

test('there are five kingdoms and each fields exactly five classes', () => {
  assert.equal(FACTIONS.length, 5);
  assert.equal(CLASS_ORDER.length, 5);
  for (const id of factionList()) {
    const r = roster(id);
    assert.equal(r.length, 5, `${id} roster`);
    assert.deepEqual(r.map(u => u.key), CLASS_ORDER, `${id} class order`);
  }
});

test('every unit has a complete stat block and a non-zero cost', () => {
  for (const id of factionList()) {
    for (const u of roster(id)) {
      const where = `${id}.${u.key}`;
      for (const field of ['hp', 'dmg', 'range', 'atkEvery', 'speed', 'pop', 'build']) {
        assert.equal(typeof u[field], 'number', `${where}.${field} is a number`);
        assert.ok(u[field] > 0, `${where}.${field} > 0`);
      }
      assert.ok(u.glyph && u.badge && u.name, `${where} has glyph, badge and name`);
      const total = u.cost.food + u.cost.wood + u.cost.gold;
      assert.ok(total > 0, `${where} costs something`);
    }
  }
});

test('unitStats is pure — same inputs, same block', () => {
  for (const id of factionList()) {
    for (const cls of CLASS_ORDER) {
      assert.deepEqual(unitStats(id, cls), unitStats(id, cls));
    }
  }
});

test('faction modifiers actually differentiate the rosters', () => {
  const warriors = factionList().map(id => unitStats(id, 'warrior'));
  assert.ok(new Set(warriors.map(w => w.hp)).size >= 4, 'warrior HP differs by kingdom');
  const chicken = unitStats('chicken', 'warrior'), cow = unitStats('cow', 'warrior');
  assert.ok(chicken.cost.food < cow.cost.food, 'chickens are cheaper than cows');
  assert.ok(chicken.speed > cow.speed, 'chickens are faster than cows');
  assert.ok(cow.hp > chicken.hp, 'cows are tougher than chickens');
});

test('overrides land: sheep get a healer, cows get a siege ox', () => {
  const medic = unitStats('sheep', 'ranged');
  assert.equal(medic.heal, true);
  assert.equal(medic.name, 'Thầy Lang');
  assert.equal(unitStats('cow', 'champion').siege, 3);
  assert.ok(!unitStats('pig', 'ranged').heal, 'only the sheep healer heals');
});

test('workers cost the same everywhere — combat modifiers must not price economies', () => {
  const costs = factionList().map(id => unitStats(id, 'worker').cost.food);
  assert.equal(new Set(costs).size, 1, 'one worker price across all kingdoms');
  assert.equal(costs[0], ARCHETYPES.worker.cost.food);
});

test('every kingdom has a passive, an ability and its own eighth building', () => {
  for (const f of FACTIONS) {
    assert.ok(f.passive?.name && f.passive?.desc, `${f.id} passive`);
    assert.ok(f.ability?.name && f.ability?.desc, `${f.id} ability`);
    assert.ok(f.building?.key && f.building?.cost, `${f.id} building`);
    assert.ok(['food', 'wood', 'gold'].includes(f.affinity), `${f.id} affinity`);
  }
  const keys = FACTIONS.map(f => f.building.key);
  assert.equal(new Set(keys).size, 5, 'faction buildings are distinct');
});

/* ── damage ───────────────────────────────────────────────────────────────── */

test('a king takes reduced damage from ranged, full damage from melee', () => {
  resetIds();
  const kd = makeKingdom(0, 'pig', true);
  const k = makeKing(kd, 0, 0);
  const melee = applyDamage(k, 100, {});
  const ranged = applyDamage(k, 100, { ranged: true });
  assert.equal(melee, 100);
  assert.equal(ranged, Math.round(100 * KING.rangedResist));
  assert.ok(ranged < melee, 'the win condition cannot be sniped from off-screen');
});

test('armour reduces damage and siege multiplies it against buildings', () => {
  const target = { alive: true, hp: 1000, maxHp: 1000, armor: 0.5, kind: 'unit' };
  assert.equal(applyDamage(target, 100, {}), 50);
  const wall = { alive: true, hp: 1000, maxHp: 1000, armor: 0, kind: 'building' };
  assert.equal(applyDamage(wall, 100, { siege: 3 }), 300);
});

test('damage never heals and healing never overfills', () => {
  const u = { alive: true, hp: 10, maxHp: 100, armor: 0.99, kind: 'unit' };
  assert.ok(applyDamage(u, 1, {}) >= 1, 'a hit always takes at least one point');
  u.hp = 90;
  assert.equal(healEntity(u, 500), 10);
  assert.equal(u.hp, 100);
});

test('a kingdom cannot spend what it does not have', () => {
  const kd = makeKingdom(0, 'cow', true);
  assert.ok(canAfford(kd, { food: 10, wood: 10, gold: 10 }));
  assert.ok(!canAfford(kd, { food: 0, wood: 0, gold: 99999 }));
});

/* ── the world ────────────────────────────────────────────────────────────── */

test('a seed reproduces the same world exactly', () => {
  const a = generateWorld(4242, 2), b = generateWorld(4242, 2);
  assert.deepEqual([...a.tiles], [...b.tiles]);
  assert.deepEqual(a.starts, b.starts);
});

test('two kingdoms get a point-symmetric map', () => {
  const w = generateWorld(99, 2);
  const N = MAP_TILES;
  let mismatch = 0;
  for (let ty = 0; ty < N; ty++) {
    for (let tx = 0; tx < N; tx++) {
      const partner = tileIndex(N - 1 - tx, N - 1 - ty);
      if (w.tiles[tileIndex(tx, ty)] !== w.tiles[partner]) mismatch++;
    }
  }
  /* rounding in the rotation costs a few tiles; anything more is a real skew */
  assert.ok(mismatch / (N * N) < 0.02, `symmetry mismatch ${mismatch} tiles`);
});

test('every start is equally far from the map centre', () => {
  for (const players of [2, 3]) {
    const w = generateWorld(7, players);
    assert.equal(w.starts.length, players);
    const c = (MAP_TILES - 1) / 2;
    const radii = w.starts.map(s => Math.hypot(s.tx - c, s.ty - c));
    const spread = Math.max(...radii) - Math.min(...radii);
    assert.ok(spread < 2, `start radii differ by ${spread.toFixed(2)} tiles`);
  }
});

test('every start is equally far from its nearest gold', () => {
  const w = generateWorld(1234, 2);
  const dists = w.starts.map(s => {
    const n = nearestNode(w, s.x, s.y, 'gold', 80);
    assert.ok(n, 'each start can find gold');
    return Math.hypot(n.x - s.x, n.y - s.y);
  });
  const spread = Math.abs(dists[0] - dists[1]);
  assert.ok(spread < TILE * 2, `gold distance differs by ${Math.round(spread)}px`);
});

test('starts are on open, reachable ground', () => {
  const w = generateWorld(555, 2);
  for (const s of w.starts) {
    assert.ok(!SOLID[w.tiles[tileIndex(s.tx, s.ty)]], 'start tile is walkable');
    assert.ok(reachableTile(w, s.tx, s.ty), 'start tile is connected');
  }
});

test('resource nodes sit on the tile that yields them, and exhaust cleanly', () => {
  const w = generateWorld(31, 2);
  assert.ok(w.nodes.length > 500, 'the map is worth harvesting');
  const wood = w.nodes.find(n => n.kind === 'wood');
  assert.equal(w.tiles[tileIndex(wood.tx, wood.ty)], T.FOREST);

  const took = harvestNode(w, wood, 1e6);
  assert.equal(took, wood.max);
  assert.equal(wood.spent, true);
  assert.equal(w.tiles[tileIndex(wood.tx, wood.ty)], T.GRASS, 'a cut forest becomes grass');
  assert.equal(harvestNode(w, wood, 10), 0, 'a spent node yields nothing more');
});

/* ── pathfinding ──────────────────────────────────────────────────────────── */

test('a flow field never routes through impassable ground', () => {
  const w = generateWorld(77, 2);
  const goal = w.starts[1];
  const dist = buildField(w, goal.tx, goal.ty);
  for (let ty = 0; ty < MAP_TILES; ty++) {
    for (let tx = 0; tx < MAP_TILES; tx++) {
      if (passable(w, tx, ty)) continue;
      assert.equal(dist[tileIndex(tx, ty)], UNREACHABLE,
        `solid tile ${tx},${ty} was given a distance`);
    }
  }
});

test('a flow field connects the two starts, and its gradient descends', () => {
  const w = generateWorld(77, 2);
  const a = w.starts[0], b = w.starts[1];
  const field = { dist: buildField(w, b.tx, b.ty) };
  assert.ok(fieldReaches(field, a.x, a.y), 'the two kingdoms can reach each other');

  /* Walk the gradient from one start to the other. A step can land back inside
     the tile it began in, so the distance is only ever non-increasing — what
     must not happen is that it goes *up*, or that the walk never arrives. Either
     of those is what a squad marching into a wall forever looks like. */
  let x = a.x, y = a.y, last = Infinity, steps = 0, arrived = false;
  while (steps++ < 4000) {
    const here = field.dist[tileIndex(Math.floor(x / TILE), Math.floor(y / TILE))];
    if (here === 0) { arrived = true; break; }
    assert.ok(here !== UNREACHABLE, `walked into unreachable ground at step ${steps}`);
    assert.ok(here <= last, `gradient went uphill at step ${steps}`);
    last = here;
    const step = steerField(field, x, y);
    assert.ok(step, `gradient ran out at step ${steps}`);
    x += step[0] * TILE;
    y += step[1] * TILE;
  }
  assert.ok(arrived, `the walk never arrived (${steps} steps, last distance ${last})`);
});

test('sealed pockets are excluded from the reachable region', () => {
  const w = generateWorld(7, 2);
  let walkable = 0, reachable = 0;
  for (let ty = 0; ty < MAP_TILES; ty++) {
    for (let tx = 0; tx < MAP_TILES; tx++) {
      if (SOLID[w.tiles[tileIndex(tx, ty)]]) continue;
      walkable++;
      if (reachableTile(w, tx, ty)) reachable++;
    }
  }
  assert.ok(reachable > 0 && reachable <= walkable);
  assert.ok(reachable / walkable > 0.9, 'the main region is most of the open map');
});

/* ── buildings ────────────────────────────────────────────────────────────── */

test('every building type is fully specified', () => {
  for (const [key, def] of Object.entries(BUILDINGS)) {
    assert.equal(def.key, key, `${key} key matches its entry`);
    assert.ok(def.name && def.glyph && def.desc, `${key} is described`);
    assert.ok(def.foot >= 1 && def.hp > 0, `${key} has a footprint and HP`);
    assert.ok(def.cost && typeof def.build === 'number', `${key} has a cost and a build time`);
  }
  assert.equal(BUILDINGS.castle.build, 0, 'the castle is given, not built');
  assert.ok(!PLACEABLE.includes('castle'), 'the castle is never in the build menu');
});

test('the builder offers six shared buildings plus the kingdom’s own', () => {
  for (const f of FACTIONS) {
    const kd = makeKingdom(0, f.id, true);
    const defs = defsFor(kd);
    assert.equal(defs.length, PLACEABLE.length + 1, `${f.id} build menu`);
    assert.equal(defs.at(-1).key, f.building.key);
  }
});

test('more workers build faster, with diminishing returns past three', () => {
  assert.equal(buildSpeed(0), 0);
  assert.equal(buildSpeed(1), 1);
  assert.ok(buildSpeed(2) > buildSpeed(1));
  assert.ok(buildSpeed(3) > buildSpeed(2));
  const firstGain = buildSpeed(2) - buildSpeed(1);
  const laterGain = buildSpeed(5) - buildSpeed(4);
  assert.ok(laterGain < firstGain, 'a crowd helps, a mob does not');
});

test('a footprint covers exactly foot² tiles and is centred on them', () => {
  const def = BUILDINGS.barracks;
  const tiles = footTiles(def, 10, 20);
  assert.equal(tiles.length, def.foot * def.foot);
  const c = centerOf(def, 10, 20);
  assert.equal(c.x, (10 + def.foot / 2) * TILE);
  assert.equal(c.y, (20 + def.foot / 2) * TILE);
});

/* ── AI and duties ────────────────────────────────────────────────────────── */

test('the four difficulties escalate on every knob, and none of them cheat', () => {
  assert.equal(PROFILES.length, 4);
  for (let i = 1; i < PROFILES.length; i++) {
    const prev = PROFILES[i - 1], p = PROFILES[i];
    assert.ok(p.think <= prev.think, `${p.name} thinks at least as often`);
    assert.ok(p.initiative >= prev.initiative, `${p.name} wastes no more`);
    assert.ok(p.scout >= prev.scout, `${p.name} scouts at least as much`);
    assert.ok(p.micro >= prev.micro, `${p.name} micros at least as well`);
    assert.ok(p.pushAt <= prev.pushAt, `${p.name} commits at least as early`);
  }
  assert.equal(PROFILES.at(-1).kingMode, 'hunt', 'the hardest king comes for yours');
  for (const p of PROFILES) {
    assert.ok(!('income' in p) && !('bonus' in p) && !('cheat' in p),
      `${p.name} has no resource multiplier`);
  }
});

test('the royal duties are ordered, unique and every one pays out', () => {
  assert.equal(DUTIES.length, 7);
  assert.equal(new Set(DUTIES.map(d => d.id)).size, 7);
  for (const d of DUTIES) {
    assert.ok(d.icon && d.text && d.hint, `${d.id} is written`);
    assert.equal(typeof d.done, 'function', `${d.id} has a predicate`);
    assert.ok(Object.keys(d.reward).length > 0, `${d.id} pays out`);
    assert.ok(d.rewardText, `${d.id} says what it pays`);
  }
});

/* ── helpers ──────────────────────────────────────────────────────────────── */

test('the seeded RNG is deterministic and stays in range', () => {
  const a = makeRng(9), b = makeRng(9);
  for (let i = 0; i < 500; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});

test('clamp, lerp and angleDiff behave', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-5, 0, 3), 0);
  assert.equal(lerp(0, 10, 0.5), 5);
  assert.ok(Math.abs(angleDiff(0.1, -0.1) - 0.2) < 1e-9);
  assert.ok(Math.abs(angleDiff(Math.PI - 0.1, -Math.PI + 0.1) - (-0.2)) < 1e-9,
    'the wrap-around is the short way round');
});
