# Farmer Dream — Stage 2 Implementation Plan (Animals)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the three decorative cows into a roster of seven buyable animals that eat crops
from the inventory, produce goods on a timer, and drop them in a pen worth watching.

**Architecture:** Extends the existing `FARM` region with `ANIMALS`, `PRODUCTS` and pure
animal-state functions, then adds a Barn shop tab and a pen to the centre column. Animals use
the same timestamp model as crops, so they save, resume and survive a background tab for free.

**Tech Stack:** Vanilla HTML/CSS/JS in `games/farmer-dream.html`. Tests via `node:test` +
`node:vm` through `tests/harness.mjs`.

**Spec:** `docs/superpowers/specs/2026-08-04-farmer-dream-design.md` §6
**Builds on:** `docs/superpowers/plans/2026-08-04-farmer-dream-stage1.md` (complete, 75 tests green)

## Global Constraints

- **Single self-contained file**, vanilla JS, emoji art, no network requests, works over `file://`.
- **The `FARM` region stays DOM-free.** No `document`, `window`, `localStorage` or `Date.now()`
  between `/* ==== FARM:START ==== */` and `/* ==== FARM:END ==== */`. Time arrives as `now`.
- **English UI copy.** Warm cozy palette, existing CSS custom properties in `:root`.
- **Do not bump the save version.** `load()` at `farmer-dream.html:369` discards anything but
  `v: 1`; a bump would delete the player's Stage 1 farm. New fields are backfilled instead
  (Task 1).
- **Test command:** `node --test "tests/*.test.mjs"` — the glob is required.
- **Verification:** static checks plus the unit suite; no headless browser driving. Browser
  checks are written out for the user's manual playtest at Task 9.
- **Commits:** conventional, scoped `farmer-dream`, body explains the failure being fixed.
  **No `Claude-Session:` trailer.**
- **Do not touch `index.html`.**

## Current State (verified before writing this plan)

| Thing | Where | Note |
|---|---|---|
| `FARM` region | `farmer-dream.html:191-305` | `CROPS`, `cropStage`, `plantTile`, `waterTile`, `harvestTile`, `LEVELS`, `UNLOCKS`, `levelFor`, `xpBar`, `OFFLINE_CAP_MS`, `advance` |
| State shape | `farmer-dream.html:346-354` | `{v, savedAt, money, xp, day, dayStartedAt, gridW, gridH, tiles, inv}` |
| `load()` backfill point | `farmer-dream.html:363-381` | already shifts `dayStartedAt` alongside `advance()` |
| `render()` | `farmer-dream.html:430-462` | calls `renderShop()` then `renderInv()` |
| Signature memoisation | `farmer-dream.html:465, 506` | `lastShopSig` / `lastInvSig` — new panels follow this pattern |
| Layout | `farmer-dream.html:135-152` | `#left` shop · `#centre` farm · `#right` inventory + sell |

## File Structure

| File | Change |
|---|---|
| `games/farmer-dream.html` | `FARM` region gains animal tables and pure functions; new Barn tab and pen below. |
| `tests/farm.test.mjs` | Extended with animal tests. |

### Deliberate deviations from the spec

- **The beehive is fed harvested 🌻 sunflowers from the inventory**, rather than checking
  whether a sunflower is planted somewhere on the grid. Spec §6 says "needs 🌻 planted". Feeding
  it like every other animal keeps one uniform rule (`ANIMALS[type].eats` is always an item id),
  removes a special case from both the pure layer and the drop handler, and reads the same to
  the player.

---

## Task 1: A unified item registry, and a save that survives the upgrade

`renderInv` (`farmer-dream.html:517`) looks metadata up as `CROPS[item]`, and the sell handler
does `CROPS[item].sell`. The moment 🥛 milk enters the inventory both throw. Fix that first,
and backfill the new state fields so an existing Stage 1 save still loads.

**Files:**
- Modify: `games/farmer-dream.html` — `FARM` region, plus `fresh()`, `load()`, `renderInv`, sell handler
- Test: `tests/farm.test.mjs`

**Interfaces:**
- Produces:
  - `PRODUCTS` — `{ [id]: { icon, name, sell } }` for animal output
  - `ITEM_TABLES` — array of lookup tables, in priority order; Stage 3 pushes `CRAFTED` onto it
  - `itemInfo(id)` → the metadata object, or `null` if unknown

- [ ] **Step 1: Write the failing tests**

Append to `tests/farm.test.mjs`:

