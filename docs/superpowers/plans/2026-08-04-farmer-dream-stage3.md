# Farmer Dream — Stage 3 Implementation Plan (Machines, Upgrades, Orders, House, Pets)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the game — six processing machines, six money-gated upgrades, an orders
board, a day/night cycle with rain, a house you decorate by dragging furniture into a room,
eight earned pets, and a real win.

**Architecture:** Everything new that is arithmetic goes in the `FARM` region and gets unit
tests; everything that draws goes below it. The centre column becomes three views
(🌾 Farm / 🏡 Home / 🐾 Pets) driven by `S.view`, reusing the tab mechanism Stage 2 built for
the shop.

**Tech Stack:** Vanilla HTML/CSS/JS in `games/farmer-dream.html`. Tests via `node:test` +
`node:vm` through `tests/harness.mjs`.

**Spec:** `docs/superpowers/specs/2026-08-04-farmer-dream-design.md` §7–§13
**Builds on:** Stage 1 (complete) and Stage 2 (`2026-08-04-farmer-dream-stage2.md`)

## Global Constraints

- **Single self-contained file**, vanilla JS, emoji art, no network requests, works over `file://`.
- **The `FARM` region stays DOM-free.** No `document`, `window`, `localStorage` or `Date.now()`
  inside the markers. Time and randomness arrive as arguments.
- **English UI copy.** Warm cozy palette using the existing `:root` custom properties.
- **Do not bump the save version.** New fields are backfilled in `load()` exactly as Stage 2
  did, so a Stage 1 or Stage 2 farm survives.
- **Test command:** `node --test "tests/*.test.mjs"` — the glob is required.
- **Verification:** static checks plus the unit suite; no headless browser driving. Browser
  checks are written out for the user's manual playtest at Task 13.
- **Commits:** conventional, scoped `farmer-dream`. **No `Claude-Session:` trailer.**
- **Do not touch `index.html`.**

## Prerequisites from Stage 2

This plan assumes Stage 2 shipped and therefore that these exist: `PRODUCTS`, `ITEM_TABLES`,
`itemInfo`, `ANIMALS`, `animalState`, `FEED_YIELD`, `makeAnimal`, `canBuyAnimal`, `canFeed`,
`feedAnimal`, `S.animals`, `S.barn`, `S.shopTab`, `buildPen`, `renderPen`, `materialise`,
`collectFrom`, and an `advance()` that shifts animals as well as tiles.

## File Structure

| File | Change |
|---|---|
| `games/farmer-dream.html` | `FARM` region gains six new tables and their pure functions; three views and four new panels below. |
| `tests/farm.test.mjs` | Extended with machine, upgrade, order, house, pet and weather tests. |

### Deliberate deviations from the spec

- **`DAY_MS` moves into the `FARM` region** (Task 6). It currently sits in the UI half at
  `farmer-dream.html:399`, but `dayPhase` needs it and must stay testable.
- **Rain is derived from the day number, not stored.** A pure hash of `S.day` means weather
  survives a reload with no new save field and is reproducible in tests.
- **Pets are not placed by the player.** They roam automatically; only house items have
  positions. Spec §12 says pets roam both views, which is incompatible with fixed placement.

---

## Task 1: Machines — recipes and state

**Files:**
- Modify: `games/farmer-dream.html` (`FARM` region)
- Test: `tests/farm.test.mjs`

**Interfaces:**
- Produces:
  - `CRAFTED` — `{ [id]: { icon, name, sell } }`, pushed onto `ITEM_TABLES`
  - `MACHINES` — `{ [id]: { icon, name, cost, recipe, makes, time, level } }`
  - `machineState(m, now)` → `{ phase: 'idle'|'working'|'done', progress: 0..1 }`
  - `canCraft(type, inv)` → boolean
  - A **machine** is `{ type, startedAt }`; `startedAt` is `null` when idle.

- [ ] **Step 1: Write the failing tests**

```js
const { CRAFTED, MACHINES, machineState, canCraft } =
  load(['FARM'], ['CRAFTED', 'MACHINES', 'machineState', 'canCraft'], FARM_GAME);

test('CRAFTED holds the six goods and itemInfo resolves them', () => {
  assert.equal(Object.keys(CRAFTED).length, 6);
  assert.equal(CRAFTED.cake.sell, 520);
  assert.equal(itemInfo('cheese').sell, 170, 'CRAFTED must be registered in ITEM_TABLES');
});

test('every machine recipe names real items and makes a real crafted good', () => {
  Object.keys(MACHINES).forEach(k => {
    const M = MACHINES[k];
    assert.ok(CRAFTED[M.makes], `${k} makes an unknown good`);
    Object.keys(M.recipe).forEach(item =>
      assert.ok(itemInfo(item), `${k} needs an unknown item: ${item}`));
  });
});

test('every machine output is worth more than its inputs', () => {
  Object.keys(MACHINES).forEach(k => {
    const M = MACHINES[k];
    const inputs = Object.keys(M.recipe)
      .reduce((sum, item) => sum + itemInfo(item).sell * M.recipe[item], 0);
    assert.ok(CRAFTED[M.makes].sell > inputs,
      `${k} loses money: ${inputs} in, ${CRAFTED[M.makes].sell} out`);
  });
});

test('an idle machine reports idle', () => {
  assert.deepEqual(machineState({ type: 'press', startedAt: null }, 5000),
    { phase: 'idle', progress: 0 });
});

test('a running machine reports progress, then done', () => {
  const m = { type: 'press', startedAt: 0 };
  const t = MACHINES.press.time;
  assert.equal(machineState(m, 0).phase, 'working');
  assert.equal(machineState(m, t / 2).progress, 0.5);
  assert.equal(machineState(m, t).phase, 'done');
  assert.equal(machineState(m, t * 9).phase, 'done', 'it waits to be collected');
});

test('canCraft checks every ingredient and quantity', () => {
  assert.equal(canCraft('press', { milk: 2 }), true);
  assert.equal(canCraft('press', { milk: 1 }), false);
  assert.equal(canCraft('bakery', { rice: 2, egg: 1 }), true);
  assert.equal(canCraft('bakery', { rice: 2 }), false, 'missing the egg entirely');
  assert.equal(canCraft('bakery', { rice: 1, egg: 1 }), false, 'not enough rice');
  assert.equal(canCraft('press', {}), false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test "tests/farm.test.mjs"` — Expected: FAIL, `CRAFTED is not defined`.

- [ ] **Step 3: Implement in the FARM region**

```js
const CRAFTED = {
  bread:   { icon:'🍞', name:'Bread',   sell:130 },
  cheese:  { icon:'🧀', name:'Cheese',  sell:170 },
  ketchup: { icon:'🥫', name:'Ketchup', sell:190 },
  juice:   { icon:'🧃', name:'Juice',   sell:230 },
  wine:    { icon:'🍷', name:'Wine',    sell:340 },
  cake:    { icon:'🍰', name:'Cake',    sell:520 }
};
ITEM_TABLES.push(CRAFTED);

const MACHINES = {
  bakery:  { icon:'🍞', name:'Bakery',       cost:600,  recipe:{ rice:2, egg:1 },                    makes:'bread',   time:30000, level:4  },
  press:   { icon:'🧀', name:'Cheese press', cost:900,  recipe:{ milk:2 },                           makes:'cheese',  time:40000, level:6  },
  cannery: { icon:'🥫', name:'Cannery',      cost:1300, recipe:{ tomato:3 },                         makes:'ketchup', time:45000, level:7  },
  juicer:  { icon:'🧃', name:'Juicer',       cost:1800, recipe:{ strawberry:3 },                     makes:'juice',   time:40000, level:8  },
  winery:  { icon:'🍷', name:'Winery',       cost:2600, recipe:{ grapes:3 },                         makes:'wine',    time:70000, level:9  },
  kitchen: { icon:'🍰', name:'Kitchen',      cost:4000, recipe:{ milk:1, egg:1, rice:1, strawberry:1 }, makes:'cake', time:60000, level:10 }
};

// A machine is { type, startedAt }. startedAt is null when idle.
function machineState(m, now) {
  if (m.startedAt == null) return { phase:'idle', progress:0 };
  const T = MACHINES[m.type].time;
  const elapsed = Math.max(0, now - m.startedAt);
  if (elapsed >= T) return { phase:'done', progress:1 };
  return { phase:'working', progress: elapsed / T };
}

function canCraft(type, inv) {
  const r = MACHINES[type].recipe;
  const items = Object.keys(r);
  for (let i = 0; i < items.length; i++) {
    if ((inv[items[i]] || 0) < r[items[i]]) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test "tests/farm.test.mjs"` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/farmer-dream.html tests/farm.test.mjs
git commit -m "feat(farmer-dream): add crafted goods and the six machine recipes

The farm was a money printer with one conversion step. Machines turn it
into a supply chain, and a test asserts every recipe is worth more out
than in so a machine can never be a loss.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Upgrades and the land regrid

Expanding the farm changes the grid **width**, so the tiles array has to be reindexed. Done
naively it silently scrambles every planted crop — which is exactly why it belongs in the
tested region.

**Files:**
- Modify: `games/farmer-dream.html` (`FARM` region)
- Test: `tests/farm.test.mjs`

