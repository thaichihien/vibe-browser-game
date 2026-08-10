import test from 'node:test';
import assert from 'node:assert/strict';
import { FARM_GAME, load, readGame } from './harness.mjs';

test('harness can read farmer-dream, not just monster-battle', () => {
  assert.match(readGame(FARM_GAME), /Farmer Dream|farm/i);
});

const { CROPS, cropStage, plantTile, waterTile, harvestTile } =
  load(['FARM'], ['CROPS', 'cropStage', 'plantTile', 'waterTile', 'harvestTile'], FARM_GAME);

const tile = (over = {}) => ({
  crop: 'rice', waterings: 1, wateredAt: 1000, grownMs: 0, harvestsLeft: 1, ...over
});

test('CROPS has the ten crops with ascending tiers', () => {
  const ids = Object.keys(CROPS);
  assert.equal(ids.length, 10);
  assert.deepEqual(ids.map(id => CROPS[id].tier), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(CROPS.rice.seed, 5);
  assert.equal(CROPS.pumpkin.sell, 220);
});

test('a freshly watered crop is growing, not ripe', () => {
  const s = cropStage(tile(), 1000);
  assert.equal(s.phase, 'growing');
  assert.equal(s.progress, 0);
});

test('rice is ripe exactly at its grow time and shows its own icon', () => {
  const s = cropStage(tile(), 1000 + CROPS.rice.grow);
  assert.equal(s.phase, 'ripe');
  assert.equal(s.progress, 1);
  assert.equal(s.icon, '🌾');
});

test('progress does not exceed 1 when left ripe for a long time', () => {
  const s = cropStage(tile(), 1000 + CROPS.rice.grow * 10);
  assert.equal(s.progress, 1);
  assert.equal(s.phase, 'ripe');
});

test('an unwatered tile is thirsty and banks no growth', () => {
  const s = cropStage(tile({ waterings: 0, wateredAt: null }), 999999);
  assert.equal(s.phase, 'thirsty');
  assert.equal(s.progress, 0);
});

test('pumpkin stalls thirsty at the halfway mark until watered a second time', () => {
  const half = CROPS.pumpkin.grow / 2;
  const p = tile({ crop: 'pumpkin', waterings: 1, wateredAt: 0, grownMs: 0 });

  const mid = cropStage(p, half);
  assert.equal(mid.phase, 'thirsty', 'first segment done, needs water again');
  assert.equal(mid.progress, 0.5);

  const later = cropStage(p, half * 5);
  assert.equal(later.phase, 'thirsty', 'time alone must not finish it');
  assert.equal(later.progress, 0.5);
});

test('pumpkin watered a second time grows on to ripe', () => {
  const half = CROPS.pumpkin.grow / 2;
  const p = { crop: 'pumpkin', waterings: 2, wateredAt: half, grownMs: half, harvestsLeft: 1 };
  assert.equal(cropStage(p, half + half).phase, 'ripe');
});

test('sprout icon changes as the crop grows', () => {
  assert.equal(cropStage(tile(), 1000).icon, '🌱');
  assert.equal(cropStage(tile(), 1000 + CROPS.rice.grow * 0.75).icon, '🌿');
});

test('a newly planted tile is thirsty and holds no growth', () => {
  const t = plantTile('rice', 500);
  assert.equal(t.crop, 'rice');
  assert.equal(t.waterings, 0);
  assert.equal(t.wateredAt, null);
  assert.equal(t.grownMs, 0);
  assert.equal(t.harvestsLeft, 1);
  assert.equal(cropStage(t, 999999).phase, 'thirsty');
});

test('strawberry is planted with three harvests', () => {
  assert.equal(plantTile('strawberry', 0).harvestsLeft, 3);
});

test('watering a thirsty tile starts its clock', () => {
  const t = waterTile(plantTile('rice', 0), 700);
  assert.equal(t.waterings, 1);
  assert.equal(t.wateredAt, 700);
  assert.equal(cropStage(t, 700).phase, 'growing');
});

test('watering a growing tile is a no-op, so water cannot be wasted for speed', () => {
  const t = waterTile(plantTile('rice', 0), 100);
  const again = waterTile(t, 200);
  assert.deepEqual(again, t);
});

test('watering pumpkin the second time banks the first segment', () => {
  const half = CROPS.pumpkin.grow / 2;
  let t = waterTile(plantTile('pumpkin', 0), 0);
  t = waterTile(t, half);
  assert.equal(t.waterings, 2);
  assert.equal(t.grownMs, half);
  assert.equal(cropStage(t, half + half).phase, 'ripe');
});

test('harvesting a single-harvest crop empties the tile and yields the crop', () => {
  const t = waterTile(plantTile('rice', 0), 0);
  const out = harvestTile(t, CROPS.rice.grow);
  assert.equal(out.crop, 'rice');
  assert.equal(out.tile, null);
});

test('harvesting an unripe tile yields nothing and leaves it alone', () => {
  const t = waterTile(plantTile('rice', 0), 0);
  const out = harvestTile(t, 1);
  assert.equal(out.crop, null);
  assert.deepEqual(out.tile, t);
});

test('a regrowing crop stays planted and ripens again after its regrow time', () => {
  let t = waterTile(plantTile('strawberry', 0), 0);
  const first = harvestTile(t, CROPS.strawberry.grow);
  assert.equal(first.crop, 'strawberry');
  assert.notEqual(first.tile, null);
  assert.equal(first.tile.harvestsLeft, 2);

  const now = CROPS.strawberry.grow;
  assert.equal(cropStage(first.tile, now).phase, 'growing', 'not instantly ripe again');
  assert.equal(cropStage(first.tile, now + CROPS.strawberry.regrow).phase, 'ripe');
});

test('a regrowing crop empties the tile on its final harvest', () => {
  let t = waterTile(plantTile('grapes', 0), 0);
  let now = CROPS.grapes.grow;
  for (let i = 0; i < 3; i++) {
    t = harvestTile(t, now).tile;
    assert.notEqual(t, null, `harvest ${i + 1} should leave the plant`);
    now += CROPS.grapes.regrow;
  }
  assert.equal(harvestTile(t, now).tile, null, 'fourth harvest clears the tile');
});

const { LEVELS, UNLOCKS, levelFor, xpBar } =
  load(['FARM'], ['LEVELS', 'UNLOCKS', 'levelFor', 'xpBar'], FARM_GAME);

test('LEVELS matches the spec thresholds', () => {
  assert.deepEqual(LEVELS, [0, 40, 90, 170, 290, 460, 700, 1020, 1450, 2000]);
});

test('levelFor maps XP onto levels at the boundaries', () => {
  assert.equal(levelFor(0), 1);
  assert.equal(levelFor(39), 1);
  assert.equal(levelFor(40), 2);
  assert.equal(levelFor(289), 4);
  assert.equal(levelFor(290), 5);
  assert.equal(levelFor(2000), 10);
  assert.equal(levelFor(999999), 10, 'level is capped at 10');
});

test('every crop has an unlock level and the starters are level 1', () => {
  assert.deepEqual(Object.keys(UNLOCKS).sort(), Object.keys(CROPS).sort());
  assert.equal(UNLOCKS.rice, 1);
  assert.equal(UNLOCKS.carrot, 1);
  assert.equal(UNLOCKS.pumpkin, 7);
  assert.equal(UNLOCKS.grapes, 9);
});

test('xpBar reports progress into the current level', () => {
  assert.deepEqual(xpBar(0), { level: 1, into: 0, need: 40 });
  assert.deepEqual(xpBar(60), { level: 2, into: 20, need: 50 });
  assert.deepEqual(xpBar(2000), { level: 10, into: 0, need: 0 });
});
