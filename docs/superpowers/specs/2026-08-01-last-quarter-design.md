# Last Quarter — Design

**Date:** 2026-08-01
**Files:** `games/last-quarter/` (folder game — `index.html`, `style.css`, `js/*.js`)
**Genre:** 2D platformer wrapped in a deception-management layer
**Source brief:** `idea.md` in the repo root

## 1. Goal

You are the character **inside** an arcade cabinet. Someone else is at the controls and they
are not very good. The cabinet gets unplugged if either:

- you obey them faithfully — the character dies over and over, and three deaths end the
  credit; or
- you override them too often — the picture stops matching the joystick, they decide the
  machine is broken, and the attendant is called.

Those are the only two ways out. There is no timer and no third failure.

The platformer is the surface. The game is reading the incoming input stream and deciding
**when** it is worth disobeying.

UI language: **English**, consistent with the other arcade/action games in the repo.

## 2. Scope

### In scope (v1)

- Three levels, each with its own theme and its own (worse) player at the cabinet.
- 3 hearts per level; checkpoints; a rematch/next-stage flow with star ratings.
- A single hidden PATIENCE meter, revealed only on the between-level report card.
- Web Audio synth, start screen, rules modal, pause, mute, touch controls.
- Hub integration: entry in `index.html`, line in `README.md`.

### Out of scope (v1)

- Level editor, more than three levels, leaderboards, online anything.
- Only mute (`lastQuarter.muted`) and level unlocks (`lastQuarter.progress`) persist.

## 3. The meter

One number drives everything. **It is never drawn as a bar during play.**

| | Start | Up | Down | Ends at |
|---|---|---|---|---|
| **PATIENCE** | 60 | **matched presses, and nothing else** | **missed presses, and nothing else** | 0 → *the attendant is called* |
| **hearts** | 3 | — | one per death | 0 → *game over* |

### Two ways to lose, one for each resource

```
patience → 0    they decide the cabinet is broken and fetch the attendant
hearts   → 0    the character is dead three times over
```

Obeying kills you on **hearts**; defying kills you on **patience**. That is the whole squeeze,
and it needs exactly two numbers to express.

It used to be three. FUN and SUS were separate meters, then merged, and boredom survived the
merge as a timer bleeding the one that was left — a third pressure with its own ending
(*they walked away*). It is gone. Nothing in the game now runs out while you are playing well,
and there is no clock to race.

What that cost, honestly: showmanship stopped paying. Coins, distance, near misses and speed
are score and spectacle now — they cost nothing and buy nothing. `world.lively`, `p.idleT`,
`sinceThrill` and the `boredScale` per-level dial all existed to serve boredom and were
deleted with it rather than left describing a pressure the game no longer applies.

### Patience moves on presses and nothing else

`hitGain` (+2) on a press of yours that matched theirs, in time, on the right key.
`missGhost` (−7) for acting unbidden, `missIgnored` (−5) for letting their press lapse, both
× attention × the cabinet's scale.

The ratio is the design. Break-even is roughly `missCost / (hitGain + missCost)` — about
**four presses answered out of every five**. Below that the meter sinks; above it, it climbs
back to full and sits there, which is what makes a clean patch genuinely buy room for the
next lie.

The earlier numbers (+3 / −4 / −3) were set when boredom was still draining underneath them.
With the drain gone they were far too generous: ignoring the person outright won 10/16 on 1-1
because the meter refilled faster than misses could take it.

### Divergence is one mechanism

Nothing is held on any cabinet — every input is a press — so there is no sustained state to
compare and no continuous-mismatch model. All three channels (◀ ▶ ⤒) are judged the same
way, by hit window.

Their press opens an accept window (`jumpAcceptLate` 0.30 s); you may also act up to
`jumpAcceptEarly` 0.26 s *before* they press, because anticipating them is still obedience.
Either side may move first, so neither press is judged when it happens — a claim stays pending
until the other side's window lapses.

**Two scales, because the two ways of being out of step are not equally visible**, and how
visible they are depends on the machine. `missScale` prices failing to act; `ghostScale`
prices acting unbidden, defaulting to the same value.

| | `missScale` | `ghostScale` | why |
|---|---|---|---|
| PLATFORM | 1.0 | 1.0 | the reference. A jump that never happened is the most legible thing a cabinet can do wrong |
| SHMUP | 0.3 | **0.25** | the ship must fire faster than a hand can ask, so stray bullets are structural; a dead trigger is still obvious |
| FIGHTER | 0.5 | **0.45** | swings are thrown constantly, so no single one is damning either way |

