import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { bridge } from './harness.mjs';

// Build a value from inside a real vm context, so it genuinely has foreign
// (non-host) Array.prototype/Object.prototype — the exact condition bridge()
// exists to fix.
function fromVmContext(expr) {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(`globalThis.__out = (${expr});`, ctx);
  return ctx.__out;
}

test('bridge round-trips a nested array-of-objects and satisfies deepEqual against a host literal', () => {
  const foreign = fromVmContext(`[{a: 1, list: ['x', 'y']}, {a: 2, list: []}]`);
  const result = bridge(foreign);
  assert.deepEqual(result, [{ a: 1, list: ['x', 'y'] }, { a: 2, list: [] }]);
});

test('bridge returns a genuine host-realm Array', () => {
  const foreign = fromVmContext(`['p', 'q']`);
  assert.notEqual(foreign.constructor, Array, 'sanity: source value must actually be foreign-realm');

  const result = bridge(foreign);
  assert.equal(Array.isArray(result), true);
  assert.equal(result.constructor, Array);
  assert.doesNotThrow(() => assert.deepEqual(result, ['p', 'q']));
});

test('bridge does not infinitely recurse on a self-referencing object (WeakMap cycle guard)', () => {
  const cyclic = {};
  cyclic.self = cyclic;

  const result = bridge(cyclic);
  assert.equal(result.self, result);
});

test('bridge wraps a function export so it still executes and its return value comes back bridged', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(`globalThis.__out = (x) => [x, {doubled: x * 2}];`, ctx);
  const wrapped = bridge(ctx.__out);

  const result = wrapped(3);
  assert.deepEqual(result, [3, { doubled: 6 }]);
  assert.equal(Array.isArray(result), true);
  assert.equal(result.constructor, Array);
});