```js
const { PRODUCTS, itemInfo } = load(['FARM'], ['PRODUCTS', 'itemInfo'], FARM_GAME);

test('PRODUCTS holds the seven animal goods with sell prices', () => {
  assert.deepEqual(Object.keys(PRODUCTS).sort(),
    ['butter', 'egg', 'feather', 'honey', 'milk', 'truffle', 'wool']);
  assert.equal(PRODUCTS.milk.sell, 60);
  assert.equal(PRODUCTS.egg.icon, '🥚');
});

test('itemInfo resolves crops and products through one lookup', () => {
  assert.equal(itemInfo('rice').sell, 15);
  assert.equal(itemInfo('milk').sell, 60);
  assert.equal(itemInfo('rice').icon, '🌾');
  assert.equal(itemInfo('milk').icon, '🥛');
});

test('itemInfo returns null for an unknown id rather than throwing', () => {
  assert.equal(itemInfo('nonsense'), null);
});

test('every product name and icon is unique', () => {
  const icons = Object.keys(PRODUCTS).map(k => PRODUCTS[k].icon);
  assert.equal(new Set(icons).size, icons.length);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test "tests/farm.test.mjs"`
Expected: FAIL — `PRODUCTS is not defined`.

- [ ] **Step 3: Add the registry to the FARM region**

Insert immediately after the `CROPS` object (before `function cropStage`):

```js
const PRODUCTS = {
  egg:     { icon:'🥚', name:'Egg',     sell:35  },
  milk:    { icon:'🥛', name:'Milk',    sell:60  },
  wool:    { icon:'🧶', name:'Wool',    sell:85  },
  butter:  { icon:'🧈', name:'Butter',  sell:95  },
  feather: { icon:'🪶', name:'Feather', sell:95  },
  honey:   { icon:'🍯', name:'Honey',   sell:110 },
  truffle: { icon:'🍄', name:'Truffle', sell:130 }
};

// Anything that can sit in the inventory resolves through here. Stage 3
// pushes CRAFTED onto this array; nothing else needs to change.
const ITEM_TABLES = [CROPS, PRODUCTS];

function itemInfo(id) {
  for (let i = 0; i < ITEM_TABLES.length; i++) {
    if (ITEM_TABLES[i][id]) return ITEM_TABLES[i][id];
  }
  return null;
}
```

- [ ] **Step 4: Route the UI through `itemInfo`**

In `renderInv` (`farmer-dream.html:517`), replace the three `CROPS[item]` reads:

```js
    const info = itemInfo(item);
    el.innerHTML = `${info.icon}<span>${S.inv[item]}</span>`;
    el.title = info.name + ' — $' + info.sell + ' each';
```

In the sell drop handler, replace `CROPS[item].sell` with:

```js
  const info = itemInfo(item);
  if (!info) return;
  const value = info.sell;
```

- [ ] **Step 5: Backfill the new state fields**

In `fresh()`, add the two new fields:

```js
    tiles: new Array(15).fill(null),
    inv: {},
    animals: [],
    barn: 4
```

In `load()`, immediately after the `data.v !== 1` guard and before the `skip` calculation:

```js
  // Stage 2 added fields a Stage 1 save does not have. Backfill rather than
  // bumping `v`, which would throw the player's existing farm away.
  if (!Array.isArray(data.animals)) data.animals = [];
  if (typeof data.barn !== 'number') data.barn = 4;
```

- [ ] **Step 6: Run to verify it passes**

Run: `node --test "tests/*.test.mjs"`
Expected: PASS — 79 tests.

- [ ] **Step 7: Commit**

```bash
git add games/farmer-dream.html tests/farm.test.mjs
git commit -m "refactor(farmer-dream): resolve inventory items through one registry

renderInv and the sell handler read CROPS[item] directly, so the first
animal product in the inventory would throw. itemInfo() spans crops and
products, and Stage 3 extends it by pushing one more table.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: The ANIMALS table and `animalState`

**Files:**
- Modify: `games/farmer-dream.html` (`FARM` region)
- Test: `tests/farm.test.mjs`

**Interfaces:**
- Produces:
  - `ANIMALS` — `{ [id]: { icon, name, cost, eats, makes, cycle, level } }`, `cycle` in ms
  - `FEED_YIELD` — 3
  - `animalState(a, now)` → `{ phase: 'hungry'|'working', ready: 0..3, progress: 0..1 }`
  - An **animal** is `{ id, type, name, x, y, fedAt, made }`. `fedAt` is null when never fed;
    `made` counts products already materialised into the pen since the last feeding.

- [ ] **Step 1: Write the failing tests**

```js
const { ANIMALS, FEED_YIELD, animalState } =
  load(['FARM'], ['ANIMALS', 'FEED_YIELD', 'animalState'], FARM_GAME);

const beast = (over = {}) => ({ id:'a1', type:'cow', name:'Bella', x:10, y:10, fedAt:0, made:0, ...over });

test('ANIMALS holds the seven animals in ascending cost order', () => {
  const costs = Object.keys(ANIMALS).map(k => ANIMALS[k].cost);
  assert.deepEqual(costs, [...costs].sort((a, b) => a - b));
  assert.equal(Object.keys(ANIMALS).length, 7);
  assert.equal(ANIMALS.cow.cost, 500);
  assert.equal(ANIMALS.duck.level, 10);
});

test('every animal eats a real crop and makes a real product', () => {
  Object.keys(ANIMALS).forEach(k => {
    assert.ok(CROPS[ANIMALS[k].eats], `${k} eats an unknown crop: ${ANIMALS[k].eats}`);
    assert.ok(PRODUCTS[ANIMALS[k].makes], `${k} makes an unknown product`);
  });
});

