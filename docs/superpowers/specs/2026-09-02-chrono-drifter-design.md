# Chrono Drifter — Design

**Date:** 2026-09-02
**Files:** `games/chrono-drifter/` (folder game — `index.html`, `style.css`, `js/**`)
**Genre:** Turn-based RPG battle roguelite with a procedural encounter generator
**Language:** **Vietnamese UI** — joining `jungle-game`, `co-ca-ngua` and `monster-battle`.
The slug stays English (`chrono-drifter`), exactly as `monster-battle` does.

## 1. Premise

You are a **Drifter**, unstuck in time. You do not choose the era, the war, or the side.
Press PLAY and you fall into somebody else's battle, already in progress, commanding whoever
happens to be standing next to you. Half the time that is the "wrong" side.

The only thing that travels with you is your satchel — and it is full of **modern junk**.
An energy drink. A pencil. Duct tape. A stopwatch. Anachronism is your only real edge, and
it is what the shop sells.

This frame does three jobs at once: it justifies total randomness (theme, side, difficulty),
it justifies a shop of contemporary objects inside a fantasy battle, and it makes "you got
put on the villains' team" a feature instead of a bug.

## 2. The randomness contract

Every PLAY press rolls, in this order:

1. **Era** — one of 12 themes.
2. **Two rival factions** from that era's faction list (rivalries are declared, never random).
3. **Format** — Duel, Skirmish, Last Stand, Monster Hunt or Pitched Battle (§9).
4. **Difficulty** — ★ Very Easy → ★★★★★ Very Hard.
5. **Rosters** — drafted per faction, legends deduplicated.
6. **Your side** — a coin flip between the two factions.

Nothing crosses an era boundary. A knight never meets a netrunner; a knight never *stands
beside* a demon either, because sides are drawn from factions, not from an era-wide pool.

## 3. Elements — one wheel, twelve vocabularies

Mechanics are global; **only the names are reskinned per era.** This is the load-bearing
architectural decision: one counter table to balance and to test, twelve flavors on top.

Six-element cycle, each beating the next:

```
STORM → TIDE → EMBER → VERDANT → FORGE → FROST → STORM
```

Plus **RADIANT ↔ UMBRA** (1.6× in *both* directions — light/dark duels are always brutal)
and **STEEL**, a neutral: never boosted, never resisted.

- Attacking into the element you beat: **×1.6**
- Attacking into the element that beats you: **×0.7**
- Anything else: **×1.0**

Reskin examples:

| Code | Giả Tưởng | Cyberpunk | Vũ Trụ Sâu | Thời Đại Buồm |
|---|---|---|---|---|
| EMBER | Lửa Rồng | Cháy Nổ | Bão Mặt Trời | Thuốc Súng |
| TIDE | Băng Thuỷ | Dung Dịch Lạnh | Thuỷ Lực | Nước Triều |
| STORM | Thiên Lôi | Xung EMP | Ion | Cuồng Phong |
| VERDANT | Dã Sinh | Sinh Học | Bào Tử | Thối Rữa |
| FORGE | Thép Cổ Ngữ | Cơ Khí | Hợp Kim | Sắt |
| FROST | Sương Giá | Đông Lạnh | Độ Không | Giá Buốt |
| RADIANT | Thánh Quang | Tín Hiệu | Ánh Sao | Lửa Thánh |
| UMBRA | Bóng Tối | Hắc Ám | Hư Không | Lời Nguyền |
| STEEL | Thép | Động Năng | Đạn Xuyên | Kiếm Cong |

### Localisation

Every player-facing string ships in Vietnamese: era and faction names, character names, move
names, item names, log lines, menus, overlays. What stays English is **code only** — module
and file names, the slug, archetype ids (`STRIKE`, `DRAIN`, `TAUNT`), element codes
(`EMBER`, `UMBRA`), stat keys (`PWR`, `GRD`, `WRD`, `SPD`) and the `localStorage` keys
(`chronoDrifter.save`, `chronoDrifter.muted`).

