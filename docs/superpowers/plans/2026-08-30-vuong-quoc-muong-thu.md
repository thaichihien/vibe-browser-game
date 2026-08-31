# Vương Quốc Muông Thú — Implementation Plan

**Goal:** Ship `games/animal-kings/` — a top-down RTS played from inside the king, with 5
animal factions of 5 unit classes each, retinue commands, courier-delivered off-screen news,
and a 4-tier AI. The match ends only when a king dies.

**Spec:** `docs/superpowers/specs/2026-08-30-vuong-quoc-muong-thu-design.md`

**Architecture:** One `G` game-state object created by `js/game.js`, one fixed-timestep loop,
one canvas. `js/main.js` owns screens and boot; every system is its own module and mutates `G`.
Pure-data / pure-function modules (`config.js`, `factions.js`, `entities.js`, `pathfind.js`,
`world.js`) stay DOM-free so `tests/animal-kings.test.mjs` can `import` them directly.

**Tech stack:** Vanilla HTML/CSS/JS ES modules, no build step, no dependencies. Tests are Node
22 built-ins (`node:test`, `node:assert`) importing the modules directly — the existing
`tests/harness.mjs` is not involved and must not be touched.

## Global constraints

- **Folder game.** `games/animal-kings/` — `index.html`, `style.css`, `js/*.js`. ES modules do
  not load over `file://`; the game is served (`python3 -m http.server 8000`), like
  `games/last-quarter/` and `games/grid-storm/`.
- **No assets, no network.** Emoji for all art, Web Audio synth for sound, no CDN, no fetch.
- **Tiếng Việt UI copy** throughout.
- **Mute key** `animalKings.muted`; setup choices at `animalKings.setup`. Nothing else persists.
- **DOM-free modules stay DOM-free** — `config.js`, `factions.js`, `entities.js`, `pathfind.js`,
  `world.js`. A stray `document`/`window`/`localStorage` in these breaks the new test file.
- **Commit style:** conventional commits scoped `animal-kings`. **No `Claude-Session:` trailer.**
  Per standing preference, **the user commits** — do not commit or branch unless asked.
- **Test command:** `node --test 'tests/*.test.mjs'` — the glob is required.
- **Performance target:** 60 fps with ~150 live units. Spatial hash for neighbour queries,
  distance-based LOD ticking for far-away units, only visible tiles drawn.

## Files

```
games/animal-kings/
  index.html      topbar, canvas, HUD shells, all modals
  style.css       pastoral-neon skin, responsive, touch layout
  js/
    config.js     tuning constants + helpers + seeded RNG        [DOM-free]
    factions.js   5 factions × 5 classes, skills, costs          [DOM-free]
    world.js      seeded symmetric map gen, tiles, resource nodes [DOM-free]
    pathfind.js   BFS flow-fields + blocked tests                [DOM-free]
    entities.js   king/unit/building factories, damage math      [DOM-free]
    game.js       the G state object, fixed-timestep loop, systems wiring
    units.js      per-unit update: steering, separation, targets, gathering
    combat.js     swings, projectiles, faction abilities, death
    buildings.js  construction sites, production queues, NPC hosts
    retinue.js    enlist, dismiss, formation, the four orders, garrisons
    messenger.js  off-screen event → courier → run to king → deliver
    ai.js         kingdom brain + 4 difficulty profiles
    camera.js     follow, smoothing, shake
    render.js     terrain/entity/fx painter + draw toolkit
    fx.js         particles, rings, floating text, flash, shake
    hud.js        resource bar, retinue bar, prompts, reports panel
    ui.js         merchant / builder / captain panels, build ghost
    audio.js      Web Audio synth + mute flag
    input.js      keyboard + mouse + touch
    main.js       boot, screen flow, pause, hotkey wiring
```

## Stage 1 — Skeleton and the world

- [x] `js/config.js` — tiles, terrain table, king stats, economy, retinue, camera, day/night,
      helpers (`clamp` `lerp` `rnd` `pick` `dist` `norm`) and `makeRng` (mulberry32).