**Interfaces:**
- Produces:
  - `LAND_STEPS` — `[{ w, h, cost }]`, index 0 being the starting 5×3
  - `UPGRADES` — `{ [id]: { icon, name, cost, desc, repeatable } }` for the non-land ones
  - `regrid(tiles, fromW, fromH, toW, toH)` → a new tiles array preserving x/y positions
  - `sprinklerCost(owned)` → number

- [ ] **Step 1: Write the failing tests**

```js
const { LAND_STEPS, UPGRADES, regrid, sprinklerCost } =
  load(['FARM'], ['LAND_STEPS', 'UPGRADES', 'regrid', 'sprinklerCost'], FARM_GAME);

test('land steps run 5x3, 6x4, 7x5 at the spec prices', () => {
  assert.deepEqual(LAND_STEPS, [
    { w:5, h:3, cost:0 }, { w:6, h:4, cost:800 }, { w:7, h:5, cost:2200 }
  ]);
});

test('regrid keeps every crop at the same x,y when the farm grows', () => {
  // 5x3 farm, one marker per row so a width change is visible.
  const tiles = new Array(15).fill(null);
  tiles[0]  = 'topleft';     // (0,0)
  tiles[4]  = 'topright';    // (4,0)
  tiles[5]  = 'row1start';   // (0,1)
  tiles[14] = 'bottomright'; // (4,2)

  const out = regrid(tiles, 5, 3, 6, 4);
  assert.equal(out.length, 24);
  assert.equal(out[0], 'topleft',      '(0,0) stays at index 0');
  assert.equal(out[4], 'topright',     '(4,0) stays at index 4 on a 6-wide grid');
  assert.equal(out[6], 'row1start',    '(0,1) moves from index 5 to index 6');
  assert.equal(out[2 * 6 + 4], 'bottomright', '(4,2) moves to index 16');
});

test('regrid fills the new plots with null', () => {
  const out = regrid(new Array(15).fill(null), 5, 3, 6, 4);
  assert.equal(out.filter(t => t === null).length, 24);
});

test('regrid does not mutate the array it was given', () => {
  const tiles = new Array(15).fill(null);
  tiles[7] = 'keep';
  regrid(tiles, 5, 3, 6, 4);
  assert.equal(tiles.length, 15);
  assert.equal(tiles[7], 'keep');
});

test('sprinklers cost a flat 450 each', () => {
  assert.equal(sprinklerCost(0), 450);
  assert.equal(sprinklerCost(3), 450);
});

test('the non-land upgrades match the spec prices', () => {
  assert.equal(UPGRADES.bigCan.cost, 600);
  assert.equal(UPGRADES.scarecrow.cost, 700);
  assert.equal(UPGRADES.silo.cost, 1600);
  assert.equal(UPGRADES.barn.cost, 1000);
  assert.equal(UPGRADES.sprinkler.repeatable, true);
  assert.equal(UPGRADES.silo.repeatable, false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test "tests/farm.test.mjs"` — Expected: FAIL, `LAND_STEPS is not defined`.

- [ ] **Step 3: Implement in the FARM region**

```js
const LAND_STEPS = [
  { w:5, h:3, cost:0 },
  { w:6, h:4, cost:800 },
  { w:7, h:5, cost:2200 }
];

const UPGRADES = {
  sprinkler: { icon:'🚿', name:'Sprinkler row', cost:450,  repeatable:true,  desc:'Waters one row forever' },
  bigCan:    { icon:'🪣', name:'Big can',       cost:600,  repeatable:false, desc:'Waters 3 plots per drag' },
  scarecrow: { icon:'🧑‍🌾', name:'Scarecrow',   cost:700,  repeatable:false, desc:'Stops 🐦 stealing crops' },
  barn:      { icon:'🏚️', name:'Barn extension',cost:1000, repeatable:false, desc:'Barn slots 4 → 8' },
  silo:      { icon:'🏗️', name:'Silo',          cost:1600, repeatable:false, desc:'Auto-feeds your animals' }
};

function sprinklerCost(owned) { return UPGRADES.sprinkler.cost; }

// Growing the farm changes its width, so a flat index means something
// different afterwards. Copy by x,y or every planted crop teleports.
function regrid(tiles, fromW, fromH, toW, toH) {
  const out = new Array(toW * toH).fill(null);
  for (let y = 0; y < fromH && y < toH; y++) {
    for (let x = 0; x < fromW && x < toW; x++) {
      out[y * toW + x] = tiles[y * fromW + x];
    }
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test "tests/farm.test.mjs"` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/farmer-dream.html tests/farm.test.mjs
git commit -m "feat(farmer-dream): add upgrades and a tested land regrid

Growing the farm changes the grid width, so copying the tiles array
straight across would move every planted crop to a different plot.
regrid() copies by x,y and is tested against that exact failure.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Orders

**Files:**
- Modify: `games/farmer-dream.html` (`FARM` region)
- Test: `tests/farm.test.mjs`

**Interfaces:**
- Produces:
  - `ORDER_MULT` — 1.6
  - `ORDER_XP` — 60
  - `ORDER_DAYS` — 3
  - `orderValue(wants)` → market value of the requested items
  - `orderFilled(order, inv)` → boolean
  - `makeOrder(day, level, rnd)` → `{ wants, reward, day }`; `rnd` is a `() => 0..1` function
    so the caller supplies randomness and tests can supply a stub
  - `orderExpired(order, day)` → boolean

- [ ] **Step 1: Write the failing tests**

```js
const { ORDER_MULT, ORDER_XP, ORDER_DAYS, orderValue, orderFilled, makeOrder, orderExpired } =
  load(['FARM'],
       ['ORDER_MULT', 'ORDER_XP', 'ORDER_DAYS', 'orderValue', 'orderFilled', 'makeOrder', 'orderExpired'],
       FARM_GAME);

test('orderValue sums market price times quantity', () => {
  assert.equal(orderValue([{ item:'carrot', qty:3 }]), 75);
  assert.equal(orderValue([{ item:'carrot', qty:3 }, { item:'milk', qty:2 }]), 75 + 120);
});

test('orderFilled needs every line covered', () => {
  const wants = [{ item:'carrot', qty:3 }, { item:'milk', qty:2 }];
  assert.equal(orderFilled({ wants }, { carrot:3, milk:2 }), true);
  assert.equal(orderFilled({ wants }, { carrot:9, milk:9 }), true, 'surplus is fine');
  assert.equal(orderFilled({ wants }, { carrot:3, milk:1 }), false);
  assert.equal(orderFilled({ wants }, { carrot:3 }), false);
  assert.equal(orderFilled({ wants }, {}), false);
});

test('an order pays better than selling the items outright', () => {
  const o = makeOrder(1, 3, () => 0.5);
  assert.ok(o.reward > orderValue(o.wants),
    'the whole point is that filling an order beats a plain sale');
  assert.equal(o.reward, Math.round(orderValue(o.wants) * ORDER_MULT));
});

test('makeOrder only asks for things the player has unlocked', () => {
  for (let lv = 1; lv <= 10; lv++) {
    for (let r = 0; r < 1; r += 0.13) {
      const o = makeOrder(3, lv, () => r);
      o.wants.forEach(w => {
        const crop = CROPS[w.item];
        if (crop) assert.ok(UNLOCKS[w.item] <= lv,
          `level ${lv} order asked for locked crop ${w.item}`);
        assert.ok(itemInfo(w.item), `unknown item ${w.item}`);
        assert.ok(w.qty >= 1 && w.qty <= 5, `silly quantity ${w.qty}`);
      });
      assert.ok(o.wants.length >= 1 && o.wants.length <= 3);
    }
  }
});

test('makeOrder is deterministic for the same rnd', () => {
  assert.deepEqual(makeOrder(4, 6, () => 0.3), makeOrder(4, 6, () => 0.3));
});

test('an order expires three days after it was posted', () => {
  const o = makeOrder(2, 5, () => 0.5);
  assert.equal(o.day, 2);
  assert.equal(orderExpired(o, 4), false);
  assert.equal(orderExpired(o, 2 + ORDER_DAYS), true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test "tests/farm.test.mjs"` — Expected: FAIL, `orderValue is not defined`.

- [ ] **Step 3: Implement in the FARM region**

```js
const ORDER_MULT = 1.6;
const ORDER_XP = 60;
const ORDER_DAYS = 3;

function orderValue(wants) {
  return wants.reduce((sum, w) => sum + itemInfo(w.item).sell * w.qty, 0);
}

function orderFilled(order, inv) {
  return order.wants.every(w => (inv[w.item] || 0) >= w.qty);
}

function orderExpired(order, day) {
  return day - order.day >= ORDER_DAYS;
}

// `rnd` is injected so this stays pure and the tests can pin it.
function makeOrder(day, level, rnd) {
  const pool = Object.keys(CROPS).filter(id => UNLOCKS[id] <= level);
  Object.keys(PRODUCTS).forEach(id => {
    const src = Object.keys(ANIMALS).find(a => ANIMALS[a].makes === id);
    if (src && ANIMALS[src].level <= level) pool.push(id);
  });
  Object.keys(CRAFTED).forEach(id => {
    const src = Object.keys(MACHINES).find(m => MACHINES[m].makes === id);
    if (src && MACHINES[src].level <= level) pool.push(id);
  });

  const lines = 1 + Math.floor(rnd() * Math.min(3, pool.length));
  const wants = [];
  const used = {};
  for (let i = 0; i < lines; i++) {
    let pick = pool[Math.floor(rnd() * pool.length) % pool.length];
    if (used[pick]) continue;              // never ask for the same item twice
    used[pick] = true;
    wants.push({ item: pick, qty: 1 + Math.floor(rnd() * 4) });
  }
  if (!wants.length) wants.push({ item: pool[0], qty: 2 });

  return { wants, reward: Math.round(orderValue(wants) * ORDER_MULT), day };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test "tests/farm.test.mjs"` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/farmer-dream.html tests/farm.test.mjs
