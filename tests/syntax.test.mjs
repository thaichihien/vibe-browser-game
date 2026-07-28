import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { scriptBody } from './harness.mjs';

test('game script parses without syntax errors', () => {
  assert.doesNotThrow(() => new vm.Script(scriptBody()));
});
