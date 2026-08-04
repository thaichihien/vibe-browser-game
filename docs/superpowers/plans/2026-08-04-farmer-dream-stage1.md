# Farmer Dream — Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `games/farmer-dream.html` on a timestamp-driven state object with ten
differentiated crops, an inventory, XP levels, saving, offline growth, and the house chrome
(start screen, rules, mute, hub link) — the foundation Stages 2 and 3 sit on.

**Architecture:** One `S` state object, one `setInterval(tick, 250)` that derives everything
from `Date.now()` minus stored timestamps, and one `render()`. All economy maths lives in a
comment-delimited `FARM` region that must stay DOM-free so `node:vm` can unit-test it. All
UI lives below that region. Everything stays in one self-contained HTML file.

**Tech Stack:** Vanilla HTML/CSS/JS, no build step, no dependencies. Tests are Node 22
built-ins (`node:test`, `node:assert`, `node:vm`) via the existing `tests/harness.mjs`.

**Spec:** `docs/superpowers/specs/2026-08-04-farmer-dream-design.md`

## Global Constraints

- **Single self-contained file.** `games/farmer-dream.html` — inline `<style>`, inline
  `<script>`, emoji for all art. No image/audio/font assets, no network requests, no CDN.
- **Must work over `file://`.** No ES modules, no `import`/`export` in the game file.
- **The `FARM` region must stay DOM-free.** No `document`, `window`, `localStorage` or `Date.now()`
  inside `/* ==== FARM:START ==== */ … /* ==== FARM:END ==== */`. Time enters as a `now`
  argument. The test context has only `{ console, Math, JSON }` — a stray DOM reference fails
  the whole suite.
- **English UI copy.**
- **Warm cozy palette**, not the hub's neon. Wood/wheat/dusk.
- **Save key** `farmerDream.save`; **mute key** `farmerDream.muted` (matches the
  `<gameCamelCase>.muted` convention used by `coCaNgua`, `coThu`, `dauTruongSinhVat`).
- **Commit style:** conventional commits scoped `farmer-dream`. Bodies explain the failure
  being fixed. **No `Claude-Session:` trailer** (see `~/.claude/CLAUDE.md`).
- **Test command:** `node --test 'tests/*.test.mjs'` — the bare directory form fails, the glob
  is required. On PowerShell use double quotes: `node --test "tests/*.test.mjs"`.
- **Verification policy:** static checks plus the unit suite; no headless browser driving.
  Manual playtest by the user at the end of the stage.
- **Do not touch `index.html`.** Farmer Dream is already registered there.

## Scope

This plan covers **Stage 1 only**, per spec §15. Stages 2 (animals) and 3 (machines,
upgrades, orders, house, pets) get their own plan files after their playtests, because the
Stage 1 playtest is expected to change their details. Stage 1 ends with a game that is fully
playable on its own: plant, water, harvest, sell, level up, close the tab, come back.

## File Structure

| File | Responsibility |
|---|---|
| `games/farmer-dream.html` | Rewritten. `FARM` region (pure economy) + UI below it. |
| `tests/harness.mjs` | Modified. Gains an optional game-path argument so it can read a second game. |
| `tests/farm.test.mjs` | New. Unit tests for the `FARM` region. |
| `tests/syntax.test.mjs` | Modified. Parses Farmer Dream's `<script>` body too. |

### Deliberate deviations from the spec

- **Harvesting is a click, not a drag.** Spec §5 says harvesting moves a crop to inventory but
  does not say how. A ripe tile is clicked to harvest. Dragging is kept for planting, watering
  and selling; making the player drag every ripe tile to the inventory panel would reintroduce
  exactly the gesture spam the redesign exists to remove.
- **No game currently has a back-to-hub link**, so the one added here is a new pattern rather
  than a copied one.

---

## Task 1: Let the test harness read a second game

`tests/harness.mjs:7` hard-codes `GAME` as monster-battle, so nothing else can be tested. Add
an optional trailing argument to each reader, defaulting to the current value — existing
callers (`rules.test.mjs`, `ai.test.mjs`, `syntax.test.mjs`) then need no changes at all.

**Files:**
- Modify: `tests/harness.mjs:7-28`, `tests/harness.mjs:60-66`
- Test: `tests/farm.test.mjs` (new, first assertion only)

**Interfaces:**
- Produces: `GAME`, `FARM_GAME` (absolute paths); `readGame(game?)`, `scriptBody(game?)`,
  `extract(marker, game?)`, `load(markers, names, game?)` — all defaulting to `GAME`.

- [ ] **Step 1: Write the failing test**

Create `tests/farm.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { FARM_GAME, readGame } from './harness.mjs';

test('harness can read farmer-dream, not just monster-battle', () => {
  assert.match(readGame(FARM_GAME), /Farmer Dream|farm/i);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test "tests/farm.test.mjs"`
Expected: FAIL — `FARM_GAME` is `undefined`, so `readFileSync` throws.

- [ ] **Step 3: Add the optional argument**

In `tests/harness.mjs`, replace lines 7–28 with:

```js
export const GAME = path.join(ROOT, 'games', 'monster-battle.html');
export const FARM_GAME = path.join(ROOT, 'games', 'farmer-dream.html');

export function readGame(game = GAME) {
  return readFileSync(game, 'utf8');
}

// Pull out the full <script> body — used by the syntax gate.
export function scriptBody(game = GAME) {
  const m = readGame(game).match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('No <script> block found in ' + game);
  return m[1];
}

// Pull out one comment-delimited region, e.g. ENGINE.
export function extract(marker, game = GAME) {
  const re = new RegExp(
    `/\\* ==== ${marker}:START ==== \\*/([\\s\\S]*?)/\\* ==== ${marker}:END ==== \\*/`
  );
  const m = readGame(game).match(re);
  if (!m) throw new Error(`Marker ${marker} not found in ` + game);
  return m[1];
}
```

And replace `load` (line 60) with:

```js
export function load(markers, names, game = GAME) {
  const code = markers.map(m => extract(m, game)).join('\n');
  const ctx = { console, Math, JSON };
  vm.createContext(ctx);
  vm.runInContext(`${code}\nglobalThis.__exports = { ${names.join(', ')} };`, ctx);
  return bridge(ctx.__exports);
}
```

- [ ] **Step 4: Run the whole suite**

Run: `node --test "tests/*.test.mjs"`
Expected: PASS — the new test passes and all pre-existing monster-battle tests are untouched
because every new argument is defaulted.

- [ ] **Step 5: Commit**