git commit -m "feat(farmer-dream): add the orders board maths

With one dominant crop there was never a reason to grow variety. Orders
ask for a mix and pay 1.6x market, and a test proves they can only ever
ask for things the player has actually unlocked.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: House items and comfort

**Files:**
- Modify: `games/farmer-dream.html` (`FARM` region)
- Test: `tests/farm.test.mjs`

**Interfaces:**
- Produces:
  - `HOUSE_ITEMS` — `{ [id]: { icon, name, price, band: 'floor'|'wall'|'yard'|'shell' } }`, 20 entries
  - `SHELL_ORDER` — `['shack', 'house', 'farmhouse']`
  - `houseTitle(n)` → the title for `n` placed items
  - `comfortMult(n)` → `1 + 0.01 * n`
  - `offlineCapFor(placedCount, hasTurtle)` → ms

- [ ] **Step 1: Write the failing tests**

```js
const { HOUSE_ITEMS, SHELL_ORDER, houseTitle, comfortMult, offlineCapFor } =
  load(['FARM'],
       ['HOUSE_ITEMS', 'SHELL_ORDER', 'houseTitle', 'comfortMult', 'offlineCapFor'],
       FARM_GAME);

test('there are exactly twenty house items, and buying all of them is the win', () => {
  assert.equal(Object.keys(HOUSE_ITEMS).length, 20);
});

test('the house items split into the four groups from the spec', () => {
  const count = b => Object.keys(HOUSE_ITEMS).filter(k => HOUSE_ITEMS[k].band === b).length;
  assert.equal(count('shell'), 2);
  assert.equal(count('floor'), 8);
  assert.equal(count('wall'), 5);
  assert.equal(count('yard'), 5);
});

test('no house item is a farm building or a plane', () => {
  const icons = Object.keys(HOUSE_ITEMS).map(k => HOUSE_ITEMS[k].icon);
  ['🏢', '🏬', '🏭', '✈️', '🛺'].forEach(bad =>
    assert.equal(icons.includes(bad), false, `${bad} cannot furnish a farmhouse`));
});

test('the yard tree and the fountain exist, because two pets depend on them', () => {
  assert.equal(HOUSE_ITEMS.tree.band, 'yard');
  assert.equal(HOUSE_ITEMS.fountain.band, 'yard');
});

test('the house title levels up every five items', () => {
  assert.equal(houseTitle(0), 'Bare Shack');
  assert.equal(houseTitle(4), 'Bare Shack');
  assert.equal(houseTitle(5), 'Cozy Shack');
  assert.equal(houseTitle(10), 'Warm Home');
  assert.equal(houseTitle(15), 'Dream Farmhouse');
  assert.equal(houseTitle(20), 'Dream Farmhouse');
});

test('each placed item makes an absence count one percent longer', () => {
  assert.equal(comfortMult(0), 1);
  assert.equal(Math.round(comfortMult(20) * 100) / 100, 1.2);
});

test('offlineCapFor stacks comfort with the turtle', () => {
  assert.equal(offlineCapFor(0, false), OFFLINE_CAP_MS);
  assert.equal(offlineCapFor(0, true), OFFLINE_CAP_MS * 2, 'the turtle doubles the window');
  assert.equal(offlineCapFor(20, false), OFFLINE_CAP_MS * 1.2);
  assert.equal(offlineCapFor(20, true), OFFLINE_CAP_MS * 2.4);
});

test('the two shells are ordered cheapest first', () => {
  assert.deepEqual(SHELL_ORDER, ['shack', 'house', 'farmhouse']);
  assert.ok(HOUSE_ITEMS.house.price < HOUSE_ITEMS.farmhouse.price);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test "tests/farm.test.mjs"` — Expected: FAIL, `HOUSE_ITEMS is not defined`.

- [ ] **Step 3: Implement in the FARM region**

```js
// The starting 🛖 shack is free and is not an item; `house` and `farmhouse`
// are the two purchasable shell upgrades.
const SHELL_ORDER = ['shack', 'house', 'farmhouse'];

const HOUSE_ITEMS = {
  chair:    { icon:'🪑',  name:'Chair',     price:80,   band:'floor' },
  plant:    { icon:'🪴',  name:'Pot plant', price:120,  band:'floor' },
  teddy:    { icon:'🧸',  name:'Teddy',     price:150,  band:'floor' },
  painting: { icon:'🖼️', name:'Painting',  price:200,  band:'wall'  },
  window:   { icon:'🪟',  name:'Window',    price:250,  band:'wall'  },
  lamp:     { icon:'💡',  name:'Lamp',      price:300,  band:'wall'  },
  clock:    { icon:'🕰️', name:'Clock',     price:350,  band:'floor' },
  mirror:   { icon:'🪞',  name:'Mirror',    price:400,  band:'wall'  },
  door:     { icon:'🚪',  name:'Door',      price:450,  band:'wall'  },
  tv:       { icon:'📺',  name:'TV',        price:600,  band:'floor' },
  sofa:     { icon:'🛋️', name:'Sofa',      price:800,  band:'floor' },
  bed:      { icon:'🛏️', name:'Bed',       price:900,  band:'floor' },
  bath:     { icon:'🛁',  name:'Bath',      price:1000, band:'floor' },
  house:    { icon:'🏠',  name:'House',     price:1200, band:'shell' },
  bike:     { icon:'🚲',  name:'Bicycle',   price:1400, band:'yard'  },
  tree:     { icon:'🌳',  name:'Tree',      price:1600, band:'yard'  },
  scooter:  { icon:'🛵',  name:'Scooter',   price:2000, band:'yard'  },
  fountain: { icon:'⛲',  name:'Fountain',  price:2500, band:'yard'  },
  farmhouse:{ icon:'🏡',  name:'Farmhouse', price:3500, band:'shell' },
  car:      { icon:'🚗',  name:'Car',       price:5000, band:'yard'  }
};

function houseTitle(n) {
  if (n >= 15) return 'Dream Farmhouse';
  if (n >= 10) return 'Warm Home';
  if (n >= 5)  return 'Cozy Shack';
  return 'Bare Shack';
}

function comfortMult(n) { return 1 + 0.01 * n; }

function offlineCapFor(placedCount, hasTurtle) {
  return OFFLINE_CAP_MS * comfortMult(placedCount) * (hasTurtle ? 2 : 1);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test "tests/farm.test.mjs"` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/farmer-dream.html tests/farm.test.mjs
git commit -m "feat(farmer-dream): replace the house item list with a furnishable set

The old twenty included a factory, a department store and a plane, which
cannot furnish a farmhouse. The new set is banded floor/wall/yard/shell
so the room can place each item somewhere it belongs.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Pets

**Files:**
- Modify: `games/farmer-dream.html` (`FARM` region)
- Test: `tests/farm.test.mjs`

**Interfaces:**
- Produces:
  - `PETS` — `{ [id]: { icon, name, hint, perk } }`, 8 entries in album order
  - `petsEarned(ctx)` → array of pet ids the player qualifies for, where
    `ctx = { xp, stats, house }` and `stats = { harvested, ordersDone, daysPlayed, sawNight }`

- [ ] **Step 1: Write the failing tests**

```js
const { PETS, petsEarned } = load(['FARM'], ['PETS', 'petsEarned'], FARM_GAME);

const ctx = (over = {}) => ({
  xp: 0,
  house: { placed: {} },
  stats: { harvested: {}, ordersDone: 0, daysPlayed: [], sawNight: false },
  ...over
});

test('there are eight pets and each has a hint the album can show', () => {
  assert.equal(Object.keys(PETS).length, 8);
  Object.keys(PETS).forEach(k => {
    assert.ok(PETS[k].hint, `${k} has no hint`);
    assert.ok(PETS[k].icon, `${k} has no icon`);
  });
});

test('a brand new farm has earned no pets', () => {
  assert.deepEqual(petsEarned(ctx()), []);
});

test('the dog arrives with the first completed order', () => {
  assert.deepEqual(petsEarned(ctx({ stats: { ...ctx().stats, ordersDone: 1 } })), ['dog']);
});

test('the cat arrives at level 5', () => {
  assert.equal(petsEarned(ctx({ xp: 289 })).includes('cat'), false);
  assert.equal(petsEarned(ctx({ xp: 290 })).includes('cat'), true);
});

test('the rabbit needs fifty carrots', () => {
  assert.equal(petsEarned(ctx({ stats: { ...ctx().stats, harvested: { carrot: 49 } } })).includes('rabbit'), false);
  assert.equal(petsEarned(ctx({ stats: { ...ctx().stats, harvested: { carrot: 50 } } })).includes('rabbit'), true);
});

test('the bluebird needs a single sunflower', () => {
  assert.equal(petsEarned(ctx({ stats: { ...ctx().stats, harvested: { sunflower: 1 } } })).includes('bluebird'), true);
});

test('the squirrel and swan come from house items', () => {
  assert.equal(petsEarned(ctx({ house: { placed: { tree: { x:1, y:1 } } } })).includes('squirrel'), true);
  assert.equal(petsEarned(ctx({ house: { placed: { fountain: { x:1, y:1 } } } })).includes('swan'), true);
});

test('the turtle needs five distinct days played', () => {
  const four = ctx({ stats: { ...ctx().stats, daysPlayed: [1, 2, 3, 4] } });
  const five = ctx({ stats: { ...ctx().stats, daysPlayed: [1, 2, 3, 4, 5] } });
  assert.equal(petsEarned(four).includes('turtle'), false);
  assert.equal(petsEarned(five).includes('turtle'), true);
});

test('the fox needs a night visit', () => {
  assert.equal(petsEarned(ctx({ stats: { ...ctx().stats, sawNight: true } })).includes('fox'), true);
});

test('petsEarned returns ids in album order, not discovery order', () => {
  const all = petsEarned(ctx({
    xp: 2000,
    house: { placed: { tree:{}, fountain:{} } },
    stats: { harvested:{ carrot:50, sunflower:1 }, ordersDone:1, daysPlayed:[1,2,3,4,5], sawNight:true }
  }));
  assert.deepEqual(all, Object.keys(PETS));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test "tests/farm.test.mjs"` — Expected: FAIL, `PETS is not defined`.

