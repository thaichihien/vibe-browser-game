# Vương Quốc Muông Thú — Design

**Date:** 2026-08-30
**Files:** `games/animal-kings/` (folder game — `index.html`, `style.css`, `js/*.js`)
**Genre:** Top-down RTS played from inside one unit — the king
**UI language:** **Tiếng Việt** (joins Cờ Thú, Cờ Cá Ngựa, Monster battle)

## 1. Goal

A real-time strategy game where **you are not a cursor, you are the king**. There is no
God view and no minimap. The camera is bolted to your king, and every strategic verb has to
be reached on foot:

- want to buy something → **walk to the merchant**
- want a building → **walk to the builder**, then walk to where it goes
- want an army to move → **walk to the soldiers** and enlist them into your retinue
- want to know what is happening across the map → **wait for the runner** to reach you

The match ends when a king dies. Nothing else ends it: not losing your base, not losing your
whole army. As long as your king breathes you can still win, and as long as theirs does, you
have not.

That single rule is what makes the avatar framing work. In a normal RTS the commander is
invulnerable and abstract; here the commander is the win condition, standing in the grass,
within reach of a wolf.

## 2. The four decisions that shape it

Settled with the user before design:


|              | Decision                                                                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Factions** | 5 animal kingdoms, and each fields **its own roster of 5 unit classes** — not a shared roster with a recolour.                                                              |
| **Vision**   | **No fog of war.** The map is very large and the camera is locked to the king; being off-screen *is* the limitation. Messengers exist for what happens beyond the viewport. |
| **Commands** | **Retinue + posts.** Walk up, `E` to enlist, command bar orders the whole retinue. No drag-select, no unit portraits.                                                       |
| **Language** | Tiếng Việt.                                                                                                                                                                 |


The no-fog call matters more than it sounds. It means the world is *knowable* — you can always
go and look — but looking costs the one thing the king cannot duplicate: his own time and his
own body. Every scouting trip is a trip your capital spends without you.

## 3. Scope

### In scope (v1)

- One 160×160 tile map (6400 × 6400 px), seeded and point-symmetric so starts are fair.
- 5 factions × 5 unit classes, one active king ability and one passive per faction.
- The king harvests, repairs and fights with one contextual verb; seven ordered royal
  duties as the opening tutorial.
- Three resources, eight building types (seven shared + one per faction), two town NPCs,
  unit upgrades, king items.
- Retinue of up to 24, four orders, garrisons that keep fighting when you leave.
- Courier system: off-screen events become runners that can be intercepted and killed.
- AI kingdom brain with **4 difficulty profiles**; 1 or 2 opponents per match.
- Neutral wildlife guarding gold.
- Day/night cycle, particle FX, Web Audio synth, touch layer.
- Menu, faction/difficulty setup, rules modal, pause, end overlay.
- Hub integration: entry in `index.html`, line in `README.md`.

### Out of scope (v1)

- Campaign, multiple maps, saving a match in progress, replays, multiplayer.
- Only the mute flag (`animalKings.muted`) and last-used setup persist.
- No audio or image assets — Web Audio synth and emoji only, so the repo grows by KB not MB.

## 4. The map

160 × 160 tiles at 40 px. The viewport shows roughly 32 × 18 tiles, so **about 1/25th of the
world is visible at once**. Walking corner to corner takes well over a minute. That is the
intended feel: distance is the game's real currency.

Terrain: `grass`, `path`, `water` (impassable), `forest` (impassable, harvest 🪵), `rock`
(impassable), `field` (walkable, harvest 🌾), `mine` (impassable, harvest 🪙), `sand`.

Generation is **seeded and point-symmetric** — one half is generated and the other is its 180°
rotation, so both kingdoms get the same lake, the same treeline, the same distance to gold.

**Gold only comes from mines**, and mines sit away from home guarded by 🐺 wolves and 🐍
snakes. Food and wood are safe and near; gold requires leaving. That is the pressure that gets
the king out of his capital, and it is also what the early game is *for* — before either side
has an army, the king personally clears creeps for the gold that buys his own equipment.

## 5. The king's own hands

**Yes — the king harvests.** `Space` (or click) is one contextual verb: swing at an enemy,
chop at a tree, reap a field, mine an outcrop, or hammer a damaged building. Whatever is in
front of him is what he does.

