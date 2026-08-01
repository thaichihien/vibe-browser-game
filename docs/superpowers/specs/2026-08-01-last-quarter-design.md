# Last Quarter — Design

**Date:** 2026-08-01
**Files:** `games/last-quarter/` (folder game — `index.html`, `style.css`, `js/*.js`)
**Genre:** 2D platformer wrapped in a deception-management layer
**Source brief:** `idea.md` in the repo root

## 1. Goal

You are the character **inside** an arcade cabinet. Someone else is at the controls and they
are not very good. The cabinet gets unplugged if either:

- you obey them faithfully — the character dies over and over, they get bored and walk away; or
- you override them too often — the picture stops matching the joystick and they decide the
  machine is broken.

The platformer is the surface. The game is reading the incoming input stream and deciding
**when** it is worth disobeying.

UI language: **English**, consistent with the other arcade/action games in the repo.

## 2. Scope

### In scope (v1)

- Three levels, each with its own theme and its own (worse) player at the cabinet.
- 3 hearts per level; checkpoints; a rematch/next-stage flow with star ratings.
- Hidden FUN and SUS meters, revealed only on the between-level report card.
- Web Audio synth, start screen, rules modal, pause, mute, touch controls.
- Hub integration: entry in `index.html`, line in `README.md`.

### Out of scope (v1)

- Level editor, more than three levels, leaderboards, online anything.
- Only mute (`lastQuarter.muted`) and level unlocks (`lastQuarter.progress`) persist.

## 3. The two meters

Both drive everything. **Neither is ever drawn as a bar during play.**

| | Start | Up | Down | Ends at |
|---|---|---|---|---|
| **FUN** | 60 | progress, coins, stomps, near misses, checkpoints | accelerating boredom, repeated deaths, standing still | 0 → *player walked away* |
| **SUS** | 0 | your input visibly contradicting theirs | decays while in sync | 100 → *cabinet unplugged* |
| **hearts** | 3 | — | one per death | 0 → *game over* |

Divergence weights (charged only after `graceTime` of *continuous* mismatch, so quick
corrective taps read as input lag and cost nothing):

- running opposite to their held direction — `1.0`
- standing still while they hold a direction — `0.7`
- moving while they hold nothing — `0.35` (deliberately the cheapest: a machine
  coasting on after they let go is far less damning than one going the wrong way,
  and a flailing player lets go constantly)
- …all multiplied by `wLeftBias` 1.35 when the direction they are holding is
  **left**. Right is the default they hold without thinking; hauling the stick
  back the other way is deliberate, so ignoring it is what they actually notice.
**Jump is not a tolerance, it is a scored window.** Their press opens an accept window
(`jumpAcceptLate` 0.30 s); you may also jump up to `jumpAcceptEarly` 0.26 s *before* they
press, because anticipating them is still obedience. Either side may move first, so neither
press is judged when it happens — a claim stays pending until the other side's window lapses.

- a clean match — `−1.5` (a responsive machine actively reassures them)
- a ghost jump (you jumped, they never pressed) — one-shot `+28`
- an ignored jump (they pressed, the window lapsed) — one-shot `+16`

Two guards keep this honest. It judges `world.justJumped` — the *visible* jump — not the
keypress, because a press buffered in mid-air that never leaves the ground is not something
the person at the cabinet can see. And an ignored jump is only charged if the character's feet
touched the floor at some point during the window; a jump that was physically impossible is
never a lie.

Mistimed jumps are priced above the direction weights deliberately: the joystick is a held
state you can drift back into sync on, the button is a discrete promise you either kept or
broke.

Sustained divergence costs `susDirRate` (32/s) × weight × attention, against a `susDecay` of
6/s while in sync. These are deliberately harsher than the platforming, which is tuned to be
forgiving: dying should be rare, but *being noticed* should not. A useful calibration is that
a run which ignores the player entirely peaks around 75–80 suspicion — close enough to failing
that it is clearly the wrong strategy, without being an instant loss.

**The central loop:** `attention = lerp(1.4, 0.6, fun/100)`. An entertained person stops
scrutinising the buttons, so keeping FUN high is literally what buys room to disobey. Stated
outright in the rules modal — it is the strategy, not a secret.

**Deaths are not purely bad.** The first death of a level is a thrill (`+4` FUN); every one
after is `-11`. Three deaths ends the level on hearts and usually wrecks FUN on the way, so
the two failure paths converge.

**Forgiveness.** Divergence is not charged when:

