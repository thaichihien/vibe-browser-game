Genre: Grid-based tactical boss battler
Reference base: Crazy Arcade (BnB) core mechanics, restructured around boss encounters



## 1. Design pillars

1. **The bomb is the only verb.** No sword, no gun, no dash-attack. Every interaction with the world — damage, movement control, self-defense, puzzle-solving — routes through placing a water balloon. Adding a second attack button kills the design.
2. **Positioning is the skill, not aim.** The blast is a fixed cross. You never aim. You decide *where to stand* and *when to commit* — and every balloon you place is also a wall that can trap you.
3. **The boss fights the maze, not the player.** The boss's real threat is that it rewrites the arena you depend on for survival. It destroys your cover, floods your escape lanes, and eats your balloons.
4. **Setup beats reaction.** The damage window is short and predictable. Winning means having balloons already in place when it opens.

---

## 2. Core loop (inherited from Crazy Arcade — keep exact)

### 2.1 Grid & movement
- Arena is a tile grid, default **15 × 13** tiles, tile size **40px**.
- Tile types: `EMPTY`, `HARD` (indestructible), `SOFT` (destructible, may drop item), `BALLOON`, `WATER`, `HAZARD`.
- Player occupies a hitbox smaller than a tile (~28px) and moves freely in 4 directions.
- **Corner-slip assist is mandatory.** If the player pushes into a wall corner and a lane is open within ~10px perpendicular, auto-nudge them into it. This single feature is 80% of why CA feels good. Do not skip it.
- No diagonal input. Diagonal key combos resolve to the most recently pressed axis.

### 2.2 Balloon → water → bubble
1. Player presses **Place**. A balloon spawns snapped to the tile center under the player. Costs 1 from `balloonCount`.
2. The player may walk off the tile freely, but **cannot walk back onto it** once they've left. (CA rule — keep it, it creates self-trapping.)
3. After `FUSE_TIME`, the balloon bursts into a **cross (+)** of water: `power` tiles in each of the 4 directions from origin.
4. Water propagation: stops at `HARD`. Destroys the **first** `SOFT` tile it hits, then stops in that direction.
5. **Chain reaction**: if the expanding water touches a tile containing another `BALLOON`, that balloon bursts immediately (its own fuse is cancelled).
6. Water tile lingers for `WATER_LINGER`, then clears. `balloonCount` refunds on burst, not on clear.

### 2.3 Getting hit — the bubble state
This is the mechanic to protect above all others. **The player does not take damage from water. The player gets trapped.**

- Player touches a `WATER` tile → enters **BUBBLED** state.
- While bubbled: cannot place balloons, movement reduced to ~15% speed, invulnerable to further water.
- A **struggle bar** counts down from `BUBBLE_DURATION`. Mashing any direction key drains it faster.
- If the bar empties → escape, brief invulnerability (`1.0s`), no life lost.
- If the timer runs out → **bubble pops → lose 1 life**, respawn at a safe tile after `2.0s`.
- Co-op: an ally touching a bubbled player frees them instantly.
- The `Needle` skill item breaks the bubble instantly.

### 2.4 Stats & items (from destroyed SOFT tiles and boss drops)
| Item | Effect | Base | Cap |
|---|---|---|---|
| Balloon | +1 concurrent balloon | 1 | 8 |
| Power | +1 water length per direction | 1 | 8 |
| Shoe | +1 speed tier | tier 2 | tier 8 |
| Kick | Walk into your own balloon to push it until it hits something | off | — |
| Throw | Lob a balloon 5 tiles over obstacles; fuse resets on landing | off | — |
| Heart | +1 life | — | 5 |

**Equipped actives** (max 2, own cooldowns): `Needle` (instant bubble escape, 20s), `Shield` (absorb 1 water hit, 30s), `Shockwave` (detonate all your placed balloons immediately, 25s), `Anchor` (become immovable + immune to boss pull for 2s, 20s).

---

## 3. THE BOSS SYSTEM (the new part)

### 3.1 The problem
CA's win condition is "trap the enemy in a bubble." A boss can't be one-shot-trapped. But if we replace that with a plain HP bar and let water chip it down, the game becomes a bomb-spamming DPS race and the tension of CA evaporates.