This is the opening of every match. You start with **a castle, three workers and nothing else**
— not enough to train a fourth worker. The first thing the king does is walk to the wheat and
cut it himself.

### Why it does not break the game

Three rules keep the king from becoming a permanent farmhand:

| | Worker | King |
|---|---|---|
| rate | 9.5 / s | **6.5 / s** — slower |
| hauling | must carry 22 back to a drop-off | **none — it lands straight in the treasury** |
| limit | works forever | **stamina**, shared with sprinting and fighting |

A worker loses half its life walking to a drop-off, so the king genuinely out-earns one worker
early and out-earns several when he is far from home. But stamina empties after about ten
seconds of continuous work and only refills while he rests, so he works in bursts and can never
be parked on a treeline. And stamina is the *same* pool he sprints and fights on — deciding to
chop is deciding to be tired if something arrives.

By the ten-minute mark six workers trivially out-produce him, which is exactly right: the king
should graduate from labour into command.

### The one thing only the king can do

Gathering into the treasury needs no drop-off building. **A worker cannot mine gold that has no
outpost near it; the king can.** He can walk to a distant unclaimed mine, chip gold out of it by
hand, and walk home with it already banked.

That makes the early gold expedition a real, self-contained adventure: cross the map, kill the
wolves camped on the seam, mine it personally, come home and buy a sword. No infrastructure
required — just the king, alone, a long way from his castle.

Each faction's king has one **affinity** at ×1.35: 🐷 and 🐔 on 🌾, 🐄 and 🐑 on 🪵, 🐰 on 🪙.

He can also **repair** — hammering a damaged friendly building restores HP for wood. Late game
that is often the most useful thing the king's hands are still good for.

### Royal duties — the opening tasks

A small parchment 📜 in the corner lists the king's current duties, one at a time, in order.
They are the tutorial, and they are written as a chancellor's instructions rather than as a
checklist:

| Duty | Reward |
|---|---|
| Đích thân thu 100 🪵 gỗ | 60 🌾 |
| Dựng một trại lính | 60 🪵 |
| Tuyển đủ 6 thợ | one free Chiến Binh |
| Diệt bầy sói canh mỏ | 50 🪙 |
| Chiếm mỏ vàng bằng tiền đồn | ⚔️ Kiếm Vua |
| Chiêu mộ 6 người vào đoàn tùy tùng | Uy Danh tier 1 |
| Tìm ra vua địch | 🎺 Tù Và |

Seven duties, one-time, ordered so each one teaches the next mechanic — harvest, build, train,
fight, expand, command, scout. The barracks comes before the workers because without it there
is nowhere to hire them. The rewards are deliberately front-loaded toward whatever the
next duty needs. When the last is done the parchment rolls up and does not come back.

They are also the answer to a real problem: this game has no minimap, no unit portraits and no
tooltips, and a player dropped into a 6400 px map with three workers needs to be told where to
put their hands.

## 6. Interaction — the town

Two NPCs stand either side of your castle, and one building. Walk within range, an `E` prompt
floats over whichever is nearest, and a panel opens. **No panel pauses the world.** Shopping is
a decision to stop watching.

- 🛒 **Thương nhân** — trades resources at a spread, and sells **king items**: ⚔️ sword (+dmg),
🛡️ shield (+max HP), 👢 boots (+speed), 🧪 thuốc (heal), 🎺 tù và (retinue damage aura),
🍖 lương khô (heal the retinue). The king is a genuine combat unit and these are how he keeps
up with the units being trained around him.
- 🔨 **Thợ xây** — the build menu. Pick a building and a translucent ghost follows the cursor;
place it in the world and a worker walks over and raises it.
- 🛖 **Trại Lính** — the barracks itself. This is the **only** place any unit is trained,
  workers included, and there is no way to queue into it from across the map. Reaching it is
  the cost of using it.

The merchant also carries the **army upgrades** — Rèn Vũ Khí, Giáp, Uy Danh — so gold has
exactly one place it can be spent.

There was a third NPC here, a captain who queued units into whichever barracks had the
shortest line. He was a second door onto a panel the barracks already opens, so he is gone.
Two people, one building, three verbs, no overlap.

## 7. Buildings

Eight types: seven shared, one unique to each faction. Footprints are in tiles (40 px each).

