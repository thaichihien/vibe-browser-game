# Galaxy Farmer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-file 3D third-person farming game (`games/galaxy-farmer.html`) on a tiny planet: farm 5 crops, sell at your house, fight off 8 alien variants, and buy 5 spaceship parts to launch and win.

**Architecture:** One HTML file: inline CSS UI + inline JS game. Three.js (CDN) renders a fixed-world small sphere; the player (and walking aliens) move on the surface via quaternion "orbit" math with up = radial direction. A third-person camera follows behind. Free cursor: left click is the universal action (shoot / farm / shop), routed by raycast + proximity. Data tables drive crops, upgrades, ship parts, and alien variants. localStorage autosave.

**Tech Stack:** Three.js r128 via cdnjs global build (`https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` — global `THREE`, no import maps, matches "no build step" repo rule). Vanilla JS/CSS. No other dependencies.

## Global Constraints

- Everything lives in ONE file: `games/galaxy-farmer.html` (spec: single HTML file).
- No build step, no npm; the only external resource is the Three.js CDN script.
- If Three.js fails to load, show a friendly "This game needs an internet connection" overlay, never a blank page (spec: error handling).
- Planet radius `PLANET_R = 14` (reduced from 20 at the user's request after milestone playtest 1; farm dirt patch threshold is now dot > 0.88, decoration exclusion 0.86/0.93). World space is fixed; the player orbits the sphere (spec: player-orbits approach).
- Day/night is cosmetic only — no gameplay values change with time of day (spec).
- Death is forgiving: respawn at house, lose 10% of money; crops, inventory, upgrades, ship parts never lost (spec).
- CONTROL CHANGE (user request after Task 8 playtest): left click ALWAYS shoots (aim assist, no plot/door routing). Farm/house interaction is proximity-focus + Space: the nearest interactable within range (plot ≤ 4u, house door ≤ 4u) gets a visible highlight + a bottom prompt (e.g. "␣ Harvest"); Space performs the contextual action. E near the door still opens the shop. Alien bullet hitboxes are enlarged (hitRadius ≈ radius × 1.6; aim assist 56px).
- Target 60fps on a mid-range laptop: shared geometries/materials, capped alive enemies (12), pooled bullets/particles, no shadow maps.
- In-game UI text in English; README/hub entry in Vietnamese like neighbors.
- Testing is manual browser playtesting (repo has no test infra). Every task ends with a browser verification step via `python -m http.server 8000` from repo root, opening `http://localhost:8000/games/galaxy-farmer.html`, and checking the DevTools console for errors.

---

### Task 1: File scaffold, renderer, game loop, CDN fallback

**Files:**
- Create: `games/galaxy-farmer.html`

**Interfaces:**
- Produces: `const G = {}` game-state namespace with `G.state` one of `'menu' | 'playing' | 'shop' | 'paused' | 'downed' | 'launch' | 'victory'`; globals `scene`, `camera`, `renderer`; `update(dt)` and `render()` called from the main loop; `const PLANET_R = 20;`.

- [ ] **Step 1: Write the HTML skeleton**

Structure (all inline, in order): `<title>Galaxy Farmer</title>`, emoji favicon 🚀 (data-URI SVG like magic-shooter), `<style>` (CSS custom props: `--accent:#6ee7a0`, `--money:#ffd76a`, `--hp:#ff5c6a`, `--ui-bg:rgba(8,12,20,.78)`, `--ui-border:rgba(110,231,160,.35)`; full-viewport canvas; hidden-by-default overlay divs `#start-screen`, `#pause-screen`, `#help-panel`, `#victory-screen`, `#downed-screen`, `#shop-panel`, `#no-internet`; HUD skeleton `#hud` with `#money`, `#hp-bar`, `#day-info`, `#seed-bar`, `#toast`, `#banner`), then `<script src="...three.min.js">`, then the game `<script>`.

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
  document.body.prepend(renderer.domElement);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0f1e);
  camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 500);
  camera.position.set(0, PLANET_R + 8, PLANET_R + 14);
  camera.lookAt(0, PLANET_R, 0);
  let last = performance.now();
  (function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (G.state === 'playing' || G.state === 'shop') update(dt);
    render();
  })(performance.now());
}
```

Note: `update(dt)` runs during `'shop'` too (crops keep growing behind the dimmed panel), but Task 8's raid director must not start a raid while `G.state === 'shop'`. Add `resize` listener updating camera aspect + renderer size.

- [ ] **Step 4: Verify in browser**

Run: `python -m http.server 8000` (repo root), open `http://localhost:8000/games/galaxy-farmer.html`.
Expected: dark page, start-screen div visible (unstyled ok), zero console errors. Block the CDN (DevTools → Network → block request) and reload: the no-internet overlay shows.