```bash
git add tests/harness.mjs tests/farm.test.mjs
git commit -m "test(harness): let readers target a game other than monster-battle

GAME was hard-coded, so no second game could be unit-tested. Each reader
now takes an optional trailing game path defaulting to the old value, so
existing callers are unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: The CROPS table and `cropStage`

The heart of the economy. A tile stores when it was last watered and how much growth it had
banked before that; `cropStage` turns those numbers plus `now` into what to draw.

**Files:**
- Modify: `games/farmer-dream.html` (add the `FARM` region at the top of `<script>`)
- Test: `tests/farm.test.mjs`

**Interfaces:**
- Consumes: `load(markers, names, game)` from Task 1.
- Produces:
  - `CROPS` — object keyed by crop id; each `{ icon, name, tier, seed, sell, grow, waterings, harvests, regrow }`, all times in ms.
  - `cropStage(tile, now)` → `{ phase: 'thirsty'|'growing'|'ripe', progress: 0..1, icon: string, segment: number }`
  - A **tile** is `{ crop, waterings, wateredAt, grownMs, harvestsLeft }` or `null` for empty.
    `waterings` counts how many times it has been watered; `wateredAt` is `null` when it is
    waiting for water; `grownMs` is growth banked before the current watering.

- [ ] **Step 1: Write the failing tests**

Append to `tests/farm.test.mjs`:

```js
import { FARM_GAME, load } from './harness.mjs';

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test "tests/farm.test.mjs"`
Expected: FAIL — `Marker FARM not found in .../farmer-dream.html`.

- [ ] **Step 3: Add the FARM region**

Replace the entire contents of `games/farmer-dream.html`'s `<script>` block with just this
region for now (the rest of the file is rebuilt in Task 6):

```js
/* ==== FARM:START ==== */
/* Pure economy. No DOM, no Date.now(), no localStorage — time arrives as `now`.
   tests/farm.test.mjs evaluates this region in a bare node:vm context. */

const CROPS = {
  rice:       { icon:'🌾', name:'Rice',       tier:1,  seed:5,  sell:15,  grow:10000, waterings:1, harvests:1, regrow:0 },
  carrot:     { icon:'🥕', name:'Carrot',     tier:2,  seed:8,  sell:25,  grow:14000, waterings:1, harvests:1, regrow:0 },
  corn:       { icon:'🌽', name:'Corn',       tier:3,  seed:10, sell:30,  grow:16000, waterings:1, harvests:1, regrow:0 },
  tomato:     { icon:'🍅', name:'Tomato',     tier:4,  seed:12, sell:40,  grow:18000, waterings:1, harvests:1, regrow:0 },
  cabbage:    { icon:'🥬', name:'Cabbage',    tier:5,  seed:12, sell:32,  grow:18000, waterings:1, harvests:1, regrow:0 },
  potato:     { icon:'🥔', name:'Potato',     tier:6,  seed:15, sell:45,  grow:20000, waterings:1, harvests:1, regrow:0 },
  sunflower:  { icon:'🌻', name:'Sunflower',  tier:7,  seed:20, sell:30,  grow:15000, waterings:1, harvests:1, regrow:0 },
  strawberry: { icon:'🍓', name:'Strawberry', tier:8,  seed:30, sell:35,  grow:20000, waterings:1, harvests:3, regrow:12000 },
  grapes:     { icon:'🍇', name:'Grapes',     tier:9,  seed:45, sell:50,  grow:26000, waterings:1, harvests:4, regrow:14000 },
  pumpkin:    { icon:'🎃', name:'Pumpkin',    tier:10, seed:60, sell:220, grow:50000, waterings:2, harvests:1, regrow:0 }
};

// A tile is { crop, waterings, wateredAt, grownMs, harvestsLeft } or null.
// `grownMs` is growth banked before the current watering; `wateredAt` is null
// while the tile is waiting for water, so no time accrues.
function cropStage(tile, now) {
  const C = CROPS[tile.crop];
  const segment = C.grow / C.waterings;
  const running = tile.wateredAt == null ? 0 : now - tile.wateredAt;
  const total = Math.min(tile.grownMs + Math.max(0, running), C.grow);
  const progress = total / C.grow;

  if (total >= C.grow) {
    return { phase: 'ripe', progress: 1, icon: C.icon, segment: C.waterings };
  }
  const done = Math.floor(total / segment);
  const icon = progress < 0.5 ? '🌱' : '🌿';
  // Once a segment finishes, the tile stops until it is watered again.
  const phase = tile.waterings <= done ? 'thirsty' : 'growing';
  return { phase, progress, icon, segment: done };
}
/* ==== FARM:END ==== */
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test "tests/farm.test.mjs"`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add games/farmer-dream.html tests/farm.test.mjs
git commit -m "feat(farmer-dream): add the DOM-free CROPS table and cropStage

Growth was a chain of setTimeouts bound to DOM nodes, so a reload wiped
the farm and a background tab stalled it. Growth is now derived from
timestamps by a pure function the unit suite can exercise.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Tile transitions — plant, water, harvest

**Files:**
- Modify: `games/farmer-dream.html` (inside the `FARM` region)
- Test: `tests/farm.test.mjs`

**Interfaces:**
- Consumes: `CROPS`, `cropStage` from Task 2.
- Produces:
  - `plantTile(cropId, now)` → tile (thirsty: `waterings: 0`, `wateredAt: null`)
  - `waterTile(tile, now)` → **new** tile, or the same tile unchanged if it is not thirsty
  - `harvestTile(tile, now)` → `{ crop: cropId, tile: nextTileOrNull }`; returns
    `{ crop: null, tile }` unchanged if the tile is not ripe

- [ ] **Step 1: Write the failing tests**

Append to `tests/farm.test.mjs` (extend the existing `load(...)` destructure to include the
three new names):

```js
const { plantTile, waterTile, harvestTile } =
  load(['FARM'], ['plantTile', 'waterTile', 'harvestTile'], FARM_GAME);

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test "tests/farm.test.mjs"`
Expected: FAIL — `plantTile is not defined`.

- [ ] **Step 3: Implement inside the FARM region**

Insert directly before `/* ==== FARM:END ==== */`:

```js
function plantTile(cropId, now) {
  return {
    crop: cropId,
    waterings: 0,
    wateredAt: null,
    grownMs: 0,
    harvestsLeft: CROPS[cropId].harvests
  };
}

function waterTile(tile, now) {
  if (cropStage(tile, now).phase !== 'thirsty') return tile;
  const C = CROPS[tile.crop];
  const segment = C.grow / C.waterings;
  return {
    ...tile,
    waterings: tile.waterings + 1,
    wateredAt: now,
    // Bank exactly the segments already completed, so no fraction is lost or gained.
    grownMs: segment * tile.waterings
  };
}