| | Building | Foot | Cost | Time | HP | What it does |
|---|---|---|---|---|---|---|
| 🏰 | **Lâu Đài** | 3×3 | *given* | — | 3000 | Drop-off for everything. Pop +12. King regenerates in its aura. Trains nothing. **One per kingdom, never rebuildable.** |
| 🏕️ | **Tiền Đồn** | 2×2 | 120 🪵 | 14s | 900 | Drop-off, pop +4, rally point, rabbit burrow anchor. **This is how you claim a gold mine.** |
| 🌾 | **Nông Trại** | 2×2 | 80 🪵 | 12s | 550 | Passive +2.2 🌾/s forever, no worker needed. Pop +2. |
| 🪓 | **Trại Gỗ** | 2×2 | 60 🪵 30 🌾 | 10s | 500 | Wood drop-off, +25% gather rate for workers hauling to it. Built beside a treeline to cut the walk. Pop +2. |
| 🛖 | **Trại Lính** | 3×3 | 140 🪵 60 🌾 | 18s | 1200 | **Trains everything — all five classes, workers included.** Pop +6. Each barracks is its own queue, so this is the only throughput lever there is. |
| 🗼 | **Tháp Canh** | 1×1 | 90 🪵 40 🪙 | 12s | 800 | Auto-fires: 260 range, 18 dmg, every 1.1s. |
| 🏛️ | **Đền Thờ** | 2×2 | 140 🪵 120 🪙 | 24s | 700 | **Unlocks the faction's signature unit** and cuts the king's ability cooldown 25%. Pop +2. |
| — | **faction building** | 1–2 | varies | varies | varies | See below. |

### The faction building

| | | Effect |
|---|---|---|
| 🐷 | 🛢️ **Máng Ăn** | Heals friendly units within range, 6 hp/s. |
| 🐔 | 🥚 **Ổ Trứng** | Spits out one **free** 🐤 chick every 25s while pop allows. |
| 🐄 | 🔔 **Chuông Trận** | Friendly units in range deal +20% damage. |
| 🐑 | 🧱 **Tường Len** | 1×1, dirt cheap, very high HP, blocks movement. Built in rows as a wall. |
| 🐰 | 🕳️ **Cửa Hầm** | A second burrow anchor; units travel between gates on their own. |

Note the shape of the economy: **🌾 fields are worker-harvested and run out; 🌾 Nông Trại is a
slow trickle that never does.** The early game is spent on fields near home, the mid game on
farms, and gold the whole time is only available where it is guarded. Each stage of the economy
pulls the king a bit further from his own castle.

### Placement

1. Walk to 🔨 **Thợ Xây**, press `E`, pick a building.
2. A translucent **ghost follows the cursor in the world** — green where it fits, red where it
   does not. Invalid means: a footprint tile is blocked or occupied, or the spot is outside
   **build range** (420 px around any building you own).
3. Click to place. Resources are deducted now; cancelling before placement refunds.

Build range is why the map is crossable at all: you cannot drop a barracks in the enemy's
base, but you *can* creep toward it by chaining outposts. Territory is something you walk
forward, one 420 px hop at a time.

### Construction

A placed building is a **site**, not a building. The nearest idle worker — or the nearest
gatherer, if none is idle — is auto-assigned, walks over, and raises it. **More workers on the
same site build it faster** (each adds to the rate, with diminishing returns past three), so
grabbing three workers off wood to rush a barracks is a real decision.

A progress ring sits over the site. On completion: dust puff, sound, and — if it finished
while you were somewhere else — a courier is dispatched: *"Tâu bệ hạ, trại lính đã dựng xong!"*

Sites can be attacked and destroyed mid-build, and that investment is simply lost. Finished
buildings smoke 🔥 below 33% HP, leave rubble when razed, and drop your pop cap when they go.

## 8. Units and how they are spawned

### The five classes

Every faction fields the same five roles with its own stats, emoji and one genuine override.

| Badge | Class | Built at | Role |
|---|---|---|---|
| ⚒ | **Thợ** | 🛖 | Gathers, builds, repairs. Flees from combat instead of fighting. |
| 👁 | **Trinh Sát** | 🛖 | Fast, cheap, fragile. The natural 🔎 DO THÁM squad. |
| ⚔ | **Chiến Binh** | 🛖 | The melee line. |
| 🏹 | **Xạ Thủ** | 🛖 | Projectiles. *Sheep override: a **healer**, not an archer.* |
| 🛡 | **signature** | 🛖, needs 🏛️ | Expensive, pop 3, one per faction: 🐗 Lợn Lòi · 🐓 Gà Trống · 🐂 Bò Mộng · 🐏 Cừu Đực · 🐇 Thỏ Sát Thủ. |