- [ ] **Step 3: Implement in the FARM region**

```js
const PETS = {
  dog:      { icon:'🐕',  name:'Dog',      hint:'Complete an order',        perk:'Chases 🐦 off the farm' },
  cat:      { icon:'🐈',  name:'Cat',      hint:'Reach level 5',            perk:'Naps on your furniture' },
  rabbit:   { icon:'🐇',  name:'Rabbit',   hint:'Harvest 50 🥕',            perk:'+5% growth on 🥕 and 🥬' },
  squirrel: { icon:'🐿️', name:'Squirrel', hint:'Buy the 🌳 for your yard', perk:'Lives in the tree' },
  bluebird: { icon:'🐦',  name:'Bluebird', hint:'Harvest a 🌻',             perk:'Perches on the scarecrow' },
  turtle:   { icon:'🐢',  name:'Turtle',   hint:'Play on 5 different days', perk:'Doubles offline growth' },
  swan:     { icon:'🦢',  name:'Swan',     hint:'Buy the ⛲ for your yard', perk:'Swims in the fountain' },
  fox:      { icon:'🦊',  name:'Fox',      hint:'Visit at night',           perk:'Mischief — the 🐕 keeps it honest' }
};

// Pure over a context so the album, the tick and the tests all agree.
const PET_RULES = {
  dog:      c => c.stats.ordersDone >= 1,
  cat:      c => levelFor(c.xp) >= 5,
  rabbit:   c => (c.stats.harvested.carrot || 0) >= 50,
  squirrel: c => !!c.house.placed.tree,
  bluebird: c => (c.stats.harvested.sunflower || 0) >= 1,
  turtle:   c => c.stats.daysPlayed.length >= 5,
  swan:     c => !!c.house.placed.fountain,
  fox:      c => !!c.stats.sawNight
};

function petsEarned(ctx) {
  return Object.keys(PETS).filter(id => PET_RULES[id](ctx));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test "tests/farm.test.mjs"` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/farmer-dream.html tests/farm.test.mjs
git commit -m "feat(farmer-dream): add the eight pets and their earn conditions

Pets are earned rather than bought, one per system, so every mechanic
has something waiting behind it. The rules are pure so the album, the
tick and the tests cannot disagree about what is unlocked.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: The day cycle and weather

`DAY_MS` currently lives in the UI half at `farmer-dream.html:399`. Move it into the `FARM`
region — `dayPhase` needs it and must stay testable.

**Files:**
- Modify: `games/farmer-dream.html` (`FARM` region, and delete the old `DAY_MS` line)
- Test: `tests/farm.test.mjs`

**Interfaces:**
- Produces:
  - `DAY_MS` — 180000, **moved** into the region
  - `PHASES` — `['dawn', 'day', 'dusk', 'night']`
  - `dayPhase(dayStartedAt, now)` → `{ phase, index, into: 0..1 }`
  - `isRainy(day)` → boolean, derived from the day number so it needs no save field

- [ ] **Step 1: Write the failing tests**

```js
const { DAY_MS, PHASES, dayPhase, isRainy } =
  load(['FARM'], ['DAY_MS', 'PHASES', 'dayPhase', 'isRainy'], FARM_GAME);

test('a day is three real minutes in four phases', () => {
  assert.equal(DAY_MS, 180000);
  assert.deepEqual(PHASES, ['dawn', 'day', 'dusk', 'night']);
});

test('dayPhase walks the four phases across the day', () => {
  const q = DAY_MS / 4;
  assert.equal(dayPhase(0, 0).phase, 'dawn');
  assert.equal(dayPhase(0, q).phase, 'day');
  assert.equal(dayPhase(0, q * 2).phase, 'dusk');
  assert.equal(dayPhase(0, q * 3).phase, 'night');
  assert.equal(dayPhase(0, q * 3.99).phase, 'night');
});

test('dayPhase reports how far into the phase we are', () => {
  const q = DAY_MS / 4;
  assert.equal(dayPhase(0, q * 1.5).into, 0.5);
  assert.equal(dayPhase(0, q * 1.5).index, 1);
});

test('dayPhase handles a day already in progress', () => {
  const q = DAY_MS / 4;
  assert.equal(dayPhase(1000, 1000 + q * 3).phase, 'night');
});

test('isRainy is stable for a given day, so a reload cannot reroll the weather', () => {
  for (let d = 1; d <= 40; d++) assert.equal(isRainy(d), isRainy(d));
});

test('rain lands on roughly one day in five', () => {
  let wet = 0;
  for (let d = 1; d <= 400; d++) if (isRainy(d)) wet++;
  assert.ok(wet > 40 && wet < 120, `expected ~80 rainy days in 400, got ${wet}`);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test "tests/farm.test.mjs"` — Expected: FAIL, `PHASES is not defined`.

- [ ] **Step 3: Implement in the FARM region and delete the old constant**

Add to the region:

```js
const DAY_MS = 180000;                       // 3 real minutes per in-game day
const PHASES = ['dawn', 'day', 'dusk', 'night'];

function dayPhase(dayStartedAt, now) {
  const q = DAY_MS / 4;
  const into = Math.max(0, now - dayStartedAt) % DAY_MS;
  const index = Math.min(PHASES.length - 1, Math.floor(into / q));
  return { phase: PHASES[index], index, into: (into % q) / q };
}

// Derived from the day number rather than stored, so weather survives a
// reload with no new save field and is reproducible in tests.
function isRainy(day) {
  const h = Math.sin(day * 12.9898) * 43758.5453;
  return (h - Math.floor(h)) < 0.2;
}
```

Delete the old line `const DAY_MS = 180000;   // 3 real minutes per in-game day` from the UI
half (`farmer-dream.html:399`) — leaving both is a redeclaration and `tick()` already reads it.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test "tests/*.test.mjs"` — Expected: PASS, including the syntax gate that would
catch a duplicate `const DAY_MS`.

- [ ] **Step 5: Commit**

```bash
git add games/farmer-dream.html tests/farm.test.mjs
git commit -m "feat(farmer-dream): add day phases and deterministic weather

DAY_MS sat in the untested UI half where dayPhase could not reach it.
Rain is hashed from the day number so a reload cannot reroll it into a
different forecast than the one the player was promised.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: State growth and the machines panel

**Files:**
- Modify: `games/farmer-dream.html` — `fresh()`, `load()`, `#centre` markup, CSS, machine code

**Interfaces:**
- Consumes: `MACHINES`, `machineState`, `canCraft`, `takeInv`, `addInv`, `itemInfo`.
- Produces: `renderMachines()`, `startMachine(i)`, `collectMachine(i)`.

- [ ] **Step 1: Grow the state**

In `fresh()`:

```js
    animals: [], barn: 4, shopTab: 'seeds',
    view: 'farm',
    machines: [],
    upgrades: { land: 0, sprinklerRows: [], bigCan: false, scarecrow: false, silo: false, barn: false },
    house: { shell: 'shack', placed: {} },
    pets: [],
    order: null,
    stats: { harvested: {}, ordersDone: 0, daysPlayed: [], sawNight: false }
```

In `load()`, alongside the Stage 2 backfills:

```js
  // Stage 3 fields. Backfilled rather than version-bumped so a Stage 1 or
  // Stage 2 farm keeps its money, crops, animals and XP.
  if (data.view !== 'home' && data.view !== 'pets') data.view = 'farm';
  if (!Array.isArray(data.machines)) data.machines = [];
  if (!Array.isArray(data.pets)) data.pets = [];
  if (!data.house || typeof data.house !== 'object') data.house = { shell:'shack', placed:{} };
  if (!data.house.placed) data.house.placed = {};
  if (!data.upgrades || typeof data.upgrades !== 'object') data.upgrades = {};
  const u = data.upgrades;
  if (typeof u.land !== 'number') u.land = 0;
  if (!Array.isArray(u.sprinklerRows)) u.sprinklerRows = [];
  ['bigCan', 'scarecrow', 'silo', 'barn'].forEach(k => { if (typeof u[k] !== 'boolean') u[k] = false; });
  if (!data.stats || typeof data.stats !== 'object') data.stats = {};
  if (!data.stats.harvested) data.stats.harvested = {};
  if (typeof data.stats.ordersDone !== 'number') data.stats.ordersDone = 0;
  if (!Array.isArray(data.stats.daysPlayed)) data.stats.daysPlayed = [];
  if (typeof data.stats.sawNight !== 'boolean') data.stats.sawNight = false;
  if (data.order === undefined) data.order = null;
```