function harvestTile(tile, now) {
  if (cropStage(tile, now).phase !== 'ripe') return { crop: null, tile };
  const C = CROPS[tile.crop];
  if (tile.harvestsLeft <= 1) return { crop: tile.crop, tile: null };
  return {
    crop: tile.crop,
    tile: {
      ...tile,
      harvestsLeft: tile.harvestsLeft - 1,
      wateredAt: now,
      // Start the regrow clock: it needs `regrow` more ms to reach `grow` again.
      grownMs: C.grow - C.regrow,
      waterings: C.waterings
    }
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test "tests/farm.test.mjs"`
Expected: PASS — 17 tests.

- [ ] **Step 5: Commit**

```bash
git add games/farmer-dream.html tests/farm.test.mjs
git commit -m "feat(farmer-dream): add plant/water/harvest tile transitions

Regrowing crops and the two-watering pumpkin are the mechanics that stop
one seed dominating, so they need a tested home rather than living in
drop handlers.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Levels and unlocks

**Files:**
- Modify: `games/farmer-dream.html` (inside the `FARM` region)
- Test: `tests/farm.test.mjs`

**Interfaces:**
- Produces:
  - `LEVELS` — array of cumulative XP thresholds, `LEVELS[0] === 0`
  - `UNLOCKS` — `{ [cropId]: level }`
  - `levelFor(xp)` → integer 1..10
  - `xpBar(xp)` → `{ level, into, need }` where `need` is 0 at max level

- [ ] **Step 1: Write the failing tests**

Append to `tests/farm.test.mjs`:

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test "tests/farm.test.mjs"`
Expected: FAIL — `LEVELS is not defined`.

- [ ] **Step 3: Implement inside the FARM region**

Insert before `/* ==== FARM:END ==== */`:

```js
// Cumulative XP required to reach level index+1. Level is capped at 10.
const LEVELS = [0, 40, 90, 170, 290, 460, 700, 1020, 1450, 2000];

const UNLOCKS = {
  rice: 1, carrot: 1, corn: 2, tomato: 3, cabbage: 3,
  potato: 5, strawberry: 6, pumpkin: 7, sunflower: 8, grapes: 9
};

function levelFor(xp) {
  let lv = 1;
  for (let i = 1; i < LEVELS.length; i++) if (xp >= LEVELS[i]) lv = i + 1;
  return lv;
}

function xpBar(xp) {
  const level = levelFor(xp);
  if (level >= LEVELS.length) return { level, into: 0, need: 0 };
  const floor = LEVELS[level - 1];
  return { level, into: xp - floor, need: LEVELS[level] - floor };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test "tests/farm.test.mjs"`
Expected: PASS — 21 tests.

- [ ] **Step 5: Commit**

```bash
git add games/farmer-dream.html tests/farm.test.mjs
git commit -m "feat(farmer-dream): add the XP level ladder and crop unlocks

Money alone gated everything, so the whole shop was visible from turn
one. Levels stage the ten crops in over the session.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Offline advance

Crops use absolute timestamps, so growth while the tab is closed happens for free. What needs
code is the **cap**: past the limit, tiles are shifted forward so only the capped window counts.

**Files:**
- Modify: `games/farmer-dream.html` (inside the `FARM` region)
- Test: `tests/farm.test.mjs`

**Interfaces:**
- Produces: `OFFLINE_CAP_MS` (= 14400000, four hours) and
  `advance(state, elapsedMs, capMs)` → a new state whose tiles have been shifted; returns the
  same object when `elapsedMs <= capMs`. `capMs` defaults to `OFFLINE_CAP_MS`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/farm.test.mjs`:

```js
const { OFFLINE_CAP_MS, advance } =
  load(['FARM'], ['OFFLINE_CAP_MS', 'advance'], FARM_GAME);

const HOUR = 3600000;

test('the offline cap is four hours', () => {
  assert.equal(OFFLINE_CAP_MS, 4 * HOUR);
});

test('a short absence is returned untouched', () => {
  const s = { tiles: [waterTile(plantTile('rice', 0), 0)] };
  assert.equal(advance(s, HOUR), s);
});

test('a long absence shifts tiles so only the capped window counted', () => {
  const t = waterTile(plantTile('pumpkin', 0), 0);
  const away = 10 * HOUR;
  const out = advance({ tiles: [t] }, away);
  assert.equal(out.tiles[0].wateredAt, away - OFFLINE_CAP_MS,
    'the excess is absorbed by moving the watering forward');
});

test('advance leaves empty and thirsty tiles alone', () => {
  const thirsty = plantTile('rice', 0);
  const out = advance({ tiles: [null, thirsty] }, 10 * HOUR);
  assert.equal(out.tiles[0], null);
  assert.deepEqual(out.tiles[1], thirsty, 'an unwatered tile has no clock to shift');
});

test('a bigger cap lets more of the absence count', () => {
  const t = waterTile(plantTile('pumpkin', 0), 0);
  const away = 10 * HOUR;
  const out = advance({ tiles: [t] }, away, 8 * HOUR);
  assert.equal(out.tiles[0].wateredAt, 2 * HOUR);
});

test('advance does not mutate the state it was given', () => {
  const t = waterTile(plantTile('rice', 0), 0);
  const s = { tiles: [t] };
  advance(s, 10 * HOUR);
  assert.equal(s.tiles[0].wateredAt, 0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test "tests/farm.test.mjs"`
Expected: FAIL — `advance is not defined`.

- [ ] **Step 3: Implement inside the FARM region**

Insert before `/* ==== FARM:END ==== */`:

```js
const OFFLINE_CAP_MS = 4 * 3600000;

// Tiles carry absolute timestamps, so time away already counts. To cap it we
// push every running tile forward by the excess, which is equivalent to the
// player having been gone only `capMs`. Pure: returns a new state.
function advance(state, elapsedMs, capMs = OFFLINE_CAP_MS) {
  if (elapsedMs <= capMs) return state;
  const skip = elapsedMs - capMs;
  return {
    ...state,
    tiles: state.tiles.map(t =>
      t && t.wateredAt != null ? { ...t, wateredAt: t.wateredAt + skip } : t)
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test "tests/*.test.mjs"`
Expected: PASS — the full suite, 27 farm tests plus all monster-battle tests.

- [ ] **Step 5: Commit**

```bash
git add games/farmer-dream.html tests/farm.test.mjs
git commit -m "feat(farmer-dream): cap how much offline growth an absence earns

Absolute timestamps mean a week away would ripen everything instantly.
advance() shifts running tiles forward by the excess so a long absence
counts as four hours.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: The page shell — markup, warm CSS, syntax gate

The `FARM` region is complete. Now rebuild everything around it. **Delete all of the old
markup, CSS and script**, including the ~120 lines of commented-out dead code at
`games/farmer-dream.html:150-151,235-239,253-283,330-340,365-369,411-445`.

**Files:**
- Modify: `games/farmer-dream.html` (everything outside the `FARM` region)
- Modify: `tests/syntax.test.mjs`

**Interfaces:**
- Produces: the DOM ids every later task binds to — `#money`, `#lvlNum`, `#xpFill`, `#xpText`,
  `#dayNum`, `#soundBtn`, `#helpBtn`, `#seedShop`, `#farm`, `#inv`, `#sell`, `#startScreen`,
  `#rulesModal`, `#endOverlay`, `#toast`.

- [ ] **Step 1: Extend the syntax gate to this game**

Replace the body of `tests/syntax.test.mjs` with:

```js
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
```

- [ ] **Step 2: Run to confirm the gate is live**

Run: `node --test "tests/syntax.test.mjs"`
Expected: PASS — both tests. (Farmer Dream currently holds only the `FARM` region, which parses.)

- [ ] **Step 3: Write the full page around the region**

Rewrite `games/farmer-dream.html` around the region that is **already in the file**. Do not
retype the `FARM` region and do not edit a character of it — cut the existing block from
`/* ==== FARM:START ==== */` to `/* ==== FARM:END ==== */` and paste it verbatim at the top of
the new `<script>`. Task 14 Step 2 checks it is still DOM-free, and the farm tests fail loudly
if any of its numbers drift.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Farmer Dream</title>
<style>
  :root {
    --wood:#6b4423; --wood-dark:#4a2f18; --wheat:#f4e4c1; --cream:#fffaf0;
    --grass:#7cb342; --grass-dark:#558b2f; --soil:#8d6e63; --sky:#bde0fe;
    --gold:#f9a825; --ink:#3e2723; --panel:#fff8e7;
  }
  * { box-sizing:border-box; }
  body {
    margin:0; font-family:"Trebuchet MS","Segoe UI",sans-serif; color:var(--ink);
    background:linear-gradient(180deg,var(--sky) 0%,#e8f5c8 45%,var(--grass) 100%);
    background-attachment:fixed; min-height:100vh;
  }

  /* ---- top bar ---- */
  #topbar {
    display:flex; align-items:center; gap:18px; flex-wrap:wrap;
    padding:10px 16px; background:var(--wood); color:var(--wheat);
    box-shadow:0 3px 0 var(--wood-dark); position:sticky; top:0; z-index:20;
  }
  #topbar a, #topbar button {
    font:inherit; color:var(--wheat); background:rgba(0,0,0,.18);
    border:0; border-radius:8px; padding:6px 12px; cursor:pointer; text-decoration:none;
  }
  #topbar button:hover, #topbar a:hover { background:rgba(0,0,0,.32); }
  .stat { font-size:18px; font-weight:bold; white-space:nowrap; }
  #xpWrap { width:150px; height:12px; background:rgba(0,0,0,.3); border-radius:6px; overflow:hidden; }
  #xpFill { height:100%; width:0; background:linear-gradient(90deg,var(--gold),#ffd54f); transition:width .3s; }
  .spacer { flex:1; }

  /* ---- three columns ---- */
  #main { display:flex; gap:14px; padding:14px; align-items:flex-start; flex-wrap:wrap; }
  .panel {
    background:var(--panel); border:3px solid var(--wood); border-radius:14px;
    padding:12px; box-shadow:0 4px 0 var(--wood-dark);
  }
  #left  { width:220px; }
  #centre{ flex:1; min-width:340px; }
  #right { width:230px; }
  .panel h3 { margin:0 0 10px; font-size:16px; letter-spacing:.5px; }

  /* ---- shop ---- */
  .shop-item {
    display:flex; align-items:center; gap:8px; width:100%;
    padding:7px 9px; margin-bottom:6px; font-size:15px;
    background:var(--cream); border:2px solid var(--wood); border-radius:9px;
    cursor:grab; user-select:none; transition:transform .12s;
  }
  .shop-item:hover { transform:translateX(3px); }
  .shop-item:active { cursor:grabbing; }
  .shop-item.locked { opacity:.45; cursor:not-allowed; filter:grayscale(1); }
  .shop-item .price { margin-left:auto; font-weight:bold; color:var(--grass-dark); }

  /* ---- farm grid ---- */
  #farm { display:grid; gap:6px; justify-content:start; }
  .cell {
    width:62px; height:62px; position:relative; font-size:30px;
    display:flex; align-items:center; justify-content:center;
    background:var(--soil); border:2px solid var(--wood-dark); border-radius:9px;
    box-shadow:inset 0 -4px 0 rgba(0,0,0,.18); transition:transform .12s;
  }
  .cell.empty { background:repeating-linear-gradient(45deg,#a1887f,#a1887f 6px,#8d6e63 6px,#8d6e63 12px); }
  .cell.ripe { cursor:pointer; animation:bob 1.4s ease-in-out infinite; }
  .cell.thirsty::after {
    content:"💧"; position:absolute; top:-4px; right:-4px; font-size:16px;
    animation:blink 1.1s infinite;
  }
  .cell .bar { position:absolute; left:4px; right:4px; bottom:3px; height:4px;
               background:rgba(0,0,0,.28); border-radius:2px; overflow:hidden; }
  .cell .bar i { display:block; height:100%; background:var(--grass); }
  .cell.drop { outline:3px solid var(--gold); outline-offset:2px; }
  @keyframes bob   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.25} }

  /* ---- inventory + sell ---- */
  #inv { display:flex; flex-wrap:wrap; gap:6px; min-height:56px; }
  .inv-item {
    position:relative; font-size:26px; padding:4px 8px; cursor:grab;
    background:var(--cream); border:2px solid var(--wood); border-radius:9px;
  }
  .inv-item span { position:absolute; right:1px; bottom:-2px; font-size:12px; font-weight:bold; }
  #sell {
    min-height:84px; display:flex; align-items:center; justify-content:center;
    text-align:center; font-size:14px; color:var(--wood);
    border:3px dashed var(--grass-dark); border-radius:12px; background:#f1f8e9;
  }
  #sell.drop { background:#dcedc8; border-color:var(--gold); }

  /* ---- overlays ---- */
  .overlay {
    position:fixed; inset:0; z-index:50; display:flex; align-items:center; justify-content:center;
    background:rgba(62,39,35,.72); padding:20px;
  }
  .overlay[hidden] { display:none; }
  .card {
    background:var(--panel); border:4px solid var(--wood); border-radius:18px;
    padding:24px 28px; max-width:520px; max-height:86vh; overflow:auto; text-align:center;
  }
  .card h1 { margin:0 0 6px; font-size:34px; }
  .card ul { text-align:left; line-height:1.7; }
  .btn {
    font:inherit; font-size:17px; font-weight:bold; cursor:pointer;
    padding:11px 26px; margin-top:14px; color:var(--wheat);
    background:var(--grass-dark); border:0; border-radius:11px; box-shadow:0 4px 0 #33691e;
  }
  .btn:active { transform:translateY(3px); box-shadow:none; }

  #toast { position:fixed; inset:0; pointer-events:none; z-index:40; }
  .float {
    position:absolute; font-weight:bold; font-size:20px; color:var(--grass-dark);
    text-shadow:0 1px 0 #fff; animation:rise 1s ease-out forwards;
  }
  @keyframes rise { to { transform:translateY(-46px); opacity:0; } }
</style>
</head>
<body>

<div id="topbar">
  <a href="../index.html">← Hub</a>
  <span class="stat">💰 <span id="money">50</span></span>
  <span class="stat">⭐ Lv<span id="lvlNum">1</span></span>
  <div id="xpWrap"><div id="xpFill"></div></div>
  <span id="xpText">0/40</span>
  <span class="stat">📅 Day <span id="dayNum">1</span></span>
  <span class="spacer"></span>
  <button id="soundBtn">🔊</button>
  <button id="helpBtn">❓ How to play</button>
</div>

<div id="main">
  <div class="panel" id="left">
    <h3>🌱 Seed Shop</h3>
    <div id="seedShop"></div>
  </div>

  <div class="panel" id="centre">
    <h3>🌾 Farm</h3>
    <div id="farm"></div>
  </div>

  <div class="panel" id="right">
    <h3>🎒 Inventory</h3>
    <div id="inv"></div>
    <h3 style="margin-top:14px">💸 Sell</h3>
    <div id="sell">Drag from your inventory<br>to sell</div>
  </div>
</div>

<div id="toast"></div>

<div class="overlay" id="startScreen">
  <div class="card">
    <h1>🌾 Farmer Dream</h1>
    <p>Plant, water, harvest. Take your time.</p>
    <button class="btn" id="startBtn">Start farming</button>
    <button class="btn" id="continueBtn" hidden style="background:var(--wood)">Continue</button>
  </div>
</div>

<div class="overlay" id="rulesModal" hidden>
  <div class="card">
    <h1>How to play</h1>
    <ul>
      <li>🌱 Drag a seed from the shop onto an empty plot.</li>
      <li>💧 Drag water onto a 💧 thirsty plot to start it growing. Water is free.</li>
      <li>🎃 Pumpkins need watering <b>twice</b> — they pause halfway.</li>
      <li>✨ Click a ripe plot to harvest it into your 🎒 inventory.</li>
      <li>🍓 Strawberries and 🍇 grapes regrow — harvest them again and again.</li>
      <li>💰 Drag from the inventory to the 💸 Sell box.</li>
      <li>⭐ Harvesting earns XP. New seeds unlock as you level up.</li>
      <li>💤 Crops keep growing while you are away, for up to four hours.</li>
    </ul>
    <button class="btn" id="closeRules">Got it</button>
  </div>
</div>

<div class="overlay" id="endOverlay" hidden>
  <div class="card">
    <h1>🎉 Well farmed!</h1>
    <p id="endText"></p>
    <button class="btn" id="closeEnd">Keep playing</button>
  </div>
</div>

<script>
/* ==== FARM:START ==== */
/* …the whole region from Tasks 2–5, unchanged… */
/* ==== FARM:END ==== */

// UI wiring is added in Tasks 7–13.
</script>
</body>
</html>
```

- [ ] **Step 4: Verify the suite still passes**

Run: `node --test "tests/*.test.mjs"`
Expected: PASS. The syntax gate proves the new `<script>` parses; the farm tests prove the
region survived the rewrite verbatim.

- [ ] **Step 5: Confirm the dead code is gone**

Run: `git diff --stat games/farmer-dream.html`
Then: `grep -c "^//" games/farmer-dream.html` — expect no block of commented-out handlers.
Manually confirm no `// cell.ondrop`, `// if(type === "rice")` or `// cowArea.ondrop` remains.

- [ ] **Step 6: Commit**

```bash
git add games/farmer-dream.html tests/syntax.test.mjs
git commit -m "feat(farmer-dream): rebuild the page shell with a warm farm theme

The old page was unstyled defaults with ~120 lines of commented-out
handlers and no start screen, rules, mute or way back to the hub. New
shell provides all of them and the ids the UI tasks bind to.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: State, save/load, tick and the farm grid

**Files:**
- Modify: `games/farmer-dream.html` (below `FARM:END`)

**Interfaces:**
- Consumes: everything the `FARM` region exports; the ids from Task 6.
- Produces: `S` (state), `save()`, `load()`, `render()`, `tick()`, `cellEls` (array of the 15
  cell elements, index-aligned with `S.tiles`), `$(id)`.

- [ ] **Step 1: Add state, persistence and the tick**

Append below `/* ==== FARM:END ==== */`:

```js
const $ = id => document.getElementById(id);
const SAVE_KEY = 'farmerDream.save';

function fresh() {
  return {
    v: 1, savedAt: Date.now(),
    money: 50, xp: 0, day: 1, dayStartedAt: Date.now(),
    gridW: 5, gridH: 3,
    tiles: new Array(15).fill(null),
    inv: {}
  };
}

let S = fresh();

function save() {
  S.savedAt = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
}

function load() {
  let raw;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  if (!raw) return false;
  let data;
  try { data = JSON.parse(raw); } catch (e) { return false; }
  if (!data || data.v !== 1) return false;      // unknown schema: discard, never migrate
  S = advance(data, Date.now() - data.savedAt);
  return true;
}

const DAY_MS = 180000;   // 3 real minutes per in-game day

function tick() {
  const now = Date.now();
  while (now - S.dayStartedAt >= DAY_MS) { S.dayStartedAt += DAY_MS; S.day++; }
  render();
}
```

- [ ] **Step 2: Build the grid once and render it every tick**

Append:

```js
const farmEl = $('farm');
let cellEls = [];

function buildGrid() {
  farmEl.innerHTML = '';
  farmEl.style.gridTemplateColumns = `repeat(${S.gridW}, 62px)`;
  cellEls = S.tiles.map((_, i) => {
    const c = document.createElement('div');
    c.className = 'cell';
    c.dataset.i = i;
    farmEl.appendChild(c);
    return c;
  });
}

function render() {
  const now = Date.now();

  cellEls.forEach((el, i) => {
    const t = S.tiles[i];
    if (!t) {
      el.className = 'cell empty';
      el.innerHTML = '';
      return;
    }
    const st = cropStage(t, now);
    el.className = 'cell' + (st.phase === 'ripe' ? ' ripe' : '') +
                            (st.phase === 'thirsty' ? ' thirsty' : '');
    el.innerHTML = st.icon +
      (st.phase === 'ripe' ? '' :
        `<div class="bar"><i style="width:${Math.round(st.progress * 100)}%"></i></div>`);
  });

  $('money').textContent = S.money;
  $('dayNum').textContent = S.day;
  const bar = xpBar(S.xp);
  $('lvlNum').textContent = bar.level;
  $('xpFill').style.width = (bar.need ? (bar.into / bar.need) * 100 : 100) + '%';
  $('xpText').textContent = bar.need ? `${bar.into}/${bar.need}` : 'MAX';

  renderShop();
  renderInv();
}
```

`renderShop` and `renderInv` arrive in Tasks 8 and 10; until then, stub them at the bottom of
the script so `render()` runs:

```js
function renderShop() {}
function renderInv() {}
```

- [ ] **Step 3: Boot**

Append:

```js
function boot() {
  buildGrid();
  render();
  setInterval(tick, 250);
  setInterval(save, 5000);
  window.addEventListener('beforeunload', save);
}
```

(`boot()` is called from the start screen in Task 13. To test Tasks 7–12 in the browser
meanwhile, temporarily add `$('startScreen').hidden = true; boot();` at the end of the script
and remove it in Task 13.)

- [ ] **Step 4: Verify**

Run: `node --test "tests/*.test.mjs"` — expected PASS (syntax gate covers the new code).
Then open `games/farmer-dream.html` in a browser: a 5×3 grid of striped empty plots renders,
the top bar reads `💰 50 · ⭐ Lv1 · 0/40 · 📅 Day 1`, and no console errors appear.

- [ ] **Step 5: Commit**

```bash
git add games/farmer-dream.html
git commit -m "feat(farmer-dream): add the state object, save file and 250ms tick

Everything now derives from timestamps in one place, so a reload restores
the farm and a background tab no longer stalls growth.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: Seed shop, level gating, and planting by drag

**Files:**
- Modify: `games/farmer-dream.html`

**Interfaces:**
- Consumes: `S`, `render`, `cellEls`, `CROPS`, `UNLOCKS`, `levelFor`, `plantTile`.
- Produces: `renderShop()` (replacing the Task 7 stub), `floatText(x, y, text, colour)`.

- [ ] **Step 1: Replace the `renderShop` stub**

```js
const shopEl = $('seedShop');

function renderShop() {
  const lv = levelFor(S.xp);
  shopEl.innerHTML = '';

  Object.keys(CROPS).forEach(id => {
    const C = CROPS[id];
    const need = UNLOCKS[id];
    const locked = lv < need;
    const row = document.createElement('div');
    row.className = 'shop-item' + (locked ? ' locked' : '');
    row.draggable = !locked;
    row.dataset.type = 'seed';
    row.dataset.crop = id;
    row.innerHTML = locked
      ? `<span>🔒</span><span>${C.name}</span><span class="price">Lv${need}</span>`
      : `<span>${C.icon}</span><span>${C.name}</span><span class="price">$${C.seed}</span>`;
    if (!locked) row.ondragstart = e => {
      e.dataTransfer.setData('type', 'seed');
      e.dataTransfer.setData('crop', id);
    };
    shopEl.appendChild(row);
  });

  const water = document.createElement('div');
  water.className = 'shop-item';
  water.draggable = true;
  water.innerHTML = `<span>💧</span><span>Water</span><span class="price">free</span>`;
  water.ondragstart = e => e.dataTransfer.setData('type', 'water');
  shopEl.appendChild(water);
}
```

- [ ] **Step 2: Add the floating-text helper**

```js
function floatText(x, y, text, colour) {
  const el = document.createElement('div');
  el.className = 'float';
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  if (colour) el.style.color = colour;
  $('toast').appendChild(el);
  setTimeout(() => el.remove(), 1000);
}
```

- [ ] **Step 3: Make cells accept a seed**

Inside `buildGrid`'s `map`, after `c.dataset.i = i;`:

```js
    c.ondragover = e => { e.preventDefault(); c.classList.add('drop'); };
    c.ondragleave = () => c.classList.remove('drop');
    c.ondrop = e => {
      e.preventDefault();
      c.classList.remove('drop');
      onDropCell(i, e);
    };
```

And add the handler:

```js
function onDropCell(i, e) {
  const type = e.dataTransfer.getData('type');
  const now = Date.now();

  if (type === 'seed' && S.tiles[i] === null) {
    const id = e.dataTransfer.getData('crop');
    const C = CROPS[id];
    if (levelFor(S.xp) < UNLOCKS[id]) return reject(i);
    if (S.money < C.seed) return reject(i);
    S.money -= C.seed;
    S.tiles[i] = plantTile(id, now);
    const r = cellEls[i].getBoundingClientRect();
    floatText(r.left, r.top, '-$' + C.seed, '#c62828');
    Sound.plant();
    save(); render();
    return;
  }
  reject(i);
}

function reject(i) {
  const el = cellEls[i];
  el.style.outline = '3px solid #e53935';
  setTimeout(() => { el.style.outline = ''; }, 250);
  Sound.bad();
}
```

`Sound` arrives in Task 13. Until then add a temporary stub near the top of the UI section and
**delete it in Task 13**:

```js
const Sound = { plant(){}, water(){}, harvest(){}, sell(){}, level(){}, bad(){} };
```

- [ ] **Step 4: Verify**

Run: `node --test "tests/*.test.mjs"` — expected PASS.
In the browser: only 🌾 Rice and 🥕 Carrot are draggable, the other eight show `🔒 Lv…` greyed
out. Dragging Rice onto an empty plot deducts $5, shows a red `-$5`, and the plot turns into a
🌱 with a 💧 badge. Dragging Rice onto an occupied plot flashes red and costs nothing.

- [ ] **Step 5: Commit**

```bash
git add games/farmer-dream.html
git commit -m "feat(farmer-dream): add the level-gated seed shop and planting

All three seeds used to be available at once with no reason to pick the
cheap one. Locked rows stay visible so progression is legible.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: Watering

**Files:**
- Modify: `games/farmer-dream.html`

**Interfaces:**
- Consumes: `onDropCell`, `waterTile`, `cropStage`.

- [ ] **Step 1: Handle the water type in `onDropCell`**

Insert immediately before the closing `reject(i);` of `onDropCell`:

```js
  if (type === 'water' && S.tiles[i]) {
    const before = S.tiles[i];
    const after = waterTile(before, now);
    if (after === before) return reject(i);   // not thirsty — nothing to do
    S.tiles[i] = after;
    Sound.water();
    save(); render();
    return;
  }
```

- [ ] **Step 2: Verify**

Run: `node --test "tests/*.test.mjs"` — expected PASS.
In the browser:
- Drag 💧 onto a fresh 🌱 — the 💧 badge disappears and the progress bar starts filling.
- Drag 💧 onto the same plot again — it flashes red, nothing changes (no speeding it up).
- Drag 💧 onto an empty plot — flashes red.
- Plant a 🎃 pumpkin (needs Lv7; to check now, temporarily set `S.xp = 999` in the console),
  water it, wait ~25s: it stops at the halfway bar and the 💧 badge returns. Water again and it
  finishes.

- [ ] **Step 3: Commit**

```bash
git add games/farmer-dream.html
git commit -m "feat(farmer-dream): make watering advance growth instead of gating it

Water was a free click tax applied once. It now drives the growth clock,
which is what makes the two-watering pumpkin a real tradeoff.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: Harvesting into the inventory

**Files:**
- Modify: `games/farmer-dream.html`

**Interfaces:**
- Consumes: `harvestTile`, `CROPS`, `xpBar`, `levelFor`, `floatText`.
- Produces: `renderInv()` (replacing the Task 7 stub), `addInv(item, n)`, `takeInv(item, n)`.

- [ ] **Step 1: Add the inventory helpers**

```js
function addInv(item, n = 1) { S.inv[item] = (S.inv[item] || 0) + n; }

function takeInv(item, n = 1) {
  if ((S.inv[item] || 0) < n) return false;
  S.inv[item] -= n;
  if (S.inv[item] <= 0) delete S.inv[item];
  return true;
}
```

- [ ] **Step 2: Replace the `renderInv` stub**

```js
const invEl = $('inv');

function renderInv() {
  const keys = Object.keys(S.inv);
  if (!keys.length) {
    invEl.innerHTML = '<span style="opacity:.5;font-size:13px">Nothing yet — harvest a ripe plot</span>';
    return;
  }
  invEl.innerHTML = '';
  keys.forEach(item => {
    const el = document.createElement('div');
    el.className = 'inv-item';
    el.draggable = true;
    el.innerHTML = `${CROPS[item].icon}<span>${S.inv[item]}</span>`;
    el.title = CROPS[item].name + ' — $' + CROPS[item].sell + ' each';
    el.ondragstart = e => {
      e.dataTransfer.setData('type', 'inv');
      e.dataTransfer.setData('item', item);
    };
    invEl.appendChild(el);
  });
}
```

- [ ] **Step 3: Click a ripe cell to harvest**

Inside `buildGrid`'s `map`, add:

```js
    c.onclick = () => harvestAt(i);
```

And the handler:

```js
function harvestAt(i) {
  const t = S.tiles[i];
  if (!t) return;
  const out = harvestTile(t, Date.now());
  if (!out.crop) return;                       // not ripe yet — silent, not an error

  const before = levelFor(S.xp);
  S.tiles[i] = out.tile;
  addInv(out.crop);
  S.xp += CROPS[out.crop].tier;

  const r = cellEls[i].getBoundingClientRect();
  floatText(r.left + 10, r.top, CROPS[out.crop].icon);
  Sound.harvest();
  if (levelFor(S.xp) > before) { Sound.level(); floatText(r.left, r.top - 24, 'LEVEL UP!', '#f9a825'); }

  save(); render();
}
```

- [ ] **Step 4: Verify**

Run: `node --test "tests/*.test.mjs"` — expected PASS.
In the browser: a ripe 🌾 bobs; clicking it empties the plot, pops a 🌾 upward, adds `🌾1` to
the inventory and moves the XP bar by 1. Plant a 🍓 strawberry (Lv6) and harvest it three
times — the plot stays planted for the first two and empties on the third.

- [ ] **Step 5: Commit**

```bash
git add games/farmer-dream.html
git commit -m "feat(farmer-dream): harvest ripe plots into an inventory

Crops went straight from tile to sell box, which leaves nowhere to hold
the two milk a recipe will need. Inventory is the indirection Stage 3
depends on, and it earns XP on the way through.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 11: Selling

**Files:**
- Modify: `games/farmer-dream.html`

**Interfaces:**
- Consumes: `takeInv`, `CROPS`, `floatText`.

- [ ] **Step 1: Wire the sell box**

```js
const sellEl = $('sell');

sellEl.ondragover = e => { e.preventDefault(); sellEl.classList.add('drop'); };
sellEl.ondragleave = () => sellEl.classList.remove('drop');
sellEl.ondrop = e => {
  e.preventDefault();
  sellEl.classList.remove('drop');
  if (e.dataTransfer.getData('type') !== 'inv') return;

  const item = e.dataTransfer.getData('item');
  if (!takeInv(item)) return;

  const value = CROPS[item].sell;
  S.money += value;
  const r = sellEl.getBoundingClientRect();
  floatText(r.left + r.width / 2 - 20, r.top + 20, '+$' + value);
  Sound.sell();
  save(); render();
};
```

- [ ] **Step 2: Verify**

Run: `node --test "tests/*.test.mjs"` — expected PASS.
In the browser: dragging 🌾 from the inventory onto the Sell box adds $15, floats `+$15`, and
decrements the stack (removing it at zero). Dragging a seed from the shop onto the Sell box
does nothing. The full loop now works: plant → water → harvest → sell → afford more seed.

- [ ] **Step 3: Commit**

```bash
git add games/farmer-dream.html
git commit -m "feat(farmer-dream): sell from the inventory to close the loop

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 12: Offline resume and the welcome-back summary

**Files:**
- Modify: `games/farmer-dream.html`

**Interfaces:**
- Consumes: `load`, `advance`, `cropStage`, `OFFLINE_CAP_MS`.
- Produces: `ripeCount()`, `welcomeBack(awayMs)`.

- [ ] **Step 1: Count what is waiting and say so**

```js
function ripeCount() {
  const now = Date.now();
  return S.tiles.filter(t => t && cropStage(t, now).phase === 'ripe').length;
}

function welcomeBack(awayMs) {
  if (awayMs < 60000) return;                 // under a minute is not an absence
  const mins = Math.round(Math.min(awayMs, OFFLINE_CAP_MS) / 60000);
  const ripe = ripeCount();
  $('endText').textContent = ripe
    ? `You were away ${mins} min. ${ripe} plot${ripe > 1 ? 's are' : ' is'} ready to harvest. 🌾`
    : `You were away ${mins} min. Your crops kept growing. 🌱`;
  $('endOverlay').querySelector('h1').textContent = '👋 Welcome back!';
  $('endOverlay').hidden = false;
}
```

- [ ] **Step 2: Verify**

Run: `node --test "tests/*.test.mjs"` — expected PASS.

The browser check for this task is **deferred to Task 13**, which builds the Continue button
that calls `welcomeBack`. To sanity-check it now without that button, run in the console:
`welcomeBack(9e5)` — the overlay should appear reading "You were away 15 min".

Note `welcomeBack` rewrites the overlay's `<h1>`; Stage 3's win screen must set its own
heading rather than relying on the markup default.

- [ ] **Step 3: Commit**

```bash
git add games/farmer-dream.html
git commit -m "feat(farmer-dream): greet the player with what grew while away

Coming back should always be a harvest, never a cleanup job, so say what
is waiting rather than silently restoring the board.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 13: Start screen, rules, sound and mute

The last of the house conventions. **Delete the temporary `Sound` stub from Task 8 and the
temporary `boot()` call from Task 7** as part of this task.

**Files:**
- Modify: `games/farmer-dream.html`

**Interfaces:**
- Produces: the real `Sound` object — `plant()`, `water()`, `harvest()`, `sell()`, `level()`,
  `bad()`, `toggle()`, `get muted()`.

- [ ] **Step 1: Replace the stub with a real Web Audio synth**

```js
const Sound = (() => {
  let ctx = null;
  let muted = localStorage.getItem('farmerDream.muted') === '1';

  function ensure() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; } }
    return !!ctx;
  }

  function beep(freq, dur, type = 'sine', gain = 0.06) {
    if (muted || !ensure()) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  }

  return {
    plant()   { beep(392, 0.12, 'triangle'); },
    water()   { beep(660, 0.16, 'sine'); },
    harvest() { beep(523, 0.14, 'triangle'); setTimeout(() => beep(784, 0.16, 'triangle'), 90); },
    sell()    { beep(880, 0.10, 'square', 0.04); },
    level()   { beep(523, 0.14); setTimeout(() => beep(659, 0.14), 120); setTimeout(() => beep(784, 0.24), 240); },
    bad()     { beep(150, 0.14, 'sawtooth', 0.05); },
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      localStorage.setItem('farmerDream.muted', muted ? '1' : '0');
      if (!muted) { ensure(); this.plant(); }
      return muted;
    }
  };
})();
```

- [ ] **Step 2: Wire the buttons and overlays**

```js
function syncSoundBtn() { $('soundBtn').textContent = Sound.muted ? '🔇' : '🔊'; }

$('soundBtn').onclick = () => { Sound.toggle(); syncSoundBtn(); };
$('helpBtn').onclick  = () => { $('rulesModal').hidden = false; };
$('closeRules').onclick = () => { $('rulesModal').hidden = true; };
$('closeEnd').onclick   = () => { $('endOverlay').hidden = true; };

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { $('rulesModal').hidden = true; $('endOverlay').hidden = true; }
});
```

- [ ] **Step 3: Replace the temporary boot with the start screen**

Delete the temporary `$('startScreen').hidden = true; boot();` line and use:

```js
syncSoundBtn();

