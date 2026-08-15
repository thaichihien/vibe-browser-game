import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { scriptBody, FARM_GAME } from './harness.mjs';

test('monster-battle script body parses', () => {
  assert.doesNotThrow(() => new vm.Script(scriptBody()));
});

test('farmer-dream script body parses', () => {
  assert.doesNotThrow(() => new vm.Script(scriptBody(FARM_GAME)));
});