- [x] `js/world.js` — seeded generation of a 160×160 `Uint8Array`: lakes, forests, rock
      ridges, wheat fields, gold mines, paths. **Point-symmetric**: generate one half, rotate
      it 180° onto the other. Place start positions on the symmetry orbit. Emit resource nodes.
- [x] `js/camera.js` — follow the king with easing and a small look-ahead toward the aim
      direction; clamp to world bounds; shake hook.
- [x] `js/fx.js` — particles, rings, floating text, flash, shake. Same object shapes as
      `games/grid-storm/js/fx.js`.
- [x] `js/render.js` — world→screen transform, visible-tile draw with per-tile variation, tree
      and rock emoji, water animation, entity painter with y-sorting, drop shadows, the
      `emoji` / `text` / `bar` toolkit other modules draw through.
- [x] `js/input.js` — keyboard set, mouse position in world space, click/aim, touch stick.
- [x] `js/game.js` — `G`, fixed-timestep loop, spatial hash, kingdom slots.
- [x] `index.html` + `style.css` + `js/main.js` — canvas fills the window, king walks, camera
      follows, terrain scrolls.
- [x] **Runnable check:** serve, open, walk the king across the map at 60 fps.

## Stage 2 — Economy

- [x] `js/entities.js` — factories for king, unit, building, resource node; stat blocks;
      `applyDamage` with the king's ranged resist; kingdom object with `res`, `pop`, `popCap`.
- [x] `js/pathfind.js` — `blockedAt`, BFS flow-field builder over the tile grid, LRU field
      cache keyed by goal tile, `steer(field, x, y)`.
- [x] `js/units.js` — steering + separation + blocked-tile sliding; worker loop
      (walk → harvest → carry 22 → nearest drop-off → repeat); idle wander.
- [x] **King harvesting** — `Space`/click is one contextual verb resolved against whatever is in
      front of him: enemy → swing, node → harvest, damaged friendly building → repair. Rate
      6.5/s (worker 9.5/s) but **banked directly, no hauling and no drop-off required**, drained
      by the shared stamina pool so he works in bursts. Per-faction affinity ×1.35
      (🐷🐔 → 🌾, 🐄🐑 → 🪵, 🐰 → 🪙).
- [x] Start the match with **castle + 3 workers only** — deliberately short of a fourth
      worker's food, so the opening move is the king cutting wheat himself.
- [x] A worker needs a drop-off in range to gather; **the king does not** — he is the only way
      to extract gold from an unclaimed mine.
- [x] `js/buildings.js` — the seven shared types with their footprints, costs, build times, HP
      and pop contribution: 🏰 Lâu Đài 3×3 (given, one only), 🏕️ Tiền Đồn 2×2, 🌾 Nông Trại 2×2
      (passive +2.2 🌾/s), 🪓 Trại Gỗ 2×2 (wood drop-off, +25% haul rate), 🛖 Trại Lính 3×3,
      🗼 Tháp Canh 1×1, 🏛️ Đền Thờ 2×2 (gates the signature unit). Drop-off flags, per-building
      rally point, `E`-interactable production queue, 🔥 smoke under 33% HP, rubble on razing.
- [x] Construction sites: cost deducted on placement, nearest idle worker auto-assigned,
      **multiple workers speed the same site** with diminishing returns past three, progress
      ring, destructible mid-build with the investment lost.
- [x] `js/ui.js` — 🔨 Thợ Xây panel + a world-space ghost that follows the cursor, green/red on
      validity: every footprint tile clear and unoccupied, inside **build range** (420 px of any
      building you own), resources affordable.
- [x] `js/hud.js` — 🌾 / 🪵 / 🪙 / 👥 bar, interaction prompts, build ghost cost readout,
      production progress rings.
- [x] **Runnable check:** start with a castle and 3 workers, hand-harvest all three resources as
      the king and watch stamina gate it, mine an unclaimed seam with no outpost, repair a
      damaged building, place
      and complete a farm and a barracks, rush a third site with three workers and see it finish
      faster, watch the pop cap rise, destroy a site mid-build.