### 3.2 The solution — SOAK → SATURATE → BURST

The boss occupies a **3 × 3 tile footprint** (final boss 4 × 4) and is far too big to miss. Hitting it is not the challenge. The challenge is the loop:

```
  ┌─ SOAK ──────────────────────────────────┐
  │  Water contact fills the boss's         │
  │  Soak meter (0 → 100).                  │
  │  Soak DECAYS if you stop applying it.   │
  └────────────────┬────────────────────────┘
                   ▼  at 100
  ┌─ SATURATE ──────────────────────────────┐
  │  Boss is BUBBLED — same visual & rules  │
  │  as a trapped player. It cannot act.    │
  │  Window = 4 seconds.                    │
  └────────────────┬────────────────────────┘
                   ▼
  ┌─ BURST ─────────────────────────────────┐
  │  All water damage ×5 during the window. │
  │  Window ends → Soak resets to 0,         │
  │  boss enrages briefly (+30% speed, 3s). │
  └─────────────────────────────────────────┘
```

**Why this works:**
- It is the CA kill verb, scaled up. Same fantasy, same animation language.
- Soak decay punishes timid poke-and-run play and forces sustained pressure.
- The 4-second window is too short to place and detonate a full loadout from scratch — so the winning play is **pre-placing balloons near the boss right before saturation**, timing fuses to land inside the window. That is a *setup* skill, which suits a grid game far better than a *reaction* skill.
- Boss abilities that eat or displace your balloons directly attack this setup, giving the boss kit a clean design target.

### 3.3 Damage model
| Source | Damage |
|---|---|
| Water tile touching boss, normal state | 5 (per water source, 0.25s tick cooldown) |
| Water tile touching boss, BURST window | 25 |
| Minion popped inside boss footprint | 40 |

Boss HP ~1000 → roughly 4–6 successful Burst windows per kill. Target fight length **90–150 seconds**.

### 3.4 Phases
Boss transitions at **70% / 40% / 15% HP**. On each transition:
- Boss becomes invulnerable ~2s, arena mutates (see 3.6).
- One new ability unlocks; one early ability upgrades.
- Soak decay rate increases.

### 3.5 Boss ability design rules
Every boss ability must be expressible in **tile space** and telegraphed on the grid for at least `0.7s` (`0.5s` in final phase). No unreadable off-grid hitboxes.

Ability archetypes (mix 4–5 per boss):

| Archetype | Behavior | What it attacks |
|---|---|---|
| **Stomp** | 3×3 shockwave centered on boss, destroys SOFT tiles | Your cover |
| **Sweep** | Floods an entire row or column after telegraph | Lane camping |
| **Spit** | Lobs corrupted balloons that burst in an **X (diagonal)** pattern | Your cross-shaped mental model |
| **Charge** | Barrels down one lane, pulverizing SOFT tiles; stunned 2.5s if it hits HARD | Rewards baiting into geometry |
| **Drain** | Absorbs any of your balloons within 2 tiles before they burst | Directly attacks the Burst setup |
| **Summon** | Spawns 2–3 minions; minions can be bubbled + popped CA-style for item drops | Splits attention |
| **Grip** | Pulls the player 3 tiles toward the boss, ignoring balloons | Punishes safe distance |
| **Tide** | Slow rising flood from one arena edge, converts tiles to HAZARD permanently | Soft enrage / shrinking arena |

### 3.6 Arena as a combatant
The map is not scenery — it is a resource that depletes.
- Phase 1: dense SOFT tile field. Lots of cover, lots of item drops.
- Phase 2: ~half destroyed. Item economy dries up.
- Phase 3: mostly open floor + HAZARD tiles. Nowhere to hide from cross-blasts, including your own.

This produces a natural difficulty ramp with zero stat inflation, and it means the player's own early-game bombing decides how survivable the late fight is. **Blowing up every SOFT tile for items in Phase 1 is a trap the player sets for themselves.** Lean into this.

### 3.7 Enrage
Hard timer at **180s**. Boss permanently gains `Tide`, arena floods one row every 8s. Not a wipe mechanic — a squeeze.

---

## 4. The campaign — rebuilt to match Crazy Arcade (2026-09-10)