- [ ] **Step 5: Commit**

```powershell
git add games/galaxy-farmer.html; git commit -m "feat(galaxy-farmer): scaffold renderer and game loop"
```

### Task 2: Planet, decorations, house, launch pad, lighting, starfield

**Files:**
- Modify: `games/galaxy-farmer.html`

**Interfaces:**
- Consumes: `scene`, `PLANET_R`.
- Produces:
  - `placeOnSurface(obj, dir, yaw = 0, height = 0)` — positions/orients any Object3D on the sphere (used by every later task).
  - `world = { houseDir: Vector3, houseDoorDir: Vector3, padDir: Vector3, planet: Mesh }` — key surface anchor directions (unit vectors). House sits at `(0,0.35,1).normalize()`; launch pad on the far side at `(0,0.2,-1).normalize()`.
  - Lights: `sunLight` (DirectionalLight 0xfff2d8, 1.1), `moonLight` (DirectionalLight 0x8899ff, 0.25, initially intensity 0), `ambient` (AmbientLight 0x445566, 0.7), `houseLamp` (PointLight 0xffc76a, 0, 8) at the house door.
  - `starfield` — `THREE.Points` of ~800 stars on a radius-300 shell, material with `transparent:true` (Task 9 animates opacity).

- [ ] **Step 1: Surface placement helper**

```js
const _Y = new THREE.Vector3(0, 1, 0);
function placeOnSurface(obj, dir, yaw = 0, height = 0) {
  const d = dir.clone().normalize();
  obj.position.copy(d).multiplyScalar(PLANET_R + height);
  obj.quaternion.setFromUnitVectors(_Y, d);
  obj.rotateY(yaw);
}
```

- [ ] **Step 2: Planet mesh**

`IcosahedronGeometry(PLANET_R, 4)` with vertex colors: base grass green `0x4a9e5c` with random per-vertex jitter; dirt patches `0x8a6a4a` around `world.houseDir` (the farm region, dot(vertexDir, houseDir) > 0.92); `MeshLambertMaterial({ vertexColors: true })`.

- [ ] **Step 3: Decorations, house, pad**

~14 rocks (gray dodecahedra, random scale 0.3–0.9) and ~10 trees (brown cylinder + 2 stacked green cones) scattered at random dirs, but skipped inside the farm region (dot > 0.9 with houseDir) and pad region (dot > 0.95 with padDir). House at `world.houseDir`: box body 3×2.5×3 warm tan, pyramid roof (4-sided cone) rust red, door plane on the side facing the farm region, two emissive window planes (material saved as `houseWindowMat`, emissiveIntensity 0 by day). `world.houseDoorDir` = house dir nudged toward the farm center and normalized (used for proximity + respawn point). Launch pad at `world.padDir`: flat gray cylinder radius 3.5 + 4 small corner lights.

- [ ] **Step 4: Lighting + starfield**

Add the 4 lights (sun at `(60,40,30)` pointing at origin — Task 9 orbits it), and the starfield Points shell.

- [ ] **Step 5: Verify in browser**

Static camera from Task 1 shows: colorful planet with dirt farm patch, house with roof/door/windows, pad on the horizon edge, rocks/trees, stars behind. 60fps, no console errors.

- [ ] **Step 6: Commit** — `git commit -m "feat(galaxy-farmer): planet, house, pad, lighting"`

### Task 3: Player surface movement + third-person follow camera

**Files:**
- Modify: `games/galaxy-farmer.html`

**Interfaces:**
- Consumes: `PLANET_R`, `placeOnSurface`, `world`, `camera`, `G.state`.
- Produces:
  - `player = { q: THREE.Quaternion, pos: Vector3, mesh: Group, hp: 100, maxHp: 100, speed: 6, lastHurt: 0 }` — `player.q` is the single source of truth; `player.pos` derived each frame.
  - `playerUp(out)`, `playerForward(out)` — local frame vectors.
  - `stepOnSphere(q, targetDir, speed, dt)` — great-circle stepper, reused by walking aliens (Task 8).
  - `updatePlayer(dt)`, `updateCamera(dt)`, `keys` keydown map, `cam = { yaw: 0, pitch: 0.35, dragging: false }`.
  - `movePlayerToDir(dir)` — teleport helper (respawn at house).

- [ ] **Step 1: Player mesh + local frame**

