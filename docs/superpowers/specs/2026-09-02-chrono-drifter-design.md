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
- **Ultimates — twelve shapes, because "damage everyone" is not a signature.**
  Annihilate (AoE) · Purge (AoE execute) · Devour (AoE that heals the caster) ·
  Shatter (AoE + stun all) · Sunderblow (one target, huge, ignores armour) ·
  Chain (three hops, each +35%) · Curse (no damage at all — wrecks every enemy stat and
  leaves them burning) · Aegis (team shield + regeneration) · Raise (every fallen ally
  stands back up) · Full Mend (heal all + cleanse) · Rage (the caster becomes the problem
  for four turns) · Sacrifice (spend 35% of your own HP for one impossible hit) ·
  **Time Stop** (act twice more immediately — the one ultimate that is *about* the premise)

  Each legend's shape is drawn from their own move set, so a taunting tank gets Aegis, a
  sniper gets Sunderblow, and a damage-over-time dragon gets Curse. Across the 84 legends
  and bosses no single shape exceeds 18%; it was 67% when every ultimate was an area attack.

## 7. Combat math

```
hit%  = 92 + accBuffs + (SPD.src − SPD.tgt)/8            clamped 45…99
crit% = 8  + critBuffs + (move.crit ? 22 : 0)            clamped 0…75
raw   = PWR × move.pow × rand(0.92, 1.08)
def   = move.el === STEEL ? target.GRD : target.WRD
dmg   = raw × 100/(100 + def) × element(move.el, target.affinity) × crit × buffs
```

### Accuracy and crit are stats, not hidden dice

Attacks can simply **miss**. `acc` and `crt` are percentage *points* rather than
multipliers, which is what lets a blinding move subtract flat accuracy and an aiming
move buy flat crit. Fifteen moves across the twelve eras move accuracy (smoke, sand,
ink, glare); twelve buy crit (taking aim, holding breath, calculating three moves
ahead). Both numbers print on the move button — `🎯 87% · 💥 8%` — because odds you
cannot see are not a decision.

Measured over 600 simulated battles: **7.7% miss rate, 9.1% crit rate.**

### A chip says which stat, and which way

Every stat modifier used to render as one of two pictures — 🔼 or 🔽 — so a name
plate showing 🔽🔽 could have been any two of six things. Each stat carries its own
face now, and the direction rides in the corner as a small ▲/▼ badge rather than a
seventh emoji:

| 💪 pwr | 🧱 grd | 🔮 wrd | 👟 spd | 👁️ acc | 💥 crt |
|---|---|---|---|---|---|

The icons steer clear of the ones already spoken for — 🛡️ is the shield status, 🎯
the mark — which a test asserts, along with all six being distinct. `effectsOf()`
returns `icon` and `dir`; the name plate and the dossier both render the badge from
those, so the two never drift apart.

The tutorial's counter ring names its elements with the same icons the battlefield
uses (⚡ STORM → 🌊 TIDE → 🔥 EMBER → 🌿 VERDANT → ⚙️ FORGE → ❄️ FROST), so the
sentence and the sprite agree.

### An item is help, not a turn

Using a satchel item no longer ends your turn — you use it and still act. It used to
cost the whole action, which meant a heal was only ever affordable on a turn you
could spare, and a boss acting once in every five enemy turns can never spare one.

**One item per turn** is the remaining limit, so a turn is at most one item plus one
move rather than a five-item dump. The real cost sits where it always did: five
satchel slots, and every consumable bought with ⧗.

`useItem()` also stopped incrementing `state.turns` — an item that costs no turn must
not age the flee window, the era-event schedule or the fatigue cap. A granted extra
turn (the power bank, Time Stop) resets the allowance, because a turn is a turn.

### Raising the dead is an ultimate, not a skill

There is no `REVIVE` archetype. A fighter comes back one of two ways: an **ultimate**
(`URAISE`, four of them across the 23 eras, gated behind a full charge bar) or a
**bought item** (the ice pack, one satchel slot and 280 ⧗). Never a move you can
spend a turn on and then spend again next turn.