The element wheel makes this easy rather than harder: because a move stores an element *code*
and its display tag is built at render time from the era's `elNames` map, the same `STRIKE`
reads **Lửa Rồng** in Giả Tưởng and **Xung EMP** in Cyberpunk. One wheel, twelve Vietnamese
vocabularies — no duplicated mechanics, and no string baked into the data.

## 4. The 12 eras

Each ships **3 factions** and **20+ characters** (roughly 7 per faction), with declared rivalries.

| # | Era | Factions |
|---|---|---|
| 1 | Giả Tưởng | Vương Quốc · Hoang Dã · Vực Thẳm |
| 2 | Cyberpunk | An Ninh Tập Đoàn · Dân Chạy Phố · Giáo Phái Kim Loại |
| 3 | Vũ Trụ Sâu | Hạm Đội Sao · Bầy Hư Không · Thương Nhân Tự Do |
| 4 | Thời Đại Buồm | Hải Quân Hoàng Gia · Cướp Biển · Kẻ Chết Đuối |
| 5 | Ai Cập Thần Thoại | Đền Ra · Quân Đoàn Lăng Mộ · Dân Du Mục |
| 6 | Nhật Bản Phong Kiến | Mạc Phủ · Ám Ảnh Môn · Yêu Quái |
| 7 | Miền Tây Hoang Dã | Cảnh Sát Trưởng · Băng Cướp · Bụi Oán |
| 8 | Hậu Tận Thế | Trật Tự Hầm Trú · Băng Cướp Hoang · Dị Biến |
| 9 | Bắc Âu | Einherjar · Người Khổng Lồ · Xác Sống Draugr |
| 10 | Steampunk | Vệ Binh Hơi Nước · Công Đoàn Bánh Răng · Người Máy |
| 11 | Tiền Sử | Bộ Tộc Lửa · Mãnh Thú · Pháp Sư Xương |
| 12 | Atlantis Chìm | Triều Đình San Hô · Bầy Vực Sâu · Đội Trục Vớt |

Rivalries are a per-era list of allowed matchups, e.g. Fantasy allows
`Realm↔Abyss`, `Realm↔Wilds`, `Wilds↔Abyss` — but a *unit* never crosses.

## 5. Characters

`{ id, name, emoji, faction, tier, affinity, stats, moves[4], ult? }`

- **Stats:** HP · PWR · GRD (physical defence) · WRD (elemental defence) · SPD
- **Tiers:** `grunt` (may be duplicated on a team), `elite`, `legend`
- **Legends** carry a 5th slot: an **ultimate**, gated on a 0→100 CHARGE meter.
  A legend appears **at most once in the whole battle** — never twice on a team, never
  mirrored across the line.
- Every character has exactly **4 moves + WAIT**.

### WAIT is a real move

Skip the turn → **+25 CHARGE** and **+20% GRD/WRD until your next turn**. Stalling a legend
one round to reach the ultimate is a legitimate line of play, which is what keeps the
required 5th option from being a dead button.

## 6. Moves — an archetype library, not 960 hand-written skills

~44 mechanical archetypes are authored **once** in `engine/moves.js`; a character's move is
an instance `{ id, el, pow, cd, name }` where `name` is the era's flavor text.
"Fireball" and "Plasma Lance" are the same `STRIKE` archetype with a different `el` and label —
exactly the "wizard and dragon share a fire attack" the brief asks for.

- **Damage** — Strike · Cleave (all, ×0.6) · Arc (2 random) · Pierce (−50% GRD) · Snipe (crit) ·
  Drain (heal 50% dealt) · Execute (bonus under 35% HP) · Ramp (grows per use) · Fixed (flat)
- **Support** — Heal · Mend All · Regen · Revive · Cleanse · Barrier (absorb) · Reflect
- **Buff** — Rally (PWR) · Bulwark (GRD) · Haste (SPD) · Focus (crit) · Charge-up (double next)
- **Debuff** — Weaken · Sunder · Slow · Blind · Burn/Poison/Bleed (DoT) · Stun · Silence · Mark (+25% taken)
- **Control** — Taunt · Guard-ally · Steal charge · Sacrifice (HP→power) · Summon
- **Ultimates** — Annihilate (AoE ×2.4) · Full mend + cleanse · Purge (execute all under 30%) ·
  **Time Stop** (act twice more immediately — the one ultimate that is *about* the premise)

