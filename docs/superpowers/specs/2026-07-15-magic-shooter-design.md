# Magic Shooter — Design Spec

Date: 2026-07-15
Status: Approved by user

## Overview

A 3D first-person shooter (Doom-inspired) delivered as a single HTML file at
`games/magic-shooter.html`, using Three.js loaded from a CDN. The player fights
endless waves of enemies in one big arena room using a magic gun with 20
switchable bullet types. The game is registered in the hub (`index.html` game
list) and the README, following the existing pattern of this repo (static site,
no build step, one file per game).

## Core Gameplay

- **View/controls:** Pointer Lock mouse-look; WASD movement; Space jump;
  Shift sprint; left click to shoot; Esc pauses (releases pointer lock).
- **Arena:** One large enclosed room — floor, four outer walls, and inner
  obstacles (pillars, blocks, ramps) the player can jump onto and hide behind.
- **Game mode:** Endless waves. Enemies spawn from glowing portals; each wave
  increases enemy count and toughness. Score, kills, and wave number are
  tracked. On death, a game-over screen shows stats and a restart button.

## Magic Bullets (20 types)

All types are unlocked from the start. Switching: keys `1`–`0` select types
1–10; mouse wheel or `Q`/`E` cycle through all 20; holding/pressing `Tab`
opens a spell-grid overlay where any type can be clicked.

Each type has a distinct projectile color, particle trail, crosshair tint,
impact VFX, fire rate, and damage.

| # | Spell | Effect |
|---|-------|--------|
| 1 | Arcane Bolt | Fast baseline shot, highest fire rate |
| 2 | Fireball | Explodes on impact — AoE damage |
| 3 | Ember Shot | Ignites enemies — burn damage over time |
| 4 | Frost Shard | Freezes an enemy solid for a few seconds |
| 5 | Homing Wisp | Curves toward the nearest enemy |
| 6 | Ricochet Orb | Bounces off walls and floor up to 6 times |
| 7 | Chain Lightning | Arcs between up to 4 nearby enemies |
| 8 | Poison Cloud | Leaves a toxic gas zone that damages over time |
| 9 | Void Orb | Slow orb that pulls enemies in, then implodes |
| 10 | Piercing Lance | Penetrates every enemy in a straight line |
| 11 | Scatter Gems | Shotgun spread of 7 crystal shards |
| 12 | Cluster Bomb | Bursts into 6 mini-bombs on impact |
| 13 | Boomerang Sickle | Flies out and returns — hits on both passes |
| 14 | Meteor Call | Lobbed arc shot with a huge crash explosion |
| 15 | Vampire Fang | Damage dealt heals the player |
| 16 | Time Warp | Creates a bubble that slows enemies inside it |
| 17 | Blink Bolt | Teleports the player to where it lands (mobility) |
| 18 | Turret Seed | Plants a temporary auto-firing magic turret |
| 19 | Gravity Flip | Launches enemies skyward; they take fall damage |
| 20 | Chaos Dice | Random effect from the other 19, with bonus damage |

## Enemies (4 types)

Low-poly glowing geometric designs with emissive materials. Health bars float
above heads; floating damage numbers appear on hit.

- **Grunt** — melee chaser; walks at the player and attacks in close range.
- **Spitter** — keeps distance and fires projectiles at the player.
- **Flyer** — fast, erratic flight path, low HP.
- **Tank** — slow, very high HP; appears from mid waves onward.

Wave scaling: enemy count, mix, HP, and speed scale with wave number. Tanks
enter around wave 4+.

## UI / UX

Dark-fantasy neon aesthetic. Elements:

- Start screen: animated title, controls guide, click-to-play.
- HUD: crosshair (tinted per active spell), health bar, wave/kills/score,
  active-spell indicator (icon + name).
- Spell hotbar along the bottom: 20 icons, active one highlighted, number
  hints for 1–0.
- Tab spell-grid overlay for direct selection.
- Feedback: hit markers, floating damage numbers, screen shake on explosions,
  kill-streak text, wave announcement banners, red low-health vignette.
- Game-over screen: wave reached, kills, score, favorite spell, restart.
- Pause screen on Esc / pointer-lock exit.

## Architecture (single file)

One HTML file with inline CSS and JS. Three.js (r16x) loaded via CDN script.
Internal modules organized as plain JS sections/classes:

- **Engine/loop:** fixed-ish timestep update + render via requestAnimationFrame.
- **Player controller:** pointer-lock camera, movement, gravity, jump,
  AABB collision against arena geometry.
- **Spell system:** data-driven table of 20 spell definitions (color, speed,
  damage, fire rate, behavior flags/handlers). Projectile pool updates
  movement, collision, and per-spell behaviors (homing, bounce, pierce, arc…).
- **Effects/status system:** burn, freeze, slow, poison, pull, launch applied
  to enemies with timers.
- **Enemy system:** spawner (portals, wave scaling), per-type AI (chase,
  ranged, flying, tank), health/damage, death VFX.
- **VFX:** particle bursts, trails, explosion lights — pooled for performance.
- **UI layer:** HTML/CSS overlay driven by game state.

## Performance targets

60 fps on a mid-range laptop with ~30 enemies and ~100 live projectiles.
Object pooling for projectiles/particles; shared geometries/materials;
no shadows or cheap shadow settings if needed.

## Error handling

- If pointer lock is denied/exits, show the pause overlay.
- If the Three.js CDN fails to load, show a friendly "needs internet" message
  instead of a blank page.

## Testing

Manual playtest checklist: each of the 20 spells behaves as described; each
enemy type spawns and behaves correctly; wave scaling works; death/restart
works; UI states (start, pause, spell grid, game over) all reachable; no
console errors; frame rate acceptable under load.

## Out of scope (for now)

Sound design beyond simple WebAudio blips (optional nice-to-have), multiple
levels/maps, saving high scores, mobile/touch controls, multiplayer.
