import test from 'node:test';
import assert from 'node:assert/strict';
import { FARM_GAME, load, readGame } from './harness.mjs';

test('harness can read farmer-dream, not just monster-battle', () => {
  assert.match(readGame(FARM_GAME), /Farmer Dream|farm/i);
});

const { CROPS, cropStage } = load(['FARM'], ['CROPS', 'cropStage'], FARM_GAME);

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
