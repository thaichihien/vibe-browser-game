# Farmer Dream — redesign

**Date:** 2026-08-04
**File:** `games/farmer-dream.html` (stays a single self-contained file)
**Goal:** a relaxing farm simulator with far more content — crops, animals, processing,
a house you decorate, and pets you collect.

---

## 1. Why

The current version has three crops, three decorative cows and twenty items to buy. Its
problems are structural, not cosmetic:

- **One dominant strategy.** Tomato beats carrot beats rice on cost, time *and* price, so
  there is never a reason to plant anything else.
- **Optimal play is frantic, lazy play is empty.** Winning costs $1,350 and the fastest route
  keeps 15 tiles in tomatoes — about 45 drag gestures per 18-second cycle. Play it slowly
  instead and you watch a static grid.
- **No decisions.** Water is free and unlimited, so watering is a click tax, not a choice.
- **Nothing persists.** Growth is a chain of `setTimeout`s bound to DOM nodes: a reload wipes
  the farm, and a background tab stalls it.
- **Cows are wallpaper.** Three spawned in a loop, unbuyable, un-upgradable. Milk is appended
  into `cowArea` in normal flow so it stacks in the corner instead of appearing at the cow.
- **It does not look like it belongs.** Default sans-serif and grey `2px solid #ccc` borders,
  no start screen, no rules modal, no mute flag, no link back to the hub, and
  `alert("🎉 YOU WIN!")` as the ending. About 120 lines are commented-out dead code.
- **Mobile is dead.** HTML5 drag-and-drop has no touch support.

## 2. What stays

- **Drag-and-drop is the interaction.** Not a problem to solve — the redesign gives it *more*
  to do (tiles, animals, machines, inventory, sell box, house). Touch support is out of scope.
- **Single self-contained file**, vanilla JS, emoji for all art, no network requests, no build
  step. A folder game would need a server, and this machine has no Python to run one.
- **English UI** — matches the current file and the arcade-side convention. The Vietnamese copy
  in this repo is only on the three board games.
- **Warm cozy palette**, not the hub's neon. Wood, wheat, dusk sky.

## 3. Architecture

### One state object, one tick

```js
const S = {
  v: 1, savedAt: 0,
  money: 50, xp: 0, level: 1, day: 1, dayStartedAt: 0, weather: 'sun',
  gridW: 5, gridH: 3,
  tiles:    [{ crop, plantedAt, waterings, harvestsLeft } | null],
  animals:  [{ id, type, name, x, y, fedAt, produced, pending }],
  machines: [{ type, inputs: {}, startedAt }],
  inv:      { rice: 3, milk: 2 },
  upgrades: { sprinklerRows: [], silo: false, scarecrow: false,
              bigCan: false, barn: 4 },
  house:    { shell: 'shack', placed: { sofa: { x, y } } },
  pets:     [{ type, name, earnedAt, x, y }],
  order:    { wants: [{ item, qty }], reward, day } | null,
  stats:    { harvested: {}, crafted: 0, daysPlayed: [] }
};
```

A single `setInterval(tick, 250)` derives **everything** from `Date.now()` minus stored
timestamps, then re-renders the changed regions. No per-object `setTimeout` anywhere. This is
what makes saving, offline growth and background tabs work at all.

### Persistence

- `localStorage['farmerDream.save']` — the state object, written on every meaningful action and
  on the tick at most once a second.
- `localStorage['farmerDream.muted']` — mute flag, matching the `<gameCamelCase>.muted`
  convention used by `coCaNgua`, `coThu` and `dauTruongSinhVat`.
- Schema carries `v: 1`; an unrecognised version is discarded rather than migrated.

### Offline rules — forgiving by design

On load, `elapsed = now - S.savedAt`, capped at **4 hours** (8 with the 🐢 turtle pet).

- Crops advance fully, including regrow cycles.
- Machines finish.
- Animals produce up to their 3-product cap, then idle.
- **Hunger does not advance while away.** Animals never starve, ever.
- The day counter advances, so returning tomorrow moves the calendar.

Coming back is always a harvest, never a cleanup job.

### Sound

Web Audio synth, no assets: a soft chime on harvest, a lower one on sale, a two-note lift on
level-up, a rattle on a rejected drop, a heart-pop on petting.

## 4. Layout

