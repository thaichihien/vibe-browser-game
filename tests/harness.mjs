import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GAME = path.join(ROOT, 'games', 'monster-battle.html');

export function readGame() {
  return readFileSync(GAME, 'utf8');
}

// Pull out the full <script> body — used by the syntax gate.
export function scriptBody() {
  const m = readGame().match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('No <script> block found in ' + GAME);
  return m[1];
}

// Pull out one comment-delimited region, e.g. ENGINE.
export function extract(marker) {
  const re = new RegExp(
    `/\\* ==== ${marker}:START ==== \\*/([\\s\\S]*?)/\\* ==== ${marker}:END ==== \\*/`
  );
  const m = readGame().match(re);
  if (!m) throw new Error(`Marker ${marker} not found in ` + GAME);
  return m[1];
}

// vm.createContext() runs code in a separate realm, so plain arrays/objects
// it produces have a different Array.prototype/Object.prototype identity
// than the host realm. assert.deepStrictEqual (what node:assert/strict's
// deepEqual resolves to) compares prototypes, so it fails on
// structurally-identical cross-realm values. `bridge` deep-clones data back
// into host-realm arrays/objects, and wraps functions so their return
// values get the same treatment while still executing inside the vm context.
export function bridge(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'function') {
      return (...args) => bridge(value(...args));
    }
    return value;
  }
  if (seen.has(value)) return seen.get(value);
  if (Array.isArray(value)) {
    const out = [];
    seen.set(value, out);
    value.forEach(v => out.push(bridge(v, seen)));
    return out;
  }
  const out = {};
  seen.set(value, out);
  for (const k of Object.keys(value)) out[k] = bridge(value[k], seen);
  return out;
}

// Evaluate the given regions in a bare context and hand back the named globals.
// The context has no `document` or `window` on purpose: if engine code ever
// touches the DOM, these tests fail loudly instead of silently passing.
export function load(markers, names) {
  const code = markers.map(extract).join('\n');
  const ctx = { console, Math, JSON };
  vm.createContext(ctx);
  vm.runInContext(`${code}\nglobalThis.__exports = { ${names.join(', ')} };`, ctx);
  return bridge(ctx.__exports);
}