## 7. Combat math

```
raw   = PWR × move.pow × rand(0.92, 1.08)
def   = move.el === STEEL ? target.GRD : target.WRD
dmg   = raw × 100/(100 + def) × element(move.el, target.affinity) × crit × buffs
```

Diminishing-returns defence keeps late-game stats from producing immortal units.

**Turn order** is a tick queue, not fixed rounds: every actor accrues `SPD` per tick and acts
at 100. Haste and Slow therefore visibly *reorder the timeline strip* at the top of the
screen, which is what makes speed manipulation legible.

## 8. Presentation — the stage, not a list of rows

The battle screen is a painted battlefield with emoji actors standing on it, built from CSS
gradients and emoji only. No image files, consistent with the rest of the repo.

### Nine layers, back to front

| Layer | Holds |
|---|---|
| Sky | The era's three-stop gradient, plus a sun/moon/star disc with a bloom |
| Sky traffic | Birds, drones, comets — small, blurred, 34% opacity |
| Ridge | Mountains, skylines, islands on the horizon, blurred and dimmed |
| Horizon | A thin lit line in the era's key colour, separating sky from ground |
| Props | Trees, ruins, dishes, wrecks standing on the ground plane |
| Weather | Embers rising / rain falling / stars drifting — direction and speed per era |
| Fighters | Emoji at 60–70px: drop shadow, idle bob, ground disc, name plate (HP, statuses, ult meter) |
| Foreground | One or two props cut off by the bottom edge — the cheapest depth cue available |
| Vignette | Darkened corners so the centre of the fight reads first |

Two camps with a gap down the middle — yours bottom-left, theirs bottom-right. Each side lays
itself out in **ranks** for any count from 1 to 8: the front rank is lowest and largest, and
every rank behind steps up, shrinks 12%, and pulls toward the outer edge so nobody is hidden.
Enemy sprites are `scaleX(-1)` so the sides face each other.

### Emoji are not all one size

A rat is not a dragon is not a boss. Final glyph size is
`56px × rank depth × crowd × species`:

| Kind | Species scale | Examples |
|---|---|---|
| Mook | 0.55–0.60 | 🐀 Crypt Rat, 🦟 Void Gnat, 🛰️ Sec Drone |
| Small | 0.78–0.90 | 💀 Gnash, 🐝 Stray Drone Pack, 🧟 Risen Levy |
| Human | 0.90–1.05 | 🧙 Ilsa, 🛡️ Roland, 👩‍🚀 Aurelis |
| Large | 1.15–1.55 | 🐉 Vharn, 🐙 The Maw, 🧟 Davy |
| Boss | 2.10–2.25 | 🐲 Malgrath, 🐋 Leviathan of the Rift |

**Crowd** shrinks a whole side as it grows — ×1.16 for a duel, ×1.00 at 3–4, ×0.86 at 5–6,
×0.76 at 7–8 — which is both how real depth reads and what keeps eight bodies a side from
colliding. Measured across every format, the worst sprite overlap is under 30% of the
smaller sprite, and zero in the crowded ones.

### Animation beats

| Beat | What happens |
|---|---|
| Turn opens | Active fighter lifts and glows, gold ring pulses underfoot, deck swaps in, timeline reorders |
| Lunge | Attacker springs a third of the way to the target and back, overshoot curve |
| Projectile | The move's element flies across the stage, spinning (🔥 EMBER, ⚡ STORM, ❄️ FROST…) |
| Impact | Nine-emoji burst ring; target flashes red and recoils |
| Numbers | Damage rises and fades; **SUPER EFFECTIVE** on ×1.6, *resisted* on ×0.7 — the wheel teaches itself |
| Heavy hit | Whole-stage shake |
| Ultimate | Stage darkens, name sweeps in, white flash, then each target in sequence |
| Death | Fighter tips over, drops, fades |
| Targeting | Valid targets pulse; hover previews the hit, Esc cancels |

Web Animations API plus CSS keyframes — no canvas, no library. The whole layer collapses to
instant state changes under `prefers-reduced-motion`.