Astronaut-farmer Group at origin: capsule-ish body (cylinder 0.35r × 0.9h, white), sphere helmet (0.32r, glassy light blue, slight transparency), small orange backpack box, two dark leg cylinders. Total height ~1.5, feet at y=0 within the group.

```js
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q1 = new THREE.Quaternion();
function playerUp(out)      { return out.set(0, 1, 0).applyQuaternion(player.q); }
function playerForward(out) { return out.set(0, 0, 1).applyQuaternion(player.q); }
```

Initialize `player.q` so the player starts near the house: `player.q.setFromUnitVectors(_Y, world.houseDoorDir)` then rotate slightly.

- [ ] **Step 2: Movement (quaternion orbit)**

```js
const TURN_SPEED = 2.6; // rad/s
function updatePlayer(dt) {
  const turn = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const fwd  = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  if (turn) player.q.premultiply(_q1.setFromAxisAngle(playerUp(_v1), -turn * TURN_SPEED * dt));
  if (fwd) {
    const right = _v1.set(1, 0, 0).applyQuaternion(player.q);
    player.q.premultiply(_q1.setFromAxisAngle(right, fwd * (player.speed * dt) / PLANET_R));
  }
  player.pos.set(0, 1, 0).applyQuaternion(player.q).multiplyScalar(PLANET_R);
  player.mesh.position.copy(player.pos);
  player.mesh.quaternion.copy(player.q);
}
```

If W walks backward or A/D turn the wrong way during verification, flip the corresponding sign. Simple walk-cycle: bob the mesh `+0.06*sin(t*10)` along up while moving.

```js
function stepOnSphere(q, targetDir, speed, dt) { // shared with alien walkers
  const up = _v1.set(0, 1, 0).applyQuaternion(q);
  const axis = _v2.crossVectors(up, targetDir);
  if (axis.lengthSq() < 1e-8) return;
  axis.normalize();
  const step = Math.min(speed * dt / PLANET_R, up.angleTo(targetDir));
  q.premultiply(_q1.setFromAxisAngle(axis, step));
}
```

- [ ] **Step 3: Follow camera + right-drag orbit**

```js
const CAM_DIST = 7, CAM_HEIGHT = 3.2;
function updateCamera(dt) {
  const up = playerUp(new THREE.Vector3());
  const fwd = playerForward(new THREE.Vector3());
  const offset = fwd.clone().multiplyScalar(-CAM_DIST).addScaledVector(up, CAM_HEIGHT + CAM_DIST * cam.pitch);
  offset.applyAxisAngle(up, cam.yaw);
  const ideal = player.pos.clone().add(offset);
  camera.position.lerp(ideal, 1 - Math.pow(0.0001, dt));
  camera.up.copy(up);
  camera.lookAt(player.pos.clone().addScaledVector(up, 1.5));
}
```

Right-mouse-drag (`contextmenu` preventDefault; on mousedown button 2 set `cam.dragging`) adjusts `cam.yaw` (±π) and `cam.pitch` (clamp 0.05–0.9); on release, ease `cam.yaw` back to 0 at 3 rad/s.

- [ ] **Step 4: Verify in browser**

Set `G.state='playing'` temporarily on load. Walk fully around the planet in all directions (no gimbal flips or jitter at poles), turn with A/D, camera stays smoothly behind with correct "up", right-drag looks around and eases back. Walk past the house — no clipping concerns needed (no collision in this game; house/rocks are avoidable visually). No console errors.

- [ ] **Step 5: Commit** — `git commit -m "feat(galaxy-farmer): player sphere movement and follow camera"`

### Task 4: Farming — plots, crops, contextual clicks, inventory

**Files:**
- Modify: `games/galaxy-farmer.html`

**Interfaces:**
- Consumes: `placeOnSurface`, `world`, `player`, `camera`, `G.state`.
- Produces:
  - `CROPS` — object keyed by id (exact table below), each `{ id, name, icon, growTime, seedCost, sellPrice, color }`.
  - `G.money = 20`; `earn(n)` (adds + updates HUD + `G.stats.earned += n`), `spend(n)` (returns false + toast if short). (Defined here so tilling can charge a fee; the shop in Task 5 reuses them.)
  - `plots` — array of 12 `{ dir: Vector3, state: 'locked'|'untilled'|'empty'|'growing'|'ready', cropId, growth (0..1), watered: bool, redried: bool, group: Group }`. First 4 start `'untilled'`; the rest `'locked'` until Field Expansion (Task 5). `TILL_COST = 10` — clicking an untilled spot pays the fee and tills it into an `'empty'` plot (spec: pay a small fee to create a plot).
  - `inventory = { seeds: { wheat: 2, berry: 0, carrot: 0, melon: 0, pumpkin: 0 }, produce: { wheat: 0, berry: 0, carrot: 0, melon: 0, pumpkin: 0 } }`.
  - `G.selectedSeed = 'wheat'`; seed bar DOM `#seed-bar` (5 cells: icon + count; keys `Digit1..5` or click select; locked look when count 0).
  - `pickWorld(e)` — raycast from mouse event; returns `{ kind: 'plot'|'door'|'enemy'|'star'|'space', ref, point }` by walking up `.parent` chain for `userData.pick` (enemies/star wired in Tasks 7–9; until then those kinds never match).
  - `interactPlot(plot)`, `updatePlots(dt)`, `toast(msg)` (2s fading hint), `PLOT_RANGE = 4`.
  - `updateSeedBar()`, `G.stats = { harvests: 0, kills: 0, earned: 0 }`.

