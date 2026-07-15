# Magic Shooter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-file 3D first-person shooter (`games/magic-shooter.html`) with 20 switchable magic bullet types, 4 enemy types, and endless waves in one arena room.

**Architecture:** One HTML file: inline CSS UI overlay + inline JS game. Three.js (CDN) renders; a custom lightweight system handles player physics (gravity + AABB collision), a data-driven spell table drives 20 projectile behaviors, and a wave director spawns 4 enemy AI types. Object pools keep projectiles/particles at 60fps.

**Tech Stack:** Three.js r128 via cdnjs global build (`https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` — global `THREE`, no import maps, matches "no build step" repo rule). Vanilla JS/CSS. No other dependencies.

## Global Constraints

- Everything lives in ONE file: `games/magic-shooter.html` (spec: single HTML file).
- No build step, no npm; the only external resource is the Three.js CDN script.
- If Three.js fails to load, show a friendly "This game needs an internet connection" overlay, never a blank page (spec: error handling).
- Target 60fps with ~30 enemies + ~100 live projectiles: pool projectiles/particles, share geometries/materials, renderer shadows OFF.
- Repo language convention: game UI text in English is fine (existing games use English in-game text); README entry in Vietnamese like its neighbors.
- Testing is manual browser playtesting (repo has no test infra). Every task ends with a browser verification step via `python -m http.server 8000` from repo root, opening `http://localhost:8000/games/magic-shooter.html`, and checking the DevTools console for errors.

---

### Task 1: File scaffold, renderer, game loop, CDN fallback

**Files:**
- Create: `games/magic-shooter.html`

**Interfaces:**
- Produces: global objects later tasks extend — `const G = {}` game-state namespace; `scene`, `camera`, `renderer` (THREE); `const arena = { size: 80, wallHeight: 12, colliders: [] }`; functions `update(dt)` and `render()` called from the main loop; `G.state` one of `'menu' | 'playing' | 'paused' | 'gameover'`.

- [ ] **Step 1: Write the HTML skeleton**

Structure (all inline, in order): `<title>Magic Shooter</title>`, `<style>` (CSS custom props for the neon palette: `--magic:#a06bff`, `--hp:#ff3b5c`, `--ui-bg:rgba(10,8,20,.72)`; full-viewport `#game-canvas`; hidden-by-default overlay divs `#start-screen`, `#pause-screen`, `#gameover-screen`, `#spell-grid`, `#no-internet`; HUD skeleton `#hud` with `#crosshair`, `#health-bar`, `#wave-info`, `#hotbar`), then `<script src="...three.min.js">`, then the game `<script>`.

- [ ] **Step 2: CDN failure fallback**

```js
window.addEventListener('DOMContentLoaded', () => {
  if (typeof THREE === 'undefined') {
    document.getElementById('no-internet').style.display = 'flex';
    return; // boot() never runs
  }
  boot();
});
```

- [ ] **Step 3: Renderer, scene, camera, loop**

```js
function boot() {
  G.state = 'menu';
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0716);
  scene.fog = new THREE.Fog(0x0b0716, 60, 140);
  camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 300);
  let last = performance.now();
  (function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (G.state === 'playing') update(dt);
    render();
  })(performance.now());
}
```

Add `resize` listener updating camera aspect + renderer size.

- [ ] **Step 4: Verify in browser**

Run: `python -m http.server 8000` (repo root), open `http://localhost:8000/games/magic-shooter.html`.
Expected: dark violet page, start-screen div visible (unstyled ok), zero console errors. Temporarily block the CDN (DevTools → Network → block request) and reload: the no-internet overlay shows.

- [ ] **Step 5: Commit**

```powershell
git add games/magic-shooter.html; git commit -m "feat(magic-shooter): scaffold renderer and game loop"
```

### Task 2: Arena — geometry, lighting, colliders

**Files:**
- Modify: `games/magic-shooter.html`

**Interfaces:**
- Consumes: `scene`, `arena` from Task 1.
- Produces: `arena.colliders` — array of `{min:THREE.Vector3, max:THREE.Vector3}` AABBs (outer walls, pillars, blocks; ramps handled as stepped boxes). Helper `addBox(x,y,z,w,h,d,mat)` adds mesh + collider. Used by player (Task 3), bullets (Task 4/6), enemies (Task 5).