```
┌──────────────────────────────────────────────────────────┐
│ ← Hub   💰 1,240   ⭐ Lv4 ▓▓▓▓▓░░░ 62/170  📅 Day 6  🔊 ❓│
├───────────────┬──────────────────────┬───────────────────┤
│ SHOP          │  🌾 FARM  4×6        │ 🎒 INVENTORY      │
│ ┌───────────┐ │  ┌──┬──┬──┬──┬──┬──┐ │  🌾7 🥕3 🥛2 🥚5   │
│ │Seeds│Barn│ │  │🌱│🌿│🍅│  │💧│🎃│ │  (drag from here) │
│ │Build│Home│ │  ├──┼──┼──┼──┼──┼──┤ │                   │
│ └───────────┘ │  └──┴──┴──┴──┴──┴──┘ │ 📋 ORDER          │
│ 🌾 Rice   $5  │                      │  3× 🥕  2× 🧀     │
│ 🥕 Carrot $8  │  🐄 PEN              │  → $350           │
│ 🌽 Corn  $10  │  ┌─────────────────┐ │                   │
│ 🍅 Tomato$12  │  │ 🐔💭🌽   🐄  🥛 │ │ 💸 SELL           │
│ 🔒 Lv5 Potato │  │    🐑      🥚   │ │  ┌─────────────┐  │
│ 💧 Water free │  └─────────────────┘ │  │  drop here  │  │
│               │                      │  └─────────────┘  │
│               │  ⚙️ 🧀▓▓▓░ 🍞 idle   │                   │
└───────────────┴──────────────────────┴───────────────────┘
```

Three tabs across the top of the centre column: **🌾 Farm**, **🏡 Home**, **🐾 Pets**.
Plus a start screen, a rules modal and an end overlay, per house convention.

## 5. Crops

Harvesting a tile always moves the crop into **inventory**, never straight to the sell box —
that indirection is what makes crafting and feeding possible. The sell box therefore accepts
drags **only from inventory**. Water stays free and unlimited, as it is today; the cost of
watering is attention, not money.

| Crop | Seed | Sells | Grow | Notes |
|---|---|---|---|---|
| 🌾 Rice | 5 | 15 | 10s | 🐄 🐐 feed |
| 🥕 Carrot | 8 | 25 | 14s | |
| 🌽 Corn | 10 | 30 | 16s | 🐔 🦆 feed |
| 🍅 Tomato | 12 | 40 | 18s | 🥫 input |
| 🥬 Cabbage | 12 | 32 | 18s | 🐑 feed |
| 🥔 Potato | 15 | 45 | 20s | 🐖 feed |
| 🌻 Sunflower | 20 | 30 | 15s | 🐝 hive needs one planted |
| 🍓 Strawberry | 30 | 35 ×3 | 20s | **regrows**, 12s per regrow |
| 🍇 Grapes | 45 | 50 ×4 | 26s | **regrows**, 14s per regrow |
| 🎃 Pumpkin | 60 | 220 | 50s | needs **two** waterings |

Three mechanics keep any single seed from dominating:

- **Feed crops** (🌾 🌽 🥬 🥔) sell low but are the only way to run animals.
- **Regrowing crops** (🍓 🍇) are harvested repeatedly without replanting, so the low-attention
  path is genuinely competitive: grapes yield ~2.3/tile/sec for one planting action.
- **Pumpkin** is the highest yield (~3.2/tile/sec) but demands two watering visits.

The real axis is therefore *attention required*, not raw price — a relaxed player leans on
grapes and strawberries, an engaged one runs pumpkins.

## 6. Animals

Bought from the **Barn** tab. Barn starts at **4 slots**, expandable to 8.

| Animal | Cost | Eats | Makes | Sells | Cycle |
|---|---|---|---|---|---|
| 🐔 Chicken | 120 | 🌽 | 🥚 Egg | 35 | 25s |
| 🐑 Sheep | 350 | 🥬 | 🧶 Wool | 85 | 60s |
| 🐄 Cow | 500 | 🌾 | 🥛 Milk | 60 | 40s |
| 🐖 Pig | 700 | 🥔 | 🍄 Truffle | 130 | 70s |
| 🐝 Hive | 900 | needs 🌻 planted | 🍯 Honey | 110 | 55s |
| 🐐 Goat | 1100 | 🌾 | 🧈 Butter | 95 | 45s |
| 🦆 Duck | 1400 | 🌽 | 🪶 Feather | 95 | 40s |

**One feeding yields three products**, then the animal shows a 💭🌽 bubble and stops. That
ratio keeps the drag count low — the point is to reduce busywork, not add it. The 🏗️ silo
upgrade auto-feeds from inventory.

Products drop **at the animal's position** and stay there until dragged off, so the pen is
worth looking at. Wandering is rewritten as short random hops with pauses between them; the
current `transition: all 2s linear` on a 2-second interval reads as gliding teleportation.

## 7. Machines

Each is a drop target with a progress bar: drag inputs in, drag the finished good out.