The shooter also sets `mashScale: 3.5` on the person themselves — nobody *taps* fire on a
shooter, they hammer it. Without that, 4-1 is unfair by construction: every shot the ship
needs beyond what a politely-tapping human asks for reads as the machine acting alone.

Two guards keep this honest. It judges the *visible* action (`world.justAction` /
`world.justTurn`), not your keypress, because an input the machine swallowed — a jump buffered
in mid-air, a turn pressed mid-corridor — is not something the person can see. And an ignored
input is only charged if the machine could have obeyed at some point while the window was
open; something physically impossible is never a lie.

**The central loop:** `attention = lerp(1.3, 0.7, patience/100)`. An absorbed person stops
scrutinising the buttons, so keeping patience high is literally what buys room to disobey.
Stated outright in the rules modal — it is the strategy, not a secret.

The range is deliberately **narrower than it was under two meters**. With one number, low
patience making misses dearer feeds straight back into patience; too wide a range turns that
into a death spiral you cannot climb out of. Narrowed, it is a real squeeze that still leaves
a way back.

**Deaths are not purely bad.** The first death of a level is free (a thrill, not a bore);
every one after is `-11`. It is not a *gain* — nothing except a matched press is. Three deaths
ends the level on hearts and usually drains the meter on the way, so the failure paths
converge.

**Forgiveness.** Divergence is not charged when:

- a spring, moving platform or conveyor is carrying the character (cover), or
- the character is at the lip of a gap nothing can jump — the human sees the same screen and
  knows a platform has to arrive. Boredom still charges for the wait, which is the honest cost.

### Pace

`TIME_SCALE` in `js/config.js` (0.8) multiplies `dt` for the whole loop. Because it scales
the character, the hand at the cabinet and the meter equally, every trajectory and every
gap stays exactly as reachable as before — it only buys real time to read the screen. This
is the dial for "too fast". **Do not slow the game by lowering `runSpeed`**: jump reach is
`runSpeed × airtime`, so that silently shortens it and makes 3-tile gaps uncrossable.

## 4. Reading the state without a HUD

Five diegetic instruments replace the bars:

1. **The face** — where patience stands. Six stages 🤩 → 😀 → 🙂 → 😐 → 😒 → 🥱, plus posture
   (lean / slump / squint). A run of misses overrides the stages with 🤨 / 😠: someone
   mid-argument with a cabinet does not look bored, they look annoyed.
2. **CRT integrity** — `heat`, meaning *recent* misses, decaying at 0.5/s. Ghosting, tearing,
   static and a rolling bar scale with it. This is deliberately not the meter: the face reports
   the balance, the picture reports the last few seconds, so one number still drives two
   instruments that say different things.
3. **The keycaps** — instantaneous divergence. Filled amber is their hand, a dashed outline is
   yours, a red hatch is a visible lie (shape as well as colour). A pre-light shows their
   intent during their reaction delay.
4. **The comment feed** — two registers, and only one of them is an instrument. Reactions to
   the screen (coins, stomps, deaths) are colour and cost nothing. `sus1..3`, `ghost` and
   `ignored` are the readout: a complaint about the *cabinet* is always real information, and
   the tier only ever ratchets up so the feed reads as a mood hardening rather than a number
   flickering around a threshold.
5. **Hearts** — the only literal gauge, and diegetic, because arcade games have always had them.

`DEBUG` in `js/config.js` (or `?debug=1`) draws the real numbers for tuning. Off by default.

## 5. The person at the cabinet

A state machine re-deciding every 240 ms over a 210 px lookahead. Every decision is queued
behind their reaction time — that queue **is** the telegraph on the keycaps.

| | look | reaction | aim error | panic | mash/s | wander/s | attention |
|---|---|---|---|---|---|---|---|
| DAVE (1-1) | 🧢 ☕ | 300 ms | 36 px | 0.12 | 0.30 | 0.16 | 1.00 |
| MEG (2-1) | 🎧 🧋 | 400 ms | 48 px | 0.30 | 0.90 | 0.45 | 0.92 |
| TOBY (3-1) | 🎈 🧸 | 560 ms | 78 px | 0.46 | 1.60 | 0.72 | 1.15 |