- [ ] **Step 1: Build the room**

80×80 floor (dark grid texture via `THREE.GridHelper` over a dark plane), 4 outer walls (height 12) with emissive trim strips, ~6 pillars, ~8 jump-height blocks (heights 1.5–4, jumpable chain), 2 ramps built from 4–5 stacked thin boxes (stepped so AABB collision "climbs" them). Palette: near-black purple surfaces + neon emissive edges (cyan/magenta).

- [ ] **Step 2: Lighting**

`AmbientLight(0x332244, 1.2)` + `HemisphereLight` + 2–3 colored `PointLight`s on pillars. No shadow maps.

- [ ] **Step 3: Verify in browser**

Temporarily set camera at `(0, 15, 30)` looking at origin. Expected: full room visible, neon-lit, 60fps, no console errors. Remove the temp camera after checking.

- [ ] **Step 4: Commit** — `git commit -m "feat(magic-shooter): arena geometry, lighting, colliders"`

### Task 3: Player controller — pointer lock, movement, jump, collision

**Files:**
- Modify: `games/magic-shooter.html`

**Interfaces:**
- Consumes: `arena.colliders`, `camera`, `G.state`.
- Produces: `player = { pos:Vector3, vel:Vector3, yaw, pitch, onGround, hp:100, maxHp:100, radius:0.5, height:1.7 }`; `updatePlayer(dt)`; `damagePlayer(amount)`; `moveWithCollision(pos, vel, radius, height, dt)` — shared AABB mover reused by enemies. Pointer-lock exit while playing → `G.state='paused'`.

- [ ] **Step 1: Input + look**

Keyboard map on `keydown/keyup` (`KeyW/A/S/D`, `Space`, `ShiftLeft`). `mousemove` under pointer lock updates `yaw/pitch` (clamp pitch ±89°, sensitivity 0.0022). Camera positioned at `player.pos + (0, height, 0)` with `camera.rotation.order='YXZ'`.

- [ ] **Step 2: Movement physics**

Walk 8 u/s, sprint 12, air control ×0.35, gravity −28 u/s², jump velocity 10.5. `moveWithCollision` resolves each axis independently against every collider AABB (expand by radius; land on top faces sets `onGround`).

- [ ] **Step 3: Verify in browser**

Click canvas → pointer locks. Walk, sprint, jump onto the 1.5-height block, chain-jump to higher blocks, walk up a ramp, run into every wall/pillar (no pass-through, no jitter), press Esc (pause state logged). No console errors.

- [ ] **Step 4: Commit** — `git commit -m "feat(magic-shooter): FPS player controller with collision"`

### Task 4: Spell table, projectile pool, shooting (baseline behavior)

**Files:**
- Modify: `games/magic-shooter.html`

**Interfaces:**
- Consumes: `player`, `camera`, `arena.colliders`, `moveWithCollision`.
- Produces:
  - `SPELLS` — array of 20 defs `{ id, name, icon, color(hex), damage, fireRate(shots/s), speed, behavior, ...params }` (exact table below; behaviors implemented in Task 6 — until then all fire as `'bolt'`).
  - `G.spellIndex`; `selectSpell(i)`; input bindings: `Digit1..0` → 0–9, wheel & `KeyQ/KeyE` cycle, `Tab` opens grid (grid UI in Task 8).
  - Projectile pool: `spawnProjectile(def, origin, dir, opts)`; each live projectile `{ mesh, vel, def, age, bounces, pierced:Set, alive }`; `updateProjectiles(dt)` handles movement, wall AABB hit → `onProjectileHitWall(p, hitPoint)`, enemy hit → `onProjectileHitEnemy(p, enemy)` (enemy set arrives Task 5; until then test against walls).
  - `hitscanExplosion(center, radius, damage, color)` — AoE helper (full logic Task 6 uses it too).

- [ ] **Step 1: The 20-spell data table (copy exactly)**