- [ ] **Step 1: Crop data (copy exactly)**

```js
const CROPS = {
  wheat:   { id:'wheat',   name:'Star Wheat',     icon:'🌾', growTime: 30,  seedCost: 5,   sellPrice: 12,  color: 0xe8d44a },
  berry:   { id:'berry',   name:'Moon Berry',     icon:'🫐', growTime: 60,  seedCost: 12,  sellPrice: 28,  color: 0x7a6aff },
  carrot:  { id:'carrot',  name:'Crystal Carrot', icon:'🥕', growTime: 100, seedCost: 30,  sellPrice: 70,  color: 0xff9a3c },
  melon:   { id:'melon',   name:'Nebula Melon',   icon:'🍈', growTime: 160, seedCost: 70,  sellPrice: 165, color: 0x5affb2 },
  pumpkin: { id:'pumpkin', name:'Void Pumpkin',   icon:'🎃', growTime: 240, seedCost: 150, sellPrice: 360, color: 0xb45aff },
};
```

- [ ] **Step 2: Plot meshes + states**

12 plot dirs in a 4×3 fan around `world.houseDir` (offset the house dir by small tangent rotations, ~2.6u apart on the surface — planet radius is 14, keep the whole fan inside the dirt patch, dot > 0.88, without overlapping the house). Each plot Group: soil box 1.6×0.25×1.6 (locked = barely visible dark ring; untilled = grassy mound with a faint dashed ring + hovering `+` sprite; empty dry soil 0xa8845a; watered soil 0x6a4a30), plus crop mesh slot. Crop visuals per growth stage: sprout (<0.4: small green cone), mid (<1: taller cone + tinted sphere bud), ready (colored sphere/box sized by crop, slight emissive pulse). Dry planted crops show a 💧 sprite above. `userData.pick = { kind: 'plot', ref: plot }` on the group.

`updatePlots(dt)`: for each growing plot, if `watered` advance `growth += dt / CROPS[cropId].growTime`; at `growth >= 0.5 && !redried` set `watered = false, redried = true` (needs one more watering); at `growth >= 1` state = `'ready'`. Rebuild/swap stage mesh when stage changes.

- [ ] **Step 3: Click routing + contextual action**

`mousedown` (button 0): ignore if `G.state !== 'playing'`. `pickWorld(e)` → if `kind === 'plot'`: if player surface distance to plot > `PLOT_RANGE` (angle between dirs × PLANET_R) → `toast('Walk closer to the plot')`; else `interactPlot(plot)`:
- `locked` → `toast('Buy Field Expansion at the house')`
- `untilled` → if `spend(TILL_COST)` state=`'empty'` (small dirt burst)
- `empty` → if `inventory.seeds[G.selectedSeed] > 0` sow it (decrement, state=growing, growth=0, watered=false, redried=false) else `toast('No ' + CROPS[G.selectedSeed].name + ' seeds — buy at the house')`
- `growing` + `!watered` → water it (soil darkens, small splash of blue particles later)
- `growing` + watered → `toast('Growing…')`
- `ready` → harvest: `inventory.produce[cropId]++; G.stats.harvests++;` state=empty

Other kinds fall through (Task 7 handles shooting on `space`).

- [ ] **Step 4: Verify in browser**

Click an untilled spot → 10 coins deduct and soil appears (money starts at 20, so only 2 tills possible — expected). Plant wheat (2 starting seeds); 💧 shows; click to water; sprout → mid; re-dries at 50%; water again; ready glows; harvest increments seed bar/produce (check via console `inventory`). Locked plots and far plots toast correctly. Keys 1–5 switch selected seed. No console errors.

- [ ] **Step 5: Commit** — `git commit -m "feat(galaxy-farmer): plots, crops, farming interactions"`