The cabinet can scale `mash/s` — see `mashScale` — because how hard you lean on the action
button belongs to the machine, not to the person. Nobody taps fire on a shooter.

Each carries a `hat` worn above the head and an `acc` held beside it. Only the head swaps as
their mood changes, so the person stays recognisable instead of being the same yellow circle
with a different mouth.

### The difficulty curve lives in one per-level dial

`attention` prices being caught out, and it **must climb across the three platformers** or the
last one stops feeling like one. `boredScale` used to be the second dial; it went with
boredom. Measured — how close a balanced run comes to zero patience, over 16 seeds:

| | avg *low* patience (balanced) |
|---|---|
| 1-1 | 20 |
| 2-1 | 17 |
| 3-1 | 6 |

A trap worth recording: `attention` was once dropped to 0.66 for Toby to stop his constant
flailing from piling up suspicion. That fixed the unfairness but pushed 3-1 *below* 2-1 and
inverted the curve. The right fix was to make the specific offender cheap globally, then push
his `attention` above everyone else's. Target the weight that is misfiring, not the multiplier
over all of them.

3-1 is calibrated so that mirroring Toby exactly holds suspicion at 0 and still kills you on
hearts: you *have* to disobey him, and he is the most expensive person to disobey.

Their mashing is a resource: a jump taken on a frame they also pressed jump costs nothing.

**Pacing is a hard constraint, not a side effect.** The keycaps have to be read mid-jump, so
four constants in `js/human.js` cap how fast that hand can move, independently of the
profiles: `DECISION` (240 ms between re-evaluations), `DIR_HOLD` (420 ms minimum before a
direction can change again), `JUMP_GAP` (550 ms minimum between any two jump presses — every
caller including the mash routes through `pressJump`, so this is the single ceiling), and
`JUMP_HOLD` (200–340 ms, long enough for a press to be visible). Measured on a safe stretch,
these put the busiest player at ~3.8 cap changes/s and the calmest at ~1.7. Raising a
profile's `mashPerSec` past what `JUMP_GAP` allows does nothing except clip.

### The shooter had to be re-solved from scratch

Removing boredom broke 4-1 specifically, and the reason is worth recording because it is not
obvious: **on a shooter, obeying a bad player wins.** Their sparse fire still grinds the stage
down given enough time, nothing kills the ship, and with no timer there is nothing to run out.
Measured with letting invaders past costing nothing: obey won **12/12**.

Three answers were tried against that. The first two are recorded because they are the
tempting ones and both are wrong.

1. *Letting one past drains patience.* Fails arithmetically. Patience refills at ~2.6/s, so any
   per-leak charge small enough to be fair is also small enough to drown — and the obedient run
   lasts ~90 s grinding the boss, earning the whole time. Priced high enough to bite, every
   strategy broke at under 60 %.
2. *Letting one past costs a heart.* Works on the gate and **fails in play**, which is the more
   useful failure. The report was "my ship randomly dies", and it was right: the charge fired
   forty pixels below the bezel and blew the ship up, so the heart went a beat after the thing
   that took it had left the picture, often on the far side of the screen. Drawing a defence
   line and detonating it there instead made it legible, but the mechanic was still a cost for
   something that never touched you.
3. **Nothing but being hit costs a heart, and the screen carries enough aimed fire that moving
   at random gets you killed.** Invaders fly off the bottom freely — they are something the
   person shouts about and nothing more. Flak is the answer instead: `fireEvery` ~2.2 s,
   `bulletSpeed` 140, a ship hitbox of 13 px inside a 22 px sprite, and a boss that alternates
   a five-shot fan with an aimed pair. A fan is beaten by standing in the gap and an aimed pair
   by moving, so neither is beaten by doing one of them at random — which is exactly what an
   obedient run does.

   The hitbox turned out to be the load-bearing part. At 8 px the flak had to be dense and fast
   to threaten anything, and bullets visibly passed *through* the rocket without registering —
   which reads as the machine being broken every bit as much as an unfair hit does. Widening it
   let the fire come back down: fewer, slower bullets that actually connect are both fairer to
   read and harder to survive by accident.

That progression is the general lesson for this game: the thing that punishes obedience has to
be the thing the genre already punishes people for. Bolted-on costs either get out-earned or
read as the machine cheating.