| id | name | icon | color | dmg | rate | speed | behavior + params |
|----|------|------|-------|-----|------|-------|-------------------|
| bolt | Arcane Bolt | ✦ | 0xa06bff | 12 | 6 | 55 | `bolt` |
| fireball | Fireball | 🔥 | 0xff6a2a | 22 | 1.6 | 38 | `explode` radius 5, splash 18 |
| ember | Ember Shot | 🕯 | 0xffa03c | 8 | 3.5 | 48 | `burn` 4 dmg/s × 4s |
| frost | Frost Shard | ❄ | 0x7fd8ff | 10 | 2.5 | 50 | `freeze` 2.5s |
| homing | Homing Wisp | 👁 | 0xff7ff0 | 10 | 2.8 | 30 | `homing` turnRate 4.5 rad/s |
| ricochet | Ricochet Orb | ◎ | 0x59ffb2 | 11 | 2.5 | 45 | `bounce` max 6 |
| chain | Chain Lightning | ⚡ | 0x9fe8ff | 14 | 1.8 | 70 | `chain` jumps 4, range 9, falloff .75 |
| poison | Poison Cloud | ☠ | 0x8aff4a | 6 | 1.4 | 34 | `cloud` r 4, 6 dmg/s, 5s |
| void | Void Orb | ● | 0x6a3bd8 | 8 | 0.9 | 12 | `vortex` pull r 9, 3.5s, implode 30 dmg r 6 |
| lance | Piercing Lance | ⟶ | 0xfff36a | 16 | 1.5 | 90 | `pierce` unlimited |
| scatter | Scatter Gems | ✸ | 0x4affd8 | 6×7 | 1.2 | 46 | `scatter` 7 shards, spread 0.14 rad |
| cluster | Cluster Bomb | ✱ | 0xff9a3c | 14 | 1.0 | 34 | `cluster` 6 bomblets, each explode r 3 / 10 dmg |
| boomerang | Boomerang Sickle | ↻ | 0xd0ff5a | 15 | 1.4 | 40 | `boomerang` out 0.6s then return, hits twice |
| meteor | Meteor Call | ☄ | 0xff4a3c | 35 | 0.7 | 26 | `arc` gravity −22, explode r 7 |
| vampire | Vampire Fang | 🦷 | 0xd83b6a | 13 | 2.2 | 52 | `vampire` heal 35% of damage |
| timewarp | Time Warp | ⏳ | 0x6ac8ff | 5 | 0.8 | 30 | `zone` r 7, 6s, enemy speed ×0.25 |
| blink | Blink Bolt | ✧ | 0x5affff | 8 | 1.2 | 60 | `blink` teleport player to impact (keep player above floor) |
| turret | Turret Seed | ⛨ | 0xffd23c | 0 | 0.5 | 28 | `turret` lifetime 8s, fires bolts 3/s, 6 dmg, range 20 |
| gravity | Gravity Flip | ↑ | 0xc06aff | 10 | 1.1 | 40 | `launch` upVel 18, fall dmg = impact speed × 1.6 |
| chaos | Chaos Dice | 🎲 | 0xffffff | ×1.4 | 1.6 | — | `chaos` pick random other behavior each shot, dmg ×1.4 |

- [ ] **Step 2: Pool + fire**

Shared `SphereGeometry(0.18)` + per-spell `MeshBasicMaterial` (emissive look via color). Pool of 200. Fire on mousedown-held, respecting `1/def.fireRate` cooldown; origin = camera position + right/down gun offset; dir = camera forward with tiny spread. Each projectile carries a `PointLight`-free glow (sprite) to stay cheap.

- [ ] **Step 3: Crosshair + hotbar tint hookup**

`selectSpell` sets `#crosshair` border color and active hotbar cell (hotbar DOM built in Task 8; guard for absence now).

- [ ] **Step 4: Verify in browser**

Fire Arcane Bolt: projectiles fly, die on walls (small flash), pool never exhausts under held fire. Switch via 1–0/wheel/Q/E: crosshair tint changes, cooldown differences observable. No console errors.

- [ ] **Step 5: Commit** — `git commit -m "feat(magic-shooter): spell table, projectile pool, shooting"`

### Task 5: Enemies — 4 types, AI, waves, damage numbers

**Files:**
- Modify: `games/magic-shooter.html`

