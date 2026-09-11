# Thám Tử Mạng — Stage 1 Implementation Plan (Engine + Chapter 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a playable vertical slice — the full capture engine (seeded director, two input
modes, lasso hit-testing, hearts, win/loss), thirteen anomalies spanning all six families, and
Chapter 1 (LUMIÈRE) complete with hotlinked photographs and an offline fallback — registered in
the hub and playable from it.

**Architecture:** A folder game. Six DOM-free ES modules under `js/engine/` carry every rule
worth testing (`rng`, `hittest`, `img`, `registry`, `director`, plus chapter data) and are
imported directly by `tests/`. The fake website renders into an open shadow root so its CSS
cannot touch the detective HUD, and hit-testing works on `getBoundingClientRect()` centres
rather than `elementFromPoint`, which does not pierce shadow boundaries. Anomalies are
mutations applied to a clean site at run start, never authored into the markup.

**Tech Stack:** Vanilla HTML/CSS/JS, ES modules, no build step, no dependencies. Tests are Node
22 built-ins (`node:test`, `node:assert`) importing the game's modules directly, the way
`tests/chrono-drifter.test.mjs` does — no `node:vm` harness.

**Spec:** `docs/superpowers/specs/2026-09-10-tham-tu-mang-design.md`

## Global Constraints

- **Folder game.** `games/tham-tu-mang/` — `index.html`, `style.css`, ES modules under `js/`,
  site modules under `sites/`. Follows `games/chrono-drifter/`.
- **Does NOT work over `file://`.** ES modules require a server. `python3` is **not installed
  on this machine** — use `npx serve` or any static server. This is expected and matches
  `games/last-quarter/`.
- **No module may touch the DOM at import time.** Not `engine/`, not `ui/`, not `anomalies/`.
  DOM access lives inside functions only. Task 1 adds a test that imports every module in the
  game; a top-level `document` reference fails the whole suite.
- **Vietnamese UI and Vietnamese site copy.** The slug stays English. Copy comes from spec §5
  and §6 verbatim — it is content, not examples to paraphrase.
- **Photographs are hotlinked and pinned** (spec §3.4): `loremflickr.com/<w>/<h>/<kw>?lock=<n>`
  or `picsum.photos/id/<id>/<w>/<h>`. An unpinned URL is a bug. Every `<img>` carries an
  `onerror` fallback.
- **Mute key** `thamTuMang.muted`; **progress key** `thamTuMang.progress`. Matches the
  `<gameCamelCase>.muted` convention.
- **`CATEGORY_ICONS` must stay monochrome** — `Puzzle: "▨"`, never an emoji.
- **Commit style:** conventional commits scoped `tham-tu-mang`. Bodies explain the failure being
  fixed, not just the change. **No `Claude-Session:` trailer** — see `~/.claude/CLAUDE.md`. The
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` trailer stays.
- **Test command:** `node --test 'tests/*.test.mjs'` — the bare directory form fails, the glob is
  required. On PowerShell use double quotes: `node --test "tests/*.test.mjs"`.
- **Single test file:** `tests/tham-tu-mang.test.mjs`. Every task appends to it.
- **Verification policy:** static checks plus the unit suite. No headless browser driving.
  Manual playtest by the user at the end of the stage.

## Scope

This plan covers **Stage 1 only**. Stages 2 and 3 get their own plan files after the Stage 1
playtest, because that playtest is expected to change their details — specifically the
difficulty calibration (are 5–6 anomalies findable in a single page?) and the image `lock`
values, which were chosen blind from a sandbox with no network (spec §3.4, §10).

| Stage | Contents |
|---|---|
| **1 (this plan)** | Engine, shell, both modes, lasso, 13 anomalies, Ch1 LUMIÈRE, hub entry |
| 2 | Remaining 21 anomalies, Ch2 Bếp Nhà Mây (2 pages), Ch3 SănĐồCũ (3 pages), reactive family |
| 3 | Ch4 Hồ Vắng, Ch5 Hoa Ban, Ch6 MegaLink, chapter unlock/ranks, case archive polish |

Stage 1 ends with a game that is fully playable on its own: open the hub, pick Chapter 1, read
a skincare landing page, find five or six things wrong with it, and win or lose.

**The thirteen anomalies in Stage 1** — chosen to cover all six families so the director's
constraint solver is exercised for real, not stubbed:

| Family | Stage 1 |
|---|---|
| TEXT | `T01`, `T02`, `T03` |
| STYLE | `S01`, `S05`, `S07` |
| MOTION | `M01`, `M03` |
| ELEMENT | `E01`, `E04` |
| REACTIVE | `R05` |
| IMAGE | `I01`, `I03` |

Ch1 rolls 5–6 with ≤2 per family and ≥3 families, so thirteen across six families is
comfortable headroom.

---

### Task 1: Test scaffold and the module-loads gate

**Files:**
- Create: `tests/tham-tu-mang.test.mjs`
- Create: `games/tham-tu-mang/js/engine/rng.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `mulberry32(seed) -> () => number`, `range(rng, lo, hi) -> int`,
  `pick(rng, arr) -> item`, `shuffle(rng, arr) -> new array`. Every later task's randomness
  goes through these; nothing calls `Math.random()` anywhere in the game.

- [ ] **Step 1: Write the failing test**

Create `tests/tham-tu-mang.test.mjs`:

```js
/* Thám Tử Mạng is a folder game, so its engine and data are real ES modules and the tests
   import them directly — no node:vm harness needed. The contract those modules must keep is
   that they stay DOM-free at import time, which the bare import proves. */

import test from 'node:test';
import assert from 'node:assert/strict';

import { mulberry32, range, pick, shuffle } from '../games/tham-tu-mang/js/engine/rng.js';

test('mulberry32 is deterministic for a seed', () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  const seqA = [a(), a(), a(), a()];
  const seqB = [b(), b(), b(), b()];
  assert.deepStrictEqual(seqA, seqB);
});

test('mulberry32 returns values in [0, 1)', () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 500; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('different seeds diverge', () => {
  const a = mulberry32(1), b = mulberry32(2);
  assert.notStrictEqual(a(), b());
});

test('range is inclusive at both ends', () => {
  const seen = new Set();
  const rng = mulberry32(99);
  for (let i = 0; i < 2000; i++) seen.add(range(rng, 5, 8));
  assert.deepStrictEqual([...seen].sort(), [5, 6, 7, 8]);
});

test('shuffle does not mutate its input and keeps every member', () => {
  const src = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = shuffle(mulberry32(3), src);
  assert.deepStrictEqual(src, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepStrictEqual([...out].sort((x, y) => x - y), src);
});

test('pick returns a member of the array', () => {
  const arr = ['a', 'b', 'c'];
  const rng = mulberry32(42);
  for (let i = 0; i < 100; i++) assert.ok(arr.includes(pick(rng, arr)));
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test "tests/tham-tu-mang.test.mjs"`
Expected: FAIL — `Cannot find module .../js/engine/rng.js`

- [ ] **Step 3: Write the minimal implementation**

Create `games/tham-tu-mang/js/engine/rng.js`:

```js
/* Seeded randomness. Every random draw in a run goes through here so that one seed
   reproduces a case exactly — see spec §3.3. Nothing in this game calls Math.random(). */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inclusive at both ends: range(rng, 5, 8) yields 5, 6, 7 or 8. */
export function range(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/** Fisher-Yates on a copy — callers pass shared data and must not have it reordered. */
export function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test "tests/tham-tu-mang.test.mjs"`
Expected: PASS, 6 tests.

- [ ] **Step 5: Add the module-loads gate**

This test is what enforces the "no DOM at import time" constraint across the whole game. It
walks the game's JS tree and imports everything. Append to `tests/tham-tu-mang.test.mjs`:

```js
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const GAME_JS = new URL('../games/tham-tu-mang/js/', import.meta.url);

function walk(dirUrl) {
  const dir = dirUrl.pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(pathToFileURL(full + '/')));
    else if (entry.endsWith('.js')) out.push(full);
  }
  return out;
}

test('every module imports without touching the DOM', async () => {
  const files = walk(GAME_JS);
  assert.ok(files.length > 0, 'found no modules to check');
  for (const file of files) {
    await assert.doesNotReject(
      () => import(pathToFileURL(file).href),
      `${relative(process.cwd(), file)} failed to import — a SyntaxError, or DOM access at ` +
      `module top level. DOM access belongs inside functions.`
    );
  }
});
```

- [ ] **Step 6: Run the full suite**

Run: `node --test "tests/*.test.mjs"`
Expected: PASS. The new file adds 7 tests; every pre-existing test still passes.

- [ ] **Step 7: Commit**

```bash
git add tests/tham-tu-mang.test.mjs games/tham-tu-mang/js/engine/rng.js
git commit -m "$(cat <<'EOF'
test(tham-tu-mang): seeded rng and a module-loads gate

A folder game's modules are only as testable as their import-time purity. The
walk-and-import test fails loudly on a stray top-level `document`, which would
otherwise surface as an unrelated suite-wide crash much later.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Lasso geometry

**Files:**
- Create: `games/tham-tu-mang/js/engine/hittest.js`
- Modify: `tests/tham-tu-mang.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `MIN_STROKE = 12`, `MAX_W = 300`, `MAX_H = 200`, `bounds(points) -> {minX,minY,maxX,maxY,w,h}`,
  `strokeVerdict(points, cap?) -> "TOO_SMALL" | "TOO_BIG" | "OK"`,
  `pointInPolygon({x,y}, points) -> bool`, `centroid(points) -> {x,y}`,
  `nearestEnclosed(points, targets) -> target | null` where a target is
  `{ id, anomaly: boolean, cx: number, cy: number }`. Task 9 (lasso) and Task 10 (run) both
  consume `strokeVerdict` and `nearestEnclosed`.

This is the module that decides whether a player loses a heart, so it gets the most tests.
Points are `{x, y}` in viewport pixels.

- [ ] **Step 1: Write the failing tests**

Append to `tests/tham-tu-mang.test.mjs`:

```js
import { MIN_STROKE, MAX_W, MAX_H, bounds, strokeVerdict, pointInPolygon, centroid,
         nearestEnclosed } from '../games/tham-tu-mang/js/engine/hittest.js';

const square = (x, y, s) => [
  { x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }
];

test('bounds measures the stroke box', () => {
  const b = bounds(square(10, 20, 40));
  assert.deepStrictEqual(
    { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY, w: b.w, h: b.h },
    { minX: 10, minY: 20, maxX: 50, maxY: 60, w: 40, h: 40 }
  );
});

test('a stroke under the floor is TOO_SMALL, not a claim', () => {
  assert.strictEqual(strokeVerdict(square(0, 0, MIN_STROKE - 1)), 'TOO_SMALL');
  assert.strictEqual(strokeVerdict([{ x: 1, y: 1 }, { x: 2, y: 2 }]), 'TOO_SMALL');
});

test('a stroke past the budget ring is TOO_BIG', () => {
  assert.strictEqual(strokeVerdict(square(0, 0, MAX_W + 1)), 'TOO_BIG');
  assert.strictEqual(strokeVerdict([
    { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: MAX_H + 5 }, { x: 0, y: MAX_H + 5 }
  ]), 'TOO_BIG');
});

test('a stroke inside both gates is OK', () => {
  assert.strictEqual(strokeVerdict(square(0, 0, 100)), 'OK');
});

test('pointInPolygon handles a convex loop', () => {
  const poly = square(0, 0, 100);
  assert.strictEqual(pointInPolygon({ x: 50, y: 50 }, poly), true);
  assert.strictEqual(pointInPolygon({ x: 150, y: 50 }, poly), false);
});

test('pointInPolygon handles a concave loop', () => {
  // A "C" shape — the notch on the right must read as outside.
  const poly = [
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 30 }, { x: 40, y: 30 },
    { x: 40, y: 70 }, { x: 100, y: 70 }, { x: 100, y: 100 }, { x: 0, y: 100 }
  ];
  assert.strictEqual(pointInPolygon({ x: 20, y: 50 }, poly), true);
  assert.strictEqual(pointInPolygon({ x: 70, y: 50 }, poly), false);
});

test('pointInPolygon handles a self-intersecting scribble without throwing', () => {
  const bowtie = [
    { x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 }
  ];
  assert.strictEqual(typeof pointInPolygon({ x: 50, y: 25 }, bowtie), 'boolean');
});

test('centroid averages the stroke', () => {
  assert.deepStrictEqual(centroid(square(0, 0, 100)), { x: 50, y: 50 });
});

test('nearestEnclosed returns null when the loop holds nothing', () => {
  const targets = [{ id: 'a', anomaly: false, cx: 900, cy: 900 }];
  assert.strictEqual(nearestEnclosed(square(0, 0, 100), targets), null);
});

test('nearestEnclosed scores exactly one target, nearest the centroid', () => {
  const targets = [
    { id: 'far',  anomaly: false, cx: 20, cy: 20 },
    { id: 'near', anomaly: true,  cx: 52, cy: 48 }
  ];
  const hit = nearestEnclosed(square(0, 0, 100), targets);
  assert.strictEqual(hit.id, 'near');
});

test('nearestEnclosed breaks ties stably toward the earlier target', () => {
  const targets = [
    { id: 'first',  anomaly: true,  cx: 40, cy: 50 },
    { id: 'second', anomaly: false, cx: 60, cy: 50 }
  ];
  assert.strictEqual(nearestEnclosed(square(0, 0, 100), targets).id, 'first');
});

test('a target centre exactly on an edge does not throw', () => {
  const targets = [{ id: 'edge', anomaly: true, cx: 0, cy: 50 }];
  assert.doesNotThrow(() => nearestEnclosed(square(0, 0, 100), targets));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test "tests/tham-tu-mang.test.mjs"`
Expected: FAIL — `Cannot find module .../js/engine/hittest.js`

- [ ] **Step 3: Write the implementation**

Create `games/tham-tu-mang/js/engine/hittest.js`:

```js
/* Lasso geometry — spec §4.2 and §4.3. This module decides whether the player loses a heart,
   so it is pure, DOM-free and heavily tested. All coordinates are viewport pixels. */

/** Below this, the gesture is a twitch or a stray click, not a circle. */
export const MIN_STROKE = 12;

/** The budget ring. A loop may not exceed this box — it is what guarantees one anomaly
    per circle, so a player cannot sweep the whole page in one stroke. */
export const MAX_W = 300;
export const MAX_H = 200;

export function bounds(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** Both rejections happen BEFORE any hit-testing, so neither leaks anything about the page. */
export function strokeVerdict(points, cap = { w: MAX_W, h: MAX_H }) {
  if (!points || points.length < 3) return 'TOO_SMALL';
  const b = bounds(points);
  if (b.w < MIN_STROKE && b.h < MIN_STROKE) return 'TOO_SMALL';
  if (b.w > cap.w || b.h > cap.h) return 'TOO_BIG';
  return 'OK';
}

/** Ray casting. Self-intersecting scribbles resolve by even-odd rule, which is fine —
    the player drew a mess and gets a defensible answer rather than an exception. */
export function pointInPolygon(pt, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x, yi = points[i].y;
    const xj = points[j].x, yj = points[j].y;
    const straddles = (yi > pt.y) !== (yj > pt.y);
    if (straddles && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function centroid(points) {
  let x = 0, y = 0;
  for (const p of points) { x += p.x; y += p.y; }
  return { x: x / points.length, y: y / points.length };
}

/**
 * Score exactly one target — the enclosed element whose centre sits nearest the loop's
 * centroid. Even if a tight loop catches two neighbours, the claim resolves against the one
 * the player most plainly meant (spec §4.3).
 *
 * @param {{x:number,y:number}[]} points
 * @param {{id:string, anomaly:boolean, cx:number, cy:number}[]} targets
 * @returns {object|null} the winning target, or null if the loop encloses nothing
 */
export function nearestEnclosed(points, targets) {
  const c = centroid(points);
  let best = null;
  let bestD = Infinity;
  for (const t of targets) {
    if (!pointInPolygon({ x: t.cx, y: t.cy }, points)) continue;
    const d = (t.cx - c.x) ** 2 + (t.cy - c.y) ** 2;
    if (d < bestD) { best = t; bestD = d; }   // strict < keeps ties on the earlier target
  }
  return best;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test "tests/tham-tu-mang.test.mjs"`
Expected: PASS, 19 tests.

- [ ] **Step 5: Commit**

```bash
git add tests/tham-tu-mang.test.mjs games/tham-tu-mang/js/engine/hittest.js
git commit -m "$(cat <<'EOF'
feat(tham-tu-mang): lasso geometry with a size cap and single-target resolution

Without an upper bound on stroke size a player could circle the entire page and
take every anomaly in one gesture. The budget ring closes that, and resolving to
the target nearest the centroid keeps a tight loop over two neighbours from being
ambiguous.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Pinned image URLs and the offline fallback

**Files:**
- Create: `games/tham-tu-mang/js/engine/img.js`
- Modify: `tests/tham-tu-mang.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `flickr({ w, h, kw, lock, grayscale?, blur? }) -> string`,
  `picsum({ w, h, id, grayscale?, blur? }) -> string`, `isPinned(url) -> bool`,
  `fallbackSvg({ w, h, tint, seed }) -> string` (an SVG data URI),
  `imgHtml({ src, alt, w, h, tint, cls? }) -> string` — the `<img>` markup every site uses,
  with its `onerror` already wired. Tasks 8 and 11 both consume `imgHtml`; Task 11's `I01`
  and `I03` consume `flickr`/`picsum` directly to re-derive a URL with `grayscale` or a
  different `lock`.

Centralising the URL builders here is deliberate: if a free service changes its scheme or dies,
the fix is one file rather than six sites (spec §10).

- [ ] **Step 1: Write the failing tests**

Append to `tests/tham-tu-mang.test.mjs`:

```js
import { flickr, picsum, isPinned, fallbackSvg, imgHtml }
  from '../games/tham-tu-mang/js/engine/img.js';

test('flickr urls are pinned with a lock', () => {
  const url = flickr({ w: 600, h: 400, kw: 'skincare', lock: 7 });
  assert.match(url, /^https:\/\/loremflickr\.com\/600\/400\/skincare\?/);
  assert.match(url, /lock=7/);
  assert.strictEqual(isPinned(url), true);
});

test('picsum urls are pinned with an id', () => {
  const url = picsum({ w: 320, h: 240, id: 1015 });
  assert.strictEqual(url, 'https://picsum.photos/id/1015/320/240');
  assert.strictEqual(isPinned(url), true);
});

test('an unpinned url is rejected by isPinned', () => {
  assert.strictEqual(isPinned('https://loremflickr.com/600/400/lake'), false);
  assert.strictEqual(isPinned('https://picsum.photos/600/400'), false);
});

test('grayscale and blur compose onto a pinned base without losing the pin', () => {
  const grey = flickr({ w: 600, h: 400, kw: 'lake', lock: 3, grayscale: true });
  assert.match(grey, /lock=3/);
  assert.ok(/grayscale|\/g\//.test(grey), `no grayscale marker in ${grey}`);
  assert.strictEqual(isPinned(grey), true);

  const blurred = picsum({ w: 600, h: 400, id: 20, blur: 2 });
  assert.match(blurred, /blur=2/);
  assert.strictEqual(isPinned(blurred), true);
});

test('fallbackSvg is a self-contained data uri needing no network', () => {
  const svg = fallbackSvg({ w: 600, h: 400, tint: '#d8c3b0', seed: 4 });
  assert.match(svg, /^data:image\/svg\+xml,/);
  assert.ok(!svg.includes('http'), 'fallback must not reference anything remote');
});

test('imgHtml wires an onerror fallback onto every image', () => {
  const html = imgHtml({
    src: flickr({ w: 600, h: 400, kw: 'skincare', lock: 7 }),
    alt: 'Kem dưỡng ẩm', w: 600, h: 400, tint: '#d8c3b0'
  });
  assert.match(html, /<img /);
  assert.match(html, /onerror=/);
  assert.match(html, /data:image\/svg\+xml/);
  assert.match(html, /alt="Kem dưỡng ẩm"/);
});

test('imgHtml refuses an unpinned src', () => {
  assert.throws(
    () => imgHtml({ src: 'https://picsum.photos/600/400', alt: 'x', w: 600, h: 400, tint: '#000' }),
    /pinned/i
  );
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test "tests/tham-tu-mang.test.mjs"`
Expected: FAIL — `Cannot find module .../js/engine/img.js`

- [ ] **Step 3: Write the implementation**

Create `games/tham-tu-mang/js/engine/img.js`:

```js
/* Hotlinked photography — spec §3.4. Two rules carry this module:
   1. Every URL is PINNED. An unpinned URL returns a different photo each load, which
      silently breaks S05 (a caption written against a known image) and the IMAGE family.
   2. Every <img> degrades. These are free services with no uptime guarantee, so a dead CDN
      or an offline player must get a stylised placeholder, not a broken-image icon. */

const FLICKR = 'https://loremflickr.com';
const PICSUM = 'https://picsum.photos';

export function flickr({ w, h, kw, lock, grayscale = false, blur = 0 }) {
  if (lock === undefined || lock === null) throw new Error('flickr(): lock is required — unpinned urls are a bug');
  const path = grayscale ? `${FLICKR}/g/${w}/${h}/${kw}` : `${FLICKR}/${w}/${h}/${kw}`;
  const params = [`lock=${lock}`];
  if (blur > 0) params.push(`blur=${blur}`);
  return `${path}?${params.join('&')}`;
}

export function picsum({ w, h, id, grayscale = false, blur = 0 }) {
  if (id === undefined || id === null) throw new Error('picsum(): id is required — unpinned urls are a bug');
  const params = [];
  if (grayscale) params.push('grayscale');
  if (blur > 0) params.push(`blur=${blur}`);
  const q = params.length ? `?${params.join('&')}` : '';
  return `${PICSUM}/id/${id}/${w}/${h}${q}`;
}

/** A url is pinned if it names a specific photograph: a lock= param, or an /id/ segment. */
export function isPinned(url) {
  return /[?&]lock=\d+/.test(url) || /picsum\.photos\/id\/\d+\//.test(url);
}

/** A stylised stand-in built entirely from gradients and grain — no network, no assets. */
export function fallbackSvg({ w, h, tint, seed = 1 }) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<defs>` +
        `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
          `<stop offset="0%" stop-color="${tint}" stop-opacity="0.85"/>` +
          `<stop offset="100%" stop-color="${tint}" stop-opacity="0.35"/>` +
        `</linearGradient>` +
        `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" ` +
          `numOctaves="2" seed="${seed}"/><feColorMatrix type="saturate" values="0"/></filter>` +
      `</defs>` +
      `<rect width="${w}" height="${h}" fill="url(#g)"/>` +
      `<rect width="${w}" height="${h}" filter="url(#n)" opacity="0.18"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * The only <img> builder the sites use. Its onerror swaps in the fallback and then clears
 * itself, so a failing placeholder cannot loop.
 */
export function imgHtml({ src, alt, w, h, tint, cls = '' }) {
  if (!isPinned(src)) throw new Error(`imgHtml(): src must be pinned — got ${src}`);
  const fb = fallbackSvg({ w, h, tint, seed: (w + h) % 97 });
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `<img class="${esc(cls)}" src="${esc(src)}" alt="${esc(alt)}" width="${w}" height="${h}" ` +
         `loading="lazy" onerror="this.onerror=null;this.src='${fb}'">`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test "tests/tham-tu-mang.test.mjs"`
Expected: PASS, 26 tests.

- [ ] **Step 5: Commit**

```bash
git add tests/tham-tu-mang.test.mjs games/tham-tu-mang/js/engine/img.js
git commit -m "$(cat <<'EOF'
feat(tham-tu-mang): pinned image urls with an offline fallback

An unpinned CDN url returns a different photo per load, which would silently break
every caption authored against a known image. isPinned() makes that a thrown error
at build time rather than a mystery at playtest.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Chapter 1 data — slots and flavour pools

**Files:**
- Create: `games/tham-tu-mang/js/chapters/ch1-lumiere.js`
- Create: `games/tham-tu-mang/js/chapters/index.js`
- Modify: `tests/tham-tu-mang.test.mjs`

**Interfaces:**
- Consumes: nothing (pure data).
- Produces: `CH1` and `CHAPTERS` (an array). A chapter is:
  ```js
  { id, title, slug, min, max, exclude: string[], force: string[],
    pages: [{ id, slots: { [slotType]: count } }],
    flavour: { [anomalyId]: unknown } }
  ```
  Task 6 (director) consumes `pages[].slots`, `min`, `max`, `exclude`, `force`. Task 11
  (anomalies) consumes `flavour`.

Slots are declared **per page** from the start even though Ch1 has one page — Stage 2 adds
multi-page chapters, and retrofitting the shape later would touch the director, the tests and
every chapter file.

- [ ] **Step 1: Write the failing tests**

Append to `tests/tham-tu-mang.test.mjs`:

```js
import { CH1 } from '../games/tham-tu-mang/js/chapters/ch1-lumiere.js';
import { CHAPTERS } from '../games/tham-tu-mang/js/chapters/index.js';

test('chapter 1 declares the slot inventory the spec gives it', () => {
  const slots = CH1.pages[0].slots;
  assert.strictEqual(slots.paragraph, 4);
  assert.strictEqual(slots.photo, 4);
  assert.strictEqual(slots.avatar, 2);
  assert.strictEqual(slots['feature-icon'], 3);
  assert.strictEqual(slots.nav, 1);
  assert.strictEqual(slots.newsletter, 1);
});

test('chapter 1 rolls 5 to 6', () => {
  assert.strictEqual(CH1.min, 5);
  assert.strictEqual(CH1.max, 6);
});

test('chapter 1 forces the emoji anomaly so the tutorial teaches on something legible', () => {
  assert.deepStrictEqual(CH1.force, ['S07']);
});

test('CHAPTERS lists chapter 1 first', () => {
  assert.strictEqual(CHAPTERS[0].id, CH1.id);
});

test('every flavour pool is a non-empty array of non-empty strings or objects', () => {
  for (const [id, pool] of Object.entries(CH1.flavour)) {
    assert.ok(Array.isArray(pool), `${id} flavour must be an array`);
    assert.ok(pool.length > 0, `${id} flavour is empty`);
  }
});