const hasSave = (() => {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
})();

if (hasSave) {
  $('continueBtn').hidden = false;
  $('startBtn').textContent = 'New farm';
}

$('continueBtn').onclick = () => {
  // Read savedAt from the raw save, not from S: load() runs advance(), which
  // rewrites timestamps, so S.savedAt is no longer the moment they left.
  let stamp = Date.now();
  try { stamp = JSON.parse(localStorage.getItem(SAVE_KEY)).savedAt; } catch (e) {}
  if (load()) {
    $('startScreen').hidden = true;
    boot();
    welcomeBack(Date.now() - stamp);
  }
};

$('startBtn').onclick = () => {
  if (hasSave && !confirm('Start over? Your current farm will be lost.')) return;
  S = fresh();
  save();
  $('startScreen').hidden = true;
  boot();
  $('rulesModal').hidden = false;      // first-time players see the rules
};
```

- [ ] **Step 4: Verify**

Run: `node --test "tests/*.test.mjs"` — expected PASS.
In the browser:
- First load shows only **Start farming**; clicking it opens the rules, then the farm.
- 🔊 toggles to 🔇, silences everything, and survives a reload.
- ❓ opens the rules; Esc and **Got it** close them.
- Reload: **Continue** appears and restores the exact farm; **New farm** asks for confirmation.
- ← Hub returns to `index.html`.

- [ ] **Step 5: Commit**

```bash
git add games/farmer-dream.html
git commit -m "feat(farmer-dream): add start screen, rules modal and mutable sound