**Interfaces:**
- Consumes: `player`, `damagePlayer`, `moveWithCollision`, `arena`, `onProjectileHitEnemy` (wire projectile→enemy sphere-vs-sphere collision here).
- Produces: `enemies` array of `Enemy { mesh, type, hp, maxHp, speed, pos, vel, status:{burn,freeze,slow,poison,launched}, alive }`; `damageEnemy(enemy, amount, source)` (spawns damage number, awards score/kill on death); `spawnWave(n)`; wave director state `G.wave, G.kills, G.score`; `spawnDamageNumber(pos, amount, color)`; health bars as `THREE.Sprite` canvas textures above heads.

- [ ] **Step 1: Enemy types (low-poly emissive builds)**

| type | body | hp | speed | behavior | first wave |
|------|------|----|-------|----------|------------|
| grunt | red icosahedron + horns | 30 | 5 | chase; melee 10 dmg / 0.8s within 1.6u | 1 |
| spitter | green cone + eye | 22 | 3.5 | keep 12–18u distance, fire 8-dmg projectile every 2s | 2 |
| flyer | cyan tetrahedron, bobbing y 2–5 | 14 | 8 | sine-strafe toward player, rams for 6 dmg | 3 |
| tank | orange box stack | 120 | 2 | slow chase, melee 22 dmg | 4 |

HP/speed scale ×(1 + 0.08×wave). Wave n spawns `4 + 2n` enemies (cap 30 alive) from 4 glowing portal rings at wall midpoints, staggered 0.5s apart. Next wave starts 3s after arena clears; banner announcement hook `showWaveBanner(n)` (real UI Task 8, `console.log` fallback now).

- [ ] **Step 2: Projectile↔enemy collision + damage numbers**

In `updateProjectiles`: sphere test (enemy radius by type 0.9–1.6). `damageEnemy` spawns floating damage number (canvas-texture sprite, rises 1.2u over 0.7s, fades). Death: quick scale-down + particle burst placeholder, +score (10×type multiplier).

- [ ] **Step 3: Enemy → player damage + game over**

Melee timers, spitter projectiles (reuse projectile pool with `hostile:true` flag → hits player not enemies). `damagePlayer` → hp ≤ 0 sets `G.state='gameover'` (screen in Task 8; log for now).

- [ ] **Step 4: Verify in browser**

Wave 1 grunts chase and hurt you; kill all → wave 2 brings spitters (their shots hurt); waves 3/4 add flyers/tanks. Damage numbers float. Health bars deplete. Dying logs game over. 60fps with 20+ enemies. No console errors.

- [ ] **Step 5: Commit** — `git commit -m "feat(magic-shooter): enemies, AI, wave director"`

### Task 6: All 20 spell behaviors + status effects

**Files:**
- Modify: `games/magic-shooter.html`

**Interfaces:**
- Consumes: everything above.
- Produces: `applyStatus(enemy, kind, params)` with per-frame status ticks in enemy update (burn/poison DoT with colored tint flash, freeze = speed 0 + ice-blue tint + block AI, slow multiplier, launched = vertical physics + fall damage on landing); behavior dispatch inside `onProjectileHitWall` / `onProjectileHitEnemy` / `updateProjectiles` keyed by `def.behavior`; `zones` array for poison clouds / time warps (ring mesh + timer); `turrets` array; `hitscanExplosion` finalized (damage falloff by distance, shockwave ring + shake).

- [ ] **Step 1: Implement behaviors in this order (cheap → complex)**

