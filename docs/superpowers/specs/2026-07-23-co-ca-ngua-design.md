# Cờ Cá Ngựa — Design Spec

**Date:** 2026-07-23
**Deliverable:** One self-contained file `games/co-ca-ngua.html` (HTML + CSS + JS, emoji only), plus a hub card in `index.html`.
**Reference:** `games/jungle-game.html` for craftsmanship (Web-Audio SFX module, particle effects, overlays, rules modal, control layout) — but a distinct racetrack/derby theme, NOT the green jungle look.

## 1. Overview

A 4-player, pass-and-play (hotseat) implementation of Cờ Cá Ngựa (Vietnamese horse-racing Ludo). Players roll one die and race their four horses 🐎 around a cross-shaped track, capturing rivals and climbing their home lane to the finish 🏁. First player to bring all four horses home wins.

## 2. Board & Geometry

Standard Ludo cross rendered on a 15×15 CSS grid.

- **4 stables (chuồng):** one per corner, each a colored 6×6 yard holding that color's 4 horse slots.
- **Shared main track:** 52 cells forming the cross loop, styled as a tan dirt racetrack.
- **Home lanes (đường về đích):** 4 lanes of 6 cells each, colored per player, leading inward to the central finish.
- **Finish (đích):** central goal where horses come to rest (🏁).
- **Colors / seats (clockwise):** 🔴 Red, 🟢 Green, 🟡 Yellow, 🔵 Blue. (Standard Ludo layout; exact corner assignment fixed in code.)

**Path model (per color):**
- Main-ring indices `0..51`. Each color has a fixed **start index** (entry cell, offset 13 apart) and steps forward 51 shared cells.
- After the 51st main-track step, the horse turns into its own 6-cell home lane (steps 52..57).
- A horse's full journey from start cell to finish is 57 forward steps. Step 57 = finish cell; must be reached by an exact die count.
- Each cell's pixel/grid position comes from precomputed coordinate arrays (main ring of 52 cells + 4×6 home-lane cells + 4 stable slot sets).

## 3. Rules (classic, single die)

- Each turn the current player rolls one die 🎲 (value 1–6).
- **Leaving the stable is strict:** a horse can only move from the stable onto its start cell on a roll of exactly **6**.
- **Rolling a 6 grants an extra roll** after the move resolves. **Three consecutive 6s void the turn** (no move on the third 6; turn passes).
- On a non-6 (or a 6 used to advance), the player moves **one** eligible horse forward by the die value.
- **Eligible move** = a horse already on the track/home-lane that can advance by the die value without overshooting the finish, OR (die=6) a stabled horse moving to its start cell.
- **Capture:** if a horse lands on a cell occupied by one or more **opponent** horses, those opponents are sent back to their stable (tumble effect). Exception: the **8 safe cells** (each color's start cell + the 4 star cells) — no capture occurs there; horses of different colors may co-exist on a safe cell.
- **Own horses** may share any cell (no self-capture, no blocking).
- **Exact finish:** landing on the final finish cell requires an exact count; if the die value would overshoot, that horse is not eligible to move.
- **Auto-pass:** if the player has no eligible move for the rolled value, the turn passes automatically (after a brief message), except the extra-roll case where a 6 still grants another roll.
- **Win:** the first player to get **all 4 horses** onto the finish wins immediately; a trophy overlay ends the game.

## 4. Theme — Racetrack / Derby (must look distinct from the jungle game)

- Warm turf-green field with a **tan/ochre dirt track** for the main loop; checkered-flag 🏁 accents at corners and finish.
- Grandstand + colored bunting strip along the top; subtle drifting **dust** ambiance layer (analogous to jungle's flora layer, different content).
- Stables styled as colored **paddocks**; home lanes tinted per color, chevrons pointing inward.
- Horses are 🐎 on colored, tinted discs (one disc style per player, echoing jungle's red/blue piece treatment but four colors).
- Palette centers on track tan + turf green + bright silks accents (red/green/yellow/blue) + checkered black/white — deliberately different from the jungle's emerald-only scheme.

## 5. Juice / Effects (same craft, new flavor)

- **Dice:** a visible die button/area that tumbles (🎲 face cycling) then settles on the rolled value; rattle SFX.
- **Move:** arc "hop" animation between cells (reuse jungle's fly-arc approach) plus a **dust-cloud gallop** trail; galloping-hooves SFX.
- **Capture:** board shake + the captured horse tumbles off with a dust puff, then animates back to its stable; whinny SFX.
- **Home / finish:** small sparkle when a horse reaches the finish.
- **Win:** checkered-flag sweep + confetti burst + trophy overlay; crowd-cheer SFX.
- **Web Audio SFX module** (synthesized, no external files), structured like jungle's `Sound` IIFE: `roll`, `move`(gallop), `capture`(whinny), `finish`, `win`, plus a mute toggle persisted to `localStorage`.

## 6. UI / Controls

- Header: title + controls — 🔊 sound toggle, 📖 rules modal, 🔄 restart (same layout family as jungle).
- Turn indicator showing the current player's color and that they must roll.
- A **Roll** button (🎲); disabled while a move animates or when it's not a roll step.
- Four side/summary readouts (one per player) showing horses still stabled vs. horses finished.
- Rules modal (📜) describing the classic rules above, in Vietnamese, matching jungle's modal style.
- Win overlay with 🏆, winning color, and a "Chơi lại" (play again) button.
- Language: Vietnamese UI text (consistent with `jungle-game.html`).

## 7. Structure (single file)

Mirrors `jungle-game.html`'s organization:
- **HTML:** container, header/controls, turn status, board mount, per-player readouts, win overlay, rules modal.
- **CSS:** board grid, cell/terrain styling (track/stable/home-lane/finish/safe), horse discs, dice, all keyframe effects (hop, dust, tumble, shake, confetti, dice tumble), responsive breakpoints.
- **JS:**
  - Constants: colors, path/coordinate model, safe cells, start offsets.
  - State: `players` (each with 4 horses: `{state:'stable'|'track'|'home'|'finish', pos}`), `currentPlayer`, `dieValue`, `sixStreak`, `gameOver`.
  - Rendering: build board cells once; render horses from state each update.
  - Rules engine: `rollDie`, `getEligibleMoves(player,die)`, `moveHorse`, `resolveCapture`, `checkWin`, `nextTurn` (with 6/extra-roll/triple-6 handling and auto-pass).
  - Effects + `Sound` module.
  - Controls wiring, rules modal, restart, win overlay.

## 8. Verification

Per repo policy (manual playtest; no Python; no subagent Playwright): static self-check that the file parses and logic is sound, then a user playtest in the browser. Confirm: 6-to-start, extra roll on 6, capture + send-home, safe cells, exact-finish, auto-pass, win detection, and that all four colors take turns correctly.

## 9. Out of Scope (YAGNI)

- AI opponents (hotseat only).
- Two-dice variant, betting, or ranking beyond first winner.
- Online/multiplayer, save/resume, animations settings.