The game had a toggle-div tutorial, no start screen and no audio, which
is out of step with every other game here. Mute persists under
farmerDream.muted, matching the house key convention.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 14: Stage 1 verification pass

No new features. Prove the stage is sound, then hand it to the user.

**Files:**
- Modify: `games/farmer-dream.html` (fixes only, if anything is found)

- [ ] **Step 1: Full suite**

Run: `node --test "tests/*.test.mjs"`
Expected: PASS with zero failures — 27 farm tests, 2 syntax tests, plus the pre-existing
monster-battle and harness tests.

- [ ] **Step 2: Confirm the FARM region is genuinely DOM-free**

Run: `node -e "import('./tests/harness.mjs').then(h=>{const r=h.extract('FARM',h.FARM_GAME);const bad=r.match(/document|window|localStorage|Date\.now/g);console.log(bad?'LEAKED: '+bad.join(','):'clean')})"`
Expected: `clean`. Anything else means the region will fail in the bare vm context.

- [ ] **Step 3: Confirm no leftover scaffolding**

Run: `grep -n "startScreen').hidden = true; boot()" games/farmer-dream.html` — expect no match.
Run: `grep -n "const Sound = { plant(){}" games/farmer-dream.html` — expect no match.

- [ ] **Step 4: Confirm the hub entry still resolves**