test('a feeding yields three products', () => {
  assert.equal(FEED_YIELD, 3);
});

test('a never-fed animal is hungry', () => {
  const s = animalState(beast({ fedAt: null }), 999999);
  assert.equal(s.phase, 'hungry');
  assert.equal(s.ready, 0);
});

test('a just-fed animal is working with nothing ready', () => {
  const s = animalState(beast(), 0);
  assert.equal(s.phase, 'working');
  assert.equal(s.ready, 0);
  assert.equal(s.progress, 0);
});

test('products become ready one cycle at a time', () => {
  const c = ANIMALS.cow.cycle;
  assert.equal(animalState(beast(), c - 1).ready, 0);
  assert.equal(animalState(beast(), c).ready, 1);
  assert.equal(animalState(beast(), c * 2).ready, 2);
});

test('an animal goes hungry after the third product and produces no more', () => {
  const c = ANIMALS.cow.cycle;
  const s = animalState(beast(), c * 3);
  assert.equal(s.phase, 'hungry');
  assert.equal(s.ready, FEED_YIELD);

  const later = animalState(beast(), c * 50);
  assert.equal(later.ready, FEED_YIELD, 'the cap is what stops it, so time away cannot overrun');
});

test('progress reports the fraction of the current cycle', () => {
  const c = ANIMALS.cow.cycle;
  assert.equal(animalState(beast(), c * 1.5).progress, 0.5);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test "tests/farm.test.mjs"` — Expected: FAIL, `ANIMALS is not defined`.

- [ ] **Step 3: Implement in the FARM region**

Insert before `/* ==== FARM:END ==== */`:

```js
const ANIMALS = {
  chicken: { icon:'🐔', name:'Chicken', cost:120,  eats:'corn',      makes:'egg',     cycle:25000, level:2  },
  sheep:   { icon:'🐑', name:'Sheep',   cost:350,  eats:'cabbage',   makes:'wool',    cycle:60000, level:4  },
  cow:     { icon:'🐄', name:'Cow',     cost:500,  eats:'rice',      makes:'milk',    cycle:40000, level:5  },
  pig:     { icon:'🐖', name:'Pig',     cost:700,  eats:'potato',    makes:'truffle', cycle:70000, level:7  },
  hive:    { icon:'🐝', name:'Beehive', cost:900,  eats:'sunflower', makes:'honey',   cycle:55000, level:8  },
  goat:    { icon:'🐐', name:'Goat',    cost:1100, eats:'rice',      makes:'butter',  cycle:45000, level:9  },
  duck:    { icon:'🦆', name:'Duck',    cost:1400, eats:'corn',      makes:'feather', cycle:40000, level:10 }
};

const FEED_YIELD = 3;

// An animal is { id, type, name, x, y, fedAt, made }. One feeding yields
// FEED_YIELD products and then the animal is hungry again — which is also
// what stops a long absence from overrunning: the cap is the hunger.
function animalState(a, now) {
  const A = ANIMALS[a.type];
  if (a.fedAt == null) return { phase:'hungry', ready:0, progress:0 };
  const elapsed = Math.max(0, now - a.fedAt);
  const ready = Math.min(FEED_YIELD, Math.floor(elapsed / A.cycle));
  if (ready >= FEED_YIELD) return { phase:'hungry', ready:FEED_YIELD, progress:1 };
  return { phase:'working', ready, progress:(elapsed % A.cycle) / A.cycle };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test "tests/farm.test.mjs"` — Expected: PASS, 87 tests.

- [ ] **Step 5: Commit**

```bash
git add games/farmer-dream.html tests/farm.test.mjs
git commit -m "feat(farmer-dream): add the ANIMALS table and animalState

Cows were spawned in a loop with no ownership, hunger or production
model. Animals now derive from timestamps like crops do, and one feeding
capping at three products is what keeps hunger from advancing offline.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Buying, feeding and collecting — the pure transitions

**Files:**
- Modify: `games/farmer-dream.html` (`FARM` region)
- Test: `tests/farm.test.mjs`

**Interfaces:**
- Consumes: `ANIMALS`, `animalState`, `FEED_YIELD`, `levelFor`.
- Produces:
  - `makeAnimal(type, id, x, y)` → a hungry animal with the species' default name
  - `canBuyAnimal(type, state)` → `{ ok, why }` where `why` is `'level'|'slots'|'money'|null`
  - `canFeed(a, now, inv)` → boolean
  - `feedAnimal(a, now)` → new animal, clock reset
  - `DEFAULT_NAMES` — `{ [type]: string }`

- [ ] **Step 1: Write the failing tests**

```js
const { makeAnimal, canBuyAnimal, canFeed, feedAnimal, DEFAULT_NAMES } =
  load(['FARM'], ['makeAnimal', 'canBuyAnimal', 'canFeed', 'feedAnimal', 'DEFAULT_NAMES'], FARM_GAME);

test('a bought animal starts hungry with a default name', () => {
  const a = makeAnimal('cow', 'a1', 5, 6);
  assert.equal(a.type, 'cow');
  assert.equal(a.fedAt, null);
  assert.equal(a.made, 0);
  assert.equal(a.name, DEFAULT_NAMES.cow);
  assert.equal(animalState(a, 999999).phase, 'hungry');
});

test('every animal type has a default name', () => {
  Object.keys(ANIMALS).forEach(k => assert.ok(DEFAULT_NAMES[k], `${k} has no default name`));
});

test('canBuyAnimal refuses below the unlock level', () => {
  const s = { xp: 0, money: 99999, animals: [], barn: 4 };
  assert.deepEqual(canBuyAnimal('cow', s), { ok: false, why: 'level' });
});

test('canBuyAnimal refuses when the barn is full', () => {
  const s = { xp: 2000, money: 99999, animals: [1, 2, 3, 4], barn: 4 };
  assert.deepEqual(canBuyAnimal('chicken', s), { ok: false, why: 'slots' });
});

test('canBuyAnimal refuses when the money is short', () => {
  const s = { xp: 2000, money: 10, animals: [], barn: 4 };
  assert.deepEqual(canBuyAnimal('cow', s), { ok: false, why: 'money' });
});

test('canBuyAnimal accepts when level, slots and money all allow it', () => {
  const s = { xp: 2000, money: 99999, animals: [], barn: 4 };
  assert.deepEqual(canBuyAnimal('cow', s), { ok: true, why: null });
});

test('canFeed needs the animal hungry and the crop in the inventory', () => {
  const hungry = makeAnimal('cow', 'a1', 0, 0);
  assert.equal(canFeed(hungry, 0, { rice: 1 }), true);
  assert.equal(canFeed(hungry, 0, { rice: 0 }), false, 'no rice');
  assert.equal(canFeed(hungry, 0, {}), false, 'no rice at all');

  const busy = feedAnimal(hungry, 0);
  assert.equal(canFeed(busy, 1000, { rice: 5 }), false, 'already working');
});

test('feeding resets the clock and the product counter', () => {
  let a = makeAnimal('cow', 'a1', 0, 0);
  a = feedAnimal(a, 500);
  assert.equal(a.fedAt, 500);
  assert.equal(a.made, 0);
  assert.equal(animalState(a, 500).phase, 'working');
});

test('an exhausted animal can be fed again and starts over', () => {
  const c = ANIMALS.cow.cycle;
  let a = feedAnimal(makeAnimal('cow', 'a1', 0, 0), 0);
  a = { ...a, made: FEED_YIELD };
  assert.equal(animalState(a, c * 3).phase, 'hungry');
  a = feedAnimal(a, c * 3);
  assert.equal(animalState(a, c * 3).phase, 'working');
  assert.equal(a.made, 0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test "tests/farm.test.mjs"` — Expected: FAIL, `makeAnimal is not defined`.

- [ ] **Step 3: Implement in the FARM region**

```js
const DEFAULT_NAMES = {
  chicken:'Pip', sheep:'Cloud', cow:'Bella', pig:'Truffle',
  hive:'Buzz', goat:'Nibbles', duck:'Puddle'
};

function makeAnimal(type, id, x, y) {
  return { id, type, name: DEFAULT_NAMES[type], x, y, fedAt: null, made: 0 };
}

function canBuyAnimal(type, state) {
  const A = ANIMALS[type];
  if (levelFor(state.xp) < A.level)      return { ok:false, why:'level' };
  if (state.animals.length >= state.barn) return { ok:false, why:'slots' };
  if (state.money < A.cost)               return { ok:false, why:'money' };
  return { ok:true, why:null };
}

function canFeed(a, now, inv) {
  if (animalState(a, now).phase !== 'hungry') return false;
  return (inv[ANIMALS[a.type].eats] || 0) > 0;
}

function feedAnimal(a, now) {
  return { ...a, fedAt: now, made: 0 };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test "tests/farm.test.mjs"` — Expected: PASS, 96 tests.

- [ ] **Step 5: Commit**

```bash
git add games/farmer-dream.html tests/farm.test.mjs
git commit -m "feat(farmer-dream): add buy, feed and name transitions for animals

Barn slots, unlock level and price were three separate checks waiting to
drift apart in a click handler; canBuyAnimal returns which one failed so
the UI can say so.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Offline behaviour for animals

`advance()` currently shifts only `tiles`. Animals must be shifted the same way, so a capped
absence treats them consistently with crops.

**Files:**
- Modify: `games/farmer-dream.html` (`FARM` region — `advance`)
- Test: `tests/farm.test.mjs`

**Interfaces:**
- Changes: `advance(state, elapsedMs, capMs)` now also shifts `state.animals[].fedAt`. Its
  contract is otherwise unchanged, including returning the same object when under the cap.

- [ ] **Step 1: Write the failing tests**

```js
test('advance shifts fed animals by the same excess as tiles', () => {
  const a = feedAnimal(makeAnimal('cow', 'a1', 0, 0), 0);
  const away = 10 * HOUR;
  const out = advance({ tiles: [], animals: [a] }, away);
  assert.equal(out.animals[0].fedAt, away - OFFLINE_CAP_MS);
});

test('advance leaves never-fed animals alone', () => {
  const a = makeAnimal('cow', 'a1', 0, 0);
  const out = advance({ tiles: [], animals: [a] }, 10 * HOUR);
  assert.equal(out.animals[0].fedAt, null);
});

test('advance still returns the same object under the cap', () => {
  const s = { tiles: [], animals: [feedAnimal(makeAnimal('cow', 'a1', 0, 0), 0)] };
  assert.equal(advance(s, HOUR), s);
});

test('advance tolerates a state with no animals array', () => {
  assert.doesNotThrow(() => advance({ tiles: [] }, 10 * HOUR));
});

test('a fed animal still caps at three products across a long absence', () => {
  const a = feedAnimal(makeAnimal('cow', 'a1', 0, 0), 0);
  const away = 10 * HOUR;
  const out = advance({ tiles: [], animals: [a] }, away);
  assert.equal(animalState(out.animals[0], away).ready, FEED_YIELD);
});

test('advance does not mutate the animals it was given', () => {
  const a = feedAnimal(makeAnimal('cow', 'a1', 0, 0), 0);
  advance({ tiles: [], animals: [a] }, 10 * HOUR);
  assert.equal(a.fedAt, 0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test "tests/farm.test.mjs"`
Expected: FAIL — `Cannot read properties of undefined (reading '0')`, because `advance` drops
the `animals` key entirely.

- [ ] **Step 3: Extend `advance`**

Replace the function body in the `FARM` region:

```js
function advance(state, elapsedMs, capMs = OFFLINE_CAP_MS) {
  if (elapsedMs <= capMs) return state;
  const skip = elapsedMs - capMs;
  return {
    ...state,
    tiles: state.tiles.map(t =>
      t && t.wateredAt != null ? { ...t, wateredAt: t.wateredAt + skip } : t),
    animals: (state.animals || []).map(a =>
      a.fedAt != null ? { ...a, fedAt: a.fedAt + skip } : a)
  };
}
```

- [ ] **Step 4: Run the whole suite**

Run: `node --test "tests/*.test.mjs"` — Expected: PASS, 102 tests.

- [ ] **Step 5: Commit**

```bash
git add games/farmer-dream.html tests/farm.test.mjs
git commit -m "feat(farmer-dream): shift animals with tiles when capping an absence

advance() rebuilt state without the animals key, so a long absence both
lost the herd and let their clocks run uncapped.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: The Barn tab and buying animals

**Files:**
- Modify: `games/farmer-dream.html` — CSS, `#left` markup, shop rendering

**Interfaces:**
- Consumes: `ANIMALS`, `canBuyAnimal`, `makeAnimal`, `levelFor`, `floatText`, `Sound`, `save`, `render`.
- Produces: `S.shopTab` (`'seeds'|'barn'`), `renderBarn()`, `buyAnimal(type)`, `nextAnimalId()`.

- [ ] **Step 1: Add the tab markup**

Replace the `#left` panel (`farmer-dream.html:136-139`):

```html
  <div class="panel" id="left">
    <div class="tabs">
      <button class="tab on" data-tab="seeds">🌱 Seeds</button>
      <button class="tab" data-tab="barn">🐄 Barn</button>
    </div>
    <div id="seedShop"></div>
    <div id="barnShop" hidden></div>
  </div>
```

Add to the `<style>` block:

```css
  .tabs { display:flex; gap:6px; margin-bottom:10px; }
  .tab {
    flex:1; font:inherit; font-size:13px; cursor:pointer; padding:6px 4px;
    color:var(--wood); background:var(--cream);
    border:2px solid var(--wood); border-radius:8px 8px 0 0;
  }
  .tab.on { color:var(--wheat); background:var(--wood); }
  .slots { font-size:12px; opacity:.7; margin-bottom:8px; }
```

- [ ] **Step 2: Add `S.shopTab` to state**

In `fresh()`, add `shopTab: 'seeds',`. In `load()`, alongside the other backfills:

```js
  if (data.shopTab !== 'barn') data.shopTab = 'seeds';
```

- [ ] **Step 3: Render the barn shop**

```js
const barnEl = $('barnShop');
let lastBarnSig = null;

function nextAnimalId() {
  return 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
}

function buyAnimal(type) {
  const check = canBuyAnimal(type, S);
  if (!check.ok) {
    Sound.bad();
    const msg = { level:'Level too low', slots:'Barn is full', money:'Not enough money' }[check.why];
    const r = barnEl.getBoundingClientRect();
    floatText(r.left + 10, r.top + 10, msg, '#c62828');
    return;
  }
  const A = ANIMALS[type];
  S.money -= A.cost;
  S.animals.push(makeAnimal(type, nextAnimalId(), 10 + Math.random() * 70, 10 + Math.random() * 55));
  Sound.plant();
  save();
  buildPen();
  render();
}

function renderBarn() {
  const lv = levelFor(S.xp);
  const sig = lv + '|' + S.money + '|' + S.animals.length + '|' + S.barn;
  if (sig === lastBarnSig) return;
  lastBarnSig = sig;

  barnEl.innerHTML = `<div class="slots">Barn slots: ${S.animals.length}/${S.barn}</div>`;

  Object.keys(ANIMALS).forEach(type => {
    const A = ANIMALS[type];
    const locked = lv < A.level;
    const row = document.createElement('div');
    row.className = 'shop-item' + (locked ? ' locked' : '');
    row.innerHTML = locked
      ? `<span>🔒</span><span>${A.name}</span><span class="price">Lv${A.level}</span>`
      : `<span>${A.icon}</span><span>${A.name}</span><span class="price">$${A.cost}</span>`;
    if (!locked) {
      row.title = `Eats ${itemInfo(A.eats).icon} ${itemInfo(A.eats).name} → makes ${itemInfo(A.makes).icon}`;
      row.onclick = () => buyAnimal(type);
      row.style.cursor = 'pointer';
    }
    barnEl.appendChild(row);
  });
}
```

- [ ] **Step 4: Wire the tabs and call `renderBarn` from `render()`**

```js
document.querySelectorAll('.tab').forEach(btn => {
  btn.onclick = () => {
    S.shopTab = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === S.shopTab));
    $('seedShop').hidden = S.shopTab !== 'seeds';
    $('barnShop').hidden = S.shopTab !== 'barn';
    save();
    render();
  };
});
```

At the end of `render()`, after `renderInv();`, add `renderBarn();`.

In `boot()`, after `buildGrid()`, sync the tab to the loaded state:

```js
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === S.shopTab));
  $('seedShop').hidden = S.shopTab !== 'seeds';
  $('barnShop').hidden = S.shopTab !== 'barn';
```

- [ ] **Step 5: Verify**

Run: `node --test "tests/*.test.mjs"` — Expected: PASS.
Browser: the Seeds/Barn tabs switch; the Barn lists seven animals with 🔒 on the locked ones
and shows `Barn slots: 0/4`. Buying a chicken at Lv2 with $120 deducts the money and fills a
slot. Clicking a locked or unaffordable row flashes a red reason and costs nothing.

- [ ] **Step 6: Commit**

```bash
git add games/farmer-dream.html
git commit -m "feat(farmer-dream): add the barn tab and buying animals

Three cows existed for free and could not be added to. Animals are now
bought against level, barn slots and money, and the shop says which of
the three refused.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: The pen — rendering and hop-and-pause wandering

The old cows used `transition: all 2s linear` on a 2-second interval, which reads as gliding
teleportation. Short hops with pauses between them look alive.

**Files:**
- Modify: `games/farmer-dream.html` — CSS, `#centre` markup, new pen code

**Interfaces:**
- Produces: `penEl`, `animalEls` (Map of animal id → element), `buildPen()`, `renderPen()`, `wander()`.

- [ ] **Step 1: Add the pen markup and CSS**

After the `#farm` div inside `#centre`:

```html
    <h3 style="margin-top:14px">🐄 Pen</h3>
    <div id="pen"></div>
```

CSS:

```css
  #pen {
    position:relative; height:190px; overflow:hidden;
    background:linear-gradient(180deg,#aed581,#8bc34a);
    border:3px solid var(--wood-dark); border-radius:12px;
  }
  #pen.drop { outline:3px solid var(--gold); outline-offset:2px; }
  #pen .empty-note {
    position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
    font-size:13px; color:var(--wood-dark); opacity:.65;
  }
  .beast {
    position:absolute; font-size:32px; cursor:pointer; user-select:none;
    transition:left .9s ease-in-out, top .9s ease-in-out;
  }
  .beast .bubble {
    position:absolute; top:-16px; left:18px; font-size:15px;
    background:var(--cream); border:2px solid var(--wood);
    border-radius:9px; padding:0 3px; animation:blink 1.4s infinite;
  }
  .beast .ring {
    position:absolute; left:2px; right:2px; bottom:-5px; height:3px;
    background:rgba(0,0,0,.25); border-radius:2px; overflow:hidden;
  }
  .beast .ring i { display:block; height:100%; background:var(--gold); }
  .beast .tag {
    position:absolute; top:32px; left:50%; transform:translateX(-50%);
    font-size:9px; white-space:nowrap; color:var(--wood-dark);
  }
```

- [ ] **Step 2: Build and render the pen**

```js
const penEl = $('pen');
const animalEls = new Map();

function buildPen() {
  penEl.innerHTML = '';
  animalEls.clear();
  if (!S.animals.length) {
    penEl.innerHTML = '<div class="empty-note">Buy an animal from the 🐄 Barn tab</div>';
    return;
  }
  S.animals.forEach(a => {
    const el = document.createElement('div');
    el.className = 'beast';
    el.style.left = a.x + 'px';
    el.style.top = a.y + 'px';
    el.onclick = () => collectFrom(a.id);
    penEl.appendChild(el);
    animalEls.set(a.id, el);
  });
}

function renderPen() {
  const now = Date.now();
  S.animals.forEach(a => {
    const el = animalEls.get(a.id);
    if (!el) return;
    const st = animalState(a, now);
    const A = ANIMALS[a.type];
    const waiting = a.made;                     // uncollected products sitting on this animal
    el.innerHTML = A.icon +
      (st.phase === 'hungry' ? `<span class="bubble">${itemInfo(A.eats).icon}</span>` : '') +
      (waiting ? `<span class="bubble" style="left:-16px">${itemInfo(A.makes).icon}${waiting > 1 ? waiting : ''}</span>` : '') +
      `<span class="tag">${a.name}</span>` +
      (st.phase === 'working' ? `<div class="ring"><i style="width:${Math.round(st.progress * 100)}%"></i></div>` : '');
    el.style.left = a.x + 'px';
    el.style.top = a.y + 'px';
  });
}
```

- [ ] **Step 3: Hop and pause**

```js
// Each animal picks its own next hop time, so the herd never moves in lockstep.
function wander() {
  const w = penEl.clientWidth - 44;
  const h = penEl.clientHeight - 40;
  const now = Date.now();
  S.animals.forEach(a => {
    if (a.nextHop && now < a.nextHop) return;
    a.nextHop = now + 1600 + Math.random() * 3400;   // pause 1.6–5s between hops
    a.x = Math.max(4, Math.min(w, a.x + (Math.random() - 0.5) * 90));
    a.y = Math.max(4, Math.min(h, a.y + (Math.random() - 0.5) * 70));
  });
}
```

Call `wander()` from `tick()` immediately before `render()`. `nextHop` is transient — it is
saved harmlessly and re-derived on load, so it needs no backfill.

Add `renderPen();` at the end of `render()`, and `buildPen();` in `boot()` after `buildGrid()`.

- [ ] **Step 4: Verify**

Run: `node --test "tests/*.test.mjs"` — Expected: PASS.
Browser: the empty pen shows its hint. After buying a chicken it appears with its name under
it, hops to a new spot every few seconds at a different rhythm from any other animal, and
shows a 💭🌽 bubble because it starts hungry.

- [ ] **Step 5: Commit**

```bash
git add games/farmer-dream.html
git commit -m "feat(farmer-dream): draw the pen and give animals a hop-and-pause walk

A 2s linear transition on a 2s interval made the old cows glide
continuously like they were being dragged. Independent hop timers with
pauses between them read as alive.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: Feeding by drag

**Files:**
- Modify: `games/farmer-dream.html`

**Interfaces:**
- Consumes: `canFeed`, `feedAnimal`, `takeInv`, `ANIMALS`, `itemInfo`.
- Produces: `feedAt(animalId, item)`.

- [ ] **Step 1: Make each animal a drop target**

Inside `buildPen`'s `forEach`, after `el.onclick = …`:

```js
    el.ondragover = e => { e.preventDefault(); el.style.filter = 'brightness(1.25)'; };
    el.ondragleave = () => { el.style.filter = ''; };
    el.ondrop = e => {
      e.preventDefault();
      el.style.filter = '';
      if (e.dataTransfer.getData('type') !== 'inv') return;
      feedAt(a.id, e.dataTransfer.getData('item'));
    };
```

- [ ] **Step 2: Add the handler**

```js
function feedAt(animalId, item) {
  const idx = S.animals.findIndex(a => a.id === animalId);
  if (idx < 0) return;
  const a = S.animals[idx];
  const A = ANIMALS[a.type];
  const el = animalEls.get(animalId);
  const r = el ? el.getBoundingClientRect() : penEl.getBoundingClientRect();

  if (item !== A.eats) {
    Sound.bad();
    floatText(r.left, r.top - 10, `wants ${itemInfo(A.eats).icon}`, '#c62828');
    return;
  }
  if (!canFeed(a, Date.now(), S.inv)) {
    Sound.bad();
    floatText(r.left, r.top - 10, 'not hungry', '#c62828');
    return;
  }
  if (!takeInv(item)) return;

  S.animals[idx] = feedAnimal(a, Date.now());
  Sound.water();
  floatText(r.left, r.top - 10, itemInfo(item).icon + ' yum');
  save();
  render();
}
```

- [ ] **Step 3: Verify**

Run: `node --test "tests/*.test.mjs"` — Expected: PASS.
Browser: dragging 🌽 corn onto a hungry chicken consumes one corn, clears the 💭 bubble and
starts its progress ring. Dragging 🌾 rice onto the chicken says `wants 🌽` and consumes
nothing. Dragging corn onto a working chicken says `not hungry`.

- [ ] **Step 4: Commit**

```bash
git add games/farmer-dream.html
git commit -m "feat(farmer-dream): feed animals by dragging crops from the inventory

Rejected drops now say what the animal actually wants instead of
flashing the whole pen red, which gave the player nothing to act on.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: Products appear at the animal and are collected by clicking

**Files:**
- Modify: `games/farmer-dream.html`

**Interfaces:**
- Consumes: `animalState`, `addInv`, `PRODUCTS`, `xpBar`, `levelFor`.
- Produces: `collectFrom(animalId)`, `materialise()`.

- [ ] **Step 1: Materialise ready products on the tick**

```js
// animalState() says how many products are *earned*; a.made is how many have
// been shown. The gap is what appears in the pen this tick.
function materialise() {
  const now = Date.now();
  let changed = false;
  S.animals.forEach(a => {
    const ready = animalState(a, now).ready;
    if (ready > a.made) { a.made = ready; changed = true; }
  });
  if (changed) save();
}
```

Call `materialise()` from `tick()` immediately before `wander()`.

- [ ] **Step 2: Collect by clicking the animal**

```js
function collectFrom(animalId) {
  const a = S.animals.find(x => x.id === animalId);
  if (!a || a.made <= 0) return;

  const A = ANIMALS[a.type];
  const before = levelFor(S.xp);
  const n = a.made;
  addInv(A.makes, n);
  S.xp += 5 * n;
  a.made = 0;
  // Collecting is also what un-sticks a hungry animal's counter, so the next
  // feeding starts from a clean slate.

  const el = animalEls.get(animalId);
  const r = el ? el.getBoundingClientRect() : penEl.getBoundingClientRect();
  floatText(r.left + 6, r.top - 6, PRODUCTS[A.makes].icon + (n > 1 ? ' ×' + n : ''));
  Sound.harvest();
  if (levelFor(S.xp) > before) { Sound.level(); floatText(r.left, r.top - 30, 'LEVEL UP!', '#f9a825'); }

  save();
  render();
}
```

- [ ] **Step 3: Verify**

Run: `node --test "tests/*.test.mjs"` — Expected: PASS.
Browser: a fed chicken shows 🥚 beside it after 25s, 🥚2 after 50s, then goes 💭🌽 hungry at
three. Clicking it moves all of them into the inventory, adds XP, and clears the badge.
The eggs sell from the inventory for $35 each.

- [ ] **Step 4: Commit**

```bash
git add games/farmer-dream.html
git commit -m "feat(farmer-dream): drop animal products at the animal that made them

Milk used to be appended into the pen in normal flow, so it stacked in
the top-left corner over the cows instead of appearing where it came
from. Products now sit on their animal and are collected by clicking it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: Stage 2 verification pass

**Files:**
- Modify: `games/farmer-dream.html` (fixes only, if anything is found)

- [ ] **Step 1: Full suite**

Run: `node --test "tests/*.test.mjs"`
Expected: PASS — 102 farm-and-friends tests, zero failures.

- [ ] **Step 2: Confirm the FARM region is still DOM-free**

Run: `node -e "import('./tests/harness.mjs').then(h=>{const r=h.extract('FARM',h.FARM_GAME);const bad=r.match(/document|window|localStorage|Date\.now/g);console.log(bad?'LEAKED: '+bad.join(','):'clean')})"`
Expected: `clean`.

- [ ] **Step 3: Confirm no stale `CROPS[` item lookups remain**

Run: `grep -n "CROPS\[item\]" games/farmer-dream.html`
Expected: no matches — every inventory-item lookup goes through `itemInfo`.

- [ ] **Step 4: Update the rules modal**

Add to the `<ul>` in `#rulesModal`:

```html
      <li>🐄 Buy animals in the 🐄 Barn tab, then drag the crop they want onto them.</li>
      <li>💭 A thought bubble means hungry. One feeding makes three products.</li>
      <li>🥚 Click an animal to collect what it has made.</li>
```

- [ ] **Step 5: Hand the manual playtest to the user**

Ask the user to confirm, in order:
1. An existing Stage 1 save still loads, with money, crops and XP intact.
2. Barn tab lists seven animals, locked ones showing `🔒 Lv…`, slots reading `0/4`.
3. Buying a chicken at Lv2 fills a slot; a fifth purchase is refused with "Barn is full".
4. The chicken hops around with pauses, not a constant glide, and shows 💭🌽.
5. Dragging corn onto it feeds it; dragging rice says `wants 🌽`.
6. Eggs appear one at a time, cap at three, then it goes hungry.
7. Clicking it collects all waiting eggs into the inventory and grants XP.
8. Eggs sell for $35 each from the inventory.
9. Reload mid-cycle — the animal, its name, its clock and its waiting eggs all return.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix(farmer-dream): stage 2 playtest fixes

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Handoff to Stage 3

- `ITEM_TABLES` is the extension point: Stage 3 pushes `CRAFTED` onto it and `itemInfo`
  resolves crafted goods with no further change.
- `S.barn` exists and is backfilled; Stage 3's barn-expansion upgrade only has to raise it.
- `S.shopTab` already drives a tab strip; Stage 3 adds `'build'` and `'home'` to the same
  mechanism.
- Animals carry a `name` the player never sees an editor for yet — Stage 3's pet naming
  introduces the rename UI, and the same control should be reused for animals.