| Machine | Cost | Recipe | Sells | Time |
|---|---|---|---|---|
| 🍞 Bakery | 600 | 🌾×2 + 🥚 | 🍞 130 | 30s |
| 🧀 Cheese press | 900 | 🥛×2 | 🧀 170 | 40s |
| 🥫 Cannery | 1300 | 🍅×3 | 🥫 190 | 45s |
| 🧃 Juicer | 1800 | 🍓×3 | 🧃 230 | 40s |
| 🍷 Winery | 2600 | 🍇×3 | 🍷 340 | 70s |
| 🍰 Kitchen | 4000 | 🥛 + 🥚 + 🌾 + 🍓 | 🍰 520 | 60s |

## 8. Upgrades

Money-gated, not level-gated, so there is always something to save toward.

| Upgrade | Cost | Effect |
|---|---|---|
| Land → 6×4 | 800 | 24 tiles |
| Land → 7×5 | 2200 | 35 tiles |
| Sprinkler (per row) | 450 | Auto-waters that row forever |
| Big watering can | 600 | Waters 3 tiles per drag |
| Scarecrow | 700 | Blocks 🐦 crop theft |
| 🏗️ Silo | 1600 | Auto-feeds animals from inventory |
| Barn expansion | 1000 | Animal slots 4 → 8 |

## 9. Orders, days and weather

- **Orders.** One at a time on a 📋 board: 2–3 item types, reward ≈ 1.6× market value plus
  60 XP. Expires after 3 days and is replaced. Its job is to make variety worth growing.
- **Day cycle.** 3 real minutes per day, four 45-second phases: dawn → day → dusk → night.
  The sky gradient shifts with the phase; 💡 lamps make the house windows glow at night.
- **Weather.** 20% chance per day of 🌧️ rain, which waters the entire farm for free.

## 10. Levels

XP: harvesting a crop grants its **tier** — its 1-based row number in the crop table of §5, so
🌾 rice = 1 through 🎃 pumpkin = 10. Collecting an animal product = 5, a crafted good = 15, a
completed order = 60.

| Lv | XP to reach | Unlocks |
|---|---|---|
| 1 | — | 🌾 🥕 |
| 2 | 40 | 🌽 · 🐔 |
| 3 | 90 | 🍅 🥬 |
| 4 | 170 | 🐑 · 🍞 bakery |
| 5 | 290 | 🐄 · 🥔 |
| 6 | 460 | 🧀 press · 🍓 |
| 7 | 700 | 🎃 · 🐖 · 🥫 |
| 8 | 1020 | 🌻 · 🐝 · 🧃 |
| 9 | 1450 | 🍇 · 🐐 · 🍷 |
| 10 | 2000 | 🍰 kitchen · 🦆 |

Locked shop rows render greyed with a `🔒 Lv5` tag rather than being hidden, so progression
is visible.

## 11. The house

A **🏡 Home** tab: a drawn room you drag furniture into and rearrange whenever you like — not
a list. The current implementation appends a `<span>` to a div, which is the weakest part of
the existing game.

```
┌─ 🏡 HOME ───────────────── Cozy Shack ⭐ 7/20 ─┐
│░░░░░░░░░░░░ wall band ░░░░░░░░░░░░░░░░░░░░░░░░│
│   🖼️        🪟              🪞        💡       │
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│▓▓▓▓▓▓▓▓▓▓▓▓ floor band ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│    🛋️    📺        🪴          🧸             │
│         🪑                    🛏️              │
└───────────────────────────────────────────────┘
   Unplaced: 🕰️  ← drag into the room
```

**Free placement, two bands.** Dropped items store an x/y that persists. Wall items snap into
the upper band and floor items into the lower one, so a bed cannot end up on the ceiling.
Everything stays re-draggable forever — rearranging the room is the relaxing activity.

**The item list is replaced.** The existing twenty (🏢 🏬 🏭 🚗 🛺 ✈️ …) cannot furnish a
farmhouse. The new set forms an actual home:

| Group | Items | Behaviour |
|---|---|---|
| **Shell** ×2 | 🏠 1200 · 🏡 3500 | **Enlarges the room** and repaints wall and floor |
| **Floor** ×8 | 🪑 80 · 🪴 120 · 🧸 150 · 🕰️ 350 · 📺 600 · 🛋️ 800 · 🛏️ 900 · 🛁 1000 | Lower band |
| **Wall** ×5 | 🖼️ 200 · 🪟 250 · 💡 300 · 🪞 400 · 🚪 450 | Upper band |
| **Yard** ×5 | 🚲 1400 · 🌳 1600 · 🛵 2000 · ⛲ 2500 · 🚗 5000 | Outside, visible behind the farm |

The starting shell is a free 🛖 shack. Buying a shell upgrade physically growing the room,
with the furniture staying where it was, is the moment that sells the whole system.

**Making the purchase feel good.** Hovering a shop item ghosts it into the room before you
commit; buying flies the emoji from the shop into the room with a sparkle and a chime; the
header title levels up as you fill the place — *Bare Shack → Cozy Shack → Warm Home → Dream
Farmhouse* at 5 / 10 / 15 / 20 items.