Also change the offline cap so comfort and the turtle count. Replace the `advance` call in
`load()`:

```js
  // `pets` holds objects ({ type, name, x, y }), not id strings — see Task 11.
  // Comfort counts every house item *bought*, including ones still waiting to
  // be dragged into the room, so buying always pays off immediately.
  const hasTurtle = data.pets.some(p => p.type === 'turtle');
  const cap = offlineCapFor(Object.keys(data.house.placed).length, hasTurtle);
  const skip = Math.max(0, elapsedMs - cap);
  data.dayStartedAt += skip;
  S = advance(data, elapsedMs, cap);
```

- [ ] **Step 2: Add the machines markup and CSS**

After the pen inside `#centre`:

```html
    <h3 style="margin-top:14px">⚙️ Workshop</h3>
    <div id="machines"></div>
```

CSS:

```css
  #machines { display:flex; flex-wrap:wrap; gap:8px; min-height:40px; }
  .machine {
    position:relative; width:96px; padding:8px 6px; text-align:center; font-size:26px;
    background:var(--cream); border:2px solid var(--wood); border-radius:10px; cursor:pointer;
  }
  .machine .label { display:block; font-size:10px; }
  .machine .bar { position:static; margin-top:4px; height:5px; background:rgba(0,0,0,.2);
                  border-radius:3px; overflow:hidden; }
  .machine .bar i { display:block; height:100%; background:var(--gold); }
  .machine.done { animation:bob 1.2s ease-in-out infinite; border-color:var(--gold); }
  .machine .none { font-size:11px; opacity:.6; }
```

- [ ] **Step 3: Render and drive the machines**

```js
const machinesEl = $('machines');

function startMachine(i) {
  const m = S.machines[i];
  const M = MACHINES[m.type];
  if (machineState(m, Date.now()).phase !== 'idle') return;
  if (!canCraft(m.type, S.inv)) {
    Sound.bad();
    const need = Object.keys(M.recipe)
      .map(it => `${M.recipe[it]}× ${itemInfo(it).icon}`).join(' + ');
    const r = machinesEl.getBoundingClientRect();
    floatText(r.left, r.top, 'needs ' + need, '#c62828');
    return;
  }
  Object.keys(M.recipe).forEach(it => takeInv(it, M.recipe[it]));
  m.startedAt = Date.now();
  Sound.water();
  save(); render();
}

function collectMachine(i) {
  const m = S.machines[i];
  if (machineState(m, Date.now()).phase !== 'done') return;
  const M = MACHINES[m.type];
  const before = levelFor(S.xp);
  addInv(M.makes, 1);
  S.xp += 15;
  m.startedAt = null;
  const r = machinesEl.getBoundingClientRect();
  floatText(r.left + 10, r.top, CRAFTED[M.makes].icon);
  Sound.harvest();
  if (levelFor(S.xp) > before) { Sound.level(); floatText(r.left, r.top - 24, 'LEVEL UP!', '#f9a825'); }
  save(); render();
}

function renderMachines() {
  if (!S.machines.length) {
    machinesEl.innerHTML = '<div class="none">Buy a machine in the 🔨 Build tab</div>';
    return;
  }
  const now = Date.now();
  machinesEl.innerHTML = '';
  S.machines.forEach((m, i) => {
    const M = MACHINES[m.type];
    const st = machineState(m, now);
    const el = document.createElement('div');
    el.className = 'machine' + (st.phase === 'done' ? ' done' : '');
    el.title = Object.keys(M.recipe).map(it => `${M.recipe[it]}× ${itemInfo(it).name}`).join(' + ')
             + ' → ' + CRAFTED[M.makes].name;
    el.innerHTML = (st.phase === 'done' ? CRAFTED[M.makes].icon : M.icon) +
      `<span class="label">${st.phase === 'done' ? 'Collect' : M.name}</span>` +
      (st.phase === 'working' ? `<div class="bar"><i style="width:${Math.round(st.progress * 100)}%"></i></div>` : '');
    el.onclick = () => st.phase === 'done' ? collectMachine(i) : startMachine(i);
    machinesEl.appendChild(el);
  });
}
```

Add `renderMachines();` to the end of `render()`.

- [ ] **Step 4: Verify**

Run: `node --test "tests/*.test.mjs"` — Expected: PASS.
Browser: the Workshop shows its hint with no machines. (Buying one arrives in Task 8; to check
now, run `S.machines.push({type:'press',startedAt:null}); render()` in the console — with 2 milk
in the inventory, clicking it consumes them and starts a 40s bar, then it bobs and hands over
a 🧀.)

- [ ] **Step 5: Commit**

```bash
git add games/farmer-dream.html
git commit -m "feat(farmer-dream): add the workshop and drive the six machines

Backfills every Stage 3 save field rather than bumping the schema
version, which load() would have treated as unreadable and discarded
along with the player's whole farm.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: The Build tab — machines, upgrades and land

**Files:**
- Modify: `games/farmer-dream.html` — tab strip, new panel, buy handlers

**Interfaces:**
- Consumes: `MACHINES`, `UPGRADES`, `LAND_STEPS`, `regrid`, `sprinklerCost`, `levelFor`.
- Produces: `renderBuild()`, `buyMachine(type)`, `buyUpgrade(id)`, `buyLand()`.

- [ ] **Step 1: Add the tab**

In the `#left` tab strip:

```html
      <button class="tab" data-tab="build">🔨 Build</button>
```

And the panel, after `#barnShop`:

```html
    <div id="buildShop" hidden></div>
```

Extend the two `hidden` lines in the tab click handler and in `boot()` to cover it:

```js
    $('buildShop').hidden = S.shopTab !== 'build';
```

- [ ] **Step 2: Buy handlers**

```js
function buyMachine(type) {
  const M = MACHINES[type];
  if (levelFor(S.xp) < M.level || S.money < M.cost) return Sound.bad();
  if (S.machines.some(m => m.type === type)) return Sound.bad();   // one of each
  S.money -= M.cost;
  S.machines.push({ type, startedAt: null });
  Sound.plant(); save(); render();
}

function buyLand() {
  const next = S.upgrades.land + 1;
  const step = LAND_STEPS[next];
  if (!step || S.money < step.cost) return Sound.bad();
  const from = LAND_STEPS[S.upgrades.land];
  S.money -= step.cost;
  S.tiles = regrid(S.tiles, from.w, from.h, step.w, step.h);
  S.gridW = step.w;
  S.gridH = step.h;
  S.upgrades.land = next;
  Sound.level();
  save();
  buildGrid();            // the grid changed shape, so rebuild the cells
  render();
}

function buyUpgrade(id) {
  const U = UPGRADES[id];
  if (id === 'sprinkler') {
    const owned = S.upgrades.sprinklerRows.length;
    if (owned >= S.gridH || S.money < sprinklerCost(owned)) return Sound.bad();
    S.money -= sprinklerCost(owned);
    S.upgrades.sprinklerRows.push(owned);      // rows fill top-down
  } else {
    if (S.upgrades[id] || S.money < U.cost) return Sound.bad();
    S.money -= U.cost;
    S.upgrades[id] = true;
    if (id === 'barn') S.barn = 8;
  }
  Sound.plant(); save(); render();
}
```

- [ ] **Step 3: Render the Build panel**

```js
const buildEl = $('buildShop');
let lastBuildSig = null;

function renderBuild() {
  const lv = levelFor(S.xp);
  const sig = [lv, S.money, S.machines.length, S.upgrades.land,
               S.upgrades.sprinklerRows.length,
               S.upgrades.bigCan, S.upgrades.scarecrow, S.upgrades.silo, S.upgrades.barn].join('|');
  if (sig === lastBuildSig) return;
  lastBuildSig = sig;
  buildEl.innerHTML = '';

  const row = (icon, name, right, onclick, dim, title) => {
    const d = document.createElement('div');
    d.className = 'shop-item' + (dim ? ' locked' : '');
    d.innerHTML = `<span>${icon}</span><span>${name}</span><span class="price">${right}</span>`;
    if (title) d.title = title;
    if (!dim && onclick) { d.onclick = onclick; d.style.cursor = 'pointer'; }
    buildEl.appendChild(d);
  };

  const next = LAND_STEPS[S.upgrades.land + 1];
  if (next) row('🟫', `Farm ${next.w}×${next.h}`, '$' + next.cost, buyLand, S.money < next.cost);
  else      row('🟫', 'Farm at full size', '✓', null, true);

  const rows = S.upgrades.sprinklerRows.length;
  row('🚿', 'Sprinkler row', rows >= S.gridH ? '✓' : '$' + sprinklerCost(rows),
      () => buyUpgrade('sprinkler'), rows >= S.gridH || S.money < sprinklerCost(rows),
      UPGRADES.sprinkler.desc);

  ['bigCan', 'scarecrow', 'barn', 'silo'].forEach(id => {
    const U = UPGRADES[id];
    row(U.icon, U.name, S.upgrades[id] ? '✓' : '$' + U.cost,
        () => buyUpgrade(id), S.upgrades[id] || S.money < U.cost, U.desc);
  });

  Object.keys(MACHINES).forEach(type => {
    const M = MACHINES[type];
    const owned = S.machines.some(m => m.type === type);
    const locked = lv < M.level;
    row(M.icon, M.name,
        owned ? '✓' : locked ? 'Lv' + M.level : '$' + M.cost,
        () => buyMachine(type), owned || locked || S.money < M.cost,
        Object.keys(M.recipe).map(it => `${M.recipe[it]}× ${itemInfo(it).name}`).join(' + ')
          + ' → ' + CRAFTED[M.makes].name);
  });
}
```

