# Galaxy Farmer — Design Spec

Date: 2026-07-16
Status: Approved by user

## Overview

A 3D third-person farming game on a tiny planet, delivered as a single HTML
file at `games/galaxy-farmer.html`, using Three.js r128 from the same CDN as
Magic Shooter (with an offline notice fallback). The player walks around a
small sphere, farms crops, sells produce at their house, fends off alien
raids with a raygun, and spends earnings on spaceship parts. Buying the final
part launches the ship and wins the game. The game is registered in the hub
(`index.html` game list) and the README, following the repo pattern (static
site, no build step, one file per game).

## World & Rendering

- **Planet:** low-poly sphere, roughly 20 units radius, vertex-colored
  grass/dirt patches, decorated with small rocks and trees. A starfield
  skybox surrounds it.
- **Fixed world space:** the planet does not rotate; the player orbits it
  (Mario Galaxy style). This keeps flying enemies, the shooting star, and
  the day/night sun simple.
- **Day/night cycle (cosmetic only):** a sun and moon directional light
  orbit the planet (~2.5 min full cycle). Sky color, ambient light, and fog
  tint lerp between day and night; stars fade in at night; the house lamp
  and windows glow at night. No effect on gameplay values.

## Player & Camera

- **Player model:** small astronaut-farmer assembled from Three.js
  primitives (capsule body, helmet sphere, backpack).
- **Movement:** quaternion-based surface walking. `W`/`S` move
  forward/back, `A`/`D` turn the player. "Up" is always the radial
  direction away from planet center.
- **Camera:** third person, auto-follows behind and slightly above the
  player, smoothed. Holding right-mouse-drag orbits the camera for a
  look-around; it eases back behind the player when released.
- **Cursor:** always free (no pointer lock). Left click is the universal
  action: shoot at enemies/sky, contextual action on nearby farm plots,
  open the shop at the house door.

## Farming Loop

- **Plots:** fixed anchor spots arranged near the house, initially locked.
  Interactions require standing close to the plot (proximity radius).
  Lifecycle per plot:
  1. **Create** — pay a small fee to clear/till the spot into a plot.
  2. **Plant** — sows the currently selected seed (chosen in a seed bar).
  3. **Water** — a planted crop starts dry; growth pauses while dry.
     Watering (click) resumes it. Crops re-dry once mid-growth and need one
     more watering (sprinkler upgrade automates this).
  4. **Grow** — three visual stages: sprout → mid → ready (distinct
     meshes/scale, ready crops glow slightly).
  5. **Harvest** — click to collect produce into inventory.
- Clicks on plots are contextual: empty plot → plant, dry → water,
  ready → harvest.

### Crops (5)

| Crop | Grow time | Seed cost | Sell price | Notes |
|------|-----------|-----------|------------|-------|
| Star Wheat | fast | cheapest | low | starter crop |
| Moon Berry | short | cheap | modest | |
| Crystal Carrot | medium | medium | good | |
| Nebula Melon | long | pricey | high | |
| Void Pumpkin | longest | expensive | highest | best money/plot |

Exact numbers are tuned during implementation so a focused player finishes
in roughly 30–45 minutes.

## House, Shop & Economy

- A small house sits on the planet; walking to its door and clicking (or
  pressing `E`) opens the shop panel (game keeps running behind a dimmed
  overlay; enemies do not spawn while shopping).
- **Shop tabs:**
  - **Seeds** — buy any of the 5 seed types.
  - **Sell** — sell produce individually or all at once.
  - **Upgrades** — gun damage, gun fire rate, walking speed boots,
    unlock additional plot slots, sprinkler (auto-waters all plots).
  - **Spaceship** — buy the 5 parts, strictly in order.
- HUD shows money, HP, selected seed, and inventory counts.

## Spaceship Goal (Win Condition)

- A launch pad sits on the far side of the planet with a ghost outline of
  the ship. Parts purchase order: **Frame → Engine → Fuel Tank → Cockpit →
  Navigation Module**, each visibly assembling onto the pad when bought.
  Part prices rise steeply; the last part is the big final goal.
- Buying the final part triggers the launch sequence: the player boards,
  engines ignite, the ship lifts off with particles and camera follow, then
  a victory screen shows stats (days survived, money earned, aliens killed)
  and a Play Again button (clears the save).

## Combat & Aliens

- **Raygun:** always equipped. Left click fires a glowing projectile toward
  the clicked world point (raycast), with mild aim-assist snapping toward
  enemies near the click ray. Upgradeable damage and fire rate.
- **Player HP:** shown in HUD; regenerates slowly out of combat. On reaching
  0 the player is downed and respawns at the house after a few seconds,
  losing a small percentage of money (crops and parts are never lost this
  way).
- **Raids:** a timed random event — a warning banner ("Alien raid
  incoming!") precedes each wave. Raid size and variant mix scale with
  spaceship parts owned. Aliens drop coins on death; coins fly to the
  player when nearby.

### Alien Variants (8)

Low-poly glowing designs with health bars, distinct silhouettes and colors.

| # | Variant | Behavior |
|---|---------|----------|
| 1 | Grunt | Basic walker, melee-attacks the player |
| 2 | Raider | Runs to a grown crop, steals it, flees to the sky — kill it to drop the crop back |
| 3 | Brute | Big, slow, high HP; smashes plots (destroys the crop, plot stays) |
| 4 | Spitter | Keeps distance, lobs acid projectiles at the player |
| 5 | Hopper | Fast erratic jumper, weak but hard to hit |
| 6 | Shieldbearer | Front shield blocks shots; must be hit from the side/behind |
| 7 | Summoner | Floats above ground, periodically spawns Grunts until killed |
| 8 | UFO Saucer | Flies overhead, beam-abducts crops from above; can only be shot in the air |

## Random Star Event

- Occasionally a glowing star arcs across the sky near the planet for
  ~15 seconds with a soft chime cue. Shooting it bursts it into loot —
  money and sometimes a rare seed — that falls to the surface for pickup.
  If ignored, it flies away.

## UI / Screens

- Start screen (title, short how-to, Start / Continue buttons), pause
  overlay (`Esc`/`P`), help panel, victory screen, respawn overlay.
- HUD: money, HP bar, day counter with sun/moon icon, seed selector bar
  (number keys or click), inventory counts, event banners.
- Visual style follows the repo's game UI conventions (dark overlay panels,
  emoji favicon, single accent color).

## Save System

- Autosave to `localStorage` under a versioned key every ~10 seconds and on
  key events (purchase, harvest, raid end). Saved: money, plot states and
  growth progress, inventory, upgrades, spaceship parts, day counter,
  player stats. Start screen shows Continue when a save exists; a Reset
  Save button lives on the start and pause screens.

## Error Handling & Constraints

- CDN failure shows the same style of "no internet" notice as Magic
  Shooter.
- Corrupt/incompatible saves (version mismatch or JSON parse failure) are
  discarded gracefully — the game starts fresh instead of crashing.
- Performance target: smooth on a mid-range laptop — capped enemy counts,
  shared geometries/materials, simple shadows or none.

## Testing

- Manual verification via the repo `verify` skill (local server + browser):
  walk fully around the planet, full farm cycle for each crop, shop
  buy/sell/upgrades, each alien variant's behavior, star event, save/load
  across reload, full playthrough to launch and victory, day/night visual
  check.