### Task 5: House shop, economy, upgrades, HUD

**Files:**
- Modify: `games/galaxy-farmer.html`

**Interfaces:**
- Consumes: `inventory`, `CROPS`, `plots`, `player`, `world.houseDoorDir`, `pickWorld`, `G.stats`, `G.money`/`earn`/`spend` (Task 4).
- Produces:
  - `UPGRADES` and `SHIP_PARTS` tables (exact below); `G.upgrades = { gunDmg: 0, gunRate: 0, boots: 0, field: 0, sprinkler: false }`; `G.partsOwned = 0`.
  - `openShop()` / `closeShop()` — sets `G.state = 'shop'` / `'playing'`; DOM `#shop-panel` with 4 tabs: Seeds, Sell, Upgrades, Spaceship.
  - `buyPart()` — buys part index `G.partsOwned` (strictly in order); calls `updateShipVisual()`, and `startLaunchSequence()` after the 5th part (both implemented in Task 6; define empty stubs now).
  - `updateHUD()` — money 🪙, HP bar width, day counter.
  - Boots upgrade sets `player.speed = [6, 7.5, 9][G.upgrades.boots]`; field upgrade flips plots 5–8 then 9–12 from `'locked'` to `'untilled'`; sprinkler flag read by `updatePlots` (auto-set `watered = true` whenever dry).

- [ ] **Step 1: Data tables (copy exactly)**

```js
const UPGRADES = [
  { id:'gunDmg',    name:'Blaster Power',   icon:'🔫', levels:[100, 300], desc:'Damage 10 → 16 → 24' },
  { id:'gunRate',   name:'Rapid Trigger',   icon:'⚡', levels:[100, 300], desc:'Fire rate up' },
  { id:'boots',     name:'Speed Boots',     icon:'👢', levels:[80, 240],  desc:'Walk speed 6 → 7.5 → 9' },
  { id:'field',     name:'Field Expansion', icon:'🏞️', levels:[150, 400], desc:'+4 farm plots each' },
  { id:'sprinkler', name:'Auto Sprinkler',  icon:'💦', levels:[500],      desc:'Crops never dry out' },
];
const SHIP_PARTS = [
  { name:'Frame',             icon:'🏗️', cost: 300 },
  { name:'Engine',            icon:'🔥', cost: 800 },
  { name:'Fuel Tank',         icon:'🛢️', cost: 1500 },
  { name:'Cockpit',           icon:'🪟', cost: 2500 },
  { name:'Navigation Module', icon:'🧭', cost: 4000 },
];
```

- [ ] **Step 2: Shop open/close + panel**