Run: `grep -n "farmer-dream" index.html`
Expected: the existing entry at `index.html:906` pointing at `games/farmer-dream.html`,
unchanged. Load `index.html`, find the Farmer Dream card in the Simulation sector, and click
through to the game.

- [ ] **Step 5: Hand the manual playtest to the user**

Ask the user to confirm, in order:
1. New farm → rules appear → plant rice → water it → it ripens → click to harvest → sell for $15.
2. Only rice and carrot are buyable; the other eight show `🔒 Lv…`.
3. Harvesting raises the XP bar; reaching 40 XP unlocks 🌽 corn with a level-up sound.
4. A strawberry regrows twice before the plot empties.
5. A pumpkin stalls halfway and needs a second watering.
6. Reload mid-growth — the farm returns exactly as it was, crops advanced.
7. 🔇 silences the game and survives a reload.
8. ← Hub goes back and the card is in the right sector.

- [ ] **Step 6: Commit any fixes and tag the stage**

```bash
git add -A
git commit -m "fix(farmer-dream): stage 1 playtest fixes

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## What Stage 1 deliberately leaves out

Tracked here so the next plan can pick them up, per spec §15:

- **Stage 2** — the barn tab, seven animals, feeding by drag, three products per feeding,
  💭 hunger bubbles, hop-and-pause wandering, products dropping at the animal.
- **Stage 3** — six machines, all upgrades, the orders board, the day/night sky and rain,
  the 🏡 Home tab with free furniture placement and shell upgrades, the 🐾 pet album, and the
  real win overlay.
- `S.day` already advances in Task 7 so Stage 3's day cycle has a counter to hook onto, but
  nothing yet reads it beyond the top bar.
- `advance()` takes a `capMs` argument Stage 3 will vary with the house comfort bonus and the
  🐢 turtle pet; Stage 1 always passes the default.