Add `renderBuild();` to `render()`.

- [ ] **Step 4: Make sprinklers actually water**

In `tick()`, before `render()`:

```js
  if (S.upgrades.sprinklerRows.length) {
    const now = Date.now();
    S.upgrades.sprinklerRows.forEach(rowIdx => {
      for (let x = 0; x < S.gridW; x++) {
        const i = rowIdx * S.gridW + x;
        const t = S.tiles[i];
        if (t && cropStage(t, now).phase === 'thirsty') S.tiles[i] = waterTile(t, now);
      }
    });
  }
```

- [ ] **Step 5: Verify**

Run: `node --test "tests/*.test.mjs"` — Expected: PASS.
Browser: the Build tab lists land, sprinkler, four upgrades and six machines. **Plant crops in
the bottom row, then buy the 6×4 land** — every crop must stay in the same visual position, not
shift left. A sprinkler row waters its plots on its own. The barn extension raises slots to 8.

- [ ] **Step 6: Commit**

```bash
git add games/farmer-dream.html
git commit -m "feat(farmer-dream): add the build tab, upgrades and farm expansion

Money only ever bought decorations, so there was nothing to save toward
that changed play. Expanding the farm routes through regrid() so growing
it cannot scramble the crops already in the ground.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: The orders board

**Files:**
- Modify: `games/farmer-dream.html` — `#right` markup, CSS, order code

**Interfaces:**
- Consumes: `makeOrder`, `orderFilled`, `orderExpired`, `orderValue`, `ORDER_XP`, `takeInv`.
- Produces: `renderOrder()`, `refreshOrder()`, `deliverOrder()`.

- [ ] **Step 1: Markup and CSS**

In `#right`, above the Inventory heading:

```html
    <h3>📋 Order</h3>
    <div id="order"></div>
```

```css
  #order { font-size:13px; margin-bottom:12px; }
  #order .want { display:inline-block; margin-right:8px; font-size:19px; }
  #order .want b { font-size:12px; }
  #order .want.short { opacity:.4; }
  #order .reward { font-weight:bold; color:var(--grass-dark); }
  #order .none { opacity:.6; font-size:12px; }
```

- [ ] **Step 2: Generate, expire and deliver**

```js
const orderEl = $('order');

function refreshOrder() {
  S.order = makeOrder(S.day, levelFor(S.xp), Math.random);
}

function deliverOrder() {
  if (!S.order || !orderFilled(S.order, S.inv)) return Sound.bad();
  S.order.wants.forEach(w => takeInv(w.item, w.qty));
  const before = levelFor(S.xp);
  S.money += S.order.reward;
  S.xp += ORDER_XP;
  S.stats.ordersDone++;
  const r = orderEl.getBoundingClientRect();
  floatText(r.left + 10, r.top, '+$' + S.order.reward);
  Sound.sell();
  if (levelFor(S.xp) > before) { Sound.level(); floatText(r.left, r.top - 24, 'LEVEL UP!', '#f9a825'); }
  refreshOrder();
  save(); render();
}

function renderOrder() {
  if (!S.order) { orderEl.innerHTML = '<div class="none">No order right now</div>'; return; }
  const ready = orderFilled(S.order, S.inv);
  orderEl.innerHTML =
    S.order.wants.map(w => {
      const have = S.inv[w.item] || 0;
      return `<span class="want${have >= w.qty ? '' : ' short'}" title="${itemInfo(w.item).name}">` +
             `${itemInfo(w.item).icon}<b>${have}/${w.qty}</b></span>`;
    }).join('') +
    `<div class="reward">→ $${S.order.reward}</div>` +
    (ready ? '<button class="btn" id="deliverBtn" style="margin-top:6px;padding:6px 14px;font-size:14px">Deliver</button>' : '');
  if (ready) $('deliverBtn').onclick = deliverOrder;
}
```

In `tick()`, after the day-rollover loop:

```js
  if (!S.order || orderExpired(S.order, S.day)) refreshOrder();
```

Add `renderOrder();` to `render()`.

- [ ] **Step 3: Verify**

Run: `node --test "tests/*.test.mjs"` — Expected: PASS.
Browser: an order appears asking for 1–3 unlocked items with `have/need` counts. Missing lines
are dimmed. Once every line is met the **Deliver** button appears; delivering consumes exactly
the requested quantities, pays more than selling them would, grants 60 XP and posts a new order.

- [ ] **Step 4: Commit**

```bash
git add games/farmer-dream.html
git commit -m "feat(farmer-dream): add the orders board

Nothing rewarded variety, so the optimal farm was fifteen plots of the
single best crop. Orders ask for a mix and pay 1.6x market for it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: Three views, and the house you decorate

**Files:**
- Modify: `games/farmer-dream.html` — `#centre` markup, CSS, view switching, house code

**Interfaces:**
- Consumes: `HOUSE_ITEMS`, `houseTitle`, `SHELL_ORDER`, `itemInfo`.
- Produces: `setView(v)`, `renderHome()`, `buyHouseItem(id)`, `placeItem(id, x, y)`, `houseCount()`.

- [ ] **Step 1: Wrap the centre column in views**

Replace `#centre`'s contents so the existing farm/pen/workshop live in one view:

```html
  <div class="panel" id="centre">
    <div class="tabs">
      <button class="vtab on" data-view="farm">🌾 Farm</button>
      <button class="vtab" data-view="home">🏡 Home</button>
      <button class="vtab" data-view="pets">🐾 Pets</button>
    </div>

    <div id="viewFarm">
      <div id="farm"></div>
      <h3 style="margin-top:14px">🐄 Pen</h3>
      <div id="pen"></div>
      <h3 style="margin-top:14px">⚙️ Workshop</h3>
      <div id="machines"></div>
    </div>

    <div id="viewHome" hidden>
      <div id="homeTitle"></div>
      <div id="room">
        <div class="band wall" id="wallBand"></div>
        <div class="band floor" id="floorBand"></div>
      </div>
      <div id="yard"></div>
      <h3 style="margin-top:12px">🛍️ Furniture</h3>
      <div id="homeShop"></div>
      <div id="unplaced"></div>
    </div>

    <div id="viewPets" hidden></div>
  </div>
```

```css
  .vtab { flex:1; font:inherit; font-size:13px; cursor:pointer; padding:6px 4px;
          color:var(--wood); background:var(--cream);
          border:2px solid var(--wood); border-radius:8px 8px 0 0; }
  .vtab.on { color:var(--wheat); background:var(--wood); }

  #homeTitle { font-weight:bold; margin-bottom:8px; }
  #room { position:relative; height:230px; border:3px solid var(--wood-dark);
          border-radius:10px; overflow:hidden; transition:height .4s; }
  #room.house { height:280px; }
  #room.farmhouse { height:330px; }
  .band { position:absolute; left:0; right:0; }
  .band.wall  { top:0; height:45%; background:repeating-linear-gradient(90deg,#e9d5b0,#e9d5b0 22px,#e0c9a2 22px,#e0c9a2 44px); }
  .band.floor { bottom:0; height:55%; background:repeating-linear-gradient(90deg,#b98b5e,#b98b5e 26px,#a97a4d 26px,#a97a4d 52px); }
  .band.over  { outline:3px dashed var(--gold); outline-offset:-4px; }
  #yard { position:relative; height:90px; margin-top:8px; border:3px solid var(--wood-dark);
          border-radius:10px; overflow:hidden; background:linear-gradient(180deg,#c5e1a5,#9ccc65); }
  .placed { position:absolute; font-size:30px; cursor:grab; user-select:none; }
  #unplaced { margin-top:8px; min-height:34px; font-size:13px; }
  #unplaced .pending { font-size:28px; cursor:grab; margin-right:6px; }
  #room.night .band.wall { filter:brightness(.55); }
  #room.night.lit .band.wall { filter:brightness(.55) drop-shadow(0 0 12px #ffe082); }
```

- [ ] **Step 2: View switching**

```js
function setView(v) {
  S.view = v;
  document.querySelectorAll('.vtab').forEach(b => b.classList.toggle('on', b.dataset.view === v));
  $('viewFarm').hidden = v !== 'farm';
  $('viewHome').hidden = v !== 'home';
  $('viewPets').hidden = v !== 'pets';
  save(); render();
}
document.querySelectorAll('.vtab').forEach(b => { b.onclick = () => setView(b.dataset.view); });
```

Call `setView(S.view)` in `boot()` after `buildPen()`.

- [ ] **Step 3: Buying and placing**