Sixteen characters used to carry it as an ordinary skill. Measured over 500 AI
battles: it landed in 6.8% of them, and where it landed it was cast **1.94 times**;
twelve fighters were raised three or more times and one came back **nine times**.
Battles with a reviver on the field ran a median of **70 turns against 56** without
one — the fight stopped being winnable and started being long, which is the same
failure the fatigue cap exists to prevent.

The sixteen kept their identity and lost the loop: the necromancers took `DRAIN`
(*Gọi Hồn*, *Gọi Tổ Tiên*, *Kéo Xác Lên Boong* — the name still fits when it is your
life it is calling), the medics took `REGEN` or `CLEANSE` (*Khởi Động Lại* now
reboots a status instead of a corpse), the defibrillator became a `STUN` (*Sốc
Điện*), and the cult midwife's *Chưa Cho Đi Đâu Cả* became the `TAUNT` it always
sounded like. Two of the sixteen — the Draugr king and the bone shaman — already had
`URAISE` ultimates, so their skill slot was pure redundancy.

### Stat modifiers do not stack either

One buff and one debuff per stat, and no deeper. They used to multiply: three slows
left a target at `0.72³ = 37%` speed, and a boss — alone, and the only thing four
enemies can aim at — could be held there permanently, which is a spectator seat
rather than a fight. Same stat and same direction now share one entry, the strongest
magnitude applies, and re-applying refreshes the timer instead of deepening the hold.

Opposite directions still coexist and cancel out multiplicatively, so a slow can be
answered with a haste. Permanent relic buffs (`perm: true`) sit outside the rule
entirely — nothing refreshes them, so nothing may fold them in either. Every stat
change in the game routes through `applyStat()`: moves, ultimates, the WAIT guard,
era events and items alike.

The AI stopped re-applying what is already there. It used to pick a random utility
move on 16–30% of turns with no check, so four enemies would spend their turns
re-slowing the same boss; a modifier already at full strength on every unit the move
would touch is now skipped, and those turns go into attacks instead.

Measured over 400 boss-format battles, before → after:

| | before | after |
|---|---|---|
| deepest slow stack | 6 | **1** |
| worst speed multiplier | ×0.135 | **×0.680** |
| boss share of all turns | 18.3% | 19.4% |
| boss survives | 35.8% | **39.3%** |

How often a lone unit is slowed at all barely moved (13.9% → 13.6% of its turns),
which is the intent: one slow is a real tactic, four on top of each other is not.

### Riders roll separately, and control cannot be chained

A move landing and its rider landing are two different questions. Burn and mark apply at 85%;
**stun at 55% and silence at 50%** — control is deliberately the least reliable thing in the
game, because it is the only thing that takes a turn away.

That alone was not enough. Silence originally locked *everything including a fully charged
ultimate*, cost 23 energy against 10/turn regeneration, and could be re-applied on top of
itself — so a lone survivor could be held from acting for the rest of the battle. Measured:
**~100% of its turns.** Three changes:

- **A control effect cannot be refreshed while it is still running.** This was the real hole:
  re-applying every turn meant it never expired, so the immunity below never began.
- **Shaking one off grants 3 turns immune to both stun and silence.** No amount of re-casting
  gets through it.
- **Silence takes the skills but never the ultimate.** The thing a legend spent the whole
  battle charging still fires.

Spammed every single turn with unlimited energy, a lone target now loses **18.8%** of its
turns to silence and **22.9%** to stun. It is a real tool and never a lock. The AI also stops
throwing locks at targets that are already locked or still resisting.

### Energy

Every skill draws on one 80-point pool that regenerates **10 at the top of your own
turn**. Cheap pokes are sustainable on regeneration alone; the heavy hitters are not,
and that gap is the decision. A move you cannot afford is locked and says how short
you are. **Chờ costs nothing and refunds 30**, so a drained unit always has a legal
move and stalling to refill is a genuine tactic rather than a dead button.

| Tier | Cost |
|---|---|
| Strike · Mark · Hex · Buff | 11–15 |
| Pierce · Drain · Dot · Taunt · Arc · Barrier | 16–21 |
| Heal · Rally · Stun · Silence · Cleave | 22–29 |
| Mend All · Hex All · Revive | 27–36 |
| Ultimates | 0 — gated by the CHARGE meter instead |