- a spring, moving platform or conveyor is carrying the character (cover), or
- the character is at the lip of a gap nothing can jump — the human sees the same screen and
  knows a platform has to arrive. Boredom still charges for the wait, which is the honest cost.

### Pace

`TIME_SCALE` in `js/config.js` (0.8) multiplies `dt` for the whole loop. Because it scales
the character, the hand at the cabinet and both meters equally, every trajectory and every
gap stays exactly as reachable as before — it only buys real time to read the screen. This
is the dial for "too fast". **Do not slow the game by lowering `runSpeed`**: jump reach is
`runSpeed × airtime`, so that silently shortens it and makes 3-tile gaps uncrossable.

## 4. Reading the state without a HUD

Five diegetic instruments replace the bars:

1. **The face** — FUN. Six stages 🤩 → 😀 → 🙂 → 😐 → 😒 → 🥱, plus posture (lean / slump /
   squint).
2. **CRT integrity** — SUS. Ghosting, tearing, static and a rolling bar scale with suspicion.
   The meter and the fiction are the same object: what they are "noticing" is what you see
   going wrong.
3. **The keycaps** — instantaneous divergence. Filled amber is their hand, a dashed outline is
   yours, a red hatch is a visible lie (shape as well as colour). A pre-light shows their
   intent during their reaction delay.
4. **The comment feed** — escalating tiers, with boredom lines complaining about the *game*
   and suspicion lines complaining about the *cabinet*. Keeping those voices separate is what
   makes the feed usable as an instrument.
5. **Hearts** — the only literal gauge, and diegetic, because arcade games have always had them.

`DEBUG` in `js/config.js` (or `?debug=1`) draws the real numbers for tuning. Off by default.

## 5. The person at the cabinet

A state machine re-deciding every 240 ms over a 210 px lookahead. Every decision is queued
behind their reaction time — that queue **is** the telegraph on the keycaps.

| | look | reaction | aim error | panic | mash/s | wander/s | attention | boredScale |
|---|---|---|---|---|---|---|---|---|
| DAVE (1-1) | 🧢 ☕ | 300 ms | 36 px | 0.12 | 0.30 | 0.16 | 1.00 | 1.00 |
| MEG (2-1) | 🎧 🧋 | 400 ms | 48 px | 0.30 | 0.90 | 0.45 | 0.92 | 1.20 |
| TOBY (3-1) | 🎈 🧸 | 560 ms | 78 px | 0.46 | 1.60 | 0.72 | 1.15 | 1.45 |

Each carries a `hat` worn above the head and an `acc` held beside it. Only the head swaps as
their mood changes, so the person stays recognisable instead of being the same yellow circle
with a different mouth.

### The difficulty curve lives in two per-level dials

`attention` scales suspicion, `boredScale` scales boredom, and **both must climb across the
three levels** or the finale stops feeling like one. Measured:

| | avg peak SUS (balanced) | FUN lost per 6 s of doing nothing |
|---|---|---|
| 1-1 | 32 | 19 |
| 2-1 | 52 | 21 |
| 3-1 | 91 | 23 |

A trap worth recording: `attention` was once dropped to 0.66 for Toby to stop his constant
flailing from piling up suspicion. That fixed the unfairness but pushed 3-1 *below* 2-1 on
both dials and inverted the curve. The right fix was to make the specific offender cheap
globally — `wGhostMove`, the "they let go and you kept walking" case Toby generates most —
and then push his `attention` above everyone else's. Target the weight that is misfiring, not
the multiplier over all of them.

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

## 6. Levels

Maps are arrays of tile strings, exactly `ROWS` (12) tall, so the camera scrolls horizontally
only. `#` solid, `=` one-way, `^` spike, `~` lava, `>`/`<` conveyor; markers `P F C o E S -`
become entities.

| # | Theme | Crossing it teaches |
|---|---|---|
| 1-1 | NEON GRASS | obey by default, override the odd jump; every gap is 2 tiles |
| 2-1 | MAGMA CAVES | lava, cover windows, one carried platform per wide crossing |
| 3-1 | SKY CIRCUIT | floating islands; most gaps are wider than a jump, so conveyors, springs and platforms are mandatory |

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

Browser verification with Playwright: zero console errors and zero page errors across boot,
the title → brief → play flow, several seconds of driving, pause/resume, both loss overlays
and the report card, at desktop and 390 px mobile. The two 404s seen in logs are
`/favicon.ico`, which the whole repo lacks.