1. `explode`, `burn`, `freeze`, `vampire` (impact modifiers)
2. `pierce` (don't kill projectile on enemy hit; track `pierced` set), `bounce` (reflect velocity across hit normal, count to max 6)
3. `scatter`, `cluster` (spawn N children via `spawnProjectile`)
4. `homing` (steer velocity toward nearest live enemy, capped turn rate), `chain` (on hit: zap up to 4 nearest within 9u with falloff, draw lightning polyline that fades in 0.15s)
5. `cloud`, `zone` (spawn zone entity; zone tick damages/slows enemies inside)
6. `vortex` (projectile decelerates, pulls enemies within 9u toward it, implodes after 3.5s)
7. `arc` (gravity on projectile; big explode), `boomerang` (velocity reverses toward player after 0.6s, despawns on catch, can hit same enemy twice)
8. `blink` (on any impact: teleport player to hit point nudged 1u toward shooter, floor-clamped; cyan flash)
9. `turret` (plant at impact: small crystal mesh, retargets nearest enemy 3/s for 8s)
10. `launch` (set enemy `launched`, vy=18; fall damage on ground contact)
11. `chaos` (on fire: clone a random other def, tint white sparkle, damage ×1.4)

- [ ] **Step 2: Verify in browser — full 20-spell sweep**

With a live wave, select each spell 1→20 and confirm its described effect visibly works (freeze stops an enemy, chain arcs visibly, blink moves you, turret fires alone, gravity flip launches + fall-kills, chaos varies per shot...). Watch FPS with void orb + cluster spam. No console errors.

- [ ] **Step 3: Commit** — `git commit -m "feat(magic-shooter): all 20 magic bullet behaviors"`

### Task 7: VFX & game feel

**Files:**
- Modify: `games/magic-shooter.html`

**Interfaces:**
- Consumes: all systems.
- Produces: pooled particle system `burst(pos, color, count, speed, life)` (one `THREE.Points` buffer, 1500 cap); projectile trails (short fading line or sprite chain); `shake(intensity)` camera offset decay; DOM feedback: hit-marker ✕ flash at crosshair, kill-streak text ("DOUBLE KILL" at 2+ kills within 1.5s), red radial vignette when hp < 35%; muzzle flash sprite; enemy death bursts in spell color.

- [ ] **Step 1: Implement all of the above; wire into damage/death/explosion/fire events**
- [ ] **Step 2: Verify in browser** — explosions shake + burst, hits flash marker, streak text appears on multikills, low health shows vignette, still 60fps under heavy fire. No console errors.
- [ ] **Step 3: Commit** — `git commit -m "feat(magic-shooter): particles, shake, hit feedback"`

### Task 8: UI screens — start, HUD, hotbar, spell grid, pause, game over

**Files:**
- Modify: `games/magic-shooter.html`

**Interfaces:**
- Consumes: `G`, `SPELLS`, `selectSpell`, restart path.
- Produces: `resetGame()` (full state reset: player, enemies, projectiles, zones, turrets, wave 1); polished DOM for: start screen (animated gradient title "MAGIC SHOOTER", controls table, "Click to Play"), HUD (health bar with number, wave/kills/score row, active-spell name+icon), bottom hotbar of 20 cells (icon + key hint for 1–0, active glow), Tab spell grid (5×4 cards: icon, name, one-line effect; click selects & closes), wave banner animation, pause overlay (resume/restart), game-over overlay (wave, kills, score, most-used spell, Play Again).

- [ ] **Step 1: Build CSS + DOM + state wiring** (state machine: menu→playing→paused→playing; playing→gameover→playing via `resetGame`). Tab must `preventDefault`. Pointer-lock loss while playing → pause screen.
- [ ] **Step 2: Verify in browser** — every screen reachable and readable; hotbar highlights follow all switch methods; grid clicking works; restart from both pause and game over fully resets (no leftover enemies/projectiles); banner shows each wave. No console errors.
- [ ] **Step 3: Commit** — `git commit -m "feat(magic-shooter): full UI/UX screens and hotbar"`

### Task 9: Hub + README registration, final playtest

**Files:**
- Modify: `index.html` (append to games array, matching existing entry shape at `index.html:104-141`)
- Modify: `README.md` (add list entry)

**Interfaces:**
- Consumes: finished `games/magic-shooter.html`.

- [ ] **Step 1: Register** — add hub entry with `path: "games/magic-shooter.html"`, Vietnamese description matching neighbors' style: `magic-shooter.html - Bắn súng góc nhìn thứ nhất với 20 loại đạn phép thuật.` README gets the same line.
- [ ] **Step 2: Full playtest checklist (from spec)** — all 20 spells behave per table; 4 enemy types + scaling; death/restart; all UI states; CDN-fail overlay; console clean; FPS acceptable under load. Also verify the hub page links to the game.
- [ ] **Step 3: Commit** — `git commit -m "feat: add Magic Shooter to game collection"`