## Stage 3 — Combat

- [x] `js/combat.js` — melee swings with wind-up, projectiles for ranged classes, damage,
      death, corpse fade, hit sparks, damage floaters, screen shake on heavy hits.
- [x] King combat: swing on `Space`/click in the facing arc, `Shift` sprint on stamina,
      regeneration inside `CASTLE_AURA`, ranged resist.
- [x] Unit target acquisition through the spatial hash; towers auto-fire; buildings take damage
      and are razed.
- [x] Neutral wildlife: 🐺 wolves and 🐍 snakes camped on gold mines, aggro radius, respawn off.
- [x] **Runnable check:** the king clears a wolf camp solo and takes a gold mine.

## Stage 4 — Retinue

- [x] `js/retinue.js` — `E` enlists soldiers within `ENLIST_RANGE` up to the cap; trailing
      formation with per-slot offsets; `F` dismisses.
- [x] The four orders (⚔ TẤN CÔNG / 🛡 GIỮ / 🏠 VỀ NHÀ / 🔎 DO THÁM), each resolving through one
      flow-field; **GIỮ** converts the retinue into a self-defending garrison.
- [x] Retinue bar in the HUD: member glyphs, cap, order buttons, `1`–`4` hotkeys.
- [x] **Runnable check:** enlist 6 soldiers, attack-move them into a creep camp, leave them on
      GIỮ, walk away and confirm they hold and fight without the king.

## Stage 5 — Factions

- [x] `js/factions.js` — 5 archetypes (Thợ ⚒ / Trinh Sát 👁 / Chiến Binh ⚔ / Xạ Thủ 🏹 /
      signature 🛡) × 5 faction modifiers, plus per-faction overrides — sheep healer instead of
      archer, cow siege-ox, chicken egg-thrower, pig boar, rabbit assassin. Passive + king
      ability per faction. Pure data and pure functions.
- [x] The eighth building, one per faction: 🛢️ Máng Ăn (heal aura) · 🥚 Ổ Trứng (free chick on a
      timer) · 🔔 Chuông Trận (+20% damage aura) · 🧱 Tường Len (cheap 1×1 wall) ·
      🕳️ Cửa Hầm (second burrow anchor).
- [x] Signature units gated behind 🏛️ Đền Thờ; the shrine also cuts king-ability cooldown 25%.
- [x] King abilities on `R` with cooldown: Tiệc Lớn, Bầy Đàn, Giẫm Đạp, Tường Len, Đào Hầm.
- [x] **Spawning, all three routes:** 🎖️ Đội Trưởng queues into the barracks with the shortest
      queue; `E` on a building opens *its own* queue and sets its rally point; free spawns from
      the chicken nest. Units walk to the rally point and **stand idle — they never auto-join
      the retinue**. Pop-capped queues stall with "Hết chỗ ở" and dispatch a courier.
- [x] 🎖️ Đội Trưởng upgrades bought with 🪙: Rèn Vũ Khí (+15% dmg ×3), Giáp (+15% hp ×3),
      Uy Danh (retinue cap +4).
- [x] 🛒 Thương nhân panel — resource trade at a spread, king items (⚔️🛡️👢🧪🎺🍖), `Q` to use.
- [x] **Runnable check:** play each of the 5 factions far enough to train every class and fire
      the king ability.

## Stage 6 — The AI

- [x] `js/ai.js` — one brain per enemy kingdom: worker assignment, build order, army
      composition from its own roster, expansion to gold, its own king's behaviour.
- [x] Phases `open → econ → scout → raid → mass → push → defend` with the transitions driven by
      army value, resource float and threat at home.
- [x] The four profiles (Dễ / Thường / Khó / Bạo Chúa) as a table of behaviour knobs — think
      interval, build efficiency, scouting, micro, king behaviour, harassment. **No resource
      cheating at any level.**
- [x] Setup screen: faction picker (5 cards), opponents (1 or 2), difficulty (4).
- [x] **Runnable check:** a full match against each difficulty; confirm Bạo Chúa's king
      actually comes for yours.