```js
function houseCount() { return Object.keys(S.house.placed).length; }

function buyHouseItem(id) {
  const H = HOUSE_ITEMS[id];
  if (S.house.placed[id] || S.money < H.price) return Sound.bad();
  S.money -= H.price;

  if (H.band === 'shell') {
    // A shell upgrade grows the room. Furniture keeps its coordinates, which
    // is the whole point — the shack becomes a house around your things.
    S.house.shell = id === 'house' ? 'house' : 'farmhouse';
    S.house.placed[id] = { x: 0, y: 0 };
  } else {
    S.house.placed[id] = null;              // null = bought but not yet placed
  }
  Sound.level();
  save(); render();
  if (houseCount() >= Object.keys(HOUSE_ITEMS).length) showWin();
}

function placeItem(id, x, y) {
  S.house.placed[id] = { x, y };
  Sound.plant();
  save(); render();
}
```

- [ ] **Step 4: Render the room**

```js
function renderHome() {
  const room = $('room'), wall = $('wallBand'), floor = $('floorBand'), yard = $('yard');
  const n = houseCount();
  $('homeTitle').textContent = `${houseTitle(n)}  ⭐ ${n}/${Object.keys(HOUSE_ITEMS).length}`;
  room.className = S.house.shell + (S.house.placed.lamp ? ' lit' : '');

  [wall, floor, yard].forEach(b => b.querySelectorAll('.placed').forEach(e => e.remove()));

  Object.keys(S.house.placed).forEach(id => {
    const pos = S.house.placed[id];
    const H = HOUSE_ITEMS[id];
    if (!pos || H.band === 'shell') return;
    const host = H.band === 'wall' ? wall : H.band === 'yard' ? yard : floor;
    const el = document.createElement('div');
    el.className = 'placed';
    el.textContent = H.icon;
    el.title = H.name + ' — drag to move';
    el.style.left = pos.x + 'px';
    el.style.top = pos.y + 'px';
    el.draggable = true;
    el.ondragstart = e => {
      e.dataTransfer.setData('type', 'furniture');
      e.dataTransfer.setData('id', id);
    };
    host.appendChild(el);
  });

  // Bought but not yet placed
  const pending = Object.keys(S.house.placed).filter(id => S.house.placed[id] === null);
  $('unplaced').innerHTML = pending.length ? 'Drag into the room: ' : '';
  pending.forEach(id => {
    const el = document.createElement('span');
    el.className = 'pending';
    el.textContent = HOUSE_ITEMS[id].icon;
    el.draggable = true;
    el.title = HOUSE_ITEMS[id].name;
    el.ondragstart = e => {
      e.dataTransfer.setData('type', 'furniture');
      e.dataTransfer.setData('id', id);
    };
    $('unplaced').appendChild(el);
  });

  renderHomeShop();
}

function renderHomeShop() {
  const el = $('homeShop');
  el.innerHTML = '';
  Object.keys(HOUSE_ITEMS).forEach(id => {
    const H = HOUSE_ITEMS[id];
    const owned = id in S.house.placed;
    const d = document.createElement('div');
    d.className = 'shop-item' + (owned || S.money < H.price ? ' locked' : '');
    d.innerHTML = `<span>${H.icon}</span><span>${H.name}</span>` +
                  `<span class="price">${owned ? '✓' : '$' + H.price}</span>`;
    if (!owned && S.money >= H.price) {
      d.onclick = () => buyHouseItem(id);
      d.style.cursor = 'pointer';
    }
    el.appendChild(d);
  });
}
```

- [ ] **Step 5: Band drop targets, so a bed cannot land on the ceiling**

```js
function bandDrop(el, band) {
  el.ondragover = e => { e.preventDefault(); el.classList.add('over'); };
  el.ondragleave = () => el.classList.remove('over');
  el.ondrop = e => {
    e.preventDefault();
    el.classList.remove('over');
    if (e.dataTransfer.getData('type') !== 'furniture') return;
    const id = e.dataTransfer.getData('id');
    if (HOUSE_ITEMS[id].band !== band) {
      Sound.bad();
      const r = el.getBoundingClientRect();
      floatText(r.left + 10, r.top + 10, band === 'wall' ? 'goes on the floor' : 'goes on the wall', '#c62828');
      return;
    }
    const r = el.getBoundingClientRect();
    placeItem(id,
      Math.max(0, Math.min(r.width - 34, e.clientX - r.left - 16)),
      Math.max(0, Math.min(r.height - 34, e.clientY - r.top - 16)));
  };
}
bandDrop($('wallBand'), 'wall');
bandDrop($('floorBand'), 'floor');
bandDrop($('yard'), 'yard');
```

Add `if (S.view === 'home') renderHome();` to `render()`.

- [ ] **Step 6: Verify**

Run: `node --test "tests/*.test.mjs"` — Expected: PASS.
Browser: the Home tab shows an empty room titled `Bare Shack ⭐ 0/20`. Buying a 🪑 chair puts it
in "Drag into the room"; dropping it on the floor band places it and it stays there across a
reload. Dropping a 🛏️ bed on the **wall** band is refused with "goes on the floor". Buying 🏠
grows the room while the furniture keeps its positions. At 5 items the title becomes
`Cozy Shack`.

- [ ] **Step 7: Commit**

```bash
git add games/farmer-dream.html
git commit -m "feat(farmer-dream): add the home view and a room you decorate

Buying an item appended a span to a list, which is the weakest reward in
the game. Items are now dragged into a room and stay where you put them,
and a shell upgrade grows the room around the furniture.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 11: The pet album, naming and roaming

**Files:**
- Modify: `games/farmer-dream.html` — `#viewPets`, CSS, pet code

**Interfaces:**
- Consumes: `PETS`, `petsEarned`, `levelFor`.
- Produces: `checkPets()`, `renderPets()`, `roamPets()`, `petName(id)`, `foxRaid()`.
- `S.pets` becomes an array of `{ type, name, x, y, nextHop }`.

- [ ] **Step 1: CSS**

```css
  #viewPets { display:flex; flex-wrap:wrap; gap:10px; }
  .petcard {
    width:120px; padding:10px 6px; text-align:center;
    background:var(--cream); border:2px solid var(--wood); border-radius:12px;
  }
  .petcard.locked { filter:grayscale(1); opacity:.5; }
  .petcard .big { font-size:38px; }
  .petcard .nm { font-weight:bold; font-size:13px; }
  .petcard .sub { font-size:11px; opacity:.75; }
  .petcard button { font:inherit; font-size:11px; margin-top:4px; cursor:pointer;
                    border:1px solid var(--wood); border-radius:6px; background:var(--panel); }
  .pet { position:absolute; font-size:26px; cursor:pointer; user-select:none;
         transition:left 1.1s ease-in-out, top 1.1s ease-in-out; z-index:5; }
```

- [ ] **Step 2: Earn, name and render**

```js
function petCtx() { return { xp:S.xp, stats:S.stats, house:S.house }; }

function checkPets() {
  const earned = petsEarned(petCtx());
  let gained = null;
  earned.forEach(type => {
    if (S.pets.some(p => p.type === type)) return;
    S.pets.push({ type, name: PETS[type].name, x: 20 + Math.random() * 60, y: 20 + Math.random() * 50, nextHop: 0 });
    gained = type;
  });
  if (gained) {
    Sound.level();
    const r = penEl.getBoundingClientRect();
    floatText(r.left + 20, r.top + 20, PETS[gained].icon + ' joined!', '#f9a825');
    save();
  }
}

function petName(type) {
  const p = S.pets.find(x => x.type === type);
  if (!p) return;
  const next = prompt(`Name your ${PETS[type].name}:`, p.name);
  if (next && next.trim()) { p.name = next.trim().slice(0, 14); save(); render(); }
}

function renderPets() {
  const el = $('viewPets');
  el.innerHTML = '';
  Object.keys(PETS).forEach(type => {
    const P = PETS[type];
    const mine = S.pets.find(p => p.type === type);
    const card = document.createElement('div');
    card.className = 'petcard' + (mine ? '' : ' locked');
    card.innerHTML = `<div class="big">${mine ? P.icon : '❓'}</div>` +
      `<div class="nm">${mine ? mine.name : '???'}</div>` +
      `<div class="sub">${mine ? P.perk : P.hint}</div>`;
    if (mine) {
      const b = document.createElement('button');
      b.textContent = 'Rename';
      b.onclick = () => petName(type);
      card.appendChild(b);
    }
    el.appendChild(card);
  });
}
```

- [ ] **Step 3: Roam the pen, and let the fox be a fox**

Pets roam whichever view is on screen; the pen is the visible container on the Farm view.

```js
function roamPets() {
  if (S.view !== 'farm' || !S.pets.length) return;
  const w = penEl.clientWidth - 34, h = penEl.clientHeight - 30, now = Date.now();
  S.pets.forEach(p => {
    let el = penEl.querySelector(`[data-pet="${p.type}"]`);
    if (!el) {
      el = document.createElement('div');
      el.className = 'pet';
      el.dataset.pet = p.type;
      el.onclick = () => {
        const r = el.getBoundingClientRect();
        floatText(r.left + 6, r.top - 6, '❤️');
        Sound.harvest();
      };
      penEl.appendChild(el);
    }
    el.textContent = PETS[p.type].icon;
    el.title = p.name;
    if (!p.nextHop || now >= p.nextHop) {
      p.nextHop = now + 2000 + Math.random() * 4000;
      p.x = Math.max(2, Math.min(w, p.x + (Math.random() - 0.5) * 100));
      p.y = Math.max(2, Math.min(h, p.y + (Math.random() - 0.5) * 70));
    }
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
  });
}

// Once every 2–4 days, at night only, the fox takes ONE uncollected product
// off one animal. Never inventory, never money — small enough to be watched
// rather than punished. The dog blocks it outright.
let lastRaidDay = 0;
function foxRaid() {
  if (!S.pets.some(p => p.type === 'fox')) return;
  if (dayPhase(S.dayStartedAt, Date.now()).phase !== 'night') return;
  if (S.day - lastRaidDay < 2 + Math.floor(Math.random() * 3)) return;
  lastRaidDay = S.day;

  if (S.pets.some(p => p.type === 'dog')) {
    const r = penEl.getBoundingClientRect();
    floatText(r.left + 20, r.top + 30, '🐕 saw off the 🦊');
    return;
  }
  const victim = S.animals.find(a => a.made > 0);
  if (!victim) return;
  victim.made--;
  const el = animalEls.get(victim.id);
  const r = el ? el.getBoundingClientRect() : penEl.getBoundingClientRect();
  floatText(r.left, r.top - 12, '🦊 stole one!', '#c62828');
  Sound.bad();
  save();
}
```