Tuned by sweeping regeneration and pool size across 400-battle runs. At 10/80 the AI
finds at least one move unaffordable on ~7% of turns and is fully starved on 0.8%; a
human clicking the strongest option first hits the wall far more often — **13 of 28
turns in a played-through battle.**

Diminishing-returns defence keeps late-game stats from producing immortal units.

**Turn order** is a tick queue, not fixed rounds: every actor accrues `SPD` per tick and acts
at 100. Haste and Slow therefore visibly *reorder the timeline strip* at the top of the
screen, which is what makes speed manipulation legible.

## 7b. The menu — standing in the vortex

The menu has no card and no chrome bar. A canvas is fixed to the viewport and
everything else floats in front of it: the title, one line of pitch, ▶ CHƠI, and the
two side doors (🎒 CỬA HÀNG, 🧳 SẮP TÚI) centred in the mouth of the tunnel; the
frame controls (← ARCADE.SYS, the purse, HƯỚNG DẪN, mute) in the top-**left** corner
of the screen and the run's numbers — score, best, record, eras seen — in the
top-**right**, both read on the way past rather than as part of the pitch. The
controls are the same elements with the same handlers as every other screen's top
bar; only the bar around them goes away, and it comes back the moment you leave the
menu. What is packed used to be a line of prose under the buttons; it is a count on
the bag button instead (`SẮP TÚI 2/5`).

`ui/vortex.js` draws the tunnel — no images, no libraries:

- **Rings** of lumpy cloud rushing outward from a wandering vanishing point, each
  stroked twice: a wide faint band that builds into cloud where rings overlap, and
  a thin filament along its spine. Segment count scales with radius, or the near
  rings facet.
- **Debris** drawn as the streak it left rather than the point it is.
- **Clock faces** — roman numerals in rings, because the vortex has always had
  clocks in it — tumbling out of the depth.
- **The mouth**: the one warm light in the picture, breathing. The wall is always
  cooler than the mouth, which is what gives the tunnel its depth.

**It is not always blue.** Eight palettes — blue, purple, magenta, red, amber,
gold, green, teal — with a fresh one on every visit to the menu, never the one it
just left. More of the cycle is spent moving than standing still (7–13s settled,
13s to cross), so you never catch the moment it changes. Hue is interpolated the
short way round the circle, or a red→blue change detours through green.

The swap of one palette for the next happens **before** the mix is read, carrying
the leftover time with it. Read after, it painted a single frame of the target
colour before the fade had begun — a flash rather than a fade, invisible in a
screenshot and obvious in motion. Measured off the palette state rather than a
pixel: the largest frame-to-frame hue step is **0.3°**, none above 6°.

**The roll falls through the same tunnel.** The menu and the roll share the backdrop
— the drift out of one screen and into the next is one continuous fall, so the
colour carries across the transition instead of re-rolling, and the roll card
becomes a translucent panel floating in the vortex rather than a solid card. The
palette only picks a new colour when the vortex has actually been put away (going
into a battle), never on the menu → roll step.

The loop only runs while the vortex is on screen, and `prefers-reduced-motion` gets
a single still frame in one colour. Measured at 61fps on a software renderer.

Two things the full-bleed backdrop cost, both found by measuring rather than
looking: a canvas is a *replaced* element, so `inset: 0` leaves it at its intrinsic
300×150 and the size has to be stated; and a viewport-fixed child inside a padded
body makes the document wider than the screen, so the canvas sits outside
`.machine` and the body's padding moves inside it while the menu is up.

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

### Four stagings, not one

Two mirrored rows made every battle look the same, so the composition is now rolled per
battle (seeded off the battle seed, stable across redraws) and the era's scenery is laid
out to suit it — the horizon itself moves:

| Composition | Shape | Horizon | Used for |
|---|---|---|---|
| **Hàng ngũ** | two facing rows | 56% | pitched battles, big fields |
| **Đối mặt** | you low and close, them high and far, each on their own ground | 48% | duels, boss hunts |
| **Vây bọc** | the larger side curls around the smaller | 60% | a mob against a few |
| **Chiếm cao điểm** | one side holds a stepped ridge | 52% | mixed |

Each fighter now stands on a tinted **platform** — ally blue, enemy red — which is what
sells the depth in the face-to-face staging.

### Nothing may hide behind anything