The caveat, recorded rather than hidden: the balance bot caps at ~81 % on 4-1 (90 % deferring
on every press). It has to interleave aiming taps with obedient taps under a one-key-per-frame
budget, which is exactly the thing a person does well and a heuristic does badly, so this is
the one level whose clearability rests on hand-testing rather than on the gate.

## 5b. Cabinets — one meta-layer, several machines

Variety comes from **the game running inside the cabinet**, not from new palettes on the
same platformer. The meta-layer (the person at the controls, the keycaps, patience, hearts,
the comment feed, the CRT) is identical on every machine; only the screen changes.

**Every cabinet uses exactly ◀ ▶ ⤒, and only one of them is ever pressed at a time.** One
stick, one button, one hand. A run-jump is "quick ▶, then ⤒" — a sequence, never a chord.

That second half is enforced in exactly one place: `press()` in `js/human.js` refuses while
the previous press is still held or inside its cool-off, and every decision the person makes
routes through it. The player's side mirrors it in `game.js`, where keys are edges only and at
most one tap is accepted per frame. Holding a key does nothing.

**Consequence: there is no held state left to compare, so all judging is discrete.** The old
sustained-mismatch model — wrong-way, frozen, coasting, their grace window and the left bias —
described something that no longer exists and has been deleted rather than left rotting in
`config.js`. Divergence is now entirely the hit window, three channels, one rule.

### Movement without holding

A direction tap is an impulse: velocity snaps to `runSpeed` and then bleeds off at `dashDecay`,
so one tap carries about 0.9s and 145px and a corridor costs a press every couple of seconds
rather than every stride. Coasting — moving with no cap lit — is a normal state.

Three things had to change with it, each of which silently broke the game until it did:

- **A jump leaves at full speed in the facing direction.** Otherwise reach depended on how long
  ago you last dashed, so coasting for a second made a gap uncrossable and quietly voided the
  "every gap is within 136px" invariant.
- **`airDecay` is exactly zero.** Bleeding even 30px/s in flight cut reach to ~129px and turned
  clean jumps into 5px-margin coin flips.
- **Variable jump height is gone.** It needed the button *held*; with taps the release landed
  one frame after take-off, so every jump was cut to 42% and nothing was crossable at all.

| | ◀ ▶ | ⤒ | judged as |
|---|---|---|---|
| PLATFORM (1-1…3-1) | dash left / right | jump | all three discrete |
| SHMUP (4-1) | dodge left / right | fire one shot | all three discrete |
| FIGHTER (5-1) | step back **+ guard** / step in | attack | all three discrete |

The fighter's block is a timed guard opened by the back-step tap rather than a held stance —
parry-shaped, more readable, and it still costs a press they may never have asked for.

The fighter is the sharpest fit of the three, because the genre and the meta-layer pull
against each other for free:

- **Guarding is a backward tap.** If they are calling you forward and you tap back to
  survive, that is a press they never asked for — so the safe play is the suspicious one. The
  skill is guarding *in the moment* rather than pre-emptively.
- **A fight is dull when both sides turtle and thrilling when there are exchanges**, which is
  precisely what boredom already charges for. On this machine "keep them entertained" and
  "play well" are the same instruction.
- **`ghostScale: 0.8`** is what stopped mashing from beating it. A stray swing is cheap on a
  fighter, but *lunging when they never asked* is the most readable thing on the screen —
  pricing the two separately took ignoring them from winning 8/12 down to 2/16.

### The contract

`js/cabinets/<id>.js` exports `{ id, judge, build, step, draw, sense, debugDraw? }`, and
`js/crt.js` owns everything that belongs to the *machine* rather than to any one game. The
world contract is simply the fields the director already reads:

```
world.player{ dead, vx, idleT, forcedWait }
world.{ cover, progress, progress01, lively, coins, coinsTotal, justAction, justTurn,
        canAct, canTurn, judge }
```

**`sense()` is the only genre-specific thing about the person.** It reports what someone
could see on that screen; `human.js` keeps every trait — reaction, aim error, panic, mash,
wander, attention — because it is the same person walking up to each machine.
`newMachine()` in `levels.js` makes an unfamiliar cabinet raise their error and *lower* their
attention, which is how a harder genre stays playable without inventing new characters.

**`judge.missScale`** lets a cabinet price its own action honestly. A missed jump is
catastrophic and unmistakable; one bullet missing from a stream of dozens is not, so the
shmup charges half.

