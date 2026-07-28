import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GAME = path.join(ROOT, 'games', 'dau-truong-sinh-vat.html');

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

// Evaluate the given regions in a bare context and hand back the named globals.
// The context has no `document` or `window` on purpose: if engine code ever
// touches the DOM, these tests fail loudly instead of silently passing.
export function load(markers, names) {
  const code = markers.map(extract).join('\n');
  const ctx = { console, Math, JSON };
  vm.createContext(ctx);
  vm.runInContext(`${code}\nglobalThis.__exports = { ${names.join(', ')} };`, ctx);
  return ctx.__exports;
}
