# Jungle King — canvas overhaul design

**Target:** `games/jungle-king.html` (already registered in the hub).
**Goal:** Keep the .io-style eat-and-grow gameplay exactly as it is, but rebuild the renderer on
`<canvas>`, give the world a real art direction, replace the flat animal AI with a state machine,
and add the house conventions this game is missing (sound + mute, rules modal, pause).

## 0. What does not change

The core loop is untouched: mouse-follow movement, eat any animal whose tier is **≤** yours,
gain XP equal to its tier, level up to evolve into the next animal on the 20-step ladder, and
**one touch by anything bigger ends the run**. Win by reaching tier 20 (🦣).

Explicitly **out of scope** (declined during design): minimap, off-screen danger arrows,
dash/stamina, hearts or extra lives, hazards and safe zones.

## 1. Architecture

One self-contained file. Vanilla JS, emoji for all art, no network requests, no build step.

- A full-viewport `<canvas>`, DPR-aware, re-sized on `resize`. DOM is used only for the HUD and
  the start / rules / pause / game-over overlays.
- The script splits into named units:
  | unit | responsibility |
  |---|---|
  | `LADDER` | the 20 animals: emoji, name, radius, base speed, perception |
  | `World` | ground pattern, decorations, canopy, light shafts, ambience, world edge |
  | `Spawner` | population maintenance, ring spawning, tier distribution |
  | `Brain` | per-animal AI state machine |
  | `FX` | particles, screen shake, floating text, trails |
  | `Sound` | Web Audio synth + mute flag |
  | `HUD` | DOM readouts, evolution track, banners |
  | `Game` | state machine `menu → playing → paused → over`, update + render |
- **Fixed 60 Hz timestep** driven by an accumulator. The current build moves entities in
  px-per-frame, so on a 144 Hz display it runs ~2.4× too fast; all speeds become px/second.
- **Spatial hash** (uniform grid, ~160 px cells) backs both collision and perception, so
  animal-vs-animal awareness stays O(n) at ~250 entities.
- No `getBoundingClientRect` anywhere in the loop — radius comes from the ladder table.
- Animals outside the view are skipped at draw time; animals that drift far from the player are
  recycled by the spawner rather than simulated forever.
- AI decisions are **staggered** (each animal re-decides every 6th tick, offset by its index)
  while movement integrates every tick.

## 2. World and art direction

Warm daylight jungle, built from four parallax layers:

| layer | content | parallax |
|---|---|---|
| canopy | dark leaf blobs drifting overhead, tiled from an offscreen canvas | 0.30 |
| shafts | soft diagonal light beams, screen space, slow drift | — |
| ground | tiled mottled green/dirt pattern + world-space decorations (bushes, rocks, flowers, tufts) | 1.00 |
| ambience | fireflies and floating pollen near the player | 1.00 |

The ground pattern and the canopy tile are generated **once** into offscreen canvases and painted
with `createPattern`, so the per-frame cost is two `fillRect`s rather than thousands of paths.

Bounded arena of 4000 × 4000 px, walled by a dark foliage band drawn outside the bounds so the
player can read where they are.

Animals get an elliptical drop shadow, a gentle idle bob, and are horizontally flipped when moving
right (emoji face left by default), which reads as facing direction.

**The camera zooms out as the player grows** — scale eases from ~1.0 at tier 1 to ~0.62 at tier 20,
so the field of view stays roughly constant instead of an elephant filling the screen.

## 3. Size, collision and spawning

- **Tier (1–20) remains the eat/eaten comparison.** What changes is that the drawn radius becomes a
  sublinear curve on tier (`≈ 11 · tier^0.55`) rather than the current linear `16 + size·7`, so
  late-game animals stay a sane size on screen.
- Collision is a true circle from that radius, not the emoji glyph's bounding box — the old box
  included font whitespace and made hitboxes inconsistent between species. Contact threshold is
  `0.78 · (rA + rB)`, matching the old feel.
- **Spawning happens in a ring just outside the visible area** (view radius + 120 … + 700), clamped
  into world bounds. Animals never materialise on screen.
- Tier distribution is a bell centred on the player's tier with an upward tail that lengthens with
  level, plus a floor guaranteeing a minimum number of edible animals nearby so the player is never
  stranded with nothing to eat.
- Target population ~240, maintained every tick.

## 4. Animal AI

A per-animal state machine replaces the current "everyone reacts identically inside a fixed radius":

- **WANDER** — drifting heading with occasional grazing pauses.
- **HERD** — tiers ≤ 6 apply light boids steering (cohesion, separation, alignment) against up to
  five same-tier neighbours, so prey moves in clusters worth hunting.
- **HUNT** — a bigger animal that perceives a smaller one (the player included) locks on and bursts,
  but **fatigues after ~4 s and gives up**, then ignores that target during a ~3.5 s cooldown. This
  is the key fairness change: today a bigger animal within 200 px chases at 1.45× indefinitely and
  the player simply cannot escape.
- **FLEE** — prey run away plus a perpendicular jitter rather than a straight predictable line, and
  panic spreads to nearby herd members so a group scatters.

Speeds: cruise sits below the player's maximum; only a hunt burst exceeds it, and a burst aimed at
the player is capped at ~1.12× the player's max speed. You can be caught, but you can outlast.

**NPCs eat each other** when tiers differ strictly, evaluated on the staggered tick against the
nearest smaller neighbour already found during perception. The ecosystem runs without the player;
the spawner keeps the mix balanced.

## 5. UI / UX

- **HUD** — current form as a large emoji, its name, tier and level, an XP bar, plus a run readout
  (animals eaten, time survived).
- **Evolution track** — the 20-emoji ladder as a horizontal strip that slides to keep the current
  form centred; past forms dimmed, current highlighted, the next one previewed.
- **Level-up banner** — `🐰 → 🐸` centre screen with screen shake and a rising arpeggio.
- **Controls** — 🔊 mute (`jungleKing.muted` in `localStorage`, per house convention), 📖 rules
  modal, ⏸ pause on `Esc` / `P`, auto-pause when the tab is hidden. A `← ARCADE.SYS` link returns
  to the hub, matching `games/last-quarter/`.
- **Juice** — eat burst particles and a floating `+N`, a player motion trail, screen shake on
  evolution, and a red vignette that intensifies as a hunting predator closes in. The vignette is
  the *only* threat warning; death stays instant with no lock-on tell or heartbeat cue.
- **Game over** — final form, animals eaten, time survived, and a personal best persisted to
  `jungleKing.best`.
- Input is `pointermove`, which brings touch-drag support for free.
- UI copy stays **English**, per the repo convention for arcade/action games.

## 6. Sound

A `Sound` IIFE in the same shape as `games/jungle-game.html`'s (synth `tone`/`noise` helpers, a
`master` gain, mute persisted to `localStorage`). Cues: **eat** (pitch scales with prey tier),
**evolve** (rising arpeggio), **death** (descending thud), **win** (fanfare), **ui** (click).
No danger loop — the threat warning is left to the visuals.

## 7. Verification

- `node --check` on the extracted script body.
- `node --test 'tests/*.test.mjs'` to confirm nothing regressed; the suite covers
  `monster-battle` only, so this is a no-change gate.
- Manual playtest by the user, per the project's verification policy.
- The stale `<title>Jungle Frenzy 🐾</title>` is corrected to Jungle King. The hub entry in
  `index.html` and the `README.md` line already exist and need no new registration.