A dragon is three times the width of a rat, so dividing a band evenly hid the rat and made
it unclickable. Layout packs by real **footprint** — the wider of the sprite and its name
plate — and rank spacing is derived from the tallest sprite standing in front rather than a
fixed percentage.

That gets the geometry close, but only the browser knows where a glyph actually lands: the
actor box is anchored at its name plate, not its feet, and emoji metrics differ by era. So
the last word goes to the rendered result. After layout, every fighter's centre is tested
with `elementFromPoint`; if it does not resolve to that fighter's own body it is not
clickable, and it moves — sideways first, lifted clear when boxed in.

Verified across 260 generated battles covering all four compositions and all 23 eras:
**0 of 2,130 fighters had a covered centre.**

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

### Death is an animation, and animations outlive the thing they played on

The death keyframes end on `fill: 'forwards'` — that is what keeps a body down after
they finish. It also outlives the death: "Hồi Quang" put a fallen fighter back on the
field still holding `opacity: 0`, `rotate: 80deg` and `translate: 0 26px`, so they
were invisible, sitting off their own tile, and impossible to click. `paint()` cancels
the death animation whenever a unit is alive, which covers every way one comes back —
the era event, the revive moves, `URAISE` and the ice pack.

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

### The console: deck left, chronicle right

Below the battlefield the screen splits **two thirds / one third**. What you can do and
what has already happened are different jobs and stopped sharing a column:

- **Left — the deck.** One header row (name · HP bar · NL bar · the standing
  instruction · the flee button, hard right), then the six move slots, then the satchel
  along the bottom edge.
- **Right — the chronicle.** The action log alone, newest at the top.

The chronicle's contents are absolutely positioned inside its box, so a full log can
never set the row height — the deck's fixed slot count does, and the move buttons stay
put all battle. Below **900px** the two stack and the chronicle keeps its own scroll.

The header never wraps, which makes it the row most likely to push the page sideways:
under **700px** the numeric readouts give way (the bars stay) and the flee and cancel
buttons drop to short forms. Measured at eight widths from 1580 down to 420 — zero deck
movement, no horizontal scroll.

Whenever the grid holds no buttons — an enemy is thinking, an action is resolving, the
era is speaking — it keeps its height and says what it is waiting for, rather than
leaving a tall blank panel.

### The action log

**Fifteen entries**, newest first, the oldest falling off the bottom; each names the
actor, the move, the target and how it landed — **trúng / CHÍ MẠNG / TRƯỢT**, or a tally
for an area attack (`7 trúng, 1 chí mạng, 1 trượt`). Deaths are appended to the line that
caused them. Exact numbers stay on the floating combat text; the log is for following the
fight, not auditing it. One line was never enough: by the time you read it, the next unit
had already acted.

Rows wrap to at most two lines and carry their full text as a tooltip. About ten to
eleven are on screen at once and the rest are one scroll up — the panel is as tall as the
deck beside it, and buying the last four rows would have meant a taller console than the
battlefield can spare.

### Two conventions the data can no longer break

**A debuff's `pct` is a magnitude, not a signed delta.** `resolve()` subtracts it, so
a move written `X('Bom Khói', 'acc', -24)` was negated twice: the button read
`−-24đ chính xác` and the enemy walked away with **+24 accuracy**. Forty-eight moves
across eleven eras were written that way. `X`/`XALL` now take the sign out of the
caller's hands, the data reads positive, and a test walks every era asserting no
debuff carries a signed `pct` and no tag prints a double minus.

**Point stats are points everywhere.** `acc` and `crt` move in percentage points, and
the status chip said `%` while the move button said `đ` — the same number, two units.
Both say `đ` now.

### Fleeing

You may withdraw from any battle. Inside the first **20 turns** the era takes half of
what a win there would have paid; after that leaving is free but pays nothing. The window
is twenty rather than a handful because a battle is only readable once both sides have
shown their hand — five turns let you fold before there was anything to fold on. The
button arms on the first click and only flees on the second.

The toll is derived from `winShards()` rather than its own constant, so it can never
exceed a victory — priced independently it did, in all 25 difficulty × format
combinations, which would have made fleeing a trap rather than a choice.

### Era events