**Working prototype:** a playable 3v3 across four eras, carrying the stage layers, tick queue,
element wheel, ultimates and AI. It is the reference implementation for `ui/battle-view.js`.

## 9. Battle formats

A drift does not just roll a team size — it rolls a **shape**. Five of them, and the coin flip
that picks your side applies afterwards, so you can be the three heroes *or* the eight mooks,
the hunting party *or* the boss.

| Format | Shape | What it is | Rounds | Est. time |
|---|---|---|---|---|
| **Duel** | 1v1 | Two named units, no support, nowhere to hide | 6–10 | 3–4 min |
| **Skirmish** | 3–4 v 3–4 | The even fight | 10–14 | 5–7 min |
| **Last Stand** | 3–4 v 6–8 | A few names against a mob of nameless — **duplicates allowed**, numbered Ⅰ…Ⅷ | 12–18 | 7–10 min |
| **Monster Hunt** | 3–4 v 1 + 0–2 | One enormous thing with a huge pool, optionally escorted | 10–16 | 6–9 min |
| **Pitched Battle** | 6–8 v 6–8 | Full lines on both sides | 16–24 | 10–14 min |

### Drafting rules per format

- **Named pool** drawn without replacement — a legend never appears twice in a battle.
- **Mook pool** drawn *with* replacement; repeats get a Roman numeral so the log stays readable.
- A side short of named units tops up from the mook pool rather than repeating a legend.
- A boss occupies the front rank alone; escorts stand behind it and smaller.

### Parity without hand-tuning every matchup

Rather than balance 5 formats × 12 eras by hand, both sides are scored on
`Σ pwr × √hp` after drafting and the weaker side's HP is padded until the ratio is inside
±10% (capped at ×2.4). That is what lets a 3v8 or a 4v1 stay a real fight.

Length is still engineered, not hoped for: `tests/` simulates the AI against itself across
every format and asserts median rounds land inside the bands above.

| Difficulty | Enemy stats | AI | Handicap | Reward |
|---|---|---|---|---|
| ★ Very Easy | ×0.75 | weighted random | you may get +1 unit | ×0.6 |
| ★★ Easy | ×0.90 | greedy damage | — | ×0.8 |
| ★★★ Normal | ×1.00 | greedy + heals + element aware | — | ×1.0 |
| ★★★★ Hard | ×1.15 | 1-ply lookahead, focus fire, holds ults | +1 legend | ×1.5 |
| ★★★★★ Very Hard | ×1.30 | 1-ply + threat/combo scoring | +1 unit, +1 legend | ×2.2 |

## 10. Rewards, ranking, economy

- **Score** = `100 × difficulty × format` + no-deaths `+150` + under-par rounds `+100` +
  ultimate-kill finish `+50`. Persisted as a local ranking (best run + lifetime total).
- **Shards ⧗** — 12–70 per win; a loss still pays 25%.
- Item prices run **190 → 5000**, i.e. roughly 5 to 80 battles. The shop is a long game.

## 11. The shop — 26 anachronisms

**Consumables** (bought in stacks, 3 satchel slots chosen pre-battle; 4 with the backpack):

| Item | ⧗ | Effect |
|---|---|---|
| 🥫 Instant Noodles | 190 | Heal the whole team 15% |
| 🪤 Paperclip | 210 | Steal 30 CHARGE from an enemy |
| 🥤 Energy Drink | 220 | Restore 35% HP to one ally |
| 🧯 Fire Extinguisher | 240 | Clear every DoT, +WRD for 2 rounds |
| 🩹 Duct Tape | 260 | Cleanse all debuffs, +15% HP |
| 🧪 Energy Gel | 260 | +30% PWR to one ally, 3 rounds |
| 🧊 Ice Pack | 280 | Revive a fallen ally at 30% |
| ☕ Cold Brew | 300 | +50 CHARGE to one ally |
| 🪝 Zip Tie | 320 | Stun one enemy for a turn |
| 🧨 Firecracker | 330 | 120 fixed damage to all enemies, ignores defence |
| 🕶️ Sunglasses | 350 | Team +25% dodge, 2 rounds |
| 🎈 Balloon | 400 | Shove one enemy to the back of the timeline |
| ✏️ Pencil | 480 | Redraw an ally's stats — reroll ±20%, keep the better draw |
| 🔋 Power Bank | 540 | One ally acts again, immediately |
| 📱 Phone | 700 | Look the enemy up: see their next action for 3 rounds |
| ⏱️ Stopwatch | 900 | Freeze the timeline — your whole team acts before any enemy |