Base costs before faction modifiers:

| | 🌾 | 🪵 | 🪙 | time | pop |
|---|---|---|---|---|---|
| Thợ | 50 | — | — | 12s | 1 |
| Trinh Sát | 40 | 20 | — | 10s | 1 |
| Chiến Binh | 70 | 20 | — | 18s | 2 |
| Xạ Thủ | 50 | 45 | — | 20s | 2 |
| signature | 110 | 40 | 35 | 30s | 3 |

Chickens multiply cost by 0.6 and time by 0.55; cows by 1.35 and 1.3. A chicken barracks is a
faucet, a cow barracks is a foundry.

### One way a unit appears

**The barracks, and nothing else.** Walk to a 🛖 Trại Lính, press `E`, and its queue opens —
all five classes, workers included. The same panel sets that building's **rally point**.
Nothing can be queued remotely, and no other building produces anything.

Two things follow, and both are load-bearing:

- **A kingdom with no barracks cannot grow at all.** Not another worker, not a scout. That is
  why the very first thing anyone builds is a barracks, and why the opening royal duty says so.
- **Workers and soldiers compete for the same queue.** Every peasant you hire is a soldier you
  did not. There is exactly one lever for widening that: build more barracks.

The one exception is **free spawns** — the chicken 🥚 Ổ Trứng emits a chick on a timer, and the
sheep king's *Tường Len* drops barricades instantly. Neither is a backbone.

### What happens when one pops out

Each barracks trains **one at a time, FIFO** — a progress ring sits over the building, and
three barracks is literally three times the throughput. The finished unit walks out of the
building's rally side to its **rally point** and then **stands there idle, guarding**.

**It does not join you.** New soldiers are not yours until you walk over and press `E`. That is
the whole conceit: an army you never visit is an army standing in a field.

If the pop cap is full the queue stalls with *"Hết chỗ ở"* — and if you are across the map, a
courier comes to tell you that your barracks has been idle for a minute.

### How units behave on their own

`idle` (drift near their post) → `gather` / `build` (workers) → `follow` (in your retinue) →
`move` (under an order) → `attack` (hostile inside ~180 px) → `garrison` (left on 🛡 GIỮ) →
`flee` (wounded — Khó and Bạo Chúa AI only) → `dead`.

Everything that is not a worker auto-attacks hostiles that come within ~180 px of it, so a
garrison genuinely holds ground and a retinue fights without micromanagement. Workers run.

### Upgrades

Bought from 🛒 Thương Nhân with 🪙: **Rèn Vũ Khí** (+15% damage, 3 tiers), **Giáp** (+15% HP,
3 tiers), **Uy Danh** (retinue cap +4, up to 24). Gold funds the army's *quality*; food and wood
fund its *quantity*. Both roads run through the mines.

## 9. Factions

Body glyph is the animal; the **class is a small badge glyph** drawn at the shoulder
(`⚒` thợ, `👁` trinh sát, `⚔` chiến binh, `🏹` xạ thủ, `🛡` signature). Kings wear `👑`. This
is how five classes fit into an emoji set that only has two or three faces per animal.


| Faction               | Passive                                                           | King ability (`R`)                                          | Feel                      |
| --------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------- |
| 🐷 **Vương Quốc Lợn** | food income ↑, units regenerate when idle near buildings          | **Tiệc Lớn** — heal every nearby ally                       | slow, tanky, attrition    |
| 🐔 **Vương Quốc Gà**  | units far cheaper and far faster to train                         | **Bầy Đàn** — retinue attack speed ↑↑ for 8s                | swarm, early aggression   |
| 🐄 **Vương Quốc Bò**  | few, expensive, heavy units                                       | **Giẫm Đạp** — king and retinue charge, trampling a line    | slow, brutal pushes       |
| 🐑 **Vương Quốc Cừu** | cheap barricades; the ranged class is a **healer**, not an archer | **Tường Len** — instant ring of barricades around the king  | defensive, siege-breaking |
| 🐰 **Vương Quốc Thỏ** | fastest units in the game                                         | **Đào Hầm** — king and retinue burrow to any owned building | raiders, map control      |


Rabbit's *Đào Hầm* is the mechanical answer to the map size: one faction gets to ignore the
distance rule, and pays for it with the thinnest units on the field.