A long fight settles into a rhythm. Every **30–50 turns** (rolled once per battle) the era
itself interrupts — and it is blind to sides, because the sky does not care whose army it
lands on. **An event may end a battle**; that is deliberate, and *Kẻ Cuối Cùng* is the
counterweight.

| Kind | Events |
|---|---|
| **Cataclysm** | Thiên Thạch (meteor: one unit hard, the **3 physically nearest** at half) · Nứt Đất (the front rank takes the ground giving way and loses its place in the queue) · Bão Nguyên Tố (one element floods the field: everything weak to it bleeds, everything strong against it charges) · Nhật Thực (RADIANT −30% PWR, UMBRA +30%) |
| **Mercy** | Đường Cùng (everyone under half HP hits 40% harder) · Hồi Quang (one of the fallen returns at 40% for exactly five of its own turns) · Kẻ Cuối Cùng (a side down to one gets +50% PWR, a shield and +25 crit) · Cơn Gió Thứ Hai (everyone heals 20% and sheds a debuff) |
| **Tempo** | Trường Năng Lượng (full energy, doubled regen) · Chân Không (half energy, halved regen) · Tiếng Gọi Nộ Khí (+40 charge to everyone — every ultimate ripens at once) · Mạch Thời Gian Đứt (the turn queue is shuffled) |
| **Rules** | Sương Mù Dày (−25 accuracy for all) · Đất Cằn (no healing works at all) · Lưỡi Dao Cạo (+30 crit for all) · Vết Nứt (one unit gets two extra turns) |
| **Outsider** | Kẻ Lạc Thời (a mook **from a different era** joins the outnumbered side for five turns) · Túi Rách (a consumable spills out of your satchel and fires itself) |

Every event carries two lines: a **blurb** (why, in the fiction) and an **effect** (what it
does, mechanically), and the two must not restate each other — a test measures word overlap
between them, which caught three events saying the same thing twice.

The **cut-in is three tiers**: a lead-in line, the name, then the effect.

```
        Một sự kiện diễn ra như định mệnh cho cuộc chiến:
                        KẺ LẠC THỜI
        🌿 Tiểu Yêu Gác Động từ TÂY DU nhập cuộc, chỉ trong 5 lượt.
```

The lead-in is drawn from a pool of six generic lines and **never repeats twice running**
inside a battle. The flavour blurb was moved off the cut-in — four tiers needed a longer
pause every single time — and now closes the history line instead:

```
⌛ KẺ LẠC THỜI — 🌿 Tiểu Yêu Gác Động từ TÂY DU nhập cuộc, chỉ trong 5 lượt.
                Một kẻ từ thời đại khác rơi qua cùng một vết nứt.
```

Effect first and flavour last, so flavour is the half that clips when a row runs past its
two lines. Each row carries the full text as a tooltip.

Four events rewrite their own effect line once they have run, so it names the unit, the
element or the era that actually turned up rather than a generic sentence.

Rails: nothing fires in the first 6 turns; an event never repeats inside one battle; a
conditional event stays out of the pool until it would actually do something, and the clock
reschedules rather than wasting the beat. Every `run()` is also safe on its own, without its
guard — the guard decides whether an event is *offered*, not whether it can crash.

Two events change the roster mid-battle, which the engine supports through `state.spawn()`
and a `temp` counter that ticks down on the unit's own turns. The renderer rebuilds the
field when it sees a `spawn` event.

The meteor is the one place position matters: the view publishes each fighter's stage
coordinates back onto the unit, so "nearby" means what it looks like.

Measured over 400 simulated battles: **1.23 events per battle**, all 18 types firing, and
4 battles ended by one.

## 10. Rewards, ranking, economy

- **Score** = `100 × difficulty × format` + no-deaths `+150` + under-par rounds `+100` +
  ultimate-kill finish `+50`. Persisted as a local ranking (best run + lifetime total).
- **Shards ⧗** — 12–70 per win; a loss still pays 25%.
- Item prices run **190 → 5000**, i.e. roughly 5 to 80 battles. The shop is a long game.

## 11. The shop — 26 anachronisms

**Consumables** (bought in stacks; **5 satchel slots**, armed automatically on purchase and
re-orderable on the loadout screen):

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
| 🎒 Ba lô hai ngăn | 1200 | Every consumable purchase yields double |
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