**It ties back to the farm.** Each placed item multiplies offline elapsed time by 1.01, so a
fully furnished house makes an absence count for 20% longer. Small enough that nobody must
min-max it, real enough that decorating is not a dead-end money sink.

## 12. Pets

Deliberately **not** a second shop. Money buys the house; pets are earned, one from each
system, so every mechanic has something charming behind it.

| Pet | Earned by | Does |
|---|---|---|
| 🐕 Dog | Complete your first order | Chases 🐦 crows off the farm |
| 🐈 Cat | Reach Lv 5 | Naps on your furniture, finds coins |
| 🐇 Rabbit | Harvest 50 🥕 | +5% growth on 🥕 and 🥬 |
| 🐿️ Squirrel | Buy the 🌳 yard tree | Lives in it, drops acorns |
| 🐦 Bluebird | Harvest 🌻 sunflowers | Perches on the scarecrow |
| 🐢 Turtle | Play on 5 different days | Doubles the offline window to 8h |
| 🦢 Swan | Buy the ⛲ fountain | Swims in it |
| 🦊 Fox | Visit during the night phase | Mischief — see below |

**The fox, precisely.** Once every 2–4 in-game days, during the night phase only, the 🦊 walks
into the pen and removes **one uncollected product lying on the ground** — never anything in
inventory, never money. If the 🐕 dog has been earned, it intercepts and the fox leaves
empty-handed. The loss is small on purpose: it exists to be watched, not to punish.

**They roam both views**, farm and house, crossing between them, so the place always has
something moving in it. Click one and a ❤️ pops with a chime. You **name** each pet when you
earn it (cute default pre-filled, editable later) — named pets are what make a save feel yours.

**The 🐾 album is the collection object:** eight cards, unearned ones grey silhouettes showing
only the hint (*"Complete an order"*).

## 13. Winning

Buying all 20 house items triggers a proper end overlay — not `alert()` — showing the finished
house and `House 20/20 ⭐ · Pets 6/8 🐾`. Play continues afterwards, so completing the pet album
is a reason to keep going past the win. Target length: **1.5–2 hours** of relaxed play, with
roughly $48k of total spend across seeds, animals, machines, upgrades and the house.

## 14. Testing

`games/monster-battle.html` is currently the only tested game, via comment-delimited regions
extracted into a bare `node:vm` context. Farmer Dream's economy is a good fit for the same
pattern, and gains a real regression gate over the timestamp maths.

- Wrap the pure economy in `/* ==== FARM:START ==== */ … END`: the `CROPS`, `ANIMALS`,
  `MACHINES`, `HOUSE_ITEMS`, `PETS` and `LEVELS` tables plus `cropStage(tile, now)`,
  `advance(state, elapsed)`, `orderValue(order)` and `levelFor(xp)`. **The region must stay
  DOM-free** — the bare context has no `document` or `window` on purpose.
- `tests/harness.mjs` hard-codes `GAME` as monster-battle. Give `readGame`, `scriptBody`,
  `extract` and `load` an optional game-path argument defaulting to the current value, so the
  existing tests are untouched.
- `tests/farm.test.mjs` covers: growth stage boundaries, regrowing crops running out of
  harvests, the two-watering pumpkin, offline advance capping at 4h (8h with 🐢), animals
  stopping at three products, hunger frozen while away, and level thresholds.
- `tests/syntax.test.mjs` should parse this game's `<script>` body too, so UI-only edits still
  have a gate.

## 15. Build stages

Each stage ends in a manual playtest before the next begins.

**Stage 1 — foundation and crops**
State object, 250ms tick, save/load, offline advance, the 10 crops, watering, inventory, sell,
XP and levels, warm restyle, start screen, rules modal, mute, back-to-hub link, end-overlay
scaffold. Delete the ~120 lines of dead commented code. `FARM` region + `tests/farm.test.mjs`.

**Stage 2 — animals**
Barn tab and purchasing, the 7 animals, feeding via drag, three-products-per-feed, 💭 hunger
bubbles, hop-and-pause wandering, products dropping at the animal, barn slots.

**Stage 3 — everything else**
The 6 machines, all upgrades, the orders board, day cycle and weather, the 🏡 Home tab with
free placement and shell upgrades, the 🐾 pet album with naming and roaming, and the real win
overlay.

## 16. Out of scope

- Touch support. HTML5 drag-and-drop does not do it, and replacing the interaction is a
  different project.
- Any change to `index.html`. The game is already registered (`Simulation`, tags `1 player` /
  `Relaxing`) and the entry stays as-is.
- Multiplayer, leaderboards, cloud saves.
