# Kẻ Trôi Thời Gian — Game Wiki

Complete reference for every mechanic in `games/chrono-drifter/`. Numbers here are read
out of the code, not remembered: where a constant is named, the file that owns it is
given, and every measured figure was re-run against the code as it stands. In-game terms
stay in Vietnamese, because that is what the screen says.

> **Slug:** `chrono-drifter` · **Title:** KẺ TRÔI THỜI GIAN · **Category:** RPG
> **Shape:** folder game (ES modules — must be served over HTTP, not opened over `file://`)

---

## Table of contents

1. [Premise and the shape of a run](#1-premise-and-the-shape-of-a-run)
2. [The roll — what randomness decides](#2-the-roll--what-randomness-decides)
3. [Eras](#3-eras)
4. [Characters](#4-characters)
5. [Elements](#5-elements)
6. [Teams and battle formats](#6-teams-and-battle-formats)
7. [Difficulty](#7-difficulty)
8. [The turn](#8-the-turn)
9. [Energy (NL)](#9-energy-nl)
10. [Charge and ultimates (nộ)](#10-charge-and-ultimates-nộ)
11. [The move library](#11-the-move-library)
12. [Damage, accuracy and crit](#12-damage-accuracy-and-crit)
13. [Riders and control effects](#13-riders-and-control-effects)
14. [Buffs, debuffs and statuses](#14-buffs-debuffs-and-statuses)
15. [Fatigue — why a battle must end](#15-fatigue--why-a-battle-must-end)
16. [Era events](#16-era-events)
17. [The battlefield](#17-the-battlefield)
18. [Fleeing](#18-fleeing)
19. [Score, shards and the shop](#19-score-shards-and-the-shop)
20. [Saved data](#20-saved-data)
21. [Controls](#21-controls)
22. [Code map and invariants](#22-code-map-and-invariants)
23. [Glossary](#23-glossary)

---

## 1. Premise and the shape of a run

You are thrown out of the timeline. Every press of **CHƠI** drops you into the middle of
someone else's war and hands you whoever is standing next to you. You do not pick the era,
the factions, the format, the difficulty or your own side — the game rolls all of it, and
the coin flip that decides which side you are on happens **last**, so roughly half the time
you are the villains.

A run is a loop:

```
MENU ──▶ THE ROLL ──▶ BATTLE ──▶ RESULT ──▶ ⧗ shards ──▶ SHOP / SẮP TÚI ──▶ MENU
```

Nothing carries between battles except the account: score, record, eras seen, ⧗ shards, the
items you own and the relics you have bought. Fighters, teams and eras are new every time.

---

## 2. The roll — what randomness decides

`engine/generator.js :: generate()` draws in this order, and **each draw constrains the
next**, which is what keeps a battle coherent instead of a costume box:

| # | Draw | Constrained by |
|---|---|---|
| 1 | **Era** — one of 30 | — |
| 2 | **Two rival factions** | must be a declared pair in `era.rivalries` |
| 3 | **Format** — one of 11 | — |
| 4 | **Difficulty** — one of 5 | — |
| 5 | **Both rosters** | the format's size and pool rules, drawn from those two factions |
| 6 | **Difficulty edge** | a spare mook for the opposition (not in `duel` / `boss`) |
| 7 | **Stat scaling** | the opposition's HP/PWR/GRD/WRD × `difficulty.stat` |
| 8 | **Balance pass** | HP padding until the sides are within ±10% |
| 9 | **Your side** | a coin flip — `rng() < .5` |

Everything is driven by one seeded PRNG (`mulberry32`), so a seed reproduces an entire
battle. `generate()` accepts `{ seed, eraKey, formatKey, difficulty }` to pin any of it —
used by the tests and the debug handle, never by normal play.

**The rivalry rule** is what stops knights sharing a side with monsters: teams are drafted
from two factions that the era file explicitly declares as enemies.

---

## 3. Eras

30 eras, each a self-contained file in `js/data/themes/`. An era owns its factions, its
rivalries, its roster, its stage art and **its own Vietnamese name for all nine elements**.

| Key | Name | Key | Name |
|---|---|---|---|
| `fantasy` | GIẢ TƯỞNG | `wuxia` | VÕ LÂM TRUNG NGUYÊN |
| `cyber` | CYBERPUNK | `tamquoc` | TAM QUỐC |
| `space` | VŨ TRỤ SÂU | `daiviet` | TRUYỀN THUYẾT ĐẠI VIỆT |
| `sail` | THỜI ĐẠI BUỒM | `taydu` | TÂY DU |
| `egypt` | AI CẬP THẦN THOẠI | `diaphu` | ĐỊA PHỦ THẬP ĐIỆN |
| `japan` | NHẬT BẢN PHONG KIẾN | `arab` | NGÀN LẺ MỘT ĐÊM |
| `west` | MIỀN TÂY HOANG DÃ | `cthulhu` | MẬT ƯỚC SÂU THẲM |
| `waste` | HẬU TẬN THẾ | `noir` | THÀNH PHỐ MƯA 1935 |
| `norse` | BẮC ÂU | `daidich` | ĐẠI DỊCH ĐEN |
| `steam` | STEAMPUNK | `comong` | CÕI MỘNG |
| `stone` | TIỀN SỬ | `bautroi` | HẢI TẶC MÂY TRỜI |
| `atlantis` | ATLANTIS CHÌM | | |

Seven more were added on a second pass, chosen to fill the widest gaps — the Americas,
Africa, Slavic Europe, a non-mythic historical setting, and two that are not places at all:

| Key | Name | What it is |
|---|---|---|
| `sunempire` | ĐẾ CHẾ MẶT TRỜI | Mesoamerica: jaguar knights, the ball court, the feathered serpent |
| `hellas` | ANH HÙNG CA | Greek myth: the phalanx, the monsters, the gods on the mountain |
| `southpole` | NAM CỰC 1912 | an Antarctic expedition, the ice fauna, and what the drill hit |
| `slavic` | RỪNG BABA YAGA | the hut on chicken legs, the deathless man, the river women |
| `mali` | VÀNG VÀ MUỐI | the Sahel: the golden court, the salt caravan, the savanna spirits |
| `circus` | GÁNH XIẾC ĐÊM | a night circus, its audience, and what is in the cages |
| `manga` | VŨ TRỤ TRUYỆN TRANH | anime and manga: heroes, villain organisations, mecha |

Every era carries, and a test enforces:

- **3 factions**, each with a declared rivalry list
- **21 named characters** (≥5 per faction, ≥1 legend per faction)
- **exactly 4 moves** on every character
- **a mook pool** (≥2 entries) and **one boss**
- **a bio** for every unit
- **its own name for all nine elements**

**Totals:** 632 named characters + 60 mook entries + 30 bosses = **722 fighters**, carrying
**2 888 move instances** and **210 ultimates**.

---

## 4. Characters

A character is data, not code (`data/mk.js`):

```js
u(name, emoji, faction, tier, element, size, hp, pwr, grd, wrd, spd, moves, ultimate)
```

| Field | Meaning |
|---|---|
| `n` / `e` | name and emoji — the emoji **is** the art; there are no images anywhere |
| `faction` | which of the era's three factions; decides who they can stand beside |
| `tier` | `grunt` · `elite` · `legend` · `boss` |
| `el` | elemental affinity — what they are **hit** as, not what they hit with |
| `sz` | body size multiplier, ~0.8–2.0; drives the sprite's pixel size on the field |
| `hp pwr grd wrd spd` | the stat line |
| `hp0` / `ep0` | optional: a format may put a fighter on the field already spent — see KẺ SỐNG SÓT |
| `mv` | exactly four moves |
| `ult` | an ultimate, on legends and bosses only |

### Tiers

| Tier | Count | Rules |
|---|---|---|
| **legend** | 180 | Has an ultimate. **Never appears twice on one team** and never twice in one battle. |
| **elite** | 180 | No ultimate, stronger line than a grunt. |
| **grunt** | 332 | Includes the nameless mook pool. |
| **boss** | 30 | One per era. Enormous. Owns its front rank alone. Has an ultimate. |

Repeats among the nameless get Roman numerals (`Chuột Hang`, `Chuột Hang Ⅱ`, `Chuột Hang Ⅲ`)
so the combat log stays readable. Legends never reach that code path.

### Stats

| Stat | Vietnamese | What it does |
|---|---|---|
| `hp` | MÁU | health; `max` is the starting value |
| `pwr` | Sức mạnh | multiplies every damage roll |
| `grd` | Giáp vật lý | defends against **STEEL** damage only |
| `wrd` | Kháng nguyên tố | defends against **every other element** |
| `spd` | Tốc độ | fills the turn gauge; also nudges accuracy on both sides |
| `acc` | Chính xác | percentage **points** on the 92% base hit chance |
| `crt` | Chí mạng | percentage **points** on the 8% base crit chance |

`pwr grd wrd spd` are **multiplier** stats — a buff of `+30` means ×1.30.
`acc crt` are **point** stats — `+30` means +30 percentage points. The UI writes `%` for the
first group and `đ` for the second, everywhere, so the two are never confused.

---

## 5. Elements

One wheel for all 30 eras. Only the **names** reskin: a move stores an element code and its
display label is built at render time from the era's `elNames` map, so the same STRIKE reads
*"Lửa Rồng"* in Giả Tưởng and *"Xung EMP"* in Cyberpunk. One table to balance, one to test,
30 vocabularies on top.

```
⚡ STORM → 🌊 TIDE → 🔥 EMBER → 🌿 VERDANT → ⚙️ FORGE → ❄️ FROST → ⚡ STORM
                     ✨ RADIANT ⇄ 🌑 UMBRA
                        ⚔️ STEEL (neutral)
```

| Relationship | Multiplier |
|---|---|
| Each ring element **into the next** | **×1.6** |
| The same swing **backwards** | **×0.7** |
| RADIANT ⇄ UMBRA, both directions | **×1.6** |
| Anything involving STEEL | ×1.0 |
| Everything else | ×1.0 |

The multiplier compares the **move's** element against the **target's** affinity
(`mult(move.el, target.el)`), so a FROST character is free to swing an EMBER move.

`weakTo(el)`, `strongAgainst(el)` and `resists(el)` power the dossier's counter panel, and
the 🔦 relic shows an enemy's element and its counters right on the health bar.

---

## 6. Teams and battle formats

Eleven shapes, drawn per battle (`engine/formats.js`), on two different axes.

**The five size formats** vary one thing: how many bodies each side has.

| Key | Name | Blurb | Side A | Side B | `par` | Worth |
|---|---|---|---|---|---|---|
| `duel` | TAY ĐÔI | one against one | 1 named | 1 named | 10 | ×1.4 |
| `even` | CHẠM TRÁN | an even match | 3–4 mixed | 3–4 mixed | 14 | ×2.0 |
| `horde` | TỬ THỦ | a few against the many | 3–4 named | 6–8 mooks | 18 | ×2.6 |
| `boss` | SĂN QUÁI | a party against the giant | 3–4 named | boss + 0–2 minions | 16 | ×2.8 |
| `war` | ĐẠI CHIẾN | full ranks on both sides | 6–8 mixed | 6–8 mixed | 24 | ×3.2 |

**The six draft formats** vary *who* gets drafted and what state they arrive in — a
second axis over the same engine, with no new win conditions and no new verbs.

| Key | Name | What is different | Sizes | `par` | Worth |
|---|---|---|---|---|---|
| `civil` | NỘI CHIẾN | both sides drafted from the **same faction**, nobody twice | 3v3 | 14 | ×2.0 |
| `brawl` | LOẠN ĐẢ | **grunts and mooks only**, with replacement — duplicates are the point | 6–8 each | 26 | ×3.0 |
| `counter` | TƯƠNG KHẮC | one side **mono-element**, the other **the element it beats**, answering with numbers | 2–3 v 3–5 | 15 | ×2.4 |
| `survivor` | KẺ SỐNG SÓT | everyone starts at **55–85% HP and 30–60% energy** | 3–4 each | 13 | ×1.8 |
| `rookie` | TÂN BINH | **no legends**, so nobody has an ultimate | 4v4 | 16 | ×2.2 |
| `titan` | SONG QUÁI | this era's **boss against another era's boss**, one or two minions each | 2–3 each | 18 | ×3.4 |

Two of them redefine what a *side* is, and say so in the side names: TƯƠNG KHẮC
labels the sides by element (*Phe Hoả Diệm Sơn* vs *Phe Đào Vườn Trời*), SONG QUÁI by
era (*AI CẬP THẦN THOẠI* vs *TÂY DU*), and NỘI CHIẾN splits one faction into
*Phe Ly Khai* and *Phe Trung Thành*. Everywhere else the rivalry rule holds.

**TƯƠNG KHẮC is lopsided on purpose.** Being on the right side of the wheel is worth
about **×2.3** on the exchange (×1.6 out, ×0.7 back), so the parity pass counts that
edge as strength — the countered side is *supposed* to have the bigger stat line and
the extra bodies. Raw parity is the wrong measure there; the test asserts the outcome
instead, and side A wins 49% of 120 simulated battles.

- **`named` pool** — drawn from the faction roster *without replacement*, so no duplicates.
- **`mixed` pool** — named units first, mooks filling the rest of the requested size.
- **`mook` pool** — nameless only, duplicates allowed and expected.
- **`boss` pool** — the era's boss plus 0–2 mooks.

`par` is the format's expected length in turns; it feeds both the score bonus and the
fatigue soft cap. **Worth** multiplies score and shard payout.

**You may be on either side of any of these.** The 3-vs-8 can be the three, or the eight.
The boss hunt can be the party — or the boss.

### Parity

Hand-balancing 5 formats × 23 eras is not authorable, so parity is computed
(`generator.js :: balance()`):

```
strength(team) = Σ  pwr × √hp
```

If one side's strength exceeds the other's by more than **10%**, the weaker side's HP is
padded by the ratio, capped at **×2.4**. Balancing happens **after** the difficulty edge and
stat scaling, so both count toward it.

---

## 7. Difficulty

| Stars | Name | Enemy stats | AI tier | Handicap | Reward |
|---|---|---|---|---|---|
| ★☆☆☆☆ | RẤT DỄ | ×0.75 | 0 — flails | — | ×0.6 |
| ★★☆☆☆ | DỄ | ×0.90 | 1 — greedy damage | — | ×0.8 |
| ★★★☆☆ | THƯỜNG | ×1.00 | 2 — greedy + heals + element aware | — | ×1.0 |
| ★★★★☆ | KHÓ | ×1.15 | 3 — 1-ply lookahead, focus fire, holds ultimates | +1 mook | ×1.5 |
| ★★★★★ | RẤT KHÓ | ×1.30 | 4 — threat scoring, executes, values energy | +2 mooks | ×2.2 |

The handicap (`edge`) hands the opposition spare mooks, capped at 8 per side, and never in
`duel` or `boss`.

### What each AI tier actually does (`engine/ai.js`)

- **Every tier:** if energy is under 22, there is a 60% chance it simply waits — Chờ is free
  and refunds energy.
- **Tier 0:** picks any legal move at random.
- **Tier 1+:** fires a charged ultimate almost always, skipping the ones that would be wasted
  (a revive with nobody down, a team heal at full health, a sacrifice below 45% HP).
- **Tier 2+:** heals an ally under 45% HP (70% of the time; 90% at tier 3+).
- **Tier 1+:** scores every damaging move against every reachable target, with a **×1.7**
  bonus for a killing blow.
- **Tier 3+:** weights the dangerous target, avoids re-applying a burn or a mark, and divides
  the score by `1 + cost/90` so energy is spent, not squandered.
- **Tier 4:** ×1.4 for an execute move on a target under 40% HP.
- **All tiers:** a lock aimed at someone already locked or still immune scores ×0.25, and a
  stat modifier already at full strength on everything it would touch is skipped entirely.
- **Setup chance:** 16% (tier 3+), 20% (tier 2), 30% (tier 0–1) to play a buff/debuff instead
  of swinging.

---

## 8. The turn

There are no rounds. Everyone accrues **SPD per tick** and acts when the gauge reaches
**1000** (`TICK_GOAL`), so haste and slow visibly reorder the DÒNG LƯỢT strip rather than
changing an invisible number. Ties break on effective SPD.

### The order of operations at the top of a turn (`openTurn`)

1. **Energy regen** — `+10`, scaled by an active era effect.
2. **Borrowed time** — a `temp` unit (a revived fighter, a drifter from another era) loses a
   turn from its counter; at zero it dies again on the spot.
3. **Buff/debuff timers** tick down; anything at zero drops.
4. **Taunt, mark and CC-immunity** timers tick.
5. **Silence** ticks; when it expires the unit gains **3 turns of CC immunity**.
6. **Damage over time** ticks — it ignores armour and can kill.
7. **Stun** — if stunned, the turn is spent; expiry grants the same 3-turn immunity.

Then the unit acts. A player unit shows its deck; an AI unit is scored and resolved.

### Chờ (WAIT) — the fifth option, and a real one

| | |
|---|---|
| Charge | **+25 nộ** |
| Energy | **+30 NL** on top of the regen |
| Defence | **+20% GRD and WRD for 2 turns** |
| Cost | always **0** |

Stalling one turn so a legend reaches its ultimate, or to refill the pool, is a line of play.
Chờ is free by design: a fully drained unit always has a legal move.

---

## 9. Energy (NL)

Every skill draws on one pool, so a turn is a question of what you can still afford next
turn rather than a free pick from four buttons.

| Constant | Value |
|---|---|
| `EP_MAX` | **80** |
| `EP_REGEN` | **10** at the top of your own turn |
| `EP_WAIT` | **+30** more for Chờ |

```
cost = max(4, BASE_COST[archetype] + round((pow − 1) × 8))
```

**Ultimates cost nothing** — the charge meter already gates those. A move you cannot afford
is locked and says how short you are.

Tuned by sweeping regen and pool size over 400-battle runs: at 10/80 the AI is energy
constrained on ~7% of turns and fully starved on 0.8%, while a human clicking the strongest
option first hit the wall on 13 of 28 turns in a played-through battle.

---

## 10. Charge and ultimates (nộ)

| Source | Charge |
|---|---|
| Acting at all | **+12** |
| Being hit | **+8** |
| Chờ | **+25** |
| 🪤 Kẹp giấy / STEAL moves | steals from the target |
| ☕ Cà phê lạnh | **+50** |
| TIẾNG GỌI NỘ KHÍ (era event) | **+40** to everyone |

At **100** (`ULT_FULL`) the ultimate unlocks; casting it resets the meter to 0. **Silence
never locks an ultimate** — that one is earned.

### The thirteen ultimate shapes

"Damage everyone" is not a signature, so an ultimate is drawn from the legend's own kit.

| Shape | id | What it does | In use |
|---|---|---|---|
| `U` | ANNIHILATE | heavy damage to the whole enemy side | 4 |
| `UEXEC` | PURGE | area damage with the execute bonus | 19 |
| `UMEND` | FULLMEND | heals the whole team and cleanses | 13 |
| `UTIME` | TIMESTOP | the caster acts **2 extra turns** | 12 |
| `UNUKE` | SUNDERBLOW | one target, enormous, straight through armour | 12 |
| `UCHAIN` | CHAIN | three hops, each **+35%** harder than the last | 9 |
| `UDRAIN` | DEVOUR | area damage, **60%** of it healed back | 20 |
| `UCURSE` | CURSE | no damage — **−30% to every stat** of the enemy side, plus a burn | 18 |
| `UGUARD` | AEGIS | team shield plus regeneration | 25 |
| `URAISE` | RAISE | **every** fallen ally stands back up | 4 |
| `USTUN` | SHATTER | moderate area damage, and nobody moves afterwards | 9 |
| `URAGE` | RAGE | the caster gets **+80% PWR, +40% SPD, +30đ crit for 5 turns** | 14 |
| `USACRIFY` | SACRIFICE | pay **35%** of your own max HP for one impossible, crit-prone hit | 2 |

No shape exceeds ~18% of all ultimates and every era fields at least three; both are
asserted by tests.

---

## 11. The move library

A character's move is an **instance of an archetype**, not bespoke logic —
`S('Cào Than','EMBER',1.2)`. "Cầu Lửa" and "Thương Plasma" are the same archetype wearing
different labels, which is why the era files are names and numbers.

### Damage

| Ctor | id | Base cost | Effect | Uses |
|---|---|---|---|---|
| `S` | STRIKE | 11 | one target | 535 |
| `AOE` | CLEAVE | 29 | the whole enemy side | 88 |
| `ARC` | ARC | 21 | 2 random targets | 76 |
| `PIERCE` | PIERCE | 16 | halves the target's defence | 27 |
| `SNIPE` | SNIPE | 19 | **+22 crit points** | 34 |
| `DRAIN` | DRAIN | 16 | heals the caster for **50%** of what it deals | 66 |
| `EXEC` | EXECUTE | 18 | **×1.8** against a target under 35% HP | 50 |
| `RAMP` | RAMP | 13 | **+25%** compounding while you keep using it — any other move resets it | 15 |
| `FIXED` | FIXED | 14 | flat damage; ignores PWR and defence | 0 |
| `DOT` | DOT | 18 | burn for N per turn, 3 turns | 84 |
| `MARK` | MARK | 11 | the target takes **+25%** from everything | 77 |
| `STUN` | STUN | 24 | the target loses its next turn | 45 |
| `SILENCE` | SILENCE | 24 | the target may not use skills — ultimates still work | 38 |

### Support

| Ctor | id | Base cost | Effect | Uses |
|---|---|---|---|---|
| `H` | HEAL | 22 | heal one ally | 66 |
| `HALL` | MENDALL | 32 | heal the whole team | 30 |
| `REGEN` | REGEN | 20 | heal-over-time on one ally | 37 |
| `CLEANSE` | CLEANSE | 18 | heal and strip every debuff, burn and mark | 26 |

> **There is no REVIVE archetype.** A fighter comes back through an **ultimate** (`URAISE`)
> or a **bought item** (🧊 Túi chườm đá) — never a skill you can spend again next turn. As an
> ordinary move it raised the same fighter up to nine times in one battle and stretched
> those battles from 56 turns to 70.

### Buff / debuff

| Ctor | id | Base cost | Effect | Uses |
|---|---|---|---|---|
| `B` | BUFF | 13 | +N to one of the caster's own stats | 390 |
| `R` | RALLY | 23 | +N to that stat for the whole team | 80 |
| `BARRIER` | BARRIER | 21 | a shield on the caster | 17 |
| `TAUNT` | TAUNT | 18 | a shield plus **2 turns** of soaking every single-target attack | 82 |
| `CHARGEUP` | CHARGE | 16 | the caster's next attack does **double** damage | 0 |
| `X` | HEX | 13 | −N to one enemy stat | 303 |
| `XALL` | HEXALL | 27 | −N to that stat across the enemy side | 20 |
| `STEAL` | STEAL | 10 | steal N charge from an enemy | 22 |

`X`/`XALL` take a **magnitude**; `resolve()` owns the sign. (Written with a minus in the data
it negated twice and buffed the enemy — 48 moves across 11 eras did exactly that.)

**Taunt** pulls every single-target attack *and* debuff on that side onto the taunter. Area
attacks ignore it, and so does 🧨 Pháo.

---

## 12. Damage, accuracy and crit

### Does it hit?

```
hit% = 92 + accBuffs + (SPD_attacker − SPD_target) / 8 + move.accBonus     clamped 45 … 99
```

Both numbers are printed on the move button, because odds you cannot see are not a decision.
Measured over 500 simulated battles (29 835 swings): **8.8% miss, 9.1% crit**.

### Does it crit?

```
crit% = 8 + critBuffs + (SNIPE-style move ? 22 : 0)                        clamped 0 … 75
```

A crit multiplies the final damage by **1.5**.

### How hard?

```
raw   = PWR × move.pow × rand(0.92 … 1.08) × (1 + ramp)
def   = (move element is STEEL) ? GRD : WRD          ← halved by PIERCE
n     = raw × 100/(100 + def) × elementMultiplier × (crit ? 1.5 : 1)
n    ×= 1.8   if EXECUTE and the target is under 35% HP
n    ×= 1.25  if the target is marked
n    ×= 2     if the caster is charged up
n    ×= 1 + fatigue
n     = max(1, round(n))
```

Then shields eat what they can before HP is touched, and the target gains **+8 charge** for
being hit.

`FIXED` damage skips this entirely — a flat number, no PWR, no defence, no element.

---

## 13. Riders and control effects

The blow landing and its **rider** landing are two different questions.

| Rider | Chance | Effect |
|---|---|---|
| `dot` — bỏng | **85%** | N damage per turn for 3 turns; armour does not stop it |
| `mark` — đánh dấu | **85%** | +25% damage taken |
| `stun` — choáng | **55%** | loses the next turn |
| `silence` — câm lặng | **50%** | no skills, only Chờ; **ultimates still fire** |

Three rules keep control from being a lock (`applyRiders`):

1. **A control effect cannot be refreshed on top of itself.** Re-applying while it is running
   is refused outright — otherwise it never expires and the immunity that follows never
   starts.
2. **Expiry grants 3 turns of immunity** (`CC_IMMUNE_TURNS`) to **both** stun and silence.
3. **Silence never touches a charged ultimate.**

Measured under infinite spam against a lone target: **18.8%** of turns lost to silence and
**22.9%** to stun — down from ~100% before the rules existed.

---

## 14. Buffs, debuffs and statuses

### One buff and one debuff per stat

Stat modifiers used to multiply: three slows put a target at `0.72³ = 37%` speed, and a boss —
alone, and the only thing four enemies can aim at — could be held there permanently.

Every stat change routes through `applyStat()`:

- the same stat in the same direction shares **one entry**;
- the **strongest magnitude** applies;
- re-applying **refreshes the timer** instead of deepening the hold;
- **opposite directions coexist** and cancel multiplicatively, so a haste answers a slow;
- **permanent relic buffs** (`perm: true`) sit outside the rule entirely.

Durations: stat modifiers **4 turns** (`BUFF_TURNS`), burns **3 turns** (`DOT_TURNS`), the Chờ
guard **2 turns**, taunt **2 turns**, CC immunity **3 turns**.

### The status chips

Each chip appears under the sprite's name plate and, with a label and a hover explanation,
in the dossier.

| Icon | Status | Meaning |
|---|---|---|
| 🛡️ | Khiên | absorbs damage before HP; breaks when spent |
| 🚩 | Khiêu khích | pulls every single-target attack on that side |
| 🎯 | Bị đánh dấu | +25% damage taken |
| 💫 | Choáng | loses the next turn |
| 🔇 | Câm lặng | skills locked, ultimate free |
| ☠️ | Bỏng | loses HP each turn, armour ignored |
| 💚 | Hồi phục | heals at the end of each of its turns |
| 💢 | Dồn lực | the next attack is doubled |
| ⏩ | Thêm lượt | will act again straight away |
| 📈 | Tăng dần | a RAMP is compounding — switching moves loses it |
| 🧿 | Kháng khống chế | just shook off a lock; immune to both for now |

And one face per stat, with the direction as a corner badge — 💪 pwr, 🧱 grd, 🔮 wrd,
👟 spd, 👁️ acc, 💥 crt, each carrying a green ▲ or a red ▼.

---

## 15. Fatigue — why a battle must end

Two sustain builds could out-heal each other forever; seed 484 once ran past 4 000 turns
with nothing in the rules able to stop it.

```
softCap  = format.par × (number of fighters on the field)
fatigue  = clamp((turns − softCap) / softCap, 0 … 3)

damage  ×= 1 + fatigue
healing ×= max(0.08, 1 − fatigue × 0.55)
```

The game says so out loud the first time it bites: **"THỜI GIAN ĐANG SỤP"** — *the era is
starting to push you out: every blow lands harder, every mend does less.*

Certain era effects set `noHeal`, which zeroes healing outright for their duration.

---

## 16. Era events

A long fight settles into a rhythm, so the era interrupts it. The period is rolled **once per
battle at 30–50 turns**; events fire on that clock (`turns ≥ nextEventAt`), never in the
first **6** turns, and **no event repeats inside one battle**.

Events are blind to sides — the sky does not care whose army it lands on — and **an event may
end a battle**. That is deliberate; *KẺ CUỐI CÙNG* is the counterweight.

Each firing shows a three-tier cut-in — a lead-in line, the name, the effect — and drops a
line in the log with its flavour text. Six generic lead-ins rotate without ever repeating
back to back:

> *Một sự kiện diễn ra như định mệnh cho cuộc chiến:* · *Dòng thời gian rẽ nhánh, và trận
> đánh không còn như cũ:* · *Thời đại chen vào giữa hai lằn đao:* · *Có thứ vượt khỏi tầm tay
> của cả hai phe:* · *Vết nứt thời gian hé mở, và điều này tràn qua:* · *Định mệnh không hỏi
> ai đang thắng:*

### The eighteen

| Kind | Name | Effect |
|---|---|---|
| **Cataclysm** | THIÊN THẠCH | one random target takes a heavy hit; the **3 physically nearest** take half |
| | NỨT ĐẤT | the front rank of both sides is hit and thrown to the back of the queue |
| | BÃO NGUYÊN TỐ | one element floods the field: everything weak to it bleeds, everything strong against it gains charge |
| | NHẬT THỰC | RADIANT −30% PWR, UMBRA +30% PWR, 4 turns |
| **Mercy** | ĐƯỜNG CÙNG | everyone under 50% HP gets +40% PWR for 3 turns |
| | HỒI QUANG | one of the fallen returns at 40% HP — for exactly 5 of its own turns |
| | KẺ CUỐI CÙNG | a side down to one fighter gets +50% PWR, +25đ crit and a shield |
| | CƠN GIÓ THỨ HAI | everyone heals 20% and sheds one debuff |
| **Tempo** | TRƯỜNG NĂNG LƯỢNG | full energy for all; doubled regen for a while |
| | CHÂN KHÔNG | half energy for all; halved regen |
| | TIẾNG GỌI NỘ KHÍ | +40 charge to everyone — every ultimate ripens at once |
| | MẠCH THỜI GIAN ĐỨT | the turn queue is shuffled from scratch |
| **Rule** | SƯƠNG MÙ DÀY | both sides −25đ accuracy, 4 turns |
| | ĐẤT CẰN | healing does nothing at all, for a while |
| | LƯỠI DAO CẠO | both sides +30đ crit, 3 turns |
| | VẾT NỨT | one fighter immediately gets 2 extra turns |
| **Outsider** | KẺ LẠC THỜI | a mook **from a different era** joins the outnumbered side for 5 turns |
| | TÚI RÁCH | an item falls out of your satchel and uses itself on your weakest fighter |

Conditional events (HỒI QUANG, KẺ CUỐI CÙNG, ĐƯỜNG CÙNG, KẺ LẠC THỜI, TÚI RÁCH) only enter
the pool when the board can satisfy them.

Measured over 500 battles: **1.26 events per battle**, and 17 of the 18 fired. The missing
one is TÚI RÁCH, which needs a satchel — an AI-versus-AI simulation carries no items.
Median battle length across the same 500: **59 turns**.

---

## 17. The battlefield

The stage is nine painted layers (sky, glow, ground, horizon, fog, vignette, scrim, flash,
banner) plus the fighters. Everything is emoji and CSS — no images, no audio files, no
network requests.

### Four stagings

Picked per battle from the seed and the format, so the field is not the same mirrored rows
every time:

| Key | Name | Shape |
|---|---|---|
| `ranks` | Hàng ngũ | both sides in matching ranks |
| `duel` | Đối mặt | you low and close, them high and far — the classic; also SONG QUÁI |
| `arc` | Vây bọc | the mob curls around whoever it outnumbers; also TƯƠNG KHẮC |
| `terrace` | Chiếm cao điểm | one side holds the ridge and looks down |

### Sizing and occlusion

A sprite's pixel size is `56 × rank scale × character size`, so a dragon towers over a rat
and a boss owns its front rank alone. Ranks are spaced by the **tallest sprite in the rank in
front**, and a footprint-packing pass separates overlaps across the whole field — because a
small fighter hidden behind a big one is a fighter you cannot click.

Verified with `elementFromPoint` over every sprite centre across every composition and team
size: **0 of 2130 covered**.

---

## 18. Fleeing

You may withdraw from any battle. The button arms on the first click and only runs on the
second.

| | |
|---|---|
| Grace window | **20 turns** (`FLEE_GRACE_TURNS`) |
| Toll inside it | `max(5, round(winShards × 0.5))` |
| After it | free — but the battle pays nothing |

The toll derives from `winShards()` rather than its own constant, so it can never exceed what
a win there would have paid. (Priced independently it did, in all 25 difficulty × format
combinations.)

The window is twenty rather than a handful because a battle is only readable once both sides
have shown their hand.

---

## 19. Score, shards and the shop

### Winning

```
score  = round(100 × difficulty.reward × format.worth)
       + 150   if nobody on your side died
       + 100   if the battle ended within format.par turns

shards = round((12 + 14 × format.worth) × difficulty.reward)
```

Losing pays **25%** of the win's shards — the consolation of a witness. Fleeing early costs
shards instead.

At the extremes: a very easy TAY ĐÔI pays **19 ⧗** and scores **84**; a very hard SONG QUÁI
pays **131 ⧗** and scores **748** before the two bonuses.

### The satchel

**5 slots** (`SATCHEL_MAX`). Consumables are loaded in SẮP TÚI **before** a battle; what is
not packed stays home.

Using an item **costs no turn** — you use it and still take your move — but **one item per
turn**. Nor does it move the battle clock, so it cannot age the flee window, the era-event
schedule or the fatigue cap. A granted extra turn (🔋 Sạc dự phòng, TIMESTOP) resets the
allowance.

### Consumables (16)

| Price | Item | Effect |
|---|---|---|
| 190 | 🥫 Mì gói | heals the whole team 15% |
| 210 | 🪤 Kẹp giấy | steals 30 charge from one enemy |
| 220 | 🥤 Nước tăng lực | heals one ally 35% |
| 240 | 🧯 Bình chữa cháy | clears every burn, team +30% WRD for 3 turns |
| 260 | 🩹 Băng keo | strips all debuffs from one ally and heals 15% |
| 260 | 🧪 Gel năng lượng | +30% PWR on one ally for 4 turns |
| 280 | 🧊 Túi chườm đá | revives a fallen ally at 30% HP |
| 300 | ☕ Cà phê lạnh | +50 charge to one ally |
| 320 | 🪝 Dây rút nhựa | stuns one enemy for a turn |
| 330 | 🧨 Pháo | 120 fixed damage to every enemy — ignores armour **and** taunt |
| 350 | 🕶️ Kính râm | team +25% GRD and WRD for 3 turns |
| 400 | 🎈 Bong bóng | throws one enemy to the back of the queue |
| 480 | ✏️ Bút chì | rerolls a fighter's stats ±20%, keeping the better result |
| 540 | 🔋 Sạc dự phòng | one ally acts an extra turn |
| 700 | 📱 Điện thoại | see the enemy's next moves for 3 turns |
| 900 | ⏱️ Đồng hồ bấm giờ | freezes the queue — your whole side acts before any enemy |

### Relics (10) — bought once, permanent, always on

| Price | Relic | Effect |
|---|---|---|
| 1200 | 🎒 Ba lô hai ngăn | every consumable purchase gives double |
| 1400 | ⌚ Đồng hồ đeo tay | wins every speed tie, +5% SPD for the team |
| 1500 | 🔦 Đèn pin | shows enemy elements and counters on the health bar |
| 1600 | 🧭 GPS | exact damage preview before you confirm |
| 1700 | 🧤 Găng tay bảo hộ | +8% PWR for the team, permanently |
| 1800 | 💳 Thẻ tín dụng | 20% off every shop price |
| 1900 | 🪖 Mũ bảo hiểm | team starts every battle +10% GRD and WRD |
| 2400 | 🖊️ Bút lông dầu | team starts every battle with 25 charge |
| 2600 | 📸 Máy ảnh | replay the code of a battle you have won |
| 5000 | ⌛ Đồng hồ cát | once per battle, undo the last turn |

Prices run **190–5000 ⧗** against **19–131 ⧗** a win, so the shop is a long game.

---

## 20. Saved data

`localStorage`, under `chronoDrifter.save` and `chronoDrifter.muted` (`js/state.js`):

| Field | Meaning |
|---|---|
| `score` | lifetime total |
| `best` | best single battle |
| `wins` / `losses` / `fled` | record |
| `shards` | ⧗ on hand — clamped at 0, never negative |
| `seen` | era keys you have fought in — the menu's THỜI ĐẠI ĐÃ QUA |
| `stock` | how many of each consumable you own |
| `satchel` | which 5 are packed |
| `relics` | which relics you own |
| `muted` | sound flag |

The hub (`index.html`) keeps its own `gamehub:favorites` and `gamehub:lastPlayed`.

---

## 21. Controls

| Key | Action |
|---|---|
| `1`–`5` | use that skill |
| `0` | Chờ |
| `Q W E R T` | use satchel slot 1–5 |
| `Esc` | cancel targeting · close the dossier · close the tutorial |
| `M` | mute |
| click a fighter | open their dossier — allies left, enemies right |
| click ✕ HUỶ CHỌN | cancel targeting |

---

## 22. Code map and invariants

```
games/chrono-drifter/
├── index.html          the shell: menu · roll · battle · shop · satchel
├── style.css
└── js/
    ├── main.js         the router, the deck, the turn loop, results
    ├── state.js        save data, purchases, the satchel
    ├── audio.js        Web Audio synth — no audio files
    ├── engine/         DOM-FREE
    │   ├── rng.js          mulberry32, pick, sample
    │   ├── elements.js     the wheel
    │   ├── moves.js        the archetype library, energy, riders
    │   ├── combat.js       the tick queue, resolve(), damage, fatigue
    │   ├── ai.js           the opposition, tiered
    │   ├── formats.js      the 5 formats, difficulties, the economy
    │   ├── generator.js    the roll and the parity pass
    │   ├── events.js       the 18 era events
    │   └── items.js        consumables
    ├── data/           DOM-FREE
    │   ├── themes.js       the era index
    │   ├── themes/*.js     23 eras
    │   ├── mk.js           the unit constructors
    │   ├── shop.js         26 anachronisms
    │   └── effects.js      the status registry and the stat icons
    └── ui/
        ├── battle-view.js  mount, layout, the event player, the log
        ├── stage.js        scenery, compositions, footprint packing
        └── inspect.js      the dossier
```

Three invariants hold the design together:

1. **`engine/` and `data/` never touch `document`, `window` or `localStorage`.** A test greps
   both directories and fails if any appears. That is what lets the tests import them
   directly and lets the AI search over the same code the renderer draws.
2. **`resolve()` returns ordered events, not a finished board.** The renderer replays them as
   staggered animation; the AI scores them on a clone.
3. **One seeded PRNG.** A seed reproduces an entire battle, which is what makes the balance
   measurements in this document repeatable.

Tests: `node --test 'tests/*.test.mjs'` (the glob is required). 343 tests at the time of
writing, of which 73 belong to this game.

---

## 23. Glossary

| Vietnamese | English |
|---|---|
| MÁU | HP |
| NL (năng lượng) | energy |
| nộ | charge — the ultimate meter |
| Chờ | wait |
| chiêu thức | skill |
| tuyệt kỹ | ultimate |
| chí mạng | critical hit |
| chính xác | accuracy |
| trượt | miss |
| khiên | shield |
| khiêu khích | taunt |
| choáng | stun |
| câm lặng | silence |
| bỏng | burn / damage over time |
| đánh dấu | mark |
| hồi sinh | revive |
| dòng lượt | the turn queue |
| thời đại | era |
| dạng trận | battle format |
| độ khó | difficulty |
| phe | side |
| mảnh thời gian (⧗) | shard — the currency |
| túi đồ | satchel |
| cửa hàng | shop |
| bỏ chạy | flee |
| hồ sơ | dossier |
| nhật ký trận | battle log |