The first build followed `core-mechanism.md` faithfully and still did not feel like Crazy Arcade.
Research into the Korean sources ([namu.wiki 몬스터 모드](https://namu.wiki/w/%ED%81%AC%EB%A0%88%EC%9D%B4%EC%A7%80%20%EC%95%84%EC%BC%80%EC%9D%B4%EB%93%9C/%EB%AA%AC%EC%8A%A4%ED%84%B0%20%EB%AA%A8%EB%93%9C),
[Fandom Monster Mode](https://crazyarcade.fandom.com/wiki/Monster_Mode)) found five differences that
mattered more than anything in the original spec. All five are now implemented, and where they
conflict with `core-mechanism.md` **they win** — that was an explicit decision.

### 4.1 The five rules that carry the feel

1. **Touching a monster costs a life outright.** 몬스터에 닿으면 바로 물풍선에 갇힘 여부와
   관계없이 바로 죽는다 — "you die on contact regardless of bubble state". No bubble, no
   struggle bar, no rescue. Water still only *traps* you. That asymmetry is what turns a stage
   into a routing problem instead of a shootout, and it is the single biggest change.
2. **Monsters do not avoid water.** The kill verb is *luring* — placing a bomb and baiting a
   monster into it. An AI that sidestepped puddles deletes the skill.
3. **Stages are hand-authored puzzles, not populated arenas.** Every monster sits on a named tile
   with a named script: patrol one axis and never turn, sit still until the first kill, wake on a
   timer, sit caged behind blocks, revive once. Everything speeds up at 60s.
4. **The boss has plain HP.** You bomb it until it dies; difficulty is its patterns and the room.
   `core-mechanism.md` §3.1 rejected this on the grounds it becomes a DPS race — CA's answer is
   that lethal contact and readable patterns supply the tension instead, and it is right.
5. **걸치기 — "edging".** Standing with your *centre* on a dry tile while your body overlaps the
   boss's edge, so its spray misses and your bombs land. The wiki names it as the technique on
   nearly every map. Both water contact and body contact are judged on the centre tile alone,
   which is precisely what makes the stance legal — see `HITBOX` in config.js.

### 4.2 Three raids, one per water-reaction

CA splits monster mode into Octopus / Penguin / Seal raids, and each has its own monster whose
reaction to water is the raid's lesson. That maps one-to-one onto the roster:

| Raid | Monsters | Reaction | Boss | Its patterns |
|---|---|---|---|---|
| 🐙 Bạch Tuộc Đại Náo | 🎱 patroller, 🧨 rusher | die on the first hit | 대왕문어 Octopus King | spray ring · cannon jet down a lane · **splits into 1 real + 2 fakes** |
| 🐧 Hoàng Đế Trở Về | ⛄ fuzzy | freezes; a player must **touch** it to shatter it, and it thaws | 황제펭귄 Penguin King | spray ring · lays 🥚 that hatch into ⛄ · charge |
| 🦭 Cơn Giận Hải Cẩu | 🐊 croc, 🎱 | shrivels; needs a **second** hit before it recovers | 황제물개 Seal King | rolls flat down a row · 3×3 drops anywhere · **no spray at all** |

The seal having no spray is load-bearing, not flavour: standing beside it is safe, which inverts
what the other two raids teach. A test asserts it never learns one.

All three raids are the same difficulty and none is locked — you pick your boss, like in CA. Same
HP, speed, size, pattern count, monster budget and SS target across all three.

### 4.3 D → SS rank

Graded on kills + total time across all three stages + deaths, which is what makes people replay a
map they have already cleared. The target is on screen the whole way and the best grade per raid is
saved. A single death costs SS by design — a grade you can get while dying is not the grade CA
hands out.

### 4.4 Two players

Solo is the default and answers to both keysets at once (arrows + Space are the natural reach; WASD
and Enter also work). Two players is the opt-in. Friendly fire is on — your water bubbles your
partner, and walking into them frees them.

### 4.5 Board scale

48px tiles (720×624). Everything that moves is written in *tiles per second* and every hitbox as a
fraction of a tile, so `TILE` is a pure scale dial. Pixel literals — in the engine or in the tests —
are the bug that rule exists to prevent.
