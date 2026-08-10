import test from 'node:test';
import assert from 'node:assert/strict';
import { FARM_GAME, readGame } from './harness.mjs';

test('harness can read farmer-dream, not just monster-battle', () => {
  assert.match(readGame(FARM_GAME), /Farmer Dream|farm/i);
});
