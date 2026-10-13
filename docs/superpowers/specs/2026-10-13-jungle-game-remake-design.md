# Cờ Thú remake — isometric pixel-art diorama (design)

Date: 2026-10-13
Source game: `games/jungle-game.html` (Cờ Thú / Jungle, 7×9, 2-player hot-seat)
Target: `games/jungle-game-remake/` (folder game)
Art references: `reference/image01.png`, `reference/image02.png` (iso block terrain, props),
`reference/color.png` (palette and pixel treatment — lighter, lime/turquoise)

## Intent

Remake Cờ Thú as a 2D-looking isometric pixel-art game. The scene is built from detailed
procedural voxel models in Three.js and rendered through a pixel-art post-process. Gameplay
must be **identical** to the original; animation is richer. Success:

1. Every rule outcome matches the original (proven by a parity test).
2. On first sight it reads as pixel art in the `color.png` palette, not as "3D with a filter".
3. All eight animals are recognisable voxel models (no emoji on the board).

## Decisions (agreed)

| Topic | Decision |
|---|---|
| Models | Procedural voxels built in code, merged per body part; no asset files |
| Three.js | ES module from CDN via import map, pinned `three@0.160.0`, with failure fallback |
| Hub | Added as a **new** card; original `jungle-game.html` stays |
| Camera | **Fixed** orthographic isometric view only (no rotate, zoom or pan) |
| Capture FX | **Gory**: full pixel blood spray + lingering stains, as in the original |
| Pixel pipeline | Low-res render target → post shader (palette, outlines, dither) → nearest upscale |
| Language | Vietnamese UI copy, carried over from the original |
| Sound | Original Web Audio synth unchanged; mute key `coThu.muted` |

## Gameplay — exact parity with the original

Ported 1:1 from `games/jungle-game.html` lines 792–1330, quirks included:

- Board 9 rows × 7 cols. Water at rows 3–5, cols 1,2 and 4,5. Traps `[0,2] [0,4] [1,3]`
  (red's) and `[8,2] [8,4] [7,3]` (blue's). Dens `[0,3]` (red) and `[8,3]` (blue).
- Starting layout = `initialPieces` from the original, unchanged. Red moves first.
- Orthogonal one-step moves. Only the rat enters water. Tiger jumps vertically, leopard
  horizontally, lion both, across the whole water run; any rat (either side) in the path
  blocks the jump. Jump may land on and capture an enemy if `canCapture` allows.
- `canCapture(attacker, defender, r, c)`: if exactly one of them stands in water → false;
  rat beats elephant; elephant cannot take rat; defender on an **enemy** trap (red at
  row ≥ 7, blue at row ≤ 1) can be taken by anything; otherwise rank ≥ rank.
- A piece may not enter its own den. Entering the enemy den wins immediately. Capturing the
  last enemy piece wins.
- Interaction semantics of `handlePieceClick` / `handleCellClick`: clicking your own piece
  selects it, clicking it again deselects it; with a selection, clicking an enemy piece either
  captures it (if valid) or shows "Nước đi không hợp lệ"; clicking a valid empty cell moves there.
  Clicking an empty invalid cell does nothing.
- Same messages as the original (capture, trap, restart, win reasons).

## Architecture

```
games/jungle-game-remake/
  index.html      HUD markup (Vietnamese copy), import map, boot guard + fallback card
  style.css       light pixel-UI HUD in the color.png palette
  js/
    rules.js      DOM-free game logic + applyMove() event list
    voxel.js      voxel builder: char-grid layers → merged BufferGeometry, vertex colours, baked AO
    palette.js    the ~32-colour palette (hex + vec3 array for the shader)
    models.js     8 animals (articulated parts), terrain blocks, water, traps, dens, props
    scene.js      board + island composition, lights, ortho camera, ambient life
    pixel.js      low-res render target, post-process shader, resize handling
    fx.js         tween/timeline system, particles (instanced, pooled), shake, stains
    anim.js       per-animal idle rigs and move/jump/swim/capture/trap/win sequences
    audio.js      original Sound module, verbatim
    main.js       boot, picking, input lock, rules → animation dispatch, HUD updates
tests/jungle-remake-rules.test.mjs
```

### `rules.js` (pure ES module, no DOM, no Three)

Exports `ROWS`, `COLS`, `ANIMALS`, `terrain`, `initialPieces`, and a `createGame()` returning a
state object with:

- `pieces`, `currentPlayer`, `gameOver`, `winner`
- `getValidMoves(piece)` → `[{row, col, capture?, jump?}]` — same algorithm as the original
- `applyMove(piece, row, col)` → ordered event list, mutating state:
  - `{type:'move'|'jump'|'swim', piece, from, to}` (`swim` when a rat's destination or
    origin is water)
  - `{type:'capture', attacker, victim, at, inWater, heavy, ratElephant}`
  - `{type:'trap', piece, at}` when landing on any trap (original fires the effect on every trap)
  - `{type:'win', player, reason}` with the original's Vietnamese reason strings
  - `{type:'turn', player}` otherwise
- `restart()`

Pieces carry a stable `id` so the renderer can map them to models.

### Rendering pipeline (`pixel.js`)

- `OrthographicCamera` at true isometric (yaw 45°, pitch ≈ 35.264°), framing the island.
- Scene renders into a `WebGLRenderTarget` sized `floor(canvasCSS / scale)`, where
  `scale` is an integer (3–4 desktop, 2 on narrow screens); `NearestFilter`, with a depth
  texture and a normal pass (MeshNormalMaterial override, same low-res size) for edges.
- Fullscreen post shader:
  1. **Outlines** — depth/normal discontinuity → outer edge = darkened colour (~45 %
     luminance) of the pixel's own colour; inner top-facing edges get a lighter highlight.
  2. **Dither** — 4×4 Bayer applied only around luminance band boundaries.
  3. **Palette snap** — nearest colour in the palette (perceptual-ish weighted RGB).
- Output to the canvas at `scale`× with `image-rendering: pixelated`.
- Selection/move-hint markers are scene meshes, so they are pixelated with everything else.
- Moving objects are rendered with positions snapped to the low-res pixel grid in screen
  space to keep motion crisp.

### Palette (`palette.js`)

About 32 colours sampled toward `color.png`: limes `#e4f75a #c7f02a #8ed11f #5fae22 #3d7f24`,
turquoise water `#bff3ea #8fe6dd #5fd3c9 #3fb3b0`, earth `#d9955a #a8673a #7a4a2c #5a3a24
#3b2618`, stone `#e8e6dc #b9b7ad #85847e #55554f`, plus animal tones (rat grey, cat cream,
dog tan, wolf blue-grey, leopard gold, tiger orange, lion ochre, elephant slate), team red
`#e2523f #a8302a`, team blue `#3f8fe2 #2a5ea8`, blood `#c8102e #7a0a1c`, white `#fffdf3`,
ink `#2b1d14`. Ambient/hemisphere light keeps shadows light (no near-black areas).

## Visual design

### Board and island

- Raised diorama: grass-topped voxel blocks with dirt sides (`color.png` look) floating in
  turquoise water. All play tiles sit at one height so readability never suffers.
- Land tiles: grass top with tuft/flower/pebble variety and occasional bare dirt patches
  (`image01`). Subtle per-tile shade variation to make the grid readable without lines.
- River pools: cut into the island, animated water shader (scrolling ripples, pale foam
  where water meets block edges); lily pads.
- Traps: worn stone slab + wooden snare with metal jaws; faint tint of the owner's colour.
- Dens: small mossy stone-ruin arch with ivy; red banner (top den) / blue banner (bottom den).
- Outer ring (non-playable): large pixel trees with layered canopies and hanging vines,
  bushes, mushrooms, rocks, fallen log, a torch beside each den, a small wooden dock,
  bamboo in outer water. Tall props stay outside the line of sight of back rows.
- Ambient life: swaying grass and leaves, drifting fish shadows, flickering torches,
  butterflies by day.

### Animals

Each 12–20 voxels tall, built from parts (body, head, 4 legs, tail, plus species extras) as
separate pivoted groups so they can be animated:

| Animal | Identity cues |
|---|---|
| Rat | grey, big round pink ears, long thin tail |
| Cat | cream/ginger, pointed ears, striped tail |
| Dog | tan, floppy ears, wagging tail |
| Wolf | blue-grey, bushy tail, long pointed snout |
| Leopard | gold with dark rosette spots |
| Tiger | orange with black stripes, white muzzle |
| Lion | ochre body, big dark mane |
| Elephant | slate, trunk, tusks, large ears (largest model) |

Team identity: coloured bandana/collar on the animal plus a team-coloured ring disc under
it. Red faces toward +row, blue toward −row. A small floating pixel rank badge (1–8) above
each piece mirrors the original's emphasis on rank.

### HUD (DOM, `style.css`)