Clicking the house door (`pickWorld` kind `'door'` — add `userData.pick` to the door plane in Task 2's house) or pressing `E` while within 4u of `world.houseDoorDir` opens the shop. Dimmed overlay panel, 4 tab buttons, close button + `Esc`. **Seeds tab:** 5 rows (icon, name, grow time, seed cost, sell price, Buy button; disabled when money short). **Sell tab:** rows per produce with count, unit price, Sell 1 / Sell All buttons; total banner. **Upgrades tab:** rows from `UPGRADES` showing current level, next price or MAX. **Spaceship tab:** the 5 parts as a vertical checklist — owned ✓ green, next one has a Buy button, later ones grayed "Requires previous part". Buying part 5 closes the shop and triggers launch (Task 6).

- [ ] **Step 3: HUD**

Top-left: 🪙 money + day counter (`Day N` with ☀️/🌙 icon — day counter increments in Task 9; show `Day 1` ☀️ static for now). Top-right: HP bar. Bottom-center: seed bar (Task 4). Wire `updateHUD()` into earn/spend/damage.

- [ ] **Step 4: Verify in browser**

Full loop: harvest wheat → walk to house → sell → buy berry seeds → plant. Buy Speed Boots (walk visibly faster), Field Expansion (plots 5–8 unlock visually), sprinkler behavior (crops never show 💧). Buy Frame — money deducts, Spaceship tab shows ✓ and Engine as next. Money can never go negative. `E` near door opens shop; `Esc` closes. No console errors.

- [ ] **Step 5: Commit** — `git commit -m "feat(galaxy-farmer): shop, economy, upgrades, HUD"`

### Task 6: Spaceship assembly, launch sequence, victory

**Files:**
- Modify: `games/galaxy-farmer.html`

**Interfaces:**
- Consumes: `world.padDir`, `placeOnSurface`, `G.partsOwned`, `camera`, `G.stats`.
- Produces: `shipGroup` at the pad with 5 sub-meshes; real `updateShipVisual()` (shows meshes 0..partsOwned-1 solid, next one as faint wireframe ghost); `startLaunchSequence()` (sets `G.state='launch'`); victory screen DOM with stats + Play Again (calls `resetGame()` — full impl in Task 10; for now reload the page).

- [ ] **Step 1: Ship meshes**

On the pad, bottom-up: Frame (gray lattice-look cylinder 1.2r × 2h), Engine (dark cone cluster below-frame nozzles + orange emissive rings), Fuel Tank (two side cylinders, rust orange), Cockpit (light blue glass sphere-cap top), Navigation (small dish + antenna + blinking red light). Unowned next part renders as `wireframe:true` ghost material; parts beyond next are invisible.

- [ ] **Step 2: Launch sequence (~8s scripted)**

`startLaunchSequence()`: hide HUD; walk is disabled (`G.state='launch'` skips player input); camera slerps to a side view of the pad; engine glow ramps + particle exhaust (reuse Task 9 `burst` if present, else simple scaling emissive cone); ship accelerates along `padDir` outward with slight wobble; screen fades white at ~6s; then show `#victory-screen`: "YOU BUILT THE SPACESHIP!" + stats (days survived, total money earned, aliens defeated, harvests) + Play Again button.

- [ ] **Step 3: Verify in browser**

Temporarily set money to 99999 via console, buy all 5 parts in order — each visibly appears on the pad, ghost preview advances. Final purchase → launch cinematic plays smoothly → victory screen with correct stats → Play Again restarts. No console errors.

- [ ] **Step 4: Commit** — `git commit -m "feat(galaxy-farmer): spaceship assembly, launch, victory"`

### Task 7: Raygun combat, bullets, player HP & respawn

**Files:**
- Modify: `games/galaxy-farmer.html`

**Interfaces:**
- Consumes: `player`, `camera`, `pickWorld`, `G.upgrades`, `world.houseDoorDir`, `updateHUD`.
- Produces:
  - `enemies = []` (filled in Task 8; bullets already collide against it).
  - `gunStats()` → `{ damage: [10,16,24][G.upgrades.gunDmg], cooldown: [0.35,0.27,0.2][G.upgrades.gunRate] }`.
  - `shootAt(worldPoint)` — spawns a pooled bullet from the player's chest toward the point (speed 45, life 2s, dies below surface `pos.length() < PLANET_R + 0.2`); green emissive tracer sphere 0.12r.
  - `updateBullets(dt)` — moves bullets, sphere-vs-sphere tests against `enemies` (per-enemy `radius`), calls `damageEnemy(e, dmg)` (Task 8; define stub `function damageEnemy(){}` now); also tests `starEvent` (Task 9).
  - Aim assist: on click, before world raycast, project alive enemies to screen space; if one is within 36px of the cursor, aim at its position instead.
  - `damagePlayer(n)` (HP, hurt flash, `player.lastHurt`), passive regen 5 HP/s once 5s past `lastHurt`; `downPlayer()` → `G.state='downed'`, `#downed-screen` for 3s ("You were knocked out… −10% coins"), `G.money = Math.floor(G.money * 0.9)`, respawn via `movePlayerToDir(world.houseDoorDir)`, HP full, back to `'playing'`.
  - Click routing update: `kind 'enemy'` or `'star'` or `'space'` (planet ground / sky, not a plot/door in range) → `shootAt(point)`.

- [ ] **Step 1: Implement pool (60 bullets), shooting, cooldown, muzzle flash sprite, hit spark**
- [ ] **Step 2: Implement HP / regen / downed / respawn flow**
- [ ] **Step 3: Verify in browser**

Click around: tracers fly from player toward click point, die on the planet surface. Held/rapid clicking respects cooldown. `damagePlayer(30)` via console → HP bar drops, red vignette flash, regen kicks in after 5s. `damagePlayer(999)` → downed overlay, respawn at house with 90% money. No console errors.

- [ ] **Step 4: Commit** — `git commit -m "feat(galaxy-farmer): raygun, bullets, player HP and respawn"`

### Task 8: Aliens — 8 variants, raid director, coin pickups

**Files:**
- Modify: `games/galaxy-farmer.html`

**Interfaces:**
- Consumes: `stepOnSphere`, `placeOnSurface`, `player`, `plots`, `damagePlayer`, `bullets`/`updateBullets`, `earn`, `G.partsOwned`, `toast`, banner hook `showBanner(text)` (simple version here; styled in Task 9).
- Produces:
  - `ALIENS` table (exact below); `enemies` populated with `{ type, q or airPos, hp, maxHp, mesh, radius, state, target, timers }`.
  - `spawnAlien(typeId)` (random dir ≥ 45° from player, teleport-in green flash), `updateEnemies(dt)`, real `damageEnemy(e, n)` (flash white, health bar sprite above head, death = burst + coins).
  - Raid director: `G.raid = { next: 75, active: false, count: 0 }` — countdown while playing (paused during `'shop'`); at 5s remaining `showBanner('⚠ Alien raid incoming!')`; spawn `2 + 2*G.partsOwned` aliens (cap 12 alive) from the unlocked pool; when all dead, `next = 60 + Math.random()*60`.
  - Variant pool by progress: parts 0 → grunt, hopper; parts 1 → + raider, spitter; parts 2–3 → + brute, shieldbearer; parts 4 → + summoner, ufo. HP scales ×(1 + 0.15 × partsOwned).
  - `pickups = []` — `{ kind: 'coin'|'seed'|'produce', id?, value?, mesh, dir }` on the surface; magnet toward player within 3u, collect at 1.2u (coin → `earn`, seed/produce → inventory + toast). `dropCoins(dirOrPos, total)` splits into 1–4 spinning gold coin meshes.

- [ ] **Step 1: Alien data + builds (copy exactly; low-poly primitive builds, emissive accents, health bar sprites)**

| id | look | hp | speed | attack | coins | behavior |
|----|------|----|-------|--------|-------|----------|
| grunt | green capsule, antenna eyes | 25 | 3.5 | melee 8 dmg / 1s within 1.5u | 4 | walk at player (`stepOnSphere` toward player up-dir) |
| hopper | yellow ball, big legs | 10 | 6 | melee 5 dmg | 3 | hops: move only during 0.4s hop bursts with 0.5s pauses, random ±40° zigzag toward player |
| raider | purple slim, sack | 20 | 5 | steals crops | 8 | walk to nearest growing/ready plot → 1s grab → plot becomes empty, then ascends radially +12u over 3s and despawns; killed while carrying → drops the produce as a pickup |
| spitter | olive cone, single eye | 22 | 2.5 | acid glob 6 dmg / 2.5s | 6 | keeps 8–12u surface distance, lobs hostile projectile (reuse bullet pool with `hostile:true`, hits player within 1u) |
| brute | red wide box stack | 120 | 1.8 | melee 20 dmg; plot smash | 15 | walks to nearest planted plot, 1.5s wind-up smash → crop destroyed (plot stays, stays empty); attacks player only if within 2u |
| shieldbearer | blue + front shield plate | 40 | 3 | melee 12 dmg | 10 | like grunt, but bullets hitting the front 120° arc (dot(bulletVel.normalized · alienForward) < −0.5) spark and deal 0 damage |
| summoner | pink jellyfish, floats 2u up | 50 | 2 | none | 18 | drifts slowly toward farm; every 6s spawns a grunt nearby (max 3 of its grunts alive) |
| ufo | silver saucer + dome, floats 6u up | 60 | 4 | crop abduction | 25 | flies (position = dir × (PLANET_R+6), lerp between targets) above a growing/ready plot, 4s tractor beam (translucent cyan cone) → crop abducted (plot empty); then next plot |

- [ ] **Step 2: Raid director + spawn/despawn + banner + coins/pickups**
- [ ] **Step 3: Verify in browser**

Force-spawn each variant via console and confirm its behavior matches the table (raider steals and drops on kill, shieldbearer blocks frontal shots but dies to flanks, summoner keeps making grunts, UFO beams a crop away). Let a natural raid trigger: banner → wave → clear → coins magnet in → next raid timer. Downed flow still works under melee pressure. 60fps with 12 aliens. No console errors.

- [ ] **Step 4: Commit** — `git commit -m "feat(galaxy-farmer): 8 alien variants and raid director"`

### Task 9: Day/night cycle, shooting star event, VFX polish

**Files:**
- Modify: `games/galaxy-farmer.html`

**Interfaces:**
- Consumes: `sunLight`, `moonLight`, `ambient`, `houseLamp`, `houseWindowMat`, `starfield`, `scene.background`, `bullets`, `dropCoins`, `showBanner`.
- Produces:
  - `G.tod` (0–1, full cycle 150s; 0–0.5 day, 0.5–1 night), `G.day = 1` (increments at each cycle wrap; HUD day counter + ☀️/🌙 icon live).
  - `updateDayNight(dt)` — orbits sun/moon around the planet (opposite sides, axis tilted ~25°); lerps `scene.background` between `0x0a0f1e` (night) and `0x16294a` (day); ambient 0.7↔0.35; starfield opacity 0.35↔1; at night `houseLamp.intensity = 1.2` and window emissive on. **No gameplay values read `G.tod`.**
  - Star event: every 100–180s (while playing), a bright glowing star (sprite + point light) arcs across the sky ~30u out over 15s with a soft twinkle; `userData.pick = { kind:'star' }`; any bullet hit bursts it → 3 coin pickups (10–25 each) rain to the surface below + 30% chance a melon or pumpkin seed pickup; expires with a fade if ignored. `showBanner('💫 A shooting star!')` on spawn.
  - `burst(pos, color, count)` — pooled `THREE.Points` particle burst (cap 1000); wire into: bullet impacts, alien deaths, harvest pops, watering splash, plot smash, launch exhaust.
  - Styled `#banner` (slide-in top-center, auto-hide 3s) replacing the simple Task 8 version.

- [ ] **Step 1: Implement day/night + day counter**
- [ ] **Step 2: Implement star event + particle system + banner styling; wire bursts into existing events**
- [ ] **Step 3: Verify in browser**

Watch a full 150s cycle: smooth dusk/dawn, stars fade in, lamp/windows glow at night, day counter ticks. Star event appears, is shootable (loot rains and can be picked up), or leaves on its own. Particles on shooting/harvest/death look right at 60fps. No console errors.

- [ ] **Step 4: Commit** — `git commit -m "feat(galaxy-farmer): day-night, shooting star, particles"`

### Task 10: Save system + start/pause/help screens + reset

**Files:**
- Modify: `games/galaxy-farmer.html`

**Interfaces:**
- Consumes: all game state.
- Produces:
  - `SAVE_KEY = 'galaxy-farmer-save-v1'`; `saveGame()` — serializes `{ v: 1, money, day, tod, inventory, upgrades, partsOwned, stats, hp, plots: plots.map(p => ({ state, cropId, growth, watered, redried })) }`; autosave every 10s while playing + after every purchase/sale/harvest/raid end.
  - `loadGame()` — try/catch JSON parse; on any error or `v !== 1`, delete the key and return null (spec: corrupt saves discarded gracefully). Applies save: rebuild plot visuals, ship visual, HUD, `player.speed` from boots.
  - `resetGame()` — clears the key and restores pristine state (used by Reset Save buttons and victory Play Again; replace Task 6's page-reload).
  - Screens: start screen (animated title "🌱 GALAXY FARMER 🚀", 5-line how-to: WASD walk · click = shoot · Space = interact with highlighted plot/house · build the spaceship to win, Start button, Continue button only when a save exists, Reset Save link), pause overlay on `Esc`/`P` while playing (Resume / Help / Reset Save), help panel (controls, crop table, alien gallery, tips), downed screen already exists.

- [ ] **Step 1: Implement save/load/reset + autosave hooks**
- [ ] **Step 2: Build screens + state wiring** (menu→playing; playing↔paused; shop and panels layered correctly; `Esc` priority: close shop > close help > pause)
- [ ] **Step 3: Verify in browser**

Play a few minutes (money, crops mid-growth, one part), reload page → Continue restores everything (growth %, watered flags, ship part visible). Corrupt the save via console (`localStorage.setItem('galaxy-farmer-save-v1','{oops')`), reload → fresh start, no crash. Reset Save works from start and pause. Victory Play Again fully resets. No console errors.

- [ ] **Step 4: Commit** — `git commit -m "feat(galaxy-farmer): save system and all UI screens"`

### Task 11: Hub + README registration, full playtest

**Files:**
- Modify: `index.html` (append to the games array, matching the existing entry shape used by neighbors)
- Modify: `README.md` (add list entry)

**Interfaces:**
- Consumes: finished `games/galaxy-farmer.html`.

- [ ] **Step 1: Register** — hub entry with `path: "games/galaxy-farmer.html"` and Vietnamese description matching neighbors' style: `galaxy-farmer.html - Trồng trọt trên hành tinh nhỏ, chống người ngoài hành tinh và xây phi thuyền.` README gets the same line.
- [ ] **Step 2: Full playtest checklist (from spec)** — walk fully around the planet; full farm cycle for all 5 crops; shop buy/sell/every upgrade; all 8 alien behaviors observed; star event looted; save/load across reload; day/night visuals; full economy run to launch + victory (money cheat allowed for the tail end, but verify early game is beatable honestly); CDN-fail overlay; hub page links to the game; console clean.
- [ ] **Step 3: Commit** — `git commit -m "feat: add Galaxy Farmer to game collection"`