Each faction's 5 classes are derived from 5 archetypes (worker / scout / warrior / ranged /
signature) times a faction modifier, plus per-faction overrides — so the sheep healer and the
cow siege-ox are real differences, not stat noise.

## 10. Retinue

- `E` near friendly soldiers enlists them, up to the cap (8, upgradable to 24). They follow in
a loose trailing formation.
- Four orders, `1`–`4` or the on-screen bar:
**⚔ TẤN CÔNG** attack-move where the king faces · **🛡 GIỮ** stand here as a garrison ·
**🏠 VỀ NHÀ** return to the castle · **🔎 DO THÁM** fan out and explore.
- `F` dismisses. Anything left on **GIỮ** becomes a garrison that defends its post on its own
and reports by courier.

Group movement uses one **BFS flow-field per order**, not one A per unit — a 20-strong
retinue costs one field.

## 11. Couriers — the only way to learn about off-screen events

Anything outside the viewport does **not** produce a popup. It produces an **event**, which
spawns a runner (🐦/🐇) at the event's location. The runner physically crosses the map to the
king, and only on arrival does the news exist: a speech bubble, and a line in the 📜 **TIN BÁO**
panel (`Tab`).

Two consequences make this more than a delayed toast:

1. **A courier can be intercepted and killed.** The news never arrives. You find out when you
  walk home and the mill is ash.
2. **Distance is latency.** A raid on your far expansion reaches you late by exactly as much as
  it is far away.

This is the diegetic-UI principle applied to an entire information layer: the game state is
expressed through a character in the fiction, never through a meter.

## 12. The AI

One brain, instantiated per enemy kingdom (1 or 2 per match), running a phased state machine:
`open → econ → scout → raid → mass → push → defend`. It assigns workers, follows a build order,
composes an army from **its own** faction roster, uses its faction skill, and controls its own
king.

Four profiles that differ by **behaviour, not by cheating on resources**:


|                  | Dễ            | Thường           | Khó               | Bạo Chúa                 |
| ---------------- | ------------- | ---------------- | ----------------- | ------------------------ |
| think interval   | slow          |                  |                   | fast                     |
| build efficiency | wasteful      |                  |                   | tight                    |
| scouting         | rare          | occasional       | regular           | constant, re-scouts      |
| micro            | none          | focus fire       | + retreat wounded | + kiting, ability timing |
| its king         | hides at home | defends the base | joins pushes      | **hunts your king**      |
| harassment       | never         | occasional       | worker raids      | multi-prong              |


*Bạo Chúa* sending its king after yours is the difficulty spike that matters: at the top level
the win condition starts walking toward you.

## 13. Win / lose

A king dies → the match ends. To keep that from being cheap:

- Kings have large HP and regenerate fast inside their own castle's aura.
- Kings take **reduced damage from ranged attacks**, so no one gets sniped from beyond the
screen edge by something they never saw.

The end overlay reports the match: duration, units lost, buildings raised, and who landed the
blow.

## 14. Controls

`WASD`/arrows move — **and that is also where the king faces**. There is no aiming device:
the same input that walks him points him, and he keeps facing that way when he stops. It makes
the contextual verb legible, because whatever he is walking at is whatever `Space` will act on.
The mouse is only for panels and for placing a building.

`Space` **contextual action** (swing / chop / reap / mine / repair) · `Shift` sprint (stamina) ·
`E` interact/enlist · `1`–`4` retinue orders · `F` dismiss · `R` faction ability ·
`Q` use item · `Tab` reports · `P` pause · `M` mute.

The camera keeps the king dead centre — no lead offset, since facing and movement are the
same thing here.

Touch: virtual stick plus action buttons, following the layout grid-storm added for phones.

## 15. House rules this game must keep

- Folder game: vanilla ES modules, no build step, no dependencies, **no network requests**.
ES modules do not load over `file://`, so it is served (`python3 -m http.server 8000`) — same
as `last-quarter` and `grid-storm`. GitHub Pages is unaffected.
- Emoji for all art. Web Audio synth for sound. Mute flag at `animalKings.muted`.
- Start screen, rules modal, end overlay, hub back-link — the house chrome.
- **Registration is part of shipping**: an entry in the `games` array in `index.html` and a line
in `README.md`, or the game is unreachable. Category `Strategy` (glyph `⊞` already exists).