test('T02 replacements change the SHAPE of the block, not one character', () => {
  // Spec §6 T02: a swap the player could only find by having memorised the page is luck,
  // not observation. >12 characters of difference is the mechanical proxy for that rule.
  for (const entry of CH1.flavour.T02) {
    const delta = Math.abs(entry.after.length - entry.before.length);
    assert.ok(delta > 12,
      `T02 "${entry.before}" -> "${entry.after}" differs by only ${delta} chars; ` +
      `the player would have to have memorised the page to spot it`);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test "tests/tham-tu-mang.test.mjs"`
Expected: FAIL — `Cannot find module .../chapters/ch1-lumiere.js`

- [ ] **Step 3: Write the chapter data**

Create `games/tham-tu-mang/js/chapters/ch1-lumiere.js`. Copy is from spec §5.1 and §6 — it is
content, not a template to paraphrase:

```js
/* Chương 1 — LUMIÈRE. Trang bán kem dưỡng ẩm. Chương hướng dẫn: ép S07 (emoji lạc loài),
   dị thường dễ thấy nhất trong thư viện, để người chơi học động tác khoanh trên một thứ
   không thể nhầm. Spec §5.1. */

export const CH1 = {
  id: 'ch1-lumiere',
  title: 'LUMIÈRE',
  slug: 'ch1-lumiere',
  subtitle: 'Kem dưỡng ẩm · trang bán hàng',
  min: 5,
  max: 6,
  exclude: [],
  force: ['S07'],

  pages: [{
    id: 'index',
    slots: {
      nav: 1,
      'hero-title': 1,
      paragraph: 4,
      price: 1,
      cta: 1,
      photo: 4,
      avatar: 2,
      'feature-icon': 3,
      faq: 1,
      footer: 1,
      newsletter: 1
    }
  }],

  flavour: {
    // T01 — một câu bị thay bằng lời nguyền, cùng font, cùng nhịp.
    T01: [
      'Thoa đều lên da mặt mỗi tối, tránh vùng mắt. Đừng thoa lên gương. Gương sẽ thoa lại.',
      'Bảo quản nơi khô ráo, tránh ánh nắng trực tiếp. Nếu nắp tự mở, đừng đóng lại.',
      'Ngưng sử dụng nếu thấy kích ứng. Ngưng sử dụng nếu thấy nó ấm khi bạn không cầm.'
    ],

    // T02 — viết lại khi cuộn ngược. Bản sau PHẢI dài hơn hẳn (xem test §6 T02).
    T02: [
      {
        before: 'Sản phẩm phù hợp với mọi loại da.',
        after: 'Sản phẩm phù hợp với mọi loại da. Kể cả da không còn ở trên người.'
      },
      {
        before: 'Chúng tôi cam kết hoàn tiền trong 30 ngày.',
        after: 'Chúng tôi cam kết hoàn tiền trong 30 ngày. Chưa ai kịp dùng hết 30 ngày để đòi.'
      }
    ],

    // T03 — con số tụt dần rồi thôi không còn là một con số nữa.
    T03: [
      { text: 'Còn {n} suất ưu đãi trong hôm nay.', start: 12 },
      { text: 'Đã có {n} người mua trong một giờ qua.', start: 9 }
    ],

    // S01 — một chữ đổi font. Chữ càng bình thường càng tốt.
    S01: [
      { word: 'mong', family: 'cursive' },
      { word: 'luôn', family: 'fantasy' },
      { word: 'nhớ', family: 'monospace' }
    ],

    // S05 — chú thích tự tin mô tả một tấm ảnh khác.
    S05: [
      'Ảnh: bạn Ngọc Anh sau 4 tuần sử dụng',
      'Ảnh: phòng thí nghiệm của chúng tôi tại Đà Lạt',
      'Ảnh: mẻ hoa cúc La Mã thu hoạch tháng trước'
    ],

    // S07 — emoji lạc loài giữa ✨🌿💧🧴.
    S07: ['🩸', '🕳️', '👁️', '🦷'],

    // E01 — cái nút không thuộc về đâu cả.
    E01: [
      { label: 'GỌI LẠI', dialog: 'Chúng tôi chưa từng gọi cho bạn lần nào.' },
      { label: 'ĐỪNG BẤM', dialog: 'Cảm ơn bạn đã bấm.' },
      { label: 'XÁC NHẬN LẦN NỮA', dialog: 'Lần này thì đã được ghi nhận.' }
    ],

    // E04 — một dòng chân trang không trang nào có.
    E04: [
      'Bản quyền © 1834–2026 LUMIÈRE',
      'Số người đang xem: 1 (bạn) và 4',
      'GPKD số 03:17 — cấp lúc 03:17'
    ],

    // R05 — đăng ký nhận tin, và hoá ra bạn đã đăng ký từ lâu.
    R05: [
      { since: '14/08/2011', unsub: 'KHÔNG THỂ' },
      { since: '02/02/2009', unsub: 'KHÔNG THỂ' }
    ],

    // I03 — hai lời chứng thực, hai cái tên, một khuôn mặt.
    I03: [
      { a: { name: 'Ngọc Anh', age: 28 }, b: { name: 'Thu Hà', age: 41 } },
      { a: { name: 'Mỹ Linh', age: 33 }, b: { name: 'Bảo Trân', age: 26 } }
    ]
  }
};
```

- [ ] **Step 4: Write the manifest**

Create `games/tham-tu-mang/js/chapters/index.js`:

```js
/* Thứ tự chương = đường cong độ khó. Stage 2 và 3 thêm chương vào đây. */

import { CH1 } from './ch1-lumiere.js';

export const CHAPTERS = [CH1];

export const chapterById = (id) => CHAPTERS.find((c) => c.id === id) ?? null;
```

- [ ] **Step 5: Run to verify pass**

Run: `node --test "tests/tham-tu-mang.test.mjs"`
Expected: PASS, 32 tests.

- [ ] **Step 6: Commit**

```bash
git add tests/tham-tu-mang.test.mjs games/tham-tu-mang/js/chapters/
git commit -m "$(cat <<'EOF'
feat(tham-tu-mang): chapter 1 slot inventory and flavour pools

Slots are declared per page even though Ch1 has one, so the multi-page chapters in
Stage 2 do not force a reshape of the director and every chapter file. The T02 test
asserts the shape rule: a swap the player could only find by having memorised the
page is luck, not observation.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The anomaly registry

**Files:**
- Create: `games/tham-tu-mang/js/anomalies/text.js`, `style.js`, `motion.js`, `element.js`,
  `reactive.js`, `image.js`
- Create: `games/tham-tu-mang/js/engine/registry.js`
- Modify: `tests/tham-tu-mang.test.mjs`

**Interfaces:**
- Consumes: nothing at import time.
- Produces: `ANOMALIES` — an array of
  `{ id, family, slots: string[], weight: number, apply(ctx) }`, and `byId(id)`.
  Task 6 (director) consumes `id`, `family`, `slots`, `weight`. Task 11 fills in the `apply`
  bodies; this task defines all thirteen with **real metadata and a no-op `apply`**, so the
  director can be built and tested against the true shape of the library.

Splitting metadata (this task) from behaviour (Task 11) means the director's constraint solver
is tested against the real thirteen rather than a fixture that could drift from them.

- [ ] **Step 1: Write the failing tests**

Append to `tests/tham-tu-mang.test.mjs`:

```js
import { ANOMALIES, byId } from '../games/tham-tu-mang/js/engine/registry.js';

const STAGE1_IDS = ['T01','T02','T03','S01','S05','S07','M01','M03','E01','E04','R05','I01','I03'];
const FAMILIES = ['TEXT','STYLE','MOTION','ELEMENT','REACTIVE','IMAGE'];

test('the registry holds exactly the stage 1 anomalies', () => {
  assert.deepStrictEqual(ANOMALIES.map((a) => a.id).sort(), [...STAGE1_IDS].sort());
});

test('every anomaly id is unique', () => {
  const ids = ANOMALIES.map((a) => a.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('all six families are represented', () => {
  const present = new Set(ANOMALIES.map((a) => a.family));
  for (const f of FAMILIES) assert.ok(present.has(f), `family ${f} is missing`);
});

test('every anomaly declares a family, at least one slot, a weight and an apply', () => {
  for (const a of ANOMALIES) {
    assert.ok(FAMILIES.includes(a.family), `${a.id} has family ${a.family}`);
    assert.ok(Array.isArray(a.slots) && a.slots.length > 0, `${a.id} declares no slots`);
    assert.strictEqual(typeof a.weight, 'number', `${a.id} has no weight`);
    assert.strictEqual(typeof a.apply, 'function', `${a.id} has no apply()`);
  }
});

test('every anomaly is eligible for at least one chapter', () => {
  for (const a of ANOMALIES) {
    const ok = CHAPTERS.some((c) =>
      c.pages.some((p) => a.slots.some((s) => (p.slots[s] || 0) > 0)));
    assert.ok(ok, `${a.id} can never be placed — no chapter has any of ${a.slots.join(', ')}`);
  }
});

test('byId finds an anomaly and returns null for a stranger', () => {
  assert.strictEqual(byId('T01').family, 'TEXT');
  assert.strictEqual(byId('ZZ9'), null);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test "tests/tham-tu-mang.test.mjs"`
Expected: FAIL — `Cannot find module .../js/engine/registry.js`

- [ ] **Step 3: Write the six family modules**

Each anomaly's `apply(ctx)` is a no-op placeholder in this task and gets its real body in Task
11. `ctx` is `{ root, slot, rng, flavour, mark, observe }` per spec §3.5.

**Nothing in these files may touch the DOM at module top level** — the registry that imports
them is itself DOM-free and imported by the tests.

Create `games/tham-tu-mang/js/anomalies/text.js`:

```js
/* Họ TEXT. apply() được cài đặt ở Task 11. */

export const T01 = {
  id: 'T01', family: 'TEXT', slots: ['paragraph', 'notice'], weight: 3,
  apply(_ctx) {}
};

export const T02 = {
  id: 'T02', family: 'TEXT', slots: ['paragraph', 'post-title', 'notice'], weight: 3,
  apply(_ctx) {}
};

export const T03 = {
  id: 'T03', family: 'TEXT', slots: ['paragraph', 'price', 'tile'], weight: 3,
  apply(_ctx) {}
};

export const TEXT_ANOMALIES = [T01, T02, T03];
```

Create `games/tham-tu-mang/js/anomalies/style.js`:

```js
/* Họ STYLE. apply() được cài đặt ở Task 11. */

export const S01 = {
  id: 'S01', family: 'STYLE', slots: ['paragraph', 'hero-title', 'notice'], weight: 3,
  apply(_ctx) {}
};

export const S05 = {
  id: 'S05', family: 'STYLE', slots: ['gallery-caption', 'avatar', 'photo'], weight: 3,
  apply(_ctx) {}
};

export const S07 = {
  id: 'S07', family: 'STYLE', slots: ['feature-icon', 'tile', 'nav'], weight: 4,
  apply(_ctx) {}
};

export const STYLE_ANOMALIES = [S01, S05, S07];
```

Create `games/tham-tu-mang/js/anomalies/motion.js`:

```js
/* Họ MOTION. apply() được cài đặt ở Task 11. */

export const M01 = {
  id: 'M01', family: 'MOTION', slots: ['avatar', 'tile', 'cta'], weight: 2,
  apply(_ctx) {}
};

export const M03 = {
  id: 'M03', family: 'MOTION', slots: ['tile', 'avatar', 'cta', 'map'], weight: 2,
  apply(_ctx) {}
};

export const MOTION_ANOMALIES = [M01, M03];
```

Create `games/tham-tu-mang/js/anomalies/element.js`:

```js
/* Họ ELEMENT. apply() được cài đặt ở Task 11. */

export const E01 = {
  id: 'E01', family: 'ELEMENT', slots: ['paragraph', 'footer', 'nav'], weight: 3,
  apply(_ctx) {}
};

export const E04 = {
  id: 'E04', family: 'ELEMENT', slots: ['footer'], weight: 3,
  apply(_ctx) {}
};

export const ELEMENT_ANOMALIES = [E01, E04];
```

Create `games/tham-tu-mang/js/anomalies/reactive.js`:

```js
/* Họ REACTIVE — hai giai đoạn: người chơi thử nghiệm, dị thường hiện ra, rồi vẫn phải khoanh.
   Thử nghiệm không bao giờ mất máu. apply() được cài đặt ở Task 11. */

export const R05 = {
  id: 'R05', family: 'REACTIVE', slots: ['subscribe', 'newsletter'], weight: 3,
  apply(_ctx) {}
};

export const REACTIVE_ANOMALIES = [R05];
```

Create `games/tham-tu-mang/js/anomalies/image.js`:

```js
/* Họ IMAGE — chỉ khả thi vì ảnh là ảnh thật và URL có tham số. apply() ở Task 11. */

export const I01 = {
  id: 'I01', family: 'IMAGE', slots: ['photo'], weight: 3,
  apply(_ctx) {}
};

export const I03 = {
  id: 'I03', family: 'IMAGE', slots: ['avatar'], weight: 3, needs: { avatar: 2 },
  apply(_ctx) {}
};

export const IMAGE_ANOMALIES = [I01, I03];
```

- [ ] **Step 4: Write the registry**

Create `games/tham-tu-mang/js/engine/registry.js`:

```js
/* Thư viện dị thường. DOM-free ở tầng import — mọi truy cập DOM nằm trong apply().
   tests/ import trực tiếp file này, nên một tham chiếu `document` ở top level của bất kỳ
   file anomalies/* nào cũng sẽ làm hỏng cả bộ test. */

import { TEXT_ANOMALIES } from '../anomalies/text.js';
import { STYLE_ANOMALIES } from '../anomalies/style.js';
import { MOTION_ANOMALIES } from '../anomalies/motion.js';
import { ELEMENT_ANOMALIES } from '../anomalies/element.js';
import { REACTIVE_ANOMALIES } from '../anomalies/reactive.js';
import { IMAGE_ANOMALIES } from '../anomalies/image.js';

export const ANOMALIES = [
  ...TEXT_ANOMALIES,
  ...STYLE_ANOMALIES,
  ...MOTION_ANOMALIES,
  ...ELEMENT_ANOMALIES,
  ...REACTIVE_ANOMALIES,
  ...IMAGE_ANOMALIES
];

export const byId = (id) => ANOMALIES.find((a) => a.id === id) ?? null;
```

- [ ] **Step 5: Run to verify pass**

Run: `node --test "tests/tham-tu-mang.test.mjs"`
Expected: PASS, 38 tests. The module-loads gate from Task 1 now covers seven more files.

- [ ] **Step 6: Commit**

```bash
git add tests/tham-tu-mang.test.mjs games/tham-tu-mang/js/anomalies/ games/tham-tu-mang/js/engine/registry.js
git commit -m "$(cat <<'EOF'
feat(tham-tu-mang): anomaly registry across all six families

Metadata lands before behaviour so the director's constraint solver can be tested
against the real thirteen anomalies rather than a fixture that would drift from
them. apply() bodies follow in the next pass.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: The director

**Files:**
- Create: `games/tham-tu-mang/js/engine/director.js`
- Modify: `tests/tham-tu-mang.test.mjs`

**Interfaces:**
- Consumes: `mulberry32`, `range`, `shuffle` (Task 1); `ANOMALIES` (Task 5); a chapter (Task 4).
- Produces: `plan(chapter, seed, registry = ANOMALIES) -> { seed, count, picks }` where `count`
  is the number **rolled** (so `picks.length < count` is a detectable failure, not a silent
  one) and a pick is `{ id, family, page, slot, nth }` — `slot` is the slot **type**, `nth` the zero-based
  index of which element of that type it claimed. Task 8 (`site.js`) resolves `{slot, nth}` to
  a real element; Task 10 (`run.js`) consumes `picks.length` as the evidence total.

This is the module that makes every playthrough different, and the one whose failure modes are
silent — a director that quietly picks four anomalies instead of six produces a chapter that
can never be won. It gets the heaviest test.

- [ ] **Step 1: Write the failing tests**

Append to `tests/tham-tu-mang.test.mjs`:

```js
import { plan } from '../games/tham-tu-mang/js/engine/director.js';

const SEEDS = Array.from({ length: 500 }, (_, i) => i * 7919 + 13);

test('the same seed reproduces an identical plan', () => {
  const a = plan(CH1, 4242);
  const b = plan(CH1, 4242);
  assert.deepStrictEqual(a, b);
});

test('different seeds produce different plans at least sometimes', () => {
  const shapes = new Set(SEEDS.slice(0, 50).map((s) => JSON.stringify(plan(CH1, s).picks)));
  assert.ok(shapes.size > 5, `only ${shapes.size} distinct plans in 50 seeds — not random enough`);
});

test('count always lands inside the chapter range', () => {
  for (const seed of SEEDS) {
    const { count, picks } = plan(CH1, seed);
    assert.ok(count >= CH1.min && count <= CH1.max, `seed ${seed} rolled ${count}`);
    assert.strictEqual(picks.length, count, `seed ${seed} promised ${count}, placed ${picks.length}`);
  }
});

test('never two anomalies on the same slot element', () => {
  for (const seed of SEEDS) {
    const { picks } = plan(CH1, seed);
    const keys = picks.map((p) => `${p.page}:${p.slot}:${p.nth}`);
    assert.strictEqual(new Set(keys).size, keys.length, `seed ${seed} stacked two on one element`);
  }
});

test('never more than two from one family', () => {
  for (const seed of SEEDS) {
    const counts = {};
    for (const p of plan(CH1, seed).picks) counts[p.family] = (counts[p.family] || 0) + 1;
    for (const [family, n] of Object.entries(counts)) {
      assert.ok(n <= 2, `seed ${seed} took ${n} from ${family}`);
    }
  }
});

test('at least three families every time', () => {
  for (const seed of SEEDS) {
    const families = new Set(plan(CH1, seed).picks.map((p) => p.family));
    assert.ok(families.size >= 3, `seed ${seed} used only ${families.size} families`);
  }
});

test('every page gets at least one anomaly', () => {
  for (const seed of SEEDS) {
    const { picks } = plan(CH1, seed);
    for (const page of CH1.pages) {
      assert.ok(picks.some((p) => p.page === page.id), `seed ${seed} left page ${page.id} clean`);
    }
  }
});

test('a forced anomaly is always present', () => {
  for (const seed of SEEDS) {
    const ids = plan(CH1, seed).picks.map((p) => p.id);
    assert.ok(ids.includes('S07'), `seed ${seed} dropped the forced S07`);
  }
});

test('an excluded anomaly never appears', () => {
  const chapter = { ...CH1, force: [], exclude: ['T01', 'S07'] };
  for (const seed of SEEDS) {
    const ids = plan(chapter, seed).picks.map((p) => p.id);
    assert.ok(!ids.includes('T01') && !ids.includes('S07'), `seed ${seed} placed an excluded anomaly`);
  }
});

test('every placed slot actually exists on its page', () => {
  for (const seed of SEEDS) {
    for (const p of plan(CH1, seed).picks) {
      const page = CH1.pages.find((pg) => pg.id === p.page);
      const available = page.slots[p.slot] || 0;
      assert.ok(p.nth < available,
        `seed ${seed} placed ${p.id} on ${p.slot}[${p.nth}] but the page has ${available}`);
    }
  }
});

test('an anomaly is only placed on a slot type it declares', () => {
  for (const seed of SEEDS) {
    for (const p of plan(CH1, seed).picks) {
      assert.ok(byId(p.id).slots.includes(p.slot), `${p.id} does not accept ${p.slot}`);
    }
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test "tests/tham-tu-mang.test.mjs"`
Expected: FAIL — `Cannot find module .../js/engine/director.js`

- [ ] **Step 3: Write the implementation**

Create `games/tham-tu-mang/js/engine/director.js`:

```js
/* Đạo diễn — chọn 5..8 dị thường cho một lượt chơi. Spec §3.3.
   Ràng buộc: ≥3 họ, ≤2 mỗi họ, mỗi phần tử slot chỉ một dị thường, mỗi trang ít nhất một.
   Cách đi vòng tròn qua các họ (round-robin) thoả cả "≤2 mỗi họ" lẫn "≥3 họ" một cách tự
   nhiên, thay vì chọn ngẫu nhiên rồi phải sửa chữa. */

import { mulberry32, range, shuffle } from './rng.js';
import { ANOMALIES, byId } from './registry.js';

function slotBudget(chapter) {
  const budget = new Map();          // "pageId:slotType" -> số phần tử còn trống
  for (const page of chapter.pages) {
    for (const [type, n] of Object.entries(page.slots)) budget.set(`${page.id}:${type}`, n);
  }
  return budget;
}

/** Chọn một chỗ trống cho dị thường này, hoặc null nếu không còn chỗ nào hợp lệ. */
function claimSlot(anomaly, budget, used, rng, preferPage = null) {
  const options = [];
  for (const [key, total] of budget) {
    const [pageId, type] = key.split(':');
    if (preferPage && pageId !== preferPage) continue;
    if (!anomaly.slots.includes(type)) continue;
    const taken = used.get(key) || 0;
    if (taken >= total) continue;
    if (anomaly.needs && (anomaly.needs[type] || 0) > total) continue;
    options.push({ pageId, type, key, nth: taken });
  }
  if (!options.length) return null;
  const chosen = shuffle(rng, options)[0];
  used.set(chosen.key, (used.get(chosen.key) || 0) + 1);
  return chosen;
}

function place(anomaly, budget, used, rng, picks, preferPage = null) {
  const slot = claimSlot(anomaly, budget, used, rng, preferPage);
  if (!slot) return false;
  picks.push({ id: anomaly.id, family: anomaly.family, page: slot.pageId, slot: slot.type, nth: slot.nth });
  return true;
}

export function plan(chapter, seed, registry = ANOMALIES) {
  const rng = mulberry32(seed);
  const count = range(rng, chapter.min, chapter.max);

  const budget = slotBudget(chapter);
  const used = new Map();
  const picks = [];
  const takenIds = new Set();

  const eligible = registry.filter((a) => {
    if (chapter.exclude.includes(a.id)) return false;
    return chapter.pages.some((p) => a.slots.some((s) => (p.slots[s] || 0) > 0));
  });

  // 1. Forced anomalies first — the tutorial depends on S07 being present every time.
  for (const id of chapter.force || []) {
    const a = byId(id);
    if (a && !chapter.exclude.includes(id) && place(a, budget, used, rng, picks)) takenIds.add(id);
  }

  // 2. Round-robin across shuffled families, two passes. One pass guarantees breadth
  //    (>=3 families); the second pass fills to count without exceeding 2 per family.
  const byFamily = new Map();
  for (const a of eligible) {
    if (takenIds.has(a.id)) continue;
    if (!byFamily.has(a.family)) byFamily.set(a.family, []);
    byFamily.get(a.family).push(a);
  }
  const families = shuffle(rng, [...byFamily.keys()]);
  const familyCount = {};
  for (const p of picks) familyCount[p.family] = (familyCount[p.family] || 0) + 1;

  for (let pass = 0; pass < 2 && picks.length < count; pass++) {
    for (const family of families) {
      if (picks.length >= count) break;
      if ((familyCount[family] || 0) >= 2) continue;
      const pool = shuffle(rng, byFamily.get(family));
      for (const a of pool) {
        if (takenIds.has(a.id)) continue;
        if (place(a, budget, used, rng, picks)) {
          takenIds.add(a.id);
          familyCount[family] = (familyCount[family] || 0) + 1;
          break;
        }
      }
    }
  }

  // 3. Every page must carry at least one, or a player can clear a page that was never dirty.
  for (const page of chapter.pages) {
    if (picks.some((p) => p.page === page.id)) continue;
    const spare = shuffle(rng, eligible).find((a) => !takenIds.has(a.id) &&
      (familyCount[a.family] || 0) < 2);
    if (spare && place(spare, budget, used, rng, picks, page.id)) {
      takenIds.add(spare.id);
      familyCount[spare.family] = (familyCount[spare.family] || 0) + 1;
    }
  }

  // `count` is the number ROLLED, not the number placed. Keeping them separate is what lets
  // the test catch under-placement — a director that promises six and places four produces a
  // chapter that cannot be won, and nothing on screen would say so.
  return { seed, count, picks };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test "tests/tham-tu-mang.test.mjs"`
Expected: PASS, 49 tests. Every one of the eleven director tests runs across 500 seeds.

- [ ] **Step 5: Commit**

```bash
git add tests/tham-tu-mang.test.mjs games/tham-tu-mang/js/engine/director.js
git commit -m "$(cat <<'EOF'
feat(tham-tu-mang): seeded director with family and slot constraints

A director that quietly places four anomalies when it promised six produces a
chapter that cannot be won, and nothing on screen would say so. Round-robin over
shuffled families satisfies ">=3 families" and "<=2 per family" by construction
rather than by picking randomly and repairing, and 500 seeds per assertion is what
makes that trustworthy.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Shell, storage and screen routing

**Files:**
- Create: `games/tham-tu-mang/index.html`
- Create: `games/tham-tu-mang/style.css`
- Create: `games/tham-tu-mang/js/storage.js`
- Create: `games/tham-tu-mang/js/state.js`
- Create: `games/tham-tu-mang/js/main.js`
- Create: `games/tham-tu-mang/js/ui/menu.js`
- Modify: `tests/tham-tu-mang.test.mjs`

**Interfaces:**
- Consumes: `CHAPTERS` (Task 4).
- Produces: `storage.load()/save(p)/isMuted()/setMuted(b)/rankFor(id)/recordClear(id, hearts)`
  and `rankOf(hearts)`; `state.newRun(chapter, seed, picks)` returning the mutable run object
  `{ chapter, seed, hearts: 3, found: Set<string>, total: number, page: string, over: false }`;
  `main.boot()` — called from `index.html`, the only entry point.

`boot()` exists so that `main.js` touches no DOM at import time and the Task 1 gate keeps
passing.

- [ ] **Step 1: Write the failing tests**

Only `storage`'s pure ranking logic is unit-testable; the rest is verified by the module-loads
gate plus the manual playtest. Append to `tests/tham-tu-mang.test.mjs`:

```js
import { rankOf } from '../games/tham-tu-mang/js/storage.js';

test('rank is derived from hearts remaining', () => {
  assert.strictEqual(rankOf(3), 'S');
  assert.strictEqual(rankOf(2), 'A');
  assert.strictEqual(rankOf(1), 'B');
  assert.strictEqual(rankOf(0), '—');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test "tests/tham-tu-mang.test.mjs"`
Expected: FAIL — `Cannot find module .../js/storage.js`

- [ ] **Step 3: Write storage**

Create `games/tham-tu-mang/js/storage.js`:

```js
/* localStorage. Mọi truy cập đều bọc try/catch — chế độ riêng tư ném lỗi khi ghi. */

const KEY_PROGRESS = 'thamTuMang.progress';
const KEY_MUTED = 'thamTuMang.muted';

export function rankOf(hearts) {
  if (hearts >= 3) return 'S';
  if (hearts === 2) return 'A';
  if (hearts === 1) return 'B';
  return '—';
}

export function load() {
  try { return JSON.parse(localStorage.getItem(KEY_PROGRESS)) ?? {}; } catch { return {}; }
}

export function save(progress) {
  try { localStorage.setItem(KEY_PROGRESS, JSON.stringify(progress)); } catch { /* private mode */ }
}

export function rankFor(chapterId) {
  return load()[chapterId]?.rank ?? '—';
}

export function recordClear(chapterId, hearts) {
  const progress = load();
  const rank = rankOf(hearts);
  const prev = progress[chapterId];
  const order = { '—': 0, B: 1, A: 2, S: 3 };
  if (!prev || order[rank] > order[prev.rank]) progress[chapterId] = { rank, hearts };
  save(progress);
  return rank;
}

export function isMuted() {
  try { return localStorage.getItem(KEY_MUTED) === '1'; } catch { return false; }
}

export function setMuted(on) {
  try { localStorage.setItem(KEY_MUTED, on ? '1' : '0'); } catch { /* private mode */ }
}
```

- [ ] **Step 4: Write state**

Create `games/tham-tu-mang/js/state.js`:

```js
/* Trạng thái một lượt chơi. Chỉ run.js được phép thay đổi hearts/found — dị thường thì không
   (spec §3.5): ctx.observe là kênh một chiều. */

export function newRun(chapter, seed, picks) {
  return {
    chapter,
    seed,
    hearts: 3,
    total: picks.length,
    found: new Set(),
    page: chapter.pages[0].id,
    over: false,
    won: false
  };
}

/** Read-only view handed to anomalies through ctx.observe. */
export function observerFor(run) {
  return {
    get hearts() { return run.hearts; },
    get found() { return run.found.size; },
    get total() { return run.total; }
  };
}
```

- [ ] **Step 5: Write the shell markup**

Create `games/tham-tu-mang/index.html`:

```html
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Thám tử mạng</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
  <header id="hud" hidden>
    <a class="hud-back" href="../../index.html" title="Về hub">◄</a>
    <div class="hud-title"><span id="hud-chapter"></span></div>
    <div class="hud-hearts" id="hud-hearts" aria-label="Máu"></div>
    <div class="hud-evidence">BẰNG CHỨNG <b id="hud-found">0</b>/<b id="hud-total">0</b></div>
    <button id="mode-toggle" class="hud-mode" type="button" aria-pressed="false">CHẾ ĐỘ KHOANH</button>
    <button id="mute" class="hud-mute" type="button" title="Tắt/bật tiếng">♪</button>
  </header>

  <main id="screen"></main>

  <div id="viewport-wrap" hidden>
    <div id="viewport"></div>
    <canvas id="lasso"></canvas>
  </div>

  <div id="toast" role="status" aria-live="polite"></div>
  <div id="overlay" hidden></div>

<script type="module">
  import { boot } from './js/main.js';
  boot();
</script>
</body>
</html>
```

- [ ] **Step 6: Write the stylesheet**

Create `games/tham-tu-mang/style.css`. This styles **only** the detective chrome — the fake
sites bring their own CSS inside the shadow root and must never be affected by anything here:

```css
/* Chrome của trò chơi. KHÔNG bao giờ chạm tới trang web giả — trang giả sống trong shadow
   root với style riêng của nó. */

:root {
  --ink: #0d1117;
  --paper: #e9e5df;
  --evidence: #4fa88b;
  --alarm: #d4553f;
  --dim: #8b8580;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--ink);
  color: var(--paper);
  font: 14px/1.5 "Segoe UI", system-ui, sans-serif;
}

/* ── HUD ───────────────────────────────────────────────────────────── */
#hud {
  position: fixed; inset: 0 0 auto 0; z-index: 40;
  display: flex; align-items: center; gap: 16px;
  padding: 8px 14px;
  background: rgba(13, 17, 23, 0.96);
  border-bottom: 1px solid #232a33;
}
.hud-back { color: var(--dim); text-decoration: none; font-size: 18px; }
.hud-back:hover { color: var(--paper); }
.hud-title { font-weight: 600; letter-spacing: 0.04em; }
.hud-hearts { letter-spacing: 2px; color: var(--alarm); font-size: 16px; }
.hud-evidence { margin-left: auto; color: var(--dim); letter-spacing: 0.08em; font-size: 12px; }
.hud-evidence b { color: var(--evidence); }

.hud-mode {
  padding: 6px 12px; border: 1px solid #2f3742; border-radius: 3px;
  background: transparent; color: var(--dim);
  font: inherit; font-size: 12px; letter-spacing: 0.08em; cursor: pointer;
}
.hud-mode[aria-pressed="true"] {
  background: var(--evidence); border-color: var(--evidence); color: var(--ink); font-weight: 600;
}
.hud-mute { background: none; border: 0; color: var(--dim); cursor: pointer; font-size: 16px; }

/* ── Khung trang web giả ───────────────────────────────────────────── */
#viewport-wrap { position: relative; margin-top: 41px; }
#viewport { background: #fff; min-height: calc(100vh - 41px); }

#lasso {
  position: fixed; inset: 41px 0 0 0; z-index: 30;
  pointer-events: none;
}
body.capture #lasso { pointer-events: auto; cursor: crosshair; }
body.capture #viewport { user-select: none; }

/* Vignette — chế độ khoanh không bao giờ mơ hồ. */
body.capture #viewport-wrap::after {
  content: ""; position: fixed; inset: 41px 0 0 0; z-index: 29; pointer-events: none;
  box-shadow: inset 0 0 120px 20px rgba(13, 17, 23, 0.45);
}

/* ── Menu / màn hình ──────────────────────────────────────────────── */
#screen { max-width: 760px; margin: 0 auto; padding: 60px 20px; }
.menu-title { font-size: 30px; letter-spacing: 0.14em; margin: 0 0 6px; }
.menu-sub { color: var(--dim); margin: 0 0 34px; }

.case {
  display: flex; align-items: center; gap: 14px; width: 100%;
  padding: 14px 16px; margin-bottom: 10px;
  background: #141a21; border: 1px solid #232a33; border-radius: 4px;
  color: var(--paper); font: inherit; text-align: left; cursor: pointer;
}
.case:hover { border-color: var(--evidence); }
.case-no { color: var(--dim); font-variant-numeric: tabular-nums; }
.case-name { font-weight: 600; }
.case-sub { color: var(--dim); font-size: 12px; }
.case-rank { margin-left: auto; color: var(--evidence); font-weight: 700; }

/* ── Toast ────────────────────────────────────────────────────────── */
#toast {
  position: fixed; left: 50%; bottom: 32px; transform: translateX(-50%);
  z-index: 50; padding: 9px 18px; border-radius: 3px;
  background: rgba(13, 17, 23, 0.95); border: 1px solid #2f3742;
  letter-spacing: 0.08em; font-size: 13px;
  opacity: 0; transition: opacity 0.18s;
}
#toast.show { opacity: 1; }
#toast.good { border-color: var(--evidence); color: var(--evidence); }
#toast.bad { border-color: var(--alarm); color: var(--alarm); }
#toast.void { border-color: #2f3742; color: var(--dim); }

/* ── Overlay ──────────────────────────────────────────────────────── */
#overlay {
  position: fixed; inset: 0; z-index: 60;
  display: flex; align-items: center; justify-content: center;
  background: rgba(13, 17, 23, 0.92); padding: 20px;
}
.sheet {
  max-width: 480px; background: #141a21; border: 1px solid #2f3742;
  border-radius: 5px; padding: 26px 28px;
}
.sheet h2 { margin: 0 0 12px; letter-spacing: 0.1em; }
.sheet p { color: #c9c4bd; }
.sheet button {
  margin-top: 18px; padding: 9px 18px; border: 0; border-radius: 3px;
  background: var(--evidence); color: var(--ink); font: inherit; font-weight: 600; cursor: pointer;
}
```

- [ ] **Step 7: Write the menu and the entry point**

Create `games/tham-tu-mang/js/ui/menu.js`:

```js
/* Kho hồ sơ. Stage 3 thêm khoá chương và hiển thị hạng đầy đủ. */

import { CHAPTERS } from '../chapters/index.js';
import { rankFor } from '../storage.js';

export function renderMenu(host, onPick) {
  host.innerHTML = `
    <h1 class="menu-title">THÁM TỬ MẠNG</h1>
    <p class="menu-sub">Mở một trang web. Tìm những thứ không nên ở đó. Ba trái tim.</p>
    <div id="cases"></div>`;

  const list = host.querySelector('#cases');
  CHAPTERS.forEach((chapter, i) => {
    const button = document.createElement('button');
    button.className = 'case';
    button.type = 'button';
    button.innerHTML = `
      <span class="case-no">HỒ SƠ ${String(i + 1).padStart(2, '0')}</span>
      <span>
        <span class="case-name">${chapter.title}</span><br>
        <span class="case-sub">${chapter.subtitle}</span>
      </span>
      <span class="case-rank">${rankFor(chapter.id)}</span>`;
    button.addEventListener('click', () => onPick(chapter));
    list.appendChild(button);
  });
}
```

Create `games/tham-tu-mang/js/main.js`:

```js
/* Điểm vào duy nhất. boot() được gọi từ index.html — không đụng DOM ở tầng import,
   nếu không bộ test "every module imports" sẽ hỏng. */

import { renderMenu } from './ui/menu.js';
import { isMuted, setMuted } from './storage.js';

export function boot() {
  const screen = document.getElementById('screen');
  const mute = document.getElementById('mute');

  mute.textContent = isMuted() ? '♪̸' : '♪';
  mute.addEventListener('click', () => {
    setMuted(!isMuted());
    mute.textContent = isMuted() ? '♪̸' : '♪';
  });

  showMenu();

  function showMenu() {
    document.getElementById('hud').hidden = true;
    document.getElementById('viewport-wrap').hidden = true;
    document.getElementById('overlay').hidden = true;
    screen.hidden = false;
    renderMenu(screen, startChapter);
  }

  /** Task 10 replaces this stub with the real run. */
  function startChapter(chapter) {
    console.log('start', chapter.id);
  }
}
```

- [ ] **Step 8: Run the suite**

Run: `node --test "tests/*.test.mjs"`
Expected: PASS, 50 tests. The module-loads gate now covers `main.js`, `menu.js`, `state.js` and
`storage.js` — if any of them touched the DOM at import time, this is where it would surface.

- [ ] **Step 9: Verify it loads in a browser**

Run: `npx serve -l 8000 .` (there is no `python3` on this machine).
Open `http://localhost:8000/games/tham-tu-mang/`.
Expected: the case archive lists **HỒ SƠ 01 · LUMIÈRE** with rank `—`. Clicking it logs
`start ch1-lumiere` to the console. No errors in the console.

- [ ] **Step 10: Commit**

```bash
git add games/tham-tu-mang/index.html games/tham-tu-mang/style.css games/tham-tu-mang/js/ tests/tham-tu-mang.test.mjs
git commit -m "$(cat <<'EOF'
feat(tham-tu-mang): shell, storage and the case archive

boot() is exported and called from index.html rather than running on import, so the
module-loads test can keep proving that nothing in this game touches the DOM before
it is asked to.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: The LUMIÈRE site and the shadow-root mount

**Files:**
- Create: `games/tham-tu-mang/sites/ch1-lumiere/page.js`
- Create: `games/tham-tu-mang/sites/ch1-lumiere/site.css`
- Create: `games/tham-tu-mang/js/engine/site.js`
- Modify: `tests/tham-tu-mang.test.mjs`

**Interfaces:**
- Consumes: `imgHtml` (Task 3).
- Produces: `PAGE_INDEX = { id: 'index', html: string, css: 'site.css' }` from `page.js`;
  and from `site.js`: `mount(host, page, cssHref) -> ShadowRoot`,
  `slotElement(shadow, type, nth) -> Element | null`,
  `targets(shadow) -> {id, anomaly, cx, cy}[]` — the array Task 10 feeds to `nearestEnclosed`.

`targets()` is the bridge between the DOM and the pure geometry: it reads
`getBoundingClientRect()` and hands `hittest.js` plain numbers.

- [ ] **Step 1: Write the failing tests**

The site module is pure data, so its slot inventory can be asserted against the chapter's
declaration — this is what catches a page that promises four paragraphs and ships three.
Append to `tests/tham-tu-mang.test.mjs`:

```js
import { PAGE_INDEX } from '../games/tham-tu-mang/sites/ch1-lumiere/page.js';

function slotCounts(html) {
  const counts = {};
  for (const m of html.matchAll(/data-slot="([^"]+)"/g)) {
    counts[m[1]] = (counts[m[1]] || 0) + 1;
  }
  return counts;
}

test('the LUMIÈRE page ships exactly the slots chapter 1 declares', () => {
  assert.deepStrictEqual(slotCounts(PAGE_INDEX.html), CH1.pages[0].slots);
});

test('the page marks ordinary content as catchable', () => {
  const catches = [...PAGE_INDEX.html.matchAll(/data-catch/g)].length;
  assert.ok(catches >= 10, `only ${catches} data-catch elements — wrong captures need targets`);
});

test('every image on the page is pinned', () => {
  for (const m of PAGE_INDEX.html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    assert.ok(isPinned(m[1]), `unpinned image src: ${m[1]}`);
  }
});

test('every image carries an onerror fallback', () => {
  const imgs = [...PAGE_INDEX.html.matchAll(/<img[^>]*>/g)];
  assert.ok(imgs.length > 0, 'the page has no images at all');
  for (const [tag] of imgs) {
    assert.match(tag, /onerror=/, `image without a fallback: ${tag}`);
  }
});

test('the page makes no network request other than images', () => {
  assert.ok(!/<script/i.test(PAGE_INDEX.html), 'site markup must not carry scripts');
  assert.ok(!/<link[^>]+href="http/i.test(PAGE_INDEX.html), 'no remote stylesheets');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test "tests/tham-tu-mang.test.mjs"`
Expected: FAIL — `Cannot find module .../sites/ch1-lumiere/page.js`

- [ ] **Step 3: Write the site markup**

Create `games/tham-tu-mang/sites/ch1-lumiere/page.js`. Every `data-slot` count must match
`CH1.pages[0].slots` exactly or the test above fails:

```js
/* Trang bán hàng LUMIÈRE — bản SẠCH. Không có dị thường nào ở đây; đạo diễn sẽ thêm vào
   lúc chạy. data-slot = chỗ dị thường có thể bám. data-catch = nội dung bình thường mà
   khoanh nhầm vào thì mất máu. */

import { flickr, imgHtml } from '../../js/engine/img.js';

const TINT = '#d8c3b0';
const photo = (kw, lock, alt, w, h) =>
  imgHtml({ src: flickr({ w, h, kw, lock }), alt, w, h, tint: TINT });

export const PAGE_INDEX = {
  id: 'index',
  css: 'site.css',
  html: `
<header class="bar">
  <span class="brand" data-catch>LUMIÈRE</span>
  <nav data-slot="nav" data-catch>
    <a href="#">TRANG CHỦ</a><a href="#">SẢN PHẨM</a><a href="#">CÂU CHUYỆN</a><a href="#">LIÊN HỆ</a>
  </nav>
</header>

<section class="hero">
  <div class="hero-copy">
    <h1 data-slot="hero-title" data-catch>Dưỡng ẩm 72 giờ,<br>nhẹ như không có gì</h1>
    <p data-slot="paragraph" data-catch>
      Chiết xuất hoa cúc La Mã và dầu hạt nho ép lạnh. Không cồn, không hương liệu,
      không màu tổng hợp. Thẩm thấu trong 40 giây.
    </p>
    <div class="price" data-slot="price" data-catch>340.000₫ <s>420.000₫</s></div>
    <button class="buy" data-slot="cta" data-catch>THÊM VÀO GIỎ</button>
  </div>
  <figure class="hero-shot">
    ${photo('skincare,cream', 21, 'Hũ kem dưỡng ẩm LUMIÈRE', 520, 380)}
    <figcaption data-slot="photo" data-catch>LUMIÈRE Crème Originelle, 50ml</figcaption>
  </figure>
</section>

<section class="features">
  <div class="feat"><span class="ico" data-slot="feature-icon" data-catch>✨</span>
    <b data-catch>Cấp ẩm tức thì</b><span data-catch>Giữ nước suốt 72 giờ</span></div>
  <div class="feat"><span class="ico" data-slot="feature-icon" data-catch>🌿</span>
    <b data-catch>Thành phần thực vật</b><span data-catch>92% nguồn gốc tự nhiên</span></div>
  <div class="feat"><span class="ico" data-slot="feature-icon" data-catch>💧</span>
    <b data-catch>Không gây bít tắc</b><span data-catch>Đã kiểm nghiệm da liễu</span></div>
</section>

<section class="ingredients">
  <h2 data-catch>Trong hũ có gì</h2>
  <p data-slot="paragraph" data-catch>
    Mỗi mẻ được ủ trong 11 ngày tại xưởng nhỏ của chúng tôi ở Đà Lạt. Chúng tôi không sản
    xuất nhiều hơn số lượng có thể tự tay kiểm tra.
  </p>
  <div class="ing-grid">
    <figure>${photo('chamomile', 34, 'Hoa cúc La Mã', 300, 220)}
      <figcaption data-slot="photo" data-catch>Hoa cúc La Mã, thu hoạch tháng 3</figcaption></figure>
    <figure>${photo('grapeseed,oil', 55, 'Dầu hạt nho', 300, 220)}
      <figcaption data-slot="photo" data-catch>Dầu hạt nho ép lạnh</figcaption></figure>
    <figure>${photo('laboratory,glass', 68, 'Xưởng bào chế', 300, 220)}
      <figcaption data-slot="photo" data-catch>Xưởng bào chế tại Đà Lạt</figcaption></figure>
  </div>
</section>

<section class="voices">
  <h2 data-catch>Khách hàng nói gì</h2>
  <p data-slot="paragraph" data-catch>
    Hơn 4.000 người đã dùng LUMIÈRE trong hai năm qua. Chúng tôi đọc từng lá thư gửi về.
  </p>
  <figure class="voice">
    ${photo('portrait,woman', 12, 'Chân dung khách hàng', 96, 96)}
    <figcaption data-slot="avatar" data-catch><b>Ngọc Anh</b>, 28<br>
      <span data-catch>“Da mình vốn rất khô. Dùng ba tuần thì hết bong.”</span></figcaption>
  </figure>
  <figure class="voice">
    ${photo('portrait,person', 47, 'Chân dung khách hàng', 96, 96)}
    <figcaption data-slot="avatar" data-catch><b>Thu Hà</b>, 41<br>
      <span data-catch>“Không mùi, đúng thứ mình cần.”</span></figcaption>
  </figure>
</section>

<section class="faq" data-slot="faq" data-catch>
  <h2 data-catch>Câu hỏi thường gặp</h2>
  <details><summary data-catch>Dùng được cho da nhạy cảm không?</summary>
    <p data-slot="paragraph" data-catch>Được. Sản phẩm không chứa cồn khô và hương liệu tổng
      hợp, đã kiểm nghiệm trên da nhạy cảm trong 4 tuần.</p></details>
  <details><summary data-catch>Bao lâu thì dùng hết một hũ?</summary>
    <p data-catch>Khoảng 8 tuần nếu dùng hai lần mỗi ngày.</p></details>
</section>

<section class="news" data-slot="newsletter" data-catch>
  <h2 data-catch>Nhận thư của chúng tôi</h2>
  <form class="news-form">
    <input type="email" placeholder="Email của bạn" aria-label="Email" data-catch>
    <button type="submit" data-catch>ĐĂNG KÝ</button>
  </form>
  <p class="news-note" data-catch>Mỗi tháng một lá. Huỷ bất cứ lúc nào.</p>
</section>

<footer data-slot="footer" data-catch>
  <span>© 2026 LUMIÈRE · Đà Lạt, Lâm Đồng</span>
  <span>Chăm sóc khách hàng: 1900 8386</span>
</footer>`
};
```

- [ ] **Step 4: Write the site stylesheet**

Create `games/tham-tu-mang/sites/ch1-lumiere/site.css`. Plain selectors are safe — this file is
linked **inside** the shadow root and cannot reach the HUD:

```css
/* LUMIÈRE — style riêng của trang giả. File này được nạp BÊN TRONG shadow root nên các
   selector trần như h1 {} không bao giờ chạm tới chrome của trò chơi. */

:host { display: block; }

* { box-sizing: border-box; }

:host {
  --cream: #faf6f1;
  --rose: #b98a86;
  --ink: #3a3330;
  font: 15px/1.65 Georgia, "Times New Roman", serif;
  color: var(--ink);
  background: var(--cream);
}

.bar {
  display: flex; align-items: center; gap: 30px;
  padding: 18px 40px; border-bottom: 1px solid #e6ddd4;
}
.brand { font-size: 21px; letter-spacing: 0.3em; }
nav { display: flex; gap: 22px; margin-left: auto; }
nav a { color: #6f635d; text-decoration: none; font-size: 12px; letter-spacing: 0.12em; }

.hero { display: flex; gap: 40px; align-items: center; padding: 60px 40px; }
.hero-copy { flex: 1; }
.hero h1 { font-size: 38px; line-height: 1.2; font-weight: 400; margin: 0 0 16px; }
.price { font-size: 22px; margin: 22px 0 18px; }
.price s { color: #a89c94; font-size: 15px; margin-left: 8px; }
.buy {
  padding: 12px 26px; border: 0; background: var(--rose); color: #fff;
  letter-spacing: 0.14em; font-size: 13px; cursor: pointer;
}
.hero-shot { margin: 0; flex: 1; }
.hero-shot img { width: 100%; height: auto; display: block; }

.features { display: flex; gap: 30px; padding: 40px; background: #f4ece5; }
.feat { flex: 1; text-align: center; }
.feat .ico { font-size: 26px; display: block; margin-bottom: 8px; }
.feat b { display: block; margin-bottom: 4px; }
.feat span { color: #6f635d; font-size: 13px; }

.ingredients, .voices, .faq, .news { padding: 50px 40px; }
h2 { font-weight: 400; font-size: 24px; margin: 0 0 18px; }
.ing-grid { display: flex; gap: 20px; }
.ing-grid figure { margin: 0; flex: 1; }
.ing-grid img { width: 100%; height: auto; display: block; }
figcaption { font-size: 12px; color: #6f635d; margin-top: 7px; }

.voices { background: #f4ece5; }
.voice { display: flex; gap: 16px; align-items: center; margin: 0 0 22px; }
.voice img { border-radius: 50%; }

details { border-bottom: 1px solid #e6ddd4; padding: 12px 0; }
summary { cursor: pointer; }

.news-form { display: flex; gap: 8px; max-width: 420px; }
.news-form input { flex: 1; padding: 10px; border: 1px solid #ddd0c6; font: inherit; }
.news-form button { padding: 10px 18px; border: 0; background: var(--ink); color: #fff; cursor: pointer; }
.news-note { font-size: 12px; color: #6f635d; }

footer {
  display: flex; justify-content: space-between; gap: 20px;
  padding: 26px 40px; border-top: 1px solid #e6ddd4;
  font-size: 12px; color: #6f635d;
}
```

- [ ] **Step 5: Write the mount**

Create `games/tham-tu-mang/js/engine/site.js`:

```js
/* Gắn trang giả vào shadow root. Vì sao shadow root: CSS của trang giả dùng selector trần
   (h1 {}, nav a {}) mà không được phép chạm tới HUD. Vì sao KHÔNG dùng elementFromPoint để
   dò trúng: nó không xuyên qua ranh giới shadow — ta đọc rect của các phần tử đã biết. */

export function mount(host, page, baseHref) {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<link rel="stylesheet" href="${baseHref}${page.css}">${page.html}`;
  return shadow;
}

export function slotElement(shadow, type, nth) {
  const all = shadow.querySelectorAll(`[data-slot="${type}"]`);
  return all[nth] ?? null;
}

/**
 * Every element the lasso can resolve against, as plain numbers for hittest.js.
 * A captured anomaly stays in the list so re-circling it is a no-op rather than a heart.
 */
export function targets(shadow) {
  const out = [];
  let n = 0;
  for (const el of shadow.querySelectorAll('[data-anom], [data-catch]')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;      // hidden markers are not targets
    out.push({
      id: el.dataset.anom ? `anom:${el.dataset.anom}:${n++}` : `catch:${n++}`,
      anomaly: Boolean(el.dataset.anom),
      anomId: el.dataset.anom ?? null,
      el,
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2
    });
  }
  return out;
}
```

- [ ] **Step 6: Run to verify pass**

Run: `node --test "tests/tham-tu-mang.test.mjs"`
Expected: PASS, 55 tests. If the slot-count test fails, the page's `data-slot` attributes and
`CH1.pages[0].slots` disagree — fix the page, not the test.

- [ ] **Step 7: Commit**

```bash
git add games/tham-tu-mang/sites/ games/tham-tu-mang/js/engine/site.js tests/tham-tu-mang.test.mjs
git commit -m "$(cat <<'EOF'
feat(tham-tu-mang): the clean LUMIERE site and its shadow-root mount

Asserting the page's data-slot counts against the chapter's declaration catches the
failure that would otherwise be invisible: a director placing an anomaly on
paragraph[3] of a page that only ships three paragraphs, which silently drops an
anomaly and makes the chapter unwinnable.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: The two modes and the lasso

**Files:**
- Create: `games/tham-tu-mang/js/ui/mode.js`
- Create: `games/tham-tu-mang/js/ui/lasso.js`
- Create: `games/tham-tu-mang/js/ui/toast.js`

**Interfaces:**
- Consumes: `strokeVerdict`, `MAX_W`, `MAX_H` (Task 2).
- Produces: `initMode(button) -> { isCapture(), set(on), toggle() }`;
  `initLasso(canvas, mode, onStroke)` where `onStroke(points, verdict)` fires on release;
  `toast(message, kind)` with `kind` one of `'good' | 'bad' | 'void'`.

- [ ] **Step 1: Write the mode toggle**

Create `games/tham-tu-mang/js/ui/mode.js`:

```js
/* Hai chế độ. CHẾ ĐỘ ĐỌC là mặc định và không bao giờ mất máu — mọi thử nghiệm sống ở đó.
   Tách hai động tác không chỉ là tiện: nếu kéo chuột lúc nào cũng nghĩa là "khoanh" thì
   người chơi không thể bôi đen chữ, và S03 (chọn chữ để lộ chữ ẩn) sẽ không thể tìm ra. */

export function initMode(button) {
  let capture = false;

  function set(on) {
    capture = on;
    document.body.classList.toggle('capture', capture);
    button.setAttribute('aria-pressed', String(capture));
    button.textContent = capture ? 'ĐANG KHOANH' : 'CHẾ ĐỘ KHOANH';
  }

  button.addEventListener('click', () => set(!capture));
  set(false);

  return { isCapture: () => capture, set, toggle: () => set(!capture) };
}
```

- [ ] **Step 2: Write the toast**

Create `games/tham-tu-mang/js/ui/toast.js`:

```js
let timer = null;

export function toast(message, kind = 'void') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `show ${kind}`;
  clearTimeout(timer);
  timer = setTimeout(() => { el.className = ''; }, 1600);
}
```

- [ ] **Step 3: Write the lasso**

Create `games/tham-tu-mang/js/ui/lasso.js`:

```js
/* Vẽ vòng khoanh. Vòng tròn ngân sách (budget ring) hiện ra ngay từ pixel đầu tiên, nên
   giới hạn kích thước được truyền đạt bằng chính nét vẽ chứ không phải bằng hình phạt. */

import { strokeVerdict, MAX_W, MAX_H, bounds } from '../engine/hittest.js';

export function initLasso(canvas, mode, onStroke) {
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let points = [];
  let anchor = null;

  function resize() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function draw() {
    clear();
    if (!anchor) return;

    // Budget ring — how large this loop is allowed to get.
    ctx.save();
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = 'rgba(233, 229, 223, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(anchor.x - MAX_W / 2, anchor.y - MAX_H / 2, MAX_W, MAX_H);
    ctx.restore();

    if (points.length < 2) return;
    const over = bounds(points).w > MAX_W || bounds(points).h > MAX_H;
    ctx.save();
    ctx.strokeStyle = over ? '#d4553f' : '#4fa88b';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (!mode.isCapture()) return;
    drawing = true;
    anchor = local(e);
    points = [anchor];
    canvas.setPointerCapture(e.pointerId);
    draw();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    points.push(local(e));
    draw();
  });

  function finish(e) {
    if (!drawing) return;
    drawing = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* already gone */ }

    const stroke = points;
    const verdict = strokeVerdict(stroke);
    points = [];
    anchor = null;
    clear();

    // Points are canvas-local; the canvas is fixed at the viewport top, so add its offset
    // back before handing them to code that compares against getBoundingClientRect().
    const r = canvas.getBoundingClientRect();
    onStroke(stroke.map((p) => ({ x: p.x + r.left, y: p.y + r.top })), verdict);
  }

  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);
}
```

- [ ] **Step 4: Run the suite**

Run: `node --test "tests/*.test.mjs"`
Expected: PASS, still 55 tests — these three modules are covered by the module-loads gate.

- [ ] **Step 5: Commit**

```bash
git add games/tham-tu-mang/js/ui/
git commit -m "$(cat <<'EOF'
feat(tham-tu-mang): read/capture modes, the lasso and toasts

Dragging cannot mean both "select text" and "draw a loop". Putting circling behind
its own mode is what keeps text selection available to the player, without which
S03 would be undiscoverable.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: The run — hearts, captures, win and loss

**Files:**
- Create: `games/tham-tu-mang/js/engine/run.js`
- Create: `games/tham-tu-mang/js/ui/hud.js`
- Create: `games/tham-tu-mang/js/ui/overlay.js`
- Create: `games/tham-tu-mang/js/audio.js`
- Modify: `games/tham-tu-mang/js/main.js`
- Modify: `tests/tham-tu-mang.test.mjs`

**Interfaces:**
- Consumes: `nearestEnclosed` (Task 2), `newRun`/`observerFor` (Task 7), `targets` (Task 8),
  `toast` (Task 9), `recordClear`/`rankOf` (Task 7).
- Produces: `resolve(run, stroke, verdict, targetList) -> { outcome, anomId? }` with `outcome`
  one of `'CAPTURED' | 'ALREADY' | 'WRONG' | 'TOO_SMALL' | 'TOO_BIG'`;
  `renderHud(run)`; `showOverlay({ title, body, cta, onCta })`; `beep(kind)`.

`resolve` is pure — it takes the target list rather than reading the DOM — so the heart rules
are unit-tested without a browser.

- [ ] **Step 1: Write the failing tests**

Append to `tests/tham-tu-mang.test.mjs`:

```js
import { resolve } from '../games/tham-tu-mang/js/engine/run.js';
import { newRun } from '../games/tham-tu-mang/js/state.js';

const box = (x, y, s) => [
  { x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }
];
const runWith = (total) => newRun(CH1, 1, Array.from({ length: total }, (_, i) => ({ id: `A${i}` })));

test('circling an anomaly logs evidence and keeps every heart', () => {
  const run = runWith(3);
  const targets = [{ id: 't1', anomaly: true, anomId: 'T01', cx: 50, cy: 50 }];
  const r = resolve(run, box(0, 0, 100), 'OK', targets);
  assert.strictEqual(r.outcome, 'CAPTURED');
  assert.strictEqual(run.hearts, 3);
  assert.strictEqual(run.found.size, 1);
});

test('circling ordinary content costs a heart', () => {
  const run = runWith(3);
  const targets = [{ id: 't1', anomaly: false, anomId: null, cx: 50, cy: 50 }];
  const r = resolve(run, box(0, 0, 100), 'OK', targets);
  assert.strictEqual(r.outcome, 'WRONG');
  assert.strictEqual(run.hearts, 2);
});

test('circling nothing costs a heart too — an empty circle is a wrong claim', () => {
  const run = runWith(3);
  const r = resolve(run, box(0, 0, 100), 'OK', []);
  assert.strictEqual(r.outcome, 'WRONG');
  assert.strictEqual(run.hearts, 2);
});

test('a stroke below the floor is voided before hit-testing and costs nothing', () => {
  const run = runWith(3);
  const targets = [{ id: 't1', anomaly: false, anomId: null, cx: 5, cy: 5 }];
  const r = resolve(run, box(0, 0, 4), 'TOO_SMALL', targets);
  assert.strictEqual(r.outcome, 'TOO_SMALL');
  assert.strictEqual(run.hearts, 3);
});

test('a stroke past the budget ring is voided and costs nothing', () => {
  const run = runWith(3);
  const targets = [{ id: 't1', anomaly: true, anomId: 'T01', cx: 50, cy: 50 }];
  const r = resolve(run, box(0, 0, 900), 'TOO_BIG', targets);
  assert.strictEqual(r.outcome, 'TOO_BIG');
  assert.strictEqual(run.hearts, 3);
  assert.strictEqual(run.found.size, 0, 'an oversized loop must not capture anything');
});

test('re-circling a found anomaly is a no-op, not a heart', () => {
  const run = runWith(3);
  const targets = [{ id: 't1', anomaly: true, anomId: 'T01', cx: 50, cy: 50 }];
  resolve(run, box(0, 0, 100), 'OK', targets);
  const again = resolve(run, box(0, 0, 100), 'OK', targets);
  assert.strictEqual(again.outcome, 'ALREADY');
  assert.strictEqual(run.hearts, 3);
  assert.strictEqual(run.found.size, 1);
});

test('finding every anomaly wins the run', () => {
  const run = runWith(2);
  resolve(run, box(0, 0, 100), 'OK', [{ id: 'a', anomaly: true, anomId: 'A0', cx: 50, cy: 50 }]);
  assert.strictEqual(run.over, false);
  resolve(run, box(0, 0, 100), 'OK', [{ id: 'b', anomaly: true, anomId: 'A1', cx: 50, cy: 50 }]);
  assert.strictEqual(run.over, true);
  assert.strictEqual(run.won, true);
});

test('losing every heart ends the run', () => {
  const run = runWith(5);
  const miss = [{ id: 'x', anomaly: false, anomId: null, cx: 50, cy: 50 }];
  resolve(run, box(0, 0, 100), 'OK', miss);
  resolve(run, box(0, 0, 100), 'OK', miss);
  assert.strictEqual(run.over, false);
  resolve(run, box(0, 0, 100), 'OK', miss);
  assert.strictEqual(run.hearts, 0);
  assert.strictEqual(run.over, true);
  assert.strictEqual(run.won, false);
});

test('a finished run ignores further strokes', () => {
  const run = runWith(1);
  resolve(run, box(0, 0, 100), 'OK', [{ id: 'a', anomaly: true, anomId: 'A0', cx: 50, cy: 50 }]);
  const after = resolve(run, box(0, 0, 100), 'OK', [{ id: 'x', anomaly: false, anomId: null, cx: 50, cy: 50 }]);
  assert.strictEqual(after.outcome, 'ALREADY');
  assert.strictEqual(run.hearts, 3);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test "tests/tham-tu-mang.test.mjs"`
Expected: FAIL — `Cannot find module .../js/engine/run.js`

- [ ] **Step 3: Write the run rules**

Create `games/tham-tu-mang/js/engine/run.js`:

```js
/* Luật tính điểm. Thuần tuý: nhận sẵn danh sách mục tiêu thay vì tự đọc DOM, nên luật máu
   kiểm thử được mà không cần trình duyệt. Spec §4.3.

   Hai kết quả duy nhất tốn máu: khoanh trúng nội dung sạch, và khoanh không trúng gì.
   Vòng quá nhỏ hoặc quá rộng bị loại TRƯỚC khi dò trúng, nên chúng không hé lộ gì về trang
   và không thể dùng để dò tìm. */

import { nearestEnclosed } from './hittest.js';

export function resolve(run, stroke, verdict, targetList) {
  if (run.over) return { outcome: 'ALREADY' };
  if (verdict === 'TOO_SMALL' || verdict === 'TOO_BIG') return { outcome: verdict };

  const hit = nearestEnclosed(stroke, targetList);

  if (hit && hit.anomaly) {
    if (run.found.has(hit.anomId)) return { outcome: 'ALREADY', anomId: hit.anomId };
    run.found.add(hit.anomId);
    if (run.found.size >= run.total) { run.over = true; run.won = true; }
    return { outcome: 'CAPTURED', anomId: hit.anomId };
  }

  run.hearts -= 1;
  if (run.hearts <= 0) { run.hearts = 0; run.over = true; run.won = false; }
  return { outcome: 'WRONG' };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test "tests/tham-tu-mang.test.mjs"`
Expected: PASS, 64 tests.

- [ ] **Step 5: Write the HUD, overlay and audio**

Create `games/tham-tu-mang/js/ui/hud.js`:

```js
export function renderHud(run) {
  document.getElementById('hud-chapter').textContent = run.chapter.title;
  document.getElementById('hud-hearts').textContent =
    '♥'.repeat(run.hearts) + '♡'.repeat(Math.max(0, 3 - run.hearts));
  document.getElementById('hud-found').textContent = String(run.found.size);
  document.getElementById('hud-total').textContent = String(run.total);
}
```

Create `games/tham-tu-mang/js/ui/overlay.js`:

```js
export function showOverlay({ title, body, cta, onCta }) {
  const host = document.getElementById('overlay');
  host.hidden = false;
  host.innerHTML = `
    <div class="sheet">
      <h2>${title}</h2>
      <div>${body}</div>
      <button type="button">${cta}</button>
    </div>`;
  host.querySelector('button').addEventListener('click', () => {
    host.hidden = true;
    onCta();
  });
}

export function hideOverlay() {
  document.getElementById('overlay').hidden = true;
}
```

Create `games/tham-tu-mang/js/audio.js`:

```js
/* Web Audio synth — không có tệp âm thanh nào, theo quy ước của repo. */

import { isMuted } from './storage.js';

let ac = null;

export function beep(kind) {
  if (isMuted()) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const now = ac.currentTime;

    const tone = { good: 660, bad: 130, void: 300 }[kind] ?? 300;
    osc.type = kind === 'bad' ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(tone, now);
    if (kind === 'good') osc.frequency.exponentialRampToValueAtTime(tone * 1.5, now + 0.12);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  } catch { /* audio is decoration; never let it break a run */ }
}
```

- [ ] **Step 6: Wire the run into main.js**

Replace the `startChapter` stub in `games/tham-tu-mang/js/main.js`. The complete file:

```js
/* Điểm vào duy nhất. boot() được gọi từ index.html — không đụng DOM ở tầng import. */

import { renderMenu } from './ui/menu.js';
import { isMuted, setMuted, recordClear } from './storage.js';
import { plan } from './engine/director.js';
import { mount, targets, slotElement } from './engine/site.js';
import { newRun, observerFor } from './state.js';
import { resolve } from './engine/run.js';
import { initMode } from './ui/mode.js';
import { initLasso } from './ui/lasso.js';
import { toast } from './ui/toast.js';
import { renderHud } from './ui/hud.js';
import { showOverlay } from './ui/overlay.js';
import { beep } from './audio.js';
import { byId } from './engine/registry.js';
import { PAGE_INDEX } from '../sites/ch1-lumiere/page.js';
import { mulberry32 } from './engine/rng.js';

const PAGES = { 'ch1-lumiere': { index: PAGE_INDEX } };

const FEEDBACK = {
  CAPTURED:  ['BẰNG CHỨNG ĐÃ GHI', 'good'],
  WRONG:     ['KHÔNG CÓ GÌ Ở ĐÂY', 'bad'],
  ALREADY:   ['ĐÃ GHI RỒI', 'void'],
  TOO_SMALL: ['VÒNG CHƯA KHÉP', 'void'],
  TOO_BIG:   ['VÙNG KHOANH QUÁ RỘNG', 'void']
};

export function boot() {
  const screen = document.getElementById('screen');
  const hud = document.getElementById('hud');
  const wrap = document.getElementById('viewport-wrap');
  const viewport = document.getElementById('viewport');
  const muteBtn = document.getElementById('mute');

  const mode = initMode(document.getElementById('mode-toggle'));
  let run = null;
  let shadow = null;

  muteBtn.textContent = isMuted() ? '♪̸' : '♪';
  muteBtn.addEventListener('click', () => {
    setMuted(!isMuted());
    muteBtn.textContent = isMuted() ? '♪̸' : '♪';
  });

  initLasso(document.getElementById('lasso'), mode, (stroke, verdict) => {
    if (!run || run.over) return;
    const result = resolve(run, stroke, verdict, targets(shadow));
    const [message, kind] = FEEDBACK[result.outcome];

    if (result.outcome === 'CAPTURED') {
      const el = shadow.querySelector(`[data-anom="${result.anomId}"]`);
      if (el) el.classList.add('evidence-ring');
    }
    toast(message, kind);
    beep(kind);
    renderHud(run);
    if (run.over) finish();
  });

  showMenu();

  function showMenu() {
    hud.hidden = true;
    wrap.hidden = true;
    screen.hidden = false;
    mode.set(false);
    run = null;
    renderMenu(screen, startChapter);
  }

  function startChapter(chapter) {
    const seed = Number(new URLSearchParams(location.search).get('seed')) || Date.now() % 2147483647;
    const built = plan(chapter, seed);

    screen.hidden = true;
    hud.hidden = false;
    wrap.hidden = false;

    // The <link> inside the shadow root resolves against the DOCUMENT, not against this
    // module — so the href is relative to games/tham-tu-mang/index.html, not to js/main.js.
    shadow = mount(viewport, PAGES[chapter.id][chapter.pages[0].id], `./sites/${chapter.slug}/`);
    run = newRun(chapter, seed, built.picks);

    const rng = mulberry32(seed ^ 0x5f3759df);
    for (const pick of built.picks) {
      const slot = slotElement(shadow, pick.slot, pick.nth);
      if (!slot) continue;
      byId(pick.id).apply({
        root: shadow,
        slot,
        rng,
        flavour: chapter.flavour[pick.id],
        mark: (el) => { el.dataset.anom = pick.id; el.setAttribute('data-catch', ''); return el; },
        observe: observerFor(run)
      });
    }

    renderHud(run);
    showOverlay({
      title: 'HỒ SƠ 01 — LUMIÈRE',
      body: `<p>Một trang bán kem dưỡng ẩm. Có <b>${run.total}</b> thứ trên trang này không
             nên ở đó.</p>
             <p><b>CHẾ ĐỘ ĐỌC</b> là mặc định: cuộn, bấm, gõ, bôi đen chữ — không mất máu.</p>
             <p>Bấm <b>CHẾ ĐỘ KHOANH</b> rồi kéo một vòng quanh thứ đáng ngờ. Khoanh trúng nội
             dung bình thường <b>hoặc khoanh vào khoảng trống</b> đều mất một trái tim.</p>`,
      cta: 'MỞ HỒ SƠ',
      onCta: () => {}
    });
  }

  function finish() {
    mode.set(false);
    const rank = run.won ? recordClear(run.chapter.id, run.hearts) : '—';
    showOverlay({
      title: run.won ? 'HOÀN THÀNH' : 'THẤT BẠI',
      body: run.won
        ? `<p>Bạn tìm được cả ${run.total} dấu vết. Còn ${run.hearts} trái tim.</p>
           <p>Hạng: <b>${rank}</b></p>`
        : `<p>Hết máu. Bạn mới tìm được ${run.found.size}/${run.total}.</p>
           <p>Lần sau trang web sẽ khác.</p>`,
      cta: 'VỀ KHO HỒ SƠ',
      onCta: showMenu
    });
  }
}
```

- [ ] **Step 7: Add the evidence ring to the site stylesheet**

Append to `games/tham-tu-mang/sites/ch1-lumiere/site.css`:

```css
/* Vòng bằng chứng — đánh dấu thứ đã khoanh đúng, để người chơi thấy mình đã báo cáo gì. */
.evidence-ring {
  outline: 2px solid #4fa88b;
  outline-offset: 3px;
  border-radius: 2px;
}
```

- [ ] **Step 8: Run the full suite**

Run: `node --test "tests/*.test.mjs"`
Expected: PASS, 64 tests.

- [ ] **Step 9: Verify the loop in a browser**

Run `npx serve -l 8000 .`, open `http://localhost:8000/games/tham-tu-mang/?seed=4242`.
Check, in order:
1. The briefing overlay names a total between 5 and 6.
2. Dismiss it. The LUMIÈRE page renders with photographs and the HUD shows `♥♥♥` and `0/N`.
3. In read mode, dragging across a headline **selects text** — it does not draw.
4. Press `CHẾ ĐỘ KHOANH`. The button fills green, the page takes a vignette, the cursor is a
   crosshair.
5. Press and hold: a dashed budget ring appears. Draw past it — the stroke turns red, and
   releasing says `VÙNG KHOANH QUÁ RỘNG` with **no** heart lost.
6. Circle an ordinary paragraph: `KHÔNG CÓ GÌ Ở ĐÂY`, hearts drop to `♥♥♡`.
7. Circle empty margin: also `KHÔNG CÓ GÌ Ở ĐÂY`, hearts drop again.
8. Lose the third heart: the `THẤT BẠI` overlay appears and returns you to the archive.

The anomalies themselves are still no-ops until Task 11, so nothing is capturable yet —
`0/N` is expected to stay at zero, and the run can only be lost. That is the point of this
checkpoint: the failure path is verified before the success path exists.

- [ ] **Step 10: Commit**

```bash
git add games/tham-tu-mang/ tests/tham-tu-mang.test.mjs
git commit -m "$(cat <<'EOF'
feat(tham-tu-mang): hearts, capture resolution and the run lifecycle

resolve() takes a target list rather than reading the DOM, so the rules that decide
whether a player loses a heart are unit-tested without a browser. Oversized and
degenerate strokes are rejected before hit-testing runs, so neither can be used to
probe where the anomalies are not.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: The thirteen anomalies

**Files:**
- Modify: `games/tham-tu-mang/js/anomalies/text.js`, `style.js`, `motion.js`, `element.js`,
  `reactive.js`, `image.js`
- Modify: `games/tham-tu-mang/sites/ch1-lumiere/site.css`
- Modify: `tests/tham-tu-mang.test.mjs`

**Interfaces:**
- Consumes: `ctx = { root, slot, rng, flavour, mark, observe }` (Task 10 supplies it);
  `flickr`, `picsum`, `imgHtml` (Task 3); `pick` (Task 1).
- Produces: no new exports — this task fills in the thirteen `apply()` bodies.

Every `apply` must call `ctx.mark(el)` on whatever it wants the player to be able to circle,
and must not touch `run` state. `ctx.observe` is read-only.

- [ ] **Step 1: Write the failing test for the T03 number ladder**

The descent through number-shapes is pure logic, so it gets a real test. Append to
`tests/tham-tu-mang.test.mjs`:

```js
import { descend, formatVi, renderNumber } from '../games/tham-tu-mang/js/anomalies/text.js';

test('formatVi uses a comma for decimals, never a dot', () => {
  assert.strictEqual(formatVi(8.5), '8,5');
  assert.strictEqual(formatVi(12), '12');
  assert.ok(!formatVi(8.25).includes('.'));
});

test('descend walks the five phases in order and gives up on being a number', () => {
  const seen = [];
  let value = 12;
  for (let step = 0; step < 24; step++) {
    const next = descend(value, step);
    seen.push(next);
    value = typeof next === 'number' ? next : value;
  }
  const asText = seen.map((v) => (typeof v === 'number' ? formatVi(v) : v));

  assert.ok(asText.some((t) => /^\d+$/.test(t)), 'no plain integer phase');
  assert.ok(asText.some((t) => t.includes(',')), 'no fractional phase');
  assert.ok(asText.some((t) => t.startsWith('-') || t.startsWith('−')), 'no negative phase');
  assert.ok(asText.some((t) => /e\d|e-/i.test(t)), 'no scientific-notation phase');
  assert.ok(asText.includes('∅') || asText.includes('NaN') || asText.includes('∞'),
    'it never stops being a number');
});

test('the descent passes through Avogadro before giving up', () => {
  // Note: String(6.02e23) is "6.02e+23" — it is renderNumber that produces the Vietnamese
  // "6,02e23" the player actually sees, so the assertion has to go through it.
  const all = [];
  let value = 12;
  for (let step = 0; step < 24; step++) {
    const next = descend(value, step);
    all.push(renderNumber(next));
    if (typeof next === 'number') value = next;
  }
  assert.ok(all.includes('6,02e23'),
    `the descent must land on Avogadro — a number no shopping page has ever needed. Got: ${all.join(' ')}`);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test "tests/tham-tu-mang.test.mjs"`
Expected: FAIL — `descend is not a function` / `formatVi is not a function`

- [ ] **Step 3: Implement the TEXT family**

Replace `games/tham-tu-mang/js/anomalies/text.js` entirely:

```js
/* Họ TEXT. Không chạm DOM ở tầng import — mọi thứ nằm trong apply(). */

import { pick } from '../engine/rng.js';

/* ── T03: cái thang tụt xuống ──────────────────────────────────────────
   Nỗi sợ không phải là con số về 0. Nó là chuyện con số THÔI KHÔNG CÒN là
   thứ đếm được, trong khi câu văn quanh nó vẫn lịch sự y nguyên. Spec §6 T03. */

export function formatVi(n) {
  if (!Number.isFinite(n)) return String(n);
  const s = Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));
  return s.replace('.', ',');
}

/** Trả về số kế tiếp, hoặc một chuỗi khi nó không còn là số nữa. */
export function descend(value, step) {
  if (step < 4) return value - 1;                       // 1 · đếm ngược thật
  if (step < 8) return value / 2;                       // 2 · phân số — đang bị chia, không phải đang bớt
  if (step < 12) return -(Math.abs(value) * 4 + 1);     // 3 · âm và tăng tốc
  if (step === 12) return -1.7e3;                       // 4 · ký hiệu khoa học
  if (step === 13) return -4.4e9;
  if (step === 14) return 6.02e23;                      // Avogadro — mọi thứ, cùng lúc, đang nhìn
  return pick(() => 0.5, ['∅', 'NaN', '∞', '∅']);       // 5 · thôi không còn là số
}

/** Exported so the test can assert what the player actually sees, not what String() gives. */
export function renderNumber(value) {
  if (typeof value === 'string') return value;
  const abs = Math.abs(value);
  if (abs >= 1e3 && (abs >= 1e6 || !Number.isInteger(value))) {
    return value.toExponential(2).replace('.', ',').replace('e+', 'e');
  }
  return formatVi(value);
}

export const T01 = {
  id: 'T01', family: 'TEXT', slots: ['paragraph', 'notice'], weight: 3,
  apply(ctx) {
    ctx.slot.textContent = pick(ctx.rng, ctx.flavour);
    ctx.mark(ctx.slot);
  }
};

export const T02 = {
  id: 'T02', family: 'TEXT', slots: ['paragraph', 'post-title', 'notice'], weight: 3,
  apply(ctx) {
    const entry = pick(ctx.rng, ctx.flavour);
    ctx.slot.textContent = entry.before;
    ctx.mark(ctx.slot);

    let left = false;
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) { left = true; continue; }
        if (left) {
          ctx.slot.textContent = entry.after;   // bản sau tệ hơn, và không có bản thứ ba
          observer.disconnect();
        }
      }
    }, { threshold: 0.2 });
    observer.observe(ctx.slot);
  }
};

export const T03 = {
  id: 'T03', family: 'TEXT', slots: ['paragraph', 'price', 'tile'], weight: 3,
  apply(ctx) {
    const entry = pick(ctx.rng, ctx.flavour);
    let value = entry.start;
    let step = 0;

    const paint = () => {
      ctx.slot.textContent = entry.text.replace('{n}', renderNumber(value));
    };
    paint();
    ctx.mark(ctx.slot);

    setInterval(() => {
      const next = descend(value, step++);
      value = next;
      paint();
    }, 9000);
  }
};

export const TEXT_ANOMALIES = [T01, T02, T03];
```

Note the `pick(() => 0.5, …)` in `descend` — `descend` is pure and seedless by design so the
test can call it directly; the fixed selector keeps it deterministic.

- [ ] **Step 4: Run to verify the TEXT tests pass**

Run: `node --test "tests/tham-tu-mang.test.mjs"`
Expected: PASS, 67 tests.

- [ ] **Step 5: Implement the STYLE family**

Replace `games/tham-tu-mang/js/anomalies/style.js`:

```js
/* Họ STYLE. */

import { pick } from '../engine/rng.js';

export const S01 = {
  id: 'S01', family: 'STYLE', slots: ['paragraph', 'hero-title', 'notice'], weight: 3,
  apply(ctx) {
    const entry = pick(ctx.rng, ctx.flavour);
    const text = ctx.slot.textContent;
    if (!text.includes(entry.word)) return;
    const span = document.createElement('span');
    span.textContent = entry.word;
    span.style.fontFamily = entry.family;
    span.style.letterSpacing = '0.06em';
    ctx.slot.innerHTML = text.replace(entry.word, span.outerHTML);
    ctx.mark(ctx.slot.querySelector('span'));
  }
};

export const S05 = {
  id: 'S05', family: 'STYLE', slots: ['gallery-caption', 'avatar', 'photo'], weight: 3,
  apply(ctx) {
    // Ảnh đã được ghim (pinned) nên chú thích được viết đối chọi với một bức ảnh ĐÃ BIẾT.
    ctx.slot.textContent = pick(ctx.rng, ctx.flavour);
    ctx.mark(ctx.slot);
  }
};

export const S07 = {
  id: 'S07', family: 'STYLE', slots: ['feature-icon', 'tile', 'nav'], weight: 4,
  apply(ctx) {
    ctx.slot.textContent = pick(ctx.rng, ctx.flavour);
    ctx.mark(ctx.slot);
  }
};

export const STYLE_ANOMALIES = [S01, S05, S07];
```

- [ ] **Step 6: Implement the MOTION family**

Replace `games/tham-tu-mang/js/anomalies/motion.js`:

```js
/* Họ MOTION. Chuyển động phải ở dưới ngưỡng nhận biết — đủ để thấy khi nhìn chằm chằm,
   không đủ để chắc chắn khi liếc qua. */

export const M01 = {
  id: 'M01', family: 'MOTION', slots: ['avatar', 'tile', 'cta'], weight: 2,
  apply(ctx) {
    ctx.mark(ctx.slot);
    const MAX = 6;                       // không bao giờ trôi quá 6px
    let x = 0, y = 0;

    ctx.root.host.ownerDocument.addEventListener('pointermove', (e) => {
      const r = ctx.slot.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      x += ((dx / d) * MAX - x) * 0.04;   // trễ nặng
      y += ((dy / d) * MAX - y) * 0.04;
      ctx.slot.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
    });
  }
};

export const M03 = {
  id: 'M03', family: 'MOTION', slots: ['tile', 'avatar', 'cta', 'map'], weight: 2,
  apply(ctx) {
    ctx.slot.style.animation = 'tho 4s ease-in-out infinite';
    ctx.mark(ctx.slot);
  }
};

export const MOTION_ANOMALIES = [M01, M03];
```

Append the keyframe to `games/tham-tu-mang/sites/ch1-lumiere/site.css`:

```css
/* M03 — nhịp thở. 1.2% là dưới ngưỡng nhận biết cho tới khi bị nhìn chằm chằm. */
@keyframes tho {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.012); }
}
```

- [ ] **Step 7: Implement the ELEMENT family**

Replace `games/tham-tu-mang/js/anomalies/element.js`:

```js
/* Họ ELEMENT. */

import { pick } from '../engine/rng.js';

export const E01 = {
  id: 'E01', family: 'ELEMENT', slots: ['paragraph', 'footer', 'nav'], weight: 3,
  apply(ctx) {
    const entry = pick(ctx.rng, ctx.flavour);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = entry.label;
    button.style.cssText =
      'position:absolute;left:8px;padding:6px 12px;border:1px solid #b0a49c;' +
      'background:#fff;font:11px/1 monospace;letter-spacing:.1em;cursor:pointer;';

    const holder = document.createElement('div');
    holder.style.cssText = 'position:relative;height:0;';
    holder.appendChild(button);
    ctx.slot.parentNode.insertBefore(holder, ctx.slot);

    // Bấm vào KHÔNG tính điểm — vẫn phải khoanh.
    button.addEventListener('click', () => { window.alert(entry.dialog); });
    ctx.mark(button);
  }
};

export const E04 = {
  id: 'E04', family: 'ELEMENT', slots: ['footer'], weight: 3,
  apply(ctx) {
    const line = document.createElement('span');
    line.textContent = pick(ctx.rng, ctx.flavour);
    ctx.slot.appendChild(line);
    ctx.mark(line);
  }
};

export const ELEMENT_ANOMALIES = [E01, E04];
```

- [ ] **Step 8: Implement the REACTIVE family**

Replace `games/tham-tu-mang/js/anomalies/reactive.js`:

```js
/* Họ REACTIVE — hai giai đoạn. Trang web trung thực cho tới khi người chơi thử nghiệm;
   thử nghiệm làm dị thường HIỆN RA; rồi vẫn phải khoanh nó. Thử nghiệm không bao giờ
   mất máu, nên tò mò luôn an toàn. Spec §6 REACTIVE. */

import { pick } from '../engine/rng.js';

export const R05 = {
  id: 'R05', family: 'REACTIVE', slots: ['subscribe', 'newsletter'], weight: 3,
  apply(ctx) {
    const entry = pick(ctx.rng, ctx.flavour);
    const form = ctx.slot.querySelector('form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (ctx.slot.querySelector('[data-anom="R05"]')) return;

      const note = document.createElement('p');
      note.innerHTML =
        `Cảm ơn bạn. Bạn đã đăng ký nhận thư của chúng tôi từ ngày ${entry.since}. ` +
        `<a href="#" style="color:inherit">${entry.unsub}</a>`;
      note.style.cssText = 'font-size:12px;color:#6f635d;margin-top:8px;';
      ctx.slot.appendChild(note);
      ctx.mark(note);
    });
  }
};

export const REACTIVE_ANOMALIES = [R05];
```

- [ ] **Step 9: Implement the IMAGE family**

Replace `games/tham-tu-mang/js/anomalies/image.js`:

```js
/* Họ IMAGE — chỉ khả thi vì ảnh là ảnh thật và URL có tham số. Mỗi dị thường ở đây sẽ cần
   một tệp ảnh thứ hai làm bằng tay nếu ảnh là tệp tĩnh, và không cái nào khả thi với emoji. */

import { pick } from '../engine/rng.js';

/** Thêm tham số vào một URL đã ghim mà không làm mất cái ghim. */
function reparam(src, extra) {
  if (src.includes('loremflickr.com')) {
    return src.includes('/g/') ? src : src.replace('loremflickr.com/', 'loremflickr.com/g/');
  }
  return src.includes('?') ? `${src}&${extra}` : `${src}?${extra}`;
}

export const I01 = {
  id: 'I01', family: 'IMAGE', slots: ['photo'], weight: 3,
  apply(ctx) {
    const figure = ctx.slot.closest('figure') ?? ctx.slot.parentElement;
    const img = figure?.querySelector('img');
    if (!img) return;
    // Ảnh tự nó về đen trắng — không phải filter CSS, nên nó chịu được soi kỹ.
    img.src = reparam(img.src, 'grayscale');
    ctx.mark(img);
  }
};

export const I03 = {
  id: 'I03', family: 'IMAGE', slots: ['avatar'], weight: 3, needs: { avatar: 2 },
  apply(ctx) {
    const all = ctx.root.querySelectorAll('[data-slot="avatar"]');
    if (all.length < 2) return;

    const mine = ctx.slot;
    const other = [...all].find((el) => el !== mine);
    const srcImg = other.closest('figure')?.querySelector('img');
    const dstImg = mine.closest('figure')?.querySelector('img');
    if (!srcImg || !dstImg) return;

    // Hai cái tên, hai độ tuổi, một khuôn mặt.
    dstImg.src = srcImg.src;
    ctx.mark(dstImg);
  }
};

export const IMAGE_ANOMALIES = [I01, I03];
```

- [ ] **Step 10: Run the full suite**

Run: `node --test "tests/*.test.mjs"`
Expected: PASS, 67 tests. The module-loads gate is what proves none of the six anomaly files
touched the DOM at import time — if one did, every test in the file fails at once.

- [ ] **Step 11: Play it**

Run `npx serve -l 8000 .`, open `http://localhost:8000/games/tham-tu-mang/`.
Play three separate runs and confirm:
1. Every run places a **different** set of anomalies.
2. `S07` (a wrong emoji among ✨🌿💧) is present **every** time — it is forced.
3. Circling an anomaly logs evidence, ticks the counter, and leaves a green ring.
4. Finding all of them shows `HOÀN THÀNH` with a rank.
5. Re-circling something already found says `ĐÃ GHI RỒI` and costs nothing.
6. Submitting the newsletter form (if `R05` was drawn) makes a line appear that must then be
   circled — and submitting it never costs a heart by itself.

- [ ] **Step 12: Commit**

```bash
git add games/tham-tu-mang/ tests/tham-tu-mang.test.mjs
git commit -m "$(cat <<'EOF'
feat(tham-tu-mang): thirteen anomalies across all six families

T03's descent is the one worth reading twice: the number does not merely reach zero,
it stops being the kind of thing that can be counted while the sentence around it
stays polite. The test asserts it passes through Avogadro before giving up.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Hub registration, README and the CLAUDE.md exception

**Files:**
- Modify: `index.html` (the `games` array and `CATEGORY_ICONS`)
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. This is the task that makes the game reachable — an unregistered game
  never appears in the hub, because nothing scans the `games/` directory.

- [ ] **Step 1: Add the Puzzle category**

In `index.html`, find `CATEGORY_ICONS` (around line 1052) and add `Puzzle`. **Monochrome
only** — an emoji codepoint renders in colour and breaks the sidebar's uniform look:

```js
  const CATEGORY_ICONS = {
    Action: "⚔", Arcade: "◈", Board: "♟", Puzzle: "▨", RPG: "❖", Simulation: "⚙", Strategy: "⊞"
  };
```

- [ ] **Step 2: Append the game entry**

In `index.html`, append to the `games` array (after the last entry, around line 1042):

```js
    {
      icon: "🔎",
      title: "Thám tử mạng",
      description: "Soi sáu trang web bình thường và khoanh tròn những thứ không nên ở đó.",
      category: "Puzzle",
      tags: ["Quan sát", "Kinh dị", "Tiếng Việt"],
      added: "2026-09-10",
      color: "linear-gradient(135deg, #0d1117, #4fa88b)",
      path: "games/tham-tu-mang/index.html"
    }
```

- [ ] **Step 3: Add the README line**

Add one line to the game list in `README.md`, matching the format of the lines around it:

```markdown
- **Thám tử mạng** (`games/tham-tu-mang/`) — soi những trang web bình thường và khoanh tròn
  những thứ không nên ở đó. Sáu chương, ba trái tim.
```

- [ ] **Step 4: Amend the house rule in CLAUDE.md**

`CLAUDE.md:56` currently says games make no network requests and names three exceptions. This
game is the fourth, and the first for images. Leaving the line unamended leaves the next reader
following a rule the codebase no longer obeys. Change the exceptions sentence to read:

```markdown
One file per game: inline `<style>`, markup, inline `<script>`, emoji for all art. No image,
audio or font assets, and no network requests — with **four exceptions**:
`games/magic-shooter.html` loads Three.js from a CDN (test its CDN-failure fallback when
touching it), `games/grid-storm/` ships ~17 MB of background music in `music/*.mp3`,
`games/farmer-dream.html` ships ~16 MB in `games/music/farmer-dream/`, and
`games/tham-tu-mang/` **hotlinks photographs** from `loremflickr.com` and `picsum.photos`
rather than bundling them — every `<img>` there carries an `onerror` fallback to a procedural
SVG, so the game degrades to a stylised site rather than breaking when the CDN is unreachable.
Both music players treat a failed track as "skip to the next one", so the games still run if
the files are missing.
```

- [ ] **Step 5: Verify the hub**

Run `npx serve -l 8000 .`, open `http://localhost:8000/`.
Confirm:
1. A **Puzzle** sector appears in the sidebar with the `▨` glyph, monochrome like its neighbours.
2. The card shows the dark-to-green gradient and carries a **NEW** badge (its `added` date is
   the newest in the array).
3. Clicking the card opens the game.
4. Searching `thám tử` finds it; searching `Quan sát` finds it by tag.

- [ ] **Step 6: Run the full suite one last time**

Run: `node --test "tests/*.test.mjs"`
Expected: PASS. `tests/syntax.test.mjs` parses `index.html`'s script body, so a typo in the
`games` array surfaces here rather than as a blank hub.

- [ ] **Step 7: Commit**

```bash
git add index.html README.md CLAUDE.md
git commit -m "$(cat <<'EOF'
feat(tham-tu-mang): register in the hub and document the fourth CDN exception

Nothing scans games/, so an unregistered game is simply unreachable. CLAUDE.md's
"no network requests" rule now names this game as its fourth exception — the first
for images rather than audio or a library — so the next reader is not following a
rule the codebase no longer obeys.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Stage 1 exit criteria

Before calling Stage 1 done, all of these must hold:

- [ ] `node --test "tests/*.test.mjs"` passes, ~67 tests, no pre-existing test broken.
- [ ] Three consecutive runs of Chapter 1 place visibly different anomalies.
- [ ] `S07` appears in every run.
- [ ] A run can be won and a run can be lost.
- [ ] Read mode allows text selection; capture mode does not.
- [ ] An oversized loop and a stray click both cost nothing.
- [ ] Circling ordinary content and circling empty space both cost exactly one heart.
- [ ] **Offline pass:** with the network throttled to offline in devtools, every photograph
      falls back to its SVG placeholder and the site still reads as a website (spec §3.4).
- [ ] The hub shows the game under a monochrome `▨ Puzzle` sector and it opens.

## Handoff to the user's playtest

Stage 1 is where the two open calibration questions get answered, and neither can be settled
without a human playing it:

1. **Difficulty.** Five to six anomalies on one page, three hearts, every miss lethal. If this
   is brutal, the lever is the count range in `CH1.min/max`, not the heart rule — that was
   decided deliberately.
2. **The photographs.** Every `lock` value in `page.js` was chosen blind from a sandbox with no
   network (spec §3.4, §10). Some will be absurd. Note which, and they get rerolled before
   Stage 2 builds five more sites on the same pattern.