## Stage 7 — Couriers and polish

- [x] `js/messenger.js` — off-screen events (base attacked, building done, garrison wiped,
      enemy sighted, mine exhausted, enemy king spotted) become couriers that run to the king,
      can be **killed en route**, and are priority-ordered.
- [x] 📜 TIN BÁO panel (`Tab`) — delivered reports with age; speech bubble on arrival.
- [x] Day/night tint cycle, swaying trees, footstep dust, territory glow under buildings,
      health bars only when damaged, banner popups for kingdom-level moments.
- [x] `js/audio.js` — Web Audio synth (swings, hits, build, train, coin, courier, horn, defeat)
      with the `animalKings.muted` flag.
- [x] Touch layer: virtual stick + swing / interact / order buttons.
- [x] **Royal duties** — the seven ordered opening tasks (harvest 100 🪵 by hand → 6 thợ →
      a barracks → clear a wolf camp → outpost on a mine → retinue of 6 → spot the enemy king)
      as a data list plus one predicate per duty, with their rewards. Parchment 📜 in the corner,
      one duty visible at a time; rolls up for good when the last completes. This is the game's
      only tutorial.
- [x] Menu, setup, rules modal, pause, end overlay with the match report.
- [x] **Runnable check:** raid an off-screen expansion and confirm a courier arrives late; kill
      a courier and confirm the news never lands.

## Stage 8 — Ship

- [x] `index.html` (hub) — append the `games` entry: icon `👑`, title `Vương Quốc Muông Thú`,
      category `Strategy`, tags `["1 player","vs AI","RTS","Tiếng Việt"]`, `added: "2026-08-30"`,
      a `color` gradient distinct from every existing entry, `path: "games/animal-kings/index.html"`.
      `Strategy` is already in `CATEGORY_ICONS` — no glyph change needed.
- [x] `README.md` — one line in the game list.
- [x] `tests/animal-kings.test.mjs` — every faction has exactly 5 classes with complete stat
      blocks and non-zero costs; damage math is symmetric; map generation is point-symmetric for
      a given seed and both starts are equidistant from gold; flow-fields never route through
      impassable tiles.
- [x] `node --test 'tests/*.test.mjs'` — new tests pass and the existing suite still does.
- [x] Headless verification with the `verify` skill against
      `http://localhost:8000/games/animal-kings/`: start a match, open all three NPC panels,
      raise a building, enlist and issue each order, kill a creep, receive a courier, force a
      king death for the end overlay — screenshot each.
- [x] Load the hub and confirm the card renders in the Strategy sector, carries the NEW badge,
      and opens the game.

## Deliberate deviations from the spec

- **Terrain is drawn directly, not from cached chunks.** At 40 px tiles only ~600 are ever
  visible. The real cost was emoji: `fillText` several hundred times a frame is ruinous, so
  `render.js` rasterises each glyph once into its own small canvas and blits it after that.
  Measured at 450 actors: **1.6 ms a frame to draw**. Chunk caching was never needed.
- **`js/game.js` is split out of `main.js`**, matching `games/grid-storm/js/game.js` vs
  `main.js`.
- **The AI's build order is reactive, not a script.** A fixed list left it sitting on an
  unaffordable entry for the rest of the match once its food ran out. `nextBuilding()` now
  asks the current state, so a starving AI puts up another farm instead of stalling.
- **`world.reachable`** — one flood fill at generation marks the main connected region.
  A tile can be walkable and still be a sealed pocket inside a rock ridge (94 of them on a
  typical map); anything seated there — a wolf, a building, a rally point — is stranded for
  the whole match. Creep seating and building placement both consult it.
- **`E` resolves to whichever of talk / open-queue / enlist is nearest**, and the floating
  prompt names which one. One key doing three jobs silently was unusable next to your own
  town, where the NPCs swallowed every press.
- **`separate()` is bucketed, not pairwise.** The O(n²) version cost **65 ms a frame** once a
  few hundred units crowded into one battle; the grid version costs **1.2 ms** at 450 actors.