Same content as the original: title "CỜ THÚ", sound/rules/restart buttons, turn banner
("Lượt: ĐỎ / XANH"), red and blue side panels with "ĐANG ĐI / CHỜ" and captured trays,
toast messages, end overlay, rules modal with the original rule list. Styled as chunky
light pixel panels (cream `#fffdf3` cards, brown ink borders, lime/turquoise accents,
2-px stepped corners); captured trays show small canvas snapshots of the voxel models.

## Animation

All rule state changes are instant in `rules.js`; `anim.js` replays the returned event
list as a timeline. Input is locked while a timeline runs.

- **Idle:** desynced breathing bob, blinks, tail swish, and an occasional species flourish
  (elephant ear flap + trunk swing, lion mane shake, cat paw lick, rat nose twitch, dog
  wag, wolf howl, tiger/leopard stretch). Active side idles slightly livelier.
- **Selection:** selected piece bounces, its ring pulses, bobbing arrow above. Valid moves
  show pulsing lime diamonds; captures show red diamonds with claw marks. Hovered tile
  lifts slightly with a pixel cursor.
- **Step:** turn to face, short hop arc, squash-and-stretch landing, dust puff.
- **Elephant step:** heavy stomp, soft shake + soft rumble (original behaviour).
- **River jump:** crouch, high arc with tracking shadow, hard landing, dust ring, heavy shake.
- **Rat swim:** dive splash, half-submerged swimming with ripple rings, dripping exit.
- **Capture (gory):** attacker crouches then lunges/pounces → hit-stop → defender flashes
  white, knocked back → ~60 pixel blood droplets/streaks erupt and fall under gravity →
  red pixel stains on the tile fading over ~5 s → defender topples and breaks into voxel
  chunks that scatter and fade; its icon flies into the captured tray. Tiger/lion/elephant
  attackers trigger heavy shake + rumble. Rat-takes-elephant adds a big pixel smoke cloud.
  In-water capture uses a red-tinted splash.
- **Trap:** jaws snap shut, sparks, piece flashes grey and stays slightly desaturated with
  a small "weakened" icon while on the enemy trap.
- **Win:** winner's victory leap, falling leaf/flower confetti, loser's pieces slump, slow
  camera push-in on the winner, then the original overlay + win jingle.
- **Restart:** pieces drop back onto their start cells in sequence with landing puffs.

Sounds fire at the same moments as the original (select, move, splash, capture(rank),
trap, rumble, win).

## Error handling

- Three.js import fails → boot guard shows a pixel card "Không tải được bộ máy 3D — kiểm tra
  kết nối và tải lại trang" with a retry button.
- No WebGL → same card, WebGL-specific message.
- Opened over `file://` → same card, hint to serve through a local server.
- `localStorage` access wrapped in try/catch; fall back to unmuted.
- Resize / DPR change → recompute integer `scale` and render-target size.

## Performance

- Voxels merged into one `BufferGeometry` per body part; static scenery merged per material.
- Particles via pooled `InstancedMesh` per effect type.
- Single 1024 shadow map, re-rendered only while something moves.
- Target 60 fps mid-range laptop, ≥ 30 fps phone.

## Testing

- `tests/jungle-remake-rules.test.mjs` imports `games/jungle-game-remake/js/rules.js`:
  starting layout; rat-only water entry; tiger vertical / leopard horizontal / lion both
  jumps; rat blocks jumps; land↔water no-capture; rat↔rat capture in water; rat beats
  elephant, elephant cannot take rat; enemy trap weakens, own trap does not; own den
  forbidden; den win; elimination win; `applyMove` event lists.
- **Parity test:** extract the original's rule functions from `games/jungle-game.html` into a
  `node:vm` context (globals stubbed), play thousands of seeded random legal moves from the
  start, and assert identical move lists and outcomes each turn.
- `node --check` on every `js/*.js`.
- Visuals are verified by the user playtesting at milestones (terrain + pixel pass →
  animals → move animations → captures/FX → full game). No automated browser driving;
  static checks = tests pass + HTTP 200 from a local Node server.

## Hub, README, CLAUDE.md

- New `games` entry in `index.html`: icon 🦁, title "Cờ Thú: Rừng Xanh", category "Board",
  tags `["Pixel art", "2 người", "Tiếng Việt"]`, distinct lime/turquoise gradient,
  `path: "games/jungle-game-remake/index.html"`.
- One line in `README.md`.
- CLAUDE.md: add the remake to the network-exceptions list (Three.js from CDN) and note it
  as a second folder game.

## Out of scope

AI opponent, online play, camera rotation/zoom, changes to rules, changes to the original
`jungle-game.html`.