**Relics** (permanent, always on):

| Item | ⧗ | Effect |
|---|---|---|
| 🎒 Bigger Backpack | 1200 | A 4th satchel slot |
| ⌚ Wristwatch | 1400 | Win every timeline tie, +5% SPD |
| 🔦 Flashlight | 1500 | Enemy affinities and counters shown in the HUD |
| 🧭 GPS | 1600 | Exact damage preview before you confirm a move |
| 🧤 Work Gloves | 1700 | +8% PWR, permanently |
| 💳 Credit Card | 1800 | Shop prices −20% |
| 🪖 Bike Helmet | 1900 | −10% damage from the first hit against you each round |
| 🖊️ Permanent Marker | 2400 | Mark a legend — they join you in every future battle of that era |
| 📸 Camera | 2600 | Capture an era; replay any battle you have won |
| ⌛ Hourglass | 5000 | Once per battle, undo your last turn |

## 12. File layout

```
games/chrono-drifter/
  index.html
  style.css
  js/
    main.js              router: title → generator reveal → battle → results → shop
    state.js             chronoDrifter.save (shards, relics, ranking), chronoDrifter.muted
    audio.js             Web Audio synth
    ui/                  battle-view.js  timeline.js  log.js  shop.js  menu.js  modal.js
    engine/              elements.js  moves.js  combat.js  ai.js  generator.js  items.js
    data/
      themes.js          index
      themes/            fantasy.js  cyberpunk.js  … (12 files)
      shop.js
tests/
  chrono-drifter.test.mjs
```

`engine/` and `data/` must stay **DOM-free** — the same discipline as `monster-battle`'s
marker regions, but enforced by module boundaries instead of comment markers. Because these
are real ES modules, the tests `import()` them directly; no `node:vm` harness is needed.

## 13. Tests

- Element wheel is total and consistent; no accidental 1.0 gaps in the cycle.
- **Content audit:** every era has ≥20 characters, ≥3 factions, ≥1 legend per faction, and
  every character has exactly 4 moves + WAIT.
- Every `move.id` referenced by data exists in the archetype library.
- Generator: never seats rival factions together, never duplicates a legend in a battle,
  never repeats a name on one side unnumbered, and always fills both sides.
- Every format produces its declared shape, and the parity pass leaves both sides within ±10%.
- Formations for n = 1…8 never overlap two sprites by more than 30% of the smaller one.
- Damage is monotonic in PWR and correctly applies the element multiplier.
- **Termination + pacing:** simulate 500 AI-vs-AI battles across every format and difficulty;
  assert all terminate and that median rounds land inside the band in §9.

## 14. Build order

1. Engine core — elements, moves, combat, tick queue — with tests.
2. Generator + 3 eras (Fantasy, Cyberpunk, Age of Sail) + content/pacing tests.
3. Battle UI: timeline strip, HP/status rows, move deck, log, animations, audio.
4. The remaining 9 eras.
5. Meta layer: score, shards, 26-item shop, satchel, relics, persistence, ranking.
6. Hub registration (`index.html` entry + a monochrome `RPG` glyph in `CATEGORY_ICONS`),
   `README.md` line, mobile pass.

Hub entry:

```js
{
  icon: "⏳",
  title: "Chrono Drifter",
  description: "Rơi vào một thời đại ngẫu nhiên, chỉ huy một phe ngẫu nhiên, thắng bằng đồ hiện đại.",
  category: "RPG",                       // add ❖ to CATEGORY_ICONS
  tags: ["1 người chơi", "Theo lượt", "Tiếng Việt"],
  added: "2026-09-02",
  color: "linear-gradient(135deg, #1b1633, #e0a94a)",
  path: "games/chrono-drifter/index.html"
}
```

Note: folder game ⇒ ES modules ⇒ must be opened through a server, not `file://`.