## Bugs found and fixed during implementation

Each of these was caught by driving the real game headlessly, not by reading the code:

- **The renderer's camera was bound at first draw**, but the king aims by projecting the
  cursor back into the world — which happens in `update`, one frame earlier. Every match threw
  on frame 1. Now bound at construction.
- **Buildings could be placed on top of units**, sealing them in permanently; an AI king was
  entombed by his own farm and the match could never end. Fixed twice over: placement evicts
  bodies from the footprint, and `moveEntity` ignores collision while already inside geometry.
- **Creep camps spawned inside the gold seam they guard**, so most of a pack vanished and the
  survivors were scattered too far apart to aggro together. Packs are now seated on collected
  open ground near the seam.
- **A worker assigned to a resource with none nearby idled for the entire match.** It now
  falls back to any node after searching its preference.
- **Couriers could be recruited into the retinue**, since they are units belonging to the
  player. Excluded from both the prompt and `enlist`.
- **The king could not sustain a fight** — 7 stamina a swing emptied the pool in eight
  seconds, so clearing the opening wolf camp was impossible. Swing cost 7 → 3, damage 22 → 32.
- **The king spawned inside the builder NPC**, so `E` at the start could never enlist anything.
- **The whole game rendered into a quarter of the screen on any HiDPI display.** `resize()` set
  a devicePixelRatio transform on the context, and `R.begin()` then reset the transform to
  identity every frame, throwing it away — so the world drew at 1/dpr into the top-left corner.
  Invisible to the entire headless suite, which ran at dpr 1. The renderer now owns `R.dpr` and
  restores that scale each frame; verified at dpr 1 and 2 with 100% canvas coverage and the
  king at the exact screen centre.

## Post-review changes

- **The 🎖️ Đội Trưởng NPC is gone.** He queued units into whichever barracks had the shortest
  line — a second door onto the panel a barracks already opens when you walk to it. His three
  upgrades moved to 🛒 Thương Nhân, who is now the single gold sink.
- **The barracks is the only producer.** The castle trained workers; now it trains nothing, and
  🛖 Trại Lính trains all five classes including 🧑‍🌾 Thợ. A kingdom with no barracks cannot
  grow at all, so it is the first thing anyone builds — the royal duties were reordered to put
  it ahead of "hire six workers", which is otherwise impossible. Cost trimmed to 140 🪵 / 60 🌾
  and 18 s so it is affordable from the opening bank.
  The AI needed rebalancing to match: **construction → military → economy** each think (running
  the economy first left Bạo Chúa at ninety seconds with seventeen peasants and no soldiers),
  workers may share a busy queue only during the opening six, and the harder profiles open more
  barracks — which is most of why their armies arrive sooner. Bạo Chúa now closes a match at
  **t=153 s**, its king walking 2826 px → 50 px to finish it.
- **Facing follows movement, not the mouse.** `WASD` both walks and points the king, and the
  heading persists when he stops. `CAMERA.lookAhead` dropped to 0 so he stays dead centre.
  The mouse is now only a pointer for panels and building placement.

## Verification performed

- `node --test 'tests/*.test.mjs'` — **168 pass, 0 fail** (33 new, 135 pre-existing).
- Headless Playwright against the system Chrome, driving real input paths: economy loop,
  construction with worker rushing, the king hand-harvesting under stamina, all three NPC
  panels, every retinue order, a wolf camp cleared solo, a courier delivering across 1770 px
  after a 10 s run, all five faction abilities firing with their real effects, a 3-kingdom
  match, and a full match played to a king's death (AI won at t=190 s against an idle player).
- Frame budget at 450 actors: **update 1.17 ms, draw 1.62 ms**. (Wall-clock frame time in
  headless is ~340 ms because `requestAnimationFrame` is throttled without a compositor —
  that number says nothing about real hardware, which is why the two phases were timed
  directly instead.)
- Hub card renders in the Strategy sector with the NEW badge and opens the game.