### Two traps this cost us, worth not repeating

- **The person must not be better than a person.** A first cut of the maze cabinet steered
  toward the globally nearest pellet, which made the person at the controls a near-optimal
  router — and obeying near-optimal advice *wins*, which breaks the game's central rule.
  `sense()` must model someone reacting to what is in front of them, not a solver.
- **Mashing must lose.** The fighter's first cut let obeying win 11 times out of 12, because
  the CPU did not punish whiffs and button-mashing beats a passive opponent — and mashing is
  exactly what the person at the cabinet does. The fix is one asymmetry: a swing that hits
  nothing recovers far slower than one that connects (`ATK.whiff` vs `ATK.recovery`), plus a
  CPU that takes its turn when you whiff (`cpu.punish`).
- **A per-frame probability is not a probability.** That whiff punish was first rolled every
  frame, which at 60fps turns any chance below 1 into a certainty. It is now decided once per
  whiff.
- **High-frequency actions need their own price.** A shot or a swing is thrown constantly, so
  one mistimed press cannot carry a missed jump's cost. Both the shooter and the fighter set
  `judge.missScale` to 0.5.
- **Suspicion has to bleed continuously.** It was once gated on "no claim outstanding", which
  was fine when only jumps were judged. With three channels each carrying a press about once a
  second something is nearly always pending, so suspicion could only ever rise.
- **The person must keep talking.** Their direction taps were briefly gated on whether the
  character actually needed a nudge — which meant that whenever you kept pace yourself they
  fell silent, leaving nothing on the keycaps to obey or defy. A person taps to make it go;
  they are not watching its velocity. The steady drumbeat *is* the instruction.

All of these were caught by the balance gate, not by looking at the screen. **The maze cabinet
was built, balanced and then cut** — it passed every gate and was still boring to play, which
is the one thing a simulation cannot tell you.

## 6. Levels

Maps are arrays of tile strings, exactly `ROWS` (12) tall, so the camera scrolls horizontally
only. `#` solid, `=` one-way, `^` spike, `~` lava, `>`/`<` conveyor; markers `P F C o E S -`
become entities.

| # | Theme | Crossing it teaches |
|---|---|---|
| 1-1 | NEON GRASS | obey by default, override the odd jump; every gap is 2 tiles |
| 2-1 | MAGMA CAVES | lava, cover windows, one carried platform per wide crossing |
| 3-1 | SKY CIRCUIT | floating islands; most gaps are wider than a jump, so conveyors, springs and platforms are mandatory |
| 4-1 | STARDUST PATROL | a shooter: dodging is lateral, and dense aimed flak is what makes obeying fatal |
| 5-1 | NEON DOJO | a fighter: best of three, guard with a backward tap, and whiffed swings are what the CPU punishes |

**Reach budget:** 95 px apex (just under 3 tiles, so a 3-tile wall still blocks) and 136 px of
horizontal reach. Every gap in every level is either under that or has a platform in it —
this is the invariant to preserve when editing maps.

## 7. Verification

Balance was checked headlessly by stepping the real simulation modules under three policies
(obey / ignore / balanced) across seeds. The gate that matters:

- **obeying the player 100 % never wins any level** — confirmed, 0/10 on all three, and with
  hearts disabled an obey run reaches only 2 % of 3-1 in 200 s across 62 deaths;
- balanced play clears 1-1 and 2-1, and 3-1 is completable (also proven with hearts disabled
  — the scripted test bot is simply worse at platform dismounts than a person).

`scratchpad/sim.mjs`-style harnesses are throwaway, but the shape is worth repeating after any
tuning change: step the real modules under obey / ignore / balanced across ~10 seeds and check
the obey row stays at zero wins.

**The platformer is byte-identical after the cabinet refactor.** `scratchpad/baseline.mjs`
pins `Math.random` to a seeded PRNG and runs a fixed level x policy x seed matrix; the digest
before and after the refactor matched exactly, which is the only real defence against a silent
regression in a change that large. Re-run it before touching shared code.

Browser verification with Playwright: zero console errors and zero page errors across boot,
the title → brief → play flow, several seconds of driving, pause/resume, both loss overlays
and the report card, at desktop and 390 px mobile. The two 404s seen in logs are
`/favicon.ico`, which the whole repo lacks.