- [ ] **Step 4: Track the stats the pets read**

In `harvestAt`, after `addInv(out.crop)`:

```js
  S.stats.harvested[out.crop] = (S.stats.harvested[out.crop] || 0) + 1;
```

In `tick()`, after the day-rollover loop:

```js
  if (S.stats.daysPlayed.indexOf(S.day) < 0) S.stats.daysPlayed.push(S.day);
  if (dayPhase(S.dayStartedAt, now).phase === 'night') S.stats.sawNight = true;
  checkPets();
  roamPets();
  foxRaid();
```

Add `if (S.view === 'pets') renderPets();` to `render()`.

- [ ] **Step 5: Verify**

Run: `node --test "tests/*.test.mjs"` — Expected: PASS.
Browser: the Pets tab shows eight grey ❓ cards with hints. Reaching Lv5 pops "🐈 joined!", the
card fills in, and the cat starts hopping around the pen on the Farm view. Clicking it pops a
❤️. Rename changes the card and the hover name and survives a reload. Buying the 🌳 tree earns
the squirrel.

- [ ] **Step 6: Commit**

```bash
git add games/farmer-dream.html
git commit -m "feat(farmer-dream): add the pet album, naming and roaming

Pets are earned from eight different systems rather than bought, so
every mechanic has something waiting behind it, and the fox-versus-dog
interaction gives the night phase a reason to be watched.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 12: Sky, rain and the win

**Files:**
- Modify: `games/farmer-dream.html` — CSS, `tick()`, win overlay

**Interfaces:**
- Consumes: `dayPhase`, `isRainy`, `waterTile`, `houseCount`, `HOUSE_ITEMS`, `PETS`.
- Produces: `applySky()`, `rainTick()`, `showWin()`.

- [ ] **Step 1: Sky and rain CSS**

```css
  body.dawn  { background:linear-gradient(180deg,#ffd7a8 0%,#ffe9c9 45%,var(--grass) 100%); }
  body.day   { background:linear-gradient(180deg,var(--sky) 0%,#e8f5c8 45%,var(--grass) 100%); }
  body.dusk  { background:linear-gradient(180deg,#f8b195 0%,#f3d6b0 45%,#6fa03a 100%); }
  body.night { background:linear-gradient(180deg,#2b3a67 0%,#4a5b8c 45%,#3f6b2a 100%); }
  body.night, body.dusk { color:var(--ink); }
  body.rain #farm::after {
    content:''; position:absolute; inset:0; pointer-events:none;
    background:repeating-linear-gradient(75deg,rgba(160,200,255,.35) 0 2px,transparent 2px 9px);
    animation:pour .4s linear infinite;
  }
  #farm { position:relative; }
  @keyframes pour { to { background-position:22px 22px; } }
  #weather { font-size:15px; }
```

Add a weather readout to the top bar, before the spacer:

```html
  <span class="stat" id="weather">☀️</span>
```

- [ ] **Step 2: Apply it on the tick**

```js
function applySky() {
  const ph = dayPhase(S.dayStartedAt, Date.now()).phase;
  const wet = isRainy(S.day);
  document.body.className = ph + (wet ? ' rain' : '');
  $('weather').textContent = wet ? '🌧️' : ph === 'night' ? '🌙' : ph === 'day' ? '☀️' : '🌤️';
}

// Rain waters every thirsty plot, so a wet day is a free day.
function rainTick() {
  if (!isRainy(S.day)) return;
  const now = Date.now();
  S.tiles.forEach((t, i) => {
    if (t && cropStage(t, now).phase === 'thirsty') S.tiles[i] = waterTile(t, now);
  });
}
```

Call both from `tick()` before `render()`.

- [ ] **Step 3: The win overlay**

```js
function showWin() {
  const total = Object.keys(HOUSE_ITEMS).length;
  $('endOverlay').querySelector('h1').textContent = '🎉 Dream farm complete!';
  $('endText').innerHTML =
    `Your <b>${houseTitle(houseCount())}</b> is fully furnished.<br><br>` +
    `🏠 House ${houseCount()}/${total} &nbsp;·&nbsp; 🐾 Pets ${S.pets.length}/${Object.keys(PETS).length}` +
    `<br><br>` + Object.keys(S.house.placed).map(id => HOUSE_ITEMS[id].icon).join(' ') +
    (S.pets.length < Object.keys(PETS).length
      ? '<br><br>Keep playing to finish the 🐾 album.'
      : '<br><br>And every pet found you. 🌟');
  $('endOverlay').hidden = false;
  Sound.level();
}
```

`buyHouseItem` already calls `showWin()` at 20/20 (Task 10 Step 3).

- [ ] **Step 4: Verify**

Run: `node --test "tests/*.test.mjs"` — Expected: PASS.
Browser: the page background walks dawn → day → dusk → night over three minutes and the top bar
weather glyph follows. On a rainy day the farm shows falling rain and thirsty plots water
themselves. To check the win without grinding, run in the console:
`Object.keys(HOUSE_ITEMS).forEach(id=>S.house.placed[id]={x:10,y:10}); showWin()`.

- [ ] **Step 5: Commit**

```bash
git add games/farmer-dream.html
git commit -m "feat(farmer-dream): add the day sky, rain and a real ending

The game ended on alert('YOU WIN'). The overlay now shows the house the
player actually built and their pet count, and says the album is still
open so there is a reason to keep playing past the win.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 13: Stage 3 verification pass

- [ ] **Step 1: Full suite**

Run: `node --test "tests/*.test.mjs"`
Expected: PASS, zero failures.

- [ ] **Step 2: Confirm the FARM region is still DOM-free**

Run: `node -e "import('./tests/harness.mjs').then(h=>{const r=h.extract('FARM',h.FARM_GAME);const bad=r.match(/document|window|localStorage|Date\.now/g);console.log(bad?'LEAKED: '+bad.join(','):'clean')})"`
Expected: `clean`.

- [ ] **Step 3: Confirm `DAY_MS` is declared exactly once**

Run: `grep -c "const DAY_MS" games/farmer-dream.html`
Expected: `1`. Two declarations would be a redeclaration error the syntax gate catches, but
this names the failure directly.

- [ ] **Step 4: Update the rules modal**

```html
      <li>⚙️ Drag nothing here — click a machine to load it, click again to collect.</li>
      <li>📋 Fill the order for far more than the items are worth.</li>
      <li>🔨 The Build tab sells more land, sprinklers and machines.</li>
      <li>🏡 Buy furniture, then drag it into your room. Wall things go on the wall.</li>
      <li>🐾 Pets are earned, never bought — check the album for hints.</li>
      <li>🌧️ Rainy days water the whole farm for free.</li>
```

- [ ] **Step 5: Hand the manual playtest to the user**

1. A Stage 2 save loads with money, crops, animals, XP and barn slots intact.
2. Build tab: buying 6×4 land keeps every planted crop in the same visual spot.
3. A sprinkler row waters its own plots; the big can waters three per drag.
4. Cheese press: 2 milk in, 40s, 1 cheese out, worth $170 and 15 XP.
5. An order appears, dims the lines you are short of, and pays out on Deliver.
6. Home tab: buy a chair, drag it to the floor, reload — it is still there.
7. A bed refuses to drop on the wall band.
8. Buying 🏠 grows the room without moving the furniture.
9. Pets tab: eight grey cards with hints; reaching Lv5 earns the cat, which then hops around
   the pen and can be renamed and petted.
10. The sky cycles dawn→day→dusk→night; a rainy day waters the farm.
11. At 20/20 house items the win overlay shows the house and the pet count.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix(farmer-dream): stage 3 playtest fixes

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Known gaps at the end of Stage 3

Recorded honestly rather than left as surprises:

- **The silo and scarecrow are bought but inert.** Their state fields, prices and shop rows
  exist; the auto-feed loop and the 🐦 crow that steals crops are not built. Either add them in
  a follow-up or drop the two upgrades from `UPGRADES` — shipping a purchasable no-op is worse
  than not offering it.
- **Pet perks are cosmetic except the turtle.** `offlineCapFor` reads the turtle; the rabbit's
  +5% growth, the cat's coins and the bluebird's perch are label text only.
- **Pets roam only the Farm view.** `roamPets()` returns early on the Home and Pets tabs, so
  spec §12's "they cross between the two" is unmet.
- **Touch is still unsupported**, per spec §16.
