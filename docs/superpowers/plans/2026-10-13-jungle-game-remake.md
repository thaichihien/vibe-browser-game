# Cờ Thú: Rừng Xanh (jungle-game remake) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remake `games/jungle-game.html` as an isometric pixel-art voxel diorama in `games/jungle-game-remake/`, keeping the original's rules exactly and adding richer animation.

**Architecture:** A DOM-free `rules.js` (1:1 port of the original, proven by a parity test) returns event lists, and an animation layer replays them on procedurally built voxel models. Three.js renders the scene into a low-res target. A post-process shader (outline + crease highlight + Bayer dither + palette snap) produces the pixel look, and the result is upscaled by an integer factor with nearest-neighbour sampling.

**Tech Stack:** Vanilla ES modules, Three.js 0.160.0 from jsDelivr via an import map, Web Audio, and Node 22 `node:test` for tests.

**Spec:** `docs/superpowers/specs/2026-10-13-jungle-game-remake-design.md`

## Global Constraints

- No build step, no `package.json`, no npm dependencies. The only network request is `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js`, through an import map.
- `js/rules.js`, `js/voxel.js`, `js/palette.js` and `js/layout.js` must not import `three` and must not touch `document` or `window`, because the tests import them directly in Node.
- UI copy is Vietnamese and taken verbatim from `games/jungle-game.html` (rules list, messages, win reasons, button labels).
- The mute flag lives in `localStorage` under `coThu.muted`. Wrap every `localStorage` access in try/catch.
- No emoji are drawn on the board. Emoji are allowed only in the DOM HUD text, where the original copy uses them.
- Every colour comes from `C` in `js/palette.js`. `THREE.ColorManagement.enabled = false` is set in `js/mesh.js`, so hex values are display values.
- Tests: `node --test 'tests/*.test.mjs'` (the glob is required).
- Verification policy: static checks only, meaning tests pass, `node --check`, and an HTTP 200 from `npx http-server -p 8000 -c-1` (there is no python on this machine). **Never launch Playwright or any automated browser.** At each `PLAYTEST` step, stop and ask the user to play at <http://localhost:8000/games/jungle-game-remake/> and report back.
- Commits are conventional with scope `jungle-remake`. Bodies explain the need or failure, not just the change. Footer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never add a `Claude-Session:` trailer. Write the message to a temp file and use `git commit -F <file>`.
- Coordinates: a board cell `(row, col)` sits at world `x = col − 3`, `z = row − 4`, and the top of a board tile is `y = 0`. Red's home is row 0 (far from the camera) and Blue's is row 8 (near it). Animal voxels are 1/16 of a tile and terrain voxels are 1/8.

## Review Focus

1. **Restart pressed mid-animation**, including during the opening drop. Expected: the restart is queued and runs once the sequence ends, and pieces are never doubled or left half-dead. Owned by Task 7 (main.js `pendingRestart`), with the rules-side reset pinned in Task 1 (`restart after a finished game`).
2. **Tapping a river square.** Expected: it resolves to that water cell, not to the land square the y=0 ray lands on. Owned by Task 3 (`resolvePick`, tested) and Task 7 (two-plane pick).
3. **Phone-sized viewport (375×600).** Expected: integer scale floors at 2, the board stays framed and nothing scrolls sideways. Owned by Task 3 (`pickScale` tests) and Task 5 (`fitCamera`, playtest).
4. **A rat at the river's edge next to an enemy rat on land.** Expected: neither can capture the other, in either direction. Owned by Task 1 (`land and water pieces cannot capture each other`).
5. **Moves out of turn, after game over, or to illegal squares** reaching `applyMove`. Expected: it throws and leaves the state untouched. Owned by Task 1 (`illegal, out-of-turn and post-game moves throw`).

## Deviations from the spec (decided while planning)

- The shadow map re-renders every colour pass. Pieces idle constantly, so a "only while something moves" gate would never be off.
- The hover lift applies only to empty land, trap and den squares. Lifting a tile under a piece would bury its feet.
- The water material is unlit and does not receive shadows. The pools read as shaded because their own walls frame them.
- Jump landings get a visual-only shake with no rumble sound, so sounds fire exactly where the original fires them.
- Den banners hang on the pillars' outer faces, not under the lintel, so pieces walking through the arch never clip the cloth.
- The palette has about 70 named keys plus a darker shade of each, about 140 snap targets in all, instead of the spec's "about 32". Each fur colour needs its own lit and shaded steps, or a tiger in shadow snaps to brown. The pixel look comes from the low-res render and the outlines; the palette keeps the colours harmonious.
- Models are built with `box` and `ellipsoid` operations on a `VoxelGrid` instead of layered character maps. That is less text for the same voxels, and the proportions become tunable numbers in `SPECIES`.
- Scenery props live in their own `props.js` and `scenery.js` instead of `models.js` and `scene.js`, so the milestone-4 task adds files instead of editing earlier ones.

- **User change after playtest 2:** play runs bottom-right → top-left. The camera sits at (−20, 20, 20), the island ring and scenery are mirrored (c → 6 − c, x → −x), the sun moves to (−8, 14, 3), the HUD panels move to the top-right and bottom-left, and the screen-axis vectors in views.js and main.js are read off the camera instead of hard-coded.

## File map

```
games/jungle-game-remake/
  index.html        HUD markup, import map, boot guard + fallback card        (Task 4)
  style.css         light pixel-UI HUD                                         (Task 4)
  js/rules.js       DOM-free rules + applyMove() events                        (Task 1)
  js/voxel.js       VoxelGrid + face-culled AO mesher (no THREE)               (Task 3)
  js/palette.js     colour constants C, TEAM, expanded palette for the shader  (Task 3)
  js/layout.js      pickScale, lowRes, cellToWorld, worldToCell, resolvePick   (Task 3)
  js/audio.js       original Sound module                                      (Task 4)
  js/hud.js         DOM HUD: turn, toasts, captured trays, overlay, rules      (Task 4)
  js/mesh.js        THREE glue: geometryFrom, materials, sway shader           (Task 5)
  js/pixel.js       low-res pipeline + post shader + snapshot                  (Task 5)
  js/scene.js       island, tiles, water, lights, camera                       (Task 5)
  js/models.js      animals, trap, den, arrow                                  (Task 6)
  js/board-props.js traps and dens placed on their squares                     (Task 6)
  js/views.js       piece views: rings, badges, idle, snapping, portraits      (Task 6)
  js/props.js       scenery models: trees, bushes, rocks, torches, fish…       (Task 8)
  js/scenery.js     scenery placement + ambient life                           (Task 8)
  js/fx.js          tweens, hit-stop, particles, shake                         (Task 7)
  js/anim.js        move/jump/swim/capture/trap/win sequences + markers        (Task 7)
  js/main.js        boot, loop, picking, input lock                            (Tasks 4→5→6→7)
tests/jungle-remake-rules.test.mjs     (Task 1)
tests/jungle-remake-parity.test.mjs    (Task 2)
tests/jungle-remake-voxel.test.mjs     (Task 3, syntax gate added in Task 4)
index.html, README.md, CLAUDE.md       (Task 9)
```

---

### Task 1: Rules engine

**Files:**
- Create: `games/jungle-game-remake/js/rules.js`
- Test: `tests/jungle-remake-rules.test.mjs`

**Interfaces:**
- Produces: `ROWS`, `COLS`, `ANIMALS[type] = {emoji, rank, name}`, `terrain[r][c] ∈ 'land'|'water'|'trap'|'den'`, `WATER`, `TRAPS`, `initialPieces`, `SIDE_NAME`, `other(player)`, `inBounds(r,c)`, `trapOwner(row)`, `denOwner(row)`, `onEnemyTrap(piece)`, `createGame()`.
- `createGame()` returns `game = { pieces, currentPlayer, gameOver, winner, restart(), pieceAt(r,c), getValidMoves(piece) → [{row,col,capture?,jump?}], canCapture(att, def, r, c), applyMove(piece,row,col) → Event[] }`.
- Pieces are `{id, type, player, row, col}`, and `id` is the index in `initialPieces`.
- Events, in order:
  - `{type:'capture', attacker, victim, at:{row,col}, inWater, heavy, ratElephant, message}`
  - then `{type:'move'|'jump'|'swim', piece, from, to, capture}`
  - then optionally `{type:'trap', piece, at, message}`
  - then either `{type:'win', player, piece, reason}` or `{type:'turn', player}`.

- [ ] **Step 1: Write the failing tests**

Create `tests/jungle-remake-rules.test.mjs`:

```js
/* Cờ Thú remake — rules. The remake is a folder game, so rules.js is a real ES module and is
   imported directly; staying DOM-free at import time is part of the contract. Positions are
   hand-built so each rule is exercised in isolation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, initialPieces, terrain, onEnemyTrap, ANIMALS,
} from '../games/jungle-game-remake/js/rules.js';

function setup(list, current = 'red') {
  const g = createGame();
  g.pieces = list.map(([player, type, row, col], id) => ({ id, player, type, row, col }));
  g.currentPlayer = current;
  return g;
}
const cells = moves =>
  moves.map(m => `${m.row},${m.col}${m.capture ? 'x' : ''}${m.jump ? 'j' : ''}`).sort();
const find = (g, player, type) => g.pieces.find(p => p.player === player && p.type === type);
const moves = (g, player, type) => cells(g.getValidMoves(find(g, player, type)));

test('starting layout matches the original', () => {
  const g = createGame();
  assert.equal(g.pieces.length, 16);
  assert.equal(g.currentPlayer, 'red');
  assert.equal(g.gameOver, false);
  assert.deepEqual(g.pieces.map(({ id, ...p }) => p), initialPieces);
  assert.deepEqual(g.pieces.map(p => p.id), [...Array(16).keys()]);
  const count = k => terrain.flat().filter(t => t === k).length;
  assert.equal(count('water'), 12);
  assert.equal(count('trap'), 6);
  assert.equal(terrain[0][3], 'den');
  assert.equal(terrain[8][3], 'den');
  assert.equal(ANIMALS.elephant.rank, 8);
});

test('only the rat enters water', () => {
  assert.deepEqual(moves(setup([['red', 'rat', 2, 1], ['blue', 'cat', 8, 6]]), 'red', 'rat'),
    ['1,1', '2,0', '2,2', '3,1']);
  assert.deepEqual(moves(setup([['red', 'cat', 2, 1], ['blue', 'cat', 8, 6]]), 'red', 'cat'),
    ['1,1', '2,0', '2,2']);
});

test('tiger jumps the river vertically only, leopard horizontally only, lion both', () => {
  const opp = ['blue', 'cat', 8, 6];
  assert.deepEqual(moves(setup([['red', 'tiger', 2, 1], opp]), 'red', 'tiger'),
    ['1,1', '2,0', '2,2', '6,1j']);
  assert.deepEqual(moves(setup([['red', 'tiger', 4, 0], opp]), 'red', 'tiger'), ['3,0', '5,0']);
  assert.deepEqual(moves(setup([['red', 'leopard', 4, 0], opp]), 'red', 'leopard'),
    ['3,0', '4,3j', '5,0']);
  assert.deepEqual(moves(setup([['red', 'leopard', 2, 1], opp]), 'red', 'leopard'),
    ['1,1', '2,0', '2,2']);
  assert.deepEqual(moves(setup([['red', 'lion', 4, 3], opp]), 'red', 'lion'),
    ['3,3', '4,0j', '4,6j', '5,3']);
});

test('a rat of either side in the river blocks the jump', () => {
  const opp = ['blue', 'cat', 8, 6];
  assert.ok(!moves(setup([['red', 'tiger', 2, 1], ['blue', 'rat', 4, 1]]), 'red', 'tiger').includes('6,1j'));
  assert.ok(!moves(setup([['red', 'tiger', 2, 1], ['red', 'rat', 5, 1], opp]), 'red', 'tiger').includes('6,1j'));
});

test('jump landing: captures a weaker enemy, never a stronger one or a friend', () => {
  assert.ok(moves(setup([['red', 'tiger', 2, 1], ['blue', 'dog', 6, 1]]), 'red', 'tiger').includes('6,1xj'));
  const vsElephant = moves(setup([['red', 'tiger', 2, 1], ['blue', 'elephant', 6, 1]]), 'red', 'tiger');
  assert.ok(!vsElephant.some(m => m.startsWith('6,1')));
  const vsFriend = moves(setup([['red', 'tiger', 2, 1], ['red', 'dog', 6, 1], ['blue', 'cat', 8, 6]]), 'red', 'tiger');
  assert.ok(!vsFriend.some(m => m.startsWith('6,1')));
});

test('land and water pieces cannot capture each other', () => {
  const g = setup([['red', 'rat', 3, 1], ['blue', 'rat', 2, 1]]);
  assert.deepEqual(moves(g, 'red', 'rat'), ['3,0', '3,2', '4,1']);
  g.currentPlayer = 'blue';
  assert.deepEqual(moves(g, 'blue', 'rat'), ['1,1', '2,0', '2,2']);
});

test('rats fight each other inside the river', () => {
  assert.ok(moves(setup([['red', 'rat', 3, 1], ['blue', 'rat', 4, 1]]), 'red', 'rat').includes('4,1x'));
});

test('rat beats elephant on land only; elephant never takes rat', () => {
  assert.ok(moves(setup([['red', 'rat', 2, 0], ['blue', 'elephant', 2, 1]]), 'red', 'rat').includes('2,1x'));
  assert.ok(!moves(setup([['red', 'rat', 3, 1], ['blue', 'elephant', 2, 1]]), 'red', 'rat').includes('2,1x'));
  assert.ok(!moves(setup([['red', 'elephant', 2, 0], ['blue', 'rat', 2, 1]]), 'red', 'elephant')
    .some(m => m.startsWith('2,1')));
});

test('an enemy trap makes any piece capturable; your own trap does not', () => {
  const g = setup([['red', 'rat', 1, 2], ['blue', 'lion', 1, 3]]);
  assert.ok(onEnemyTrap(find(g, 'blue', 'lion')));
  assert.ok(moves(g, 'red', 'rat').includes('1,3x'));

  const own = setup([['red', 'lion', 1, 3], ['blue', 'rat', 1, 2]], 'blue');
  assert.ok(!onEnemyTrap(find(own, 'red', 'lion')));
  assert.ok(!moves(own, 'blue', 'rat').includes('1,3x'));
});

test('a piece never enters its own den', () => {
  assert.deepEqual(moves(setup([['red', 'dog', 1, 3], ['blue', 'cat', 8, 6]]), 'red', 'dog'),
    ['1,2', '1,4', '2,3']);
});

test('entering the enemy den wins', () => {
  const g = setup([['blue', 'dog', 1, 3], ['red', 'cat', 5, 6]], 'blue');
  const ev = g.applyMove(find(g, 'blue', 'dog'), 0, 3);
  assert.deepEqual(ev.map(e => e.type), ['move', 'win']);
  assert.equal(ev[1].player, 'blue');
  assert.equal(ev[1].reason, '🐶 Chó XANH đã tiến vào hang đối phương!');
  assert.equal(g.gameOver, true);
  assert.equal(g.winner, 'blue');
});

test('capturing the last enemy piece wins', () => {
  const g = setup([['red', 'lion', 4, 3], ['blue', 'cat', 5, 3]]);
  const ev = g.applyMove(find(g, 'red', 'lion'), 5, 3);
  assert.deepEqual(ev.map(e => e.type), ['capture', 'move', 'win']);
  assert.equal(ev[0].message, 'Sư tử ăn Mèo!');
  assert.equal(ev[0].heavy, true);
  assert.equal(ev[0].ratElephant, false);
  assert.equal(ev[2].reason, 'XANH đã mất toàn bộ quân trên bàn cờ!');
  assert.equal(g.pieces.length, 1);
});

test('applyMove names jumps, swims and traps, then passes the turn', () => {
  const opp = ['blue', 'cat', 8, 6];
  let g = setup([['red', 'tiger', 2, 1], opp]);
  assert.deepEqual(g.applyMove(find(g, 'red', 'tiger'), 6, 1).map(e => e.type), ['jump', 'turn']);
  assert.equal(g.currentPlayer, 'blue');

  g = setup([['red', 'rat', 2, 1], opp]);
  assert.deepEqual(g.applyMove(find(g, 'red', 'rat'), 3, 1).map(e => e.type), ['swim', 'turn']);
  g = setup([['red', 'rat', 3, 1], opp]);
  assert.deepEqual(g.applyMove(find(g, 'red', 'rat'), 3, 0).map(e => e.type), ['swim', 'turn']);

  g = setup([['red', 'dog', 6, 3], opp]);
  const ev = g.applyMove(find(g, 'red', 'dog'), 7, 3);
  assert.deepEqual(ev.map(e => e.type), ['move', 'trap', 'turn']);
  assert.equal(ev[1].message, 'Chó sập bẫy! 🪤');
  assert.ok(onEnemyTrap(find(g, 'red', 'dog')));

  g = setup([['red', 'rat', 2, 0], ['blue', 'elephant', 2, 1], opp]);
  const cap = g.applyMove(find(g, 'red', 'rat'), 2, 1)[0];
  assert.equal(cap.ratElephant, true);
  assert.equal(cap.heavy, false);
});

test('illegal, out-of-turn and post-game moves throw and change nothing', () => {
  const g = setup([['red', 'dog', 6, 3], ['blue', 'cat', 8, 6]]);
  const before = JSON.stringify(g.pieces);
  assert.throws(() => g.applyMove(find(g, 'red', 'dog'), 6, 5), /illegal/);
  assert.throws(() => g.applyMove(find(g, 'blue', 'cat'), 8, 5), /turn/);
  assert.equal(JSON.stringify(g.pieces), before);
  g.gameOver = true;
  assert.throws(() => g.applyMove(find(g, 'red', 'dog'), 5, 3), /over/);
});

test('restart after a finished game restores the opening', () => {
  const g = setup([['blue', 'dog', 1, 3], ['red', 'cat', 5, 6]], 'blue');
  g.applyMove(find(g, 'blue', 'dog'), 0, 3);
  g.restart();
  assert.equal(g.gameOver, false);
  assert.equal(g.winner, null);
  assert.equal(g.currentPlayer, 'red');
  assert.equal(g.pieces.length, 16);
  assert.deepEqual(g.pieces.map(({ id, ...p }) => p), initialPieces);
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `node --test tests/jungle-remake-rules.test.mjs`
Expected: FAIL with `Cannot find module …/games/jungle-game-remake/js/rules.js`

- [ ] **Step 3: Implement `rules.js`**

Create `games/jungle-game-remake/js/rules.js`:

```js
/* Cờ Thú rules — a 1:1 port of games/jungle-game.html (the block from `const ROWS` through
   `movePiece`) with the DOM taken out. State changes here are instant; applyMove returns an
   ordered event list that the animation layer replays. tests/jungle-remake-parity.test.mjs
   checks the move generator against the original file, so keep the two in step. */

export const ROWS = 9;
export const COLS = 7;

export const ANIMALS = {
  rat:      { emoji: '🐭', rank: 1, name: 'Chuột' },
  cat:      { emoji: '🐱', rank: 2, name: 'Mèo' },
  dog:      { emoji: '🐶', rank: 3, name: 'Chó' },
  wolf:     { emoji: '🐺', rank: 4, name: 'Sói' },
  leopard:  { emoji: '🐆', rank: 5, name: 'Báo' },
  tiger:    { emoji: '🐯', rank: 6, name: 'Hổ' },
  lion:     { emoji: '🦁', rank: 7, name: 'Sư tử' },
  elephant: { emoji: '🐘', rank: 8, name: 'Voi' },
};

export const terrain = Array.from({ length: ROWS }, () => Array(COLS).fill('land'));

export const WATER = [
  [3, 1], [3, 2], [4, 1], [4, 2], [5, 1], [5, 2],
  [3, 4], [3, 5], [4, 4], [4, 5], [5, 4], [5, 5],
];
WATER.forEach(([r, c]) => { terrain[r][c] = 'water'; });

export const TRAPS = [[0, 2], [0, 4], [1, 3], [8, 2], [8, 4], [7, 3]];
TRAPS.forEach(([r, c]) => { terrain[r][c] = 'trap'; });

terrain[0][3] = 'den';
terrain[8][3] = 'den';

export const initialPieces = [
  { type: 'lion', player: 'red', row: 0, col: 0 },
  { type: 'tiger', player: 'red', row: 0, col: 6 },
  { type: 'leopard', player: 'red', row: 2, col: 2 },
  { type: 'wolf', player: 'red', row: 2, col: 4 },
  { type: 'dog', player: 'red', row: 1, col: 1 },
  { type: 'cat', player: 'red', row: 1, col: 5 },
  { type: 'rat', player: 'red', row: 2, col: 0 },
  { type: 'elephant', player: 'red', row: 2, col: 6 },

  { type: 'lion', player: 'blue', row: 8, col: 6 },
  { type: 'tiger', player: 'blue', row: 8, col: 0 },
  { type: 'leopard', player: 'blue', row: 6, col: 4 },
  { type: 'wolf', player: 'blue', row: 6, col: 2 },
  { type: 'dog', player: 'blue', row: 7, col: 5 },
  { type: 'cat', player: 'blue', row: 7, col: 1 },
  { type: 'rat', player: 'blue', row: 6, col: 6 },
  { type: 'elephant', player: 'blue', row: 6, col: 0 },
];

export const SIDE_NAME = { red: 'ĐỎ', blue: 'XANH' };
export const other = player => (player === 'red' ? 'blue' : 'red');
export const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

/** Red's traps and den are on rows 0–1, blue's on rows 7–8. */
export const trapOwner = row => (row <= 1 ? 'red' : 'blue');
export const denOwner = row => (row === 0 ? 'red' : 'blue');

/** True when the piece stands on a trap of the other side — the only trap that weakens. */
export const onEnemyTrap = p => terrain[p.row][p.col] === 'trap' &&
  ((p.player === 'red' && p.row >= 7) || (p.player === 'blue' && p.row <= 1));

export function createGame() {
  const game = {
    pieces: [], currentPlayer: 'red', gameOver: false, winner: null,
    restart, pieceAt, getValidMoves, canCapture, applyMove,
  };

  function restart() {
    game.pieces = initialPieces.map((p, id) => ({ id, ...p }));
    game.currentPlayer = 'red';
    game.gameOver = false;
    game.winner = null;
  }

  function pieceAt(r, c) {
    return game.pieces.find(p => p.row === r && p.col === c);
  }

  function getValidMoves(piece) {
    const moves = [];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = piece.row + dr;
      const nc = piece.col + dc;
      if (!inBounds(nr, nc)) continue;

      // Water: the rat swims in, tiger/leopard/lion jump across
      if (terrain[nr][nc] === 'water') {
        if (piece.type === 'rat') {
          const swimTarget = pieceAt(nr, nc);
          if (!swimTarget) {
            moves.push({ row: nr, col: nc });
          } else if (swimTarget.player !== piece.player && canCapture(piece, swimTarget, nr, nc)) {
            moves.push({ row: nr, col: nc, capture: true });
          }
        } else {
          const jump = getJumpMove(piece, dr, dc);
          if (jump) moves.push(jump);
        }
        continue;
      }

      // Never into your own den
      if (terrain[nr][nc] === 'den' &&
          ((piece.player === 'red' && nr === 0) || (piece.player === 'blue' && nr === 8))) continue;

      const target = pieceAt(nr, nc);
      if (!target) {
        moves.push({ row: nr, col: nc });
      } else if (target.player !== piece.player && canCapture(piece, target, nr, nc)) {
        moves.push({ row: nr, col: nc, capture: true });
      }
    }
    return moves;
  }

  function getJumpMove(piece, dr, dc) {
    const canJumpVertical = piece.type === 'tiger' || piece.type === 'lion';
    const canJumpHorizontal = piece.type === 'leopard' || piece.type === 'lion';
    if (dr !== 0 && !canJumpVertical) return null;
    if (dc !== 0 && !canJumpHorizontal) return null;

    let r = piece.row + dr;
    let c = piece.col + dc;
    if (!inBounds(r, c) || terrain[r][c] !== 'water') return null;

    while (inBounds(r, c) && terrain[r][c] === 'water') {
      const blocker = pieceAt(r, c);          // any rat in the river blocks the jump
      if (blocker && blocker.type === 'rat') return null;
      r += dr;
      c += dc;
    }
    if (!inBounds(r, c)) return null;

    const target = pieceAt(r, c);
    if (target) {
      if (target.player === piece.player) return null;
      if (!canCapture(piece, target, r, c)) return null;
      return { row: r, col: c, capture: true, jump: true };
    }
    return { row: r, col: c, jump: true };
  }

  // (dr, dc) is the defender's square — the original's parameter names, kept for parity.
  function canCapture(attacker, defender, dr, dc) {
    // River rule: land and water pieces cannot capture each other; only rat-vs-rat in water.
    const attackerInWater = terrain[attacker.row][attacker.col] === 'water';
    const defenderInWater = terrain[dr][dc] === 'water';
    if (attackerInWater !== defenderInWater) return false;

    if (attacker.type === 'rat' && defender.type === 'elephant') return true;
    if (attacker.type === 'elephant' && defender.type === 'rat') return false;

    // A defender standing on the other side's trap can be taken by anything
    const defenderOnEnemyTrap = terrain[dr][dc] === 'trap' && (
      (defender.player === 'red' && dr >= 7) ||
      (defender.player === 'blue' && dr <= 1)
    );
    if (defenderOnEnemyTrap) return true;

    return ANIMALS[attacker.type].rank >= ANIMALS[defender.type].rank;
  }

  function applyMove(piece, r, c) {
    if (game.gameOver) throw new Error('game is over');
    if (piece.player !== game.currentPlayer) throw new Error(`not ${piece.player}'s turn`);
    const move = getValidMoves(piece).find(m => m.row === r && m.col === c);
    if (!move) throw new Error(`illegal move: ${piece.type} to ${r},${c}`);

    const events = [];
    const from = { row: piece.row, col: piece.col };
    const target = pieceAt(r, c);
    const a = ANIMALS[piece.type];

    if (target) {
      events.push({
        type: 'capture', attacker: piece, victim: target, at: { row: r, col: c },
        inWater: terrain[r][c] === 'water',
        heavy: piece.type === 'tiger' || piece.type === 'lion' || piece.type === 'elephant',
        ratElephant: piece.type === 'rat' && target.type === 'elephant',
        message: `${a.name} ăn ${ANIMALS[target.type].name}!`,
      });
      game.pieces = game.pieces.filter(p => p !== target);
    }

    piece.row = r;
    piece.col = c;

    const wet = terrain[r][c] === 'water' || terrain[from.row][from.col] === 'water';
    const kind = move.jump ? 'jump' : (piece.type === 'rat' && wet ? 'swim' : 'move');
    events.push({ type: kind, piece, from, to: { row: r, col: c }, capture: !!target });

    if (terrain[r][c] === 'trap') {
      events.push({ type: 'trap', piece, at: { row: r, col: c }, message: `${a.name} sập bẫy! 🪤` });
    }

    const win = reason => {
      game.gameOver = true;
      game.winner = piece.player;
      events.push({ type: 'win', player: piece.player, piece, reason });
    };

    if (terrain[r][c] === 'den') {
      win(`${a.emoji} ${a.name} ${SIDE_NAME[piece.player]} đã tiến vào hang đối phương!`);
      return events;
    }

    const enemy = other(piece.player);
    if (!game.pieces.some(p => p.player === enemy)) {
      win(`${SIDE_NAME[enemy]} đã mất toàn bộ quân trên bàn cờ!`);
      return events;
    }

    game.currentPlayer = enemy;
    events.push({ type: 'turn', player: enemy });
    return events;
  }

  restart();
  return game;
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `node --test tests/jungle-remake-rules.test.mjs`
Expected: PASS, 15 tests

- [ ] **Step 5: Commit**

Message (via `git commit -F`):

```
feat(jungle-remake): DOM-free rules engine with event lists

The remake renders through Three.js and animates every move, so the rules
cannot live inside DOM click handlers as they do in jungle-game.html.
rules.js ports them 1:1 and returns an ordered event list (capture, move/
jump/swim, trap, win/turn) for the animation layer to replay.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

Files: `games/jungle-game-remake/js/rules.js`, `tests/jungle-remake-rules.test.mjs`.

---

### Task 2: Parity test against the original game

**Files:**
- Test: `tests/jungle-remake-parity.test.mjs`

**Interfaces:**
- Consumes: `createGame()` from Task 1, and the original's `inBounds`, `getPieceAt`, `getValidMoves`, `getJumpMove`, `canCapture`, plus the data block `const ROWS = 9;` … `let pieces =` in `games/jungle-game.html`.
- Produces: nothing; this task is a guard only.

- [ ] **Step 1: Write the parity test**

Create `tests/jungle-remake-parity.test.mjs`:

```js
/* Parity: the remake's move generator must agree with the original single-file game on every
   position a few thousand seeded random legal moves reach. The original's rule functions are
   pulled out of games/jungle-game.html by name and evaluated in a bare node:vm context, so a
   rule change in either file fails here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createGame } from '../games/jungle-game-remake/js/rules.js';

const ORIGINAL = new URL('../games/jungle-game.html', import.meta.url);

// Source of `function name(...) { ... }`, found by brace matching.
function functionSource(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `function ${name} not found in jungle-game.html`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`unbalanced braces in ${name}`);
}

function loadOriginal() {
  const src = readFileSync(ORIGINAL, 'utf8');
  const start = src.indexOf('const ROWS = 9;');
  const end = src.indexOf('let pieces =');
  assert.ok(start > 0 && end > start, 'rule data block not found in jungle-game.html');
  const fns = ['inBounds', 'getPieceAt', 'getValidMoves', 'getJumpMove', 'canCapture']
    .map(n => functionSource(src, n)).join('\n');
  const code = `${src.slice(start, end)}\nlet pieces = [];\n${fns}\n` +
    'globalThis.api = { setPieces(p) { pieces = p; }, getValidMoves };';
  const ctx = vm.createContext({});
  vm.runInContext(code, ctx);
  return ctx.api;
}

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// JSON keys compare cleanly across the vm realm boundary.
const key = moves => JSON.stringify(moves.map(m => [m.row, m.col, !!m.capture, !!m.jump]).sort());

test('move generation matches jungle-game.html across random games', () => {
  const api = loadOriginal();
  const rng = mulberry32(20261013);
  let positions = 0, captures = 0, jumps = 0;

  for (let gameNo = 0; gameNo < 60; gameNo++) {
    const game = createGame();
    for (let ply = 0; ply < 250 && !game.gameOver; ply++) {
      const mirror = game.pieces.map(p => ({ ...p }));
      api.setPieces(mirror);
      const legal = [];
      for (const p of game.pieces.filter(q => q.player === game.currentPlayer)) {
        const mine = game.getValidMoves(p);
        const theirs = api.getValidMoves(mirror.find(m => m.id === p.id));
        assert.equal(key(mine), key(theirs),
          `game ${gameNo} ply ${ply}: ${p.player} ${p.type} at ${p.row},${p.col}`);
        mine.forEach(m => legal.push([p, m]));
        positions++;
      }
      if (!legal.length) break;
      const [p, m] = legal[Math.floor(rng() * legal.length)];
      if (m.capture) captures++;
      if (m.jump) jumps++;
      game.applyMove(p, m.row, m.col);
    }
  }

  assert.ok(positions > 5000, `only ${positions} piece-positions checked`);
  assert.ok(captures > 50, `only ${captures} captures exercised`);
  assert.ok(jumps > 20, `only ${jumps} jumps exercised`);
});
```

- [ ] **Step 2: Run it**

Run: `node --test tests/jungle-remake-parity.test.mjs`
Expected: PASS. If an assertion fails, the message names the game, ply and piece. Fix `rules.js` to match the original, never the other way round. If the coverage asserts fail (too few captures or jumps), raise the game count from 60 to 150. Do not lower the thresholds.

- [ ] **Step 3: Run the whole suite**

Run: `node --test 'tests/*.test.mjs'`
Expected: every test passes, including the existing monster-battle, farm and similar suites.

- [ ] **Step 4: Commit**

Message:

```
test(jungle-remake): prove move-generation parity with the original

"Keep exact gameplay" is only a promise unless something checks it. The
test lifts the original rule functions out of jungle-game.html, runs them
in a bare vm context, and compares move lists with rules.js on every
position of 60 seeded random games.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

Files: `tests/jungle-remake-parity.test.mjs`.

---

### Task 3: Voxel mesher, palette and layout maths

**Files:**
- Create: `games/jungle-game-remake/js/voxel.js`
- Create: `games/jungle-game-remake/js/palette.js`
- Create: `games/jungle-game-remake/js/layout.js`
- Test: `tests/jungle-remake-voxel.test.mjs`

**Interfaces:**
- Produces from `voxel.js`:
  - `hash3(x,y,z,seed=0) → [0,1)`
  - `class VoxelGrid` with `set(x,y,z,color|null)`, `get`, `has`, `size`, `box(x0,y0,z0,x1,y1,z1,color|fn)`, `ellipsoid(cx,cy,cz,rx,ry,rz,color|fn)`, `merge(other)`, `mirrorX() → VoxelGrid`, `each(fn)`, and `mesh({jitter=0.05, seed=7}) → {positions, normals, colors, sway, indices, minY, maxY}`.
  - Integer coordinates must lie in [-512, 511]. Colour fns get `(x,y,z)` and return a hex or `null`.
- Produces from `palette.js`:
  - `C` (named hex colours)
  - `TEAM = { red:{main,dark}, blue:{main,dark} }`
  - `hexCss(hex) → '#rrggbb'`
  - `paletteRGBA() → { data: Uint8Array, count }` (keys plus a 0.68 shade of each, deduplicated, at most 256)
- Produces from `layout.js`:
  - `pickScale(cssW, cssH) → 2..4`
  - `lowRes(cssW, cssH, scale) → {w,h}`
  - `cellToWorld(r,c) → {x,z}`
  - `worldToCell(x,z) → {row,col}`
  - `resolvePick(groundCell, waterCell, isWater) → cell|null`

- [ ] **Step 1: Write the failing tests**

Create `tests/jungle-remake-voxel.test.mjs`:

```js
/* Cờ Thú remake — the THREE-free building blocks: voxel mesher, palette, layout maths. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { VoxelGrid, hash3 } from '../games/jungle-game-remake/js/voxel.js';
import { C, TEAM, paletteRGBA, hexCss } from '../games/jungle-game-remake/js/palette.js';
import {
  pickScale, lowRes, cellToWorld, worldToCell, resolvePick,
} from '../games/jungle-game-remake/js/layout.js';

const faces = m => m.indices.length / 6;

test('a lone voxel meshes to 6 faces', () => {
  const m = new VoxelGrid().set(0, 0, 0, 0xffffff).mesh();
  assert.equal(faces(m), 6);
  assert.equal(m.positions.length, 6 * 4 * 3);
  assert.equal(m.colors.length, m.positions.length);
  assert.equal(m.sway.length, 24);
});

test('shared faces are culled', () => {
  const two = new VoxelGrid().set(0, 0, 0, 1).set(1, 0, 0, 1).mesh();
  assert.equal(faces(two), 10);
  const cube = new VoxelGrid().box(0, 0, 0, 2, 2, 2, 0x808080);
  assert.equal(cube.size, 27);
  assert.equal(faces(cube.mesh()), 54);
});

test('box colour functions can leave cells empty', () => {
  const g = new VoxelGrid().box(0, 0, 0, 3, 0, 0, x => (x % 2 ? 0xff0000 : null));
  assert.equal(g.size, 2);
  assert.ok(g.has(1, 0, 0) && !g.has(0, 0, 0));
});

test('ellipsoid is symmetric and bounded', () => {
  const g = new VoxelGrid().ellipsoid(0, 0, 0, 2, 2, 2, 1);
  assert.ok(g.has(2, 0, 0) && g.has(-2, 0, 0) && g.has(0, 2, 0) && g.has(0, 0, -2));
  assert.ok(!g.has(2, 2, 0));
});

test('mirrorX reflects around the centre line and merge combines grids', () => {
  const left = new VoxelGrid().set(-3, 1, 2, 5);
  const right = left.mirrorX();
  assert.equal(right.get(2, 1, 2), 5);
  const both = new VoxelGrid().merge(left).merge(right);
  assert.equal(both.size, 2);
});

test('ambient occlusion darkens a crease corner, not an open one', () => {
  // floor voxel with a voxel sitting diagonally above its +x edge
  const m = new VoxelGrid().set(0, 0, 0, 0xffffff).set(1, 1, 0, 0xffffff).mesh({ jitter: 0 });
  const top = [];
  for (let v = 0; v < m.positions.length / 3; v++) {
    const [x, y] = [m.positions[v * 3], m.positions[v * 3 + 1]];
    if (m.normals[v * 3 + 1] === 1 && y === 1 && x <= 1) top.push({ x, r: m.colors[v * 3] });
  }
  assert.equal(top.length, 4);
  assert.ok(top.filter(t => t.x === 1).every(t => t.r < 1), 'crease side is darkened');
  assert.ok(top.filter(t => t.x === 0).every(t => t.r === 1), 'open side stays bright');
});

test('sway runs 0 at the bottom of the grid to 1 at the top', () => {
  const m = new VoxelGrid().box(0, 0, 0, 0, 3, 0, 1).mesh();
  assert.equal(Math.min(...m.sway), 0);
  assert.equal(Math.max(...m.sway), 1);
});

test('hash3 is deterministic and in [0,1)', () => {
  assert.equal(hash3(1, 2, 3, 4), hash3(1, 2, 3, 4));
  assert.notEqual(hash3(1, 2, 3), hash3(3, 2, 1));
  for (let i = 0; i < 200; i++) {
    const h = hash3(i, i * 7, -i, 3);
    assert.ok(h >= 0 && h < 1);
  }
});

test('palette: every key is in the shader palette, shades included, within 256', () => {
  const { data, count } = paletteRGBA();
  assert.ok(count > Object.keys(C).length && count <= 256, `count ${count}`);
  const has = hex => {
    for (let i = 0; i < count; i++) {
      if (data[i * 4] === (hex >> 16 & 255) && data[i * 4 + 1] === (hex >> 8 & 255) && data[i * 4 + 2] === (hex & 255)) return true;
    }
    return false;
  };
  for (const [name, hex] of Object.entries(C)) assert.ok(has(hex), `missing ${name}`);
  assert.equal(TEAM.red.main, C.red);
  assert.equal(hexCss(0x0a0b0c), '#0a0b0c');
});

test('pickScale floors at 2, caps at 4, and stays chunky on desktop', () => {
  assert.equal(pickScale(375, 600), 2);
  assert.equal(pickScale(1280, 720), 2);
  assert.equal(pickScale(1920, 1000), 3);
  assert.equal(pickScale(3840, 2000), 4);
  assert.deepEqual(lowRes(1920, 1000, 3), { w: 640, h: 333 });
  assert.deepEqual(lowRes(1, 1, 3), { w: 1, h: 1 });
});

test('cell ↔ world round-trips for every square, tolerating clicks off-centre', () => {
  for (let r = 0; r < 9; r++) for (let c = 0; c < 7; c++) {
    const { x, z } = cellToWorld(r, c);
    assert.deepEqual(worldToCell(x + 0.45, z - 0.45), { row: r, col: c });
  }
  assert.deepEqual(cellToWorld(4, 3), { x: 0, z: 0 });
});

test('resolvePick prefers the river square the water-level ray lands on', () => {
  const land = { row: 6, col: 1 }, water = { row: 5, col: 1 };
  assert.deepEqual(resolvePick(land, water, true), water);
  assert.deepEqual(resolvePick(land, { row: 6, col: 0 }, false), land);
  assert.deepEqual(resolvePick(null, water, true), water);
  assert.equal(resolvePick(null, null, false), null);
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `node --test tests/jungle-remake-voxel.test.mjs`
Expected: FAIL with `Cannot find module …/js/voxel.js`

- [ ] **Step 3: Implement `voxel.js`**

Create `games/jungle-game-remake/js/voxel.js`:

```js
/* Voxel builder: fill a sparse grid with colours, then mesh only the faces that touch air,
   with per-corner ambient occlusion baked into the vertex colours. Pure JS on purpose — no
   THREE, no DOM — so the tests import it directly; mesh.js turns the arrays into geometry. */

const OFF = 512, SPAN = 1024;            // coordinates must stay within [-512, 511]
const key = (x, y, z) => ((x + OFF) * SPAN + (y + OFF)) * SPAN + (z + OFF);

/** Deterministic 0..1 hash of an integer triple — colour noise and scatter without Math.random. */
export function hash3(x, y, z, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^
    Math.imul(z | 0, 1440662683) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Each face: outward normal and its 4 corners, counter-clockwise seen from outside.
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];
// Brightness for 0..3 open neighbours around a corner. Kept light: shadows stay airy.
const AO = [0.64, 0.78, 0.9, 1];

export class VoxelGrid {
  constructor() { this.cells = new Map(); }

  set(x, y, z, color) {
    const k = key(x, y, z);
    if (color == null) this.cells.delete(k);
    else this.cells.set(k, { x, y, z, color });
    return this;
  }
  get(x, y, z) { return this.cells.get(key(x, y, z))?.color; }
  has(x, y, z) { return this.cells.has(key(x, y, z)); }
  get size() { return this.cells.size; }
  each(fn) { for (const v of this.cells.values()) fn(v); }

  /** Inclusive box. `color` is a hex number or (x,y,z) => hex|null (null leaves the cell alone). */
  box(x0, y0, z0, x1, y1, z1, color) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) {
          const c = typeof color === 'function' ? color(x, y, z) : color;
          if (c != null) this.set(x, y, z, c);
        }
    return this;
  }

  /** Solid ellipsoid; centres may be half-integers for even-width shapes. */
  ellipsoid(cx, cy, cz, rx, ry, rz, color) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
          const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
          if (d > 1) continue;
          const c = typeof color === 'function' ? color(x, y, z) : color;
          if (c != null) this.set(x, y, z, c);
        }
    return this;
  }

  merge(other) { other.each(v => this.set(v.x, v.y, v.z, v.color)); return this; }

  /** Copy reflected across the model's centre line: x → −1 − x (cells span [x, x+1]). */
  mirrorX() {
    const g = new VoxelGrid();
    this.each(v => g.set(-1 - v.x, v.y, v.z, v.color));
    return g;
  }

  mesh({ jitter = 0.05, seed = 7 } = {}) {
    const pos = [], nor = [], col = [], sway = [], idx = [];
    let minY = Infinity, maxY = -Infinity;
    for (const v of this.cells.values()) { minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y); }
    const spanY = maxY - minY + 1;
    const solid = (x, y, z) => this.cells.has(key(x, y, z));

    for (const v of this.cells.values()) {
      const { x, y, z } = v;
      const r = ((v.color >> 16) & 255) / 255;
      const g = ((v.color >> 8) & 255) / 255;
      const b = (v.color & 255) / 255;
      const shade = 1 + (hash3(x, y, z, seed) - 0.5) * 2 * jitter;

      for (const f of FACES) {
        const [nx, ny, nz] = f.n;
        if (solid(x + nx, y + ny, z + nz)) continue;
        const axis = nx ? 0 : ny ? 1 : 2;
        const u = (axis + 1) % 3, w = (axis + 2) % 3;
        const front = [x + nx, y + ny, z + nz];      // the layer of cells this face looks into
        const base = pos.length / 3;
        const ao = [];
        for (const c of f.c) {
          const su = c[u] ? 1 : -1, sw = c[w] ? 1 : -1;
          const a = [...front]; a[u] += su;
          const bb = [...front]; bb[w] += sw;
          const cc = [...front]; cc[u] += su; cc[w] += sw;
          const s1 = solid(...a) ? 1 : 0, s2 = solid(...bb) ? 1 : 0, s3 = solid(...cc) ? 1 : 0;
          const level = s1 && s2 ? 0 : 3 - (s1 + s2 + s3);
          ao.push(level);
          const k = AO[level] * shade;
          pos.push(x + c[0], y + c[1], z + c[2]);
          nor.push(nx, ny, nz);
          col.push(Math.min(1, r * k), Math.min(1, g * k), Math.min(1, b * k));
          sway.push((y + c[1] - minY) / spanY);
        }
        // flip the quad's diagonal so AO interpolates without the classic seam
        if (ao[0] + ao[2] > ao[1] + ao[3]) idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
        else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    return {
      positions: new Float32Array(pos), normals: new Float32Array(nor),
      colors: new Float32Array(col), sway: new Float32Array(sway),
      indices: new Uint32Array(idx), minY, maxY,
    };
  }
}
```

The AO test needs the open side to read exactly 1, but `shade` is `1 + 0·…` when `jitter` is 0, so this holds. The sway test needs a top of exactly 1: the highest corner is `maxY + 1`, and `(maxY + 1 − minY) / spanY = 1`.

- [ ] **Step 4: Implement `palette.js`**

Create `games/jungle-game-remake/js/palette.js`:

```js
/* The colours every rendered pixel snaps to, tuned toward reference/color.png: limes and
   turquoise, warm earth, light shadows. The post shader gets each key plus a darker shade
   (0.68×) so lit, shaded and outlined pixels all have somewhere to land. */

export const C = {
  // greens, light → dark
  lime0: 0xf0fb8c, lime1: 0xe4f75a, lime2: 0xc7f02a, lime3: 0x8ed11f, lime4: 0x5fae22,
  lime5: 0x3d7f24, lime6: 0x2a5a1e,
  // water
  water0: 0xe6fbf6, water1: 0xbff3ea, water2: 0x8fe6dd, water3: 0x5fd3c9, water4: 0x3fb3b0,
  water5: 0x2f8f93,
  // earth
  sand: 0xf1d6a0, earth1: 0xd9955a, earth2: 0xa8673a, earth3: 0x7a4a2c, earth4: 0x5a3a24,
  earth5: 0x3b2618,
  // stone
  stone0: 0xf4f2ea, stone1: 0xe8e6dc, stone2: 0xb9b7ad, stone3: 0x85847e, stone4: 0x55554f,
  // animals
  ratFur: 0xa9a3a8, ratDark: 0x7b737c, pink: 0xf2a0a8,
  catFur: 0xf0b05c, catStripe: 0xd98a3a, cream: 0xfff1d6,
  dogFur: 0xc98d52, dogEar: 0x8a5631, dogMuzzle: 0xf3e3c3,
  wolfFur: 0x8e9aaa, wolfDark: 0x5f6b7c, wolfBelly: 0xd4dbe3,
  leoFur: 0xe9b949, leoSpot: 0x6a4424, leoBelly: 0xfbe9b7,
  tigerFur: 0xf08a24, tigerBelly: 0xfff7e6,
  lionFur: 0xe3b25a, lionMane: 0xa8562a, lionManeDark: 0x7a3a1c, lionBelly: 0xf6dfa6,
  eleSkin: 0x9aa3b5, eleDark: 0x747d90, eleEar: 0xd9a3a8,
  // teams, effects, scenery accents
  red: 0xe2523f, redDark: 0xa8302a, blue: 0x3f8fe2, blueDark: 0x2a5ea8,
  blood: 0xc8102e, bloodDark: 0x7a0a1c,
  gold: 0xffd23f, flame: 0xff8a1f,
  flowerPink: 0xff8fb1, flowerYellow: 0xffe14d, flowerViolet: 0xb48cff,
  white: 0xfffdf3, ink: 0x2b1d14,
};

export const TEAM = {
  red: { main: C.red, dark: C.redDark },
  blue: { main: C.blue, dark: C.blueDark },
};

export const hexCss = hex => `#${hex.toString(16).padStart(6, '0')}`;

const rgb = hex => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];

/** RGBA bytes for the post shader's palette texture: keys first, then their shades. */
export function paletteRGBA() {
  const list = [];
  const near = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 9;
  const add = c => { if (!list.some(o => near(o, c))) list.push(c); };
  const keys = Object.values(C).map(rgb);
  keys.forEach(c => list.push(c));                  // every key exactly, even near-duplicates
  keys.forEach(c => add(c.map(v => Math.round(v * 0.68))));
  const count = Math.min(256, list.length);
  const data = new Uint8Array(count * 4);
  list.slice(0, count).forEach((c, i) => { data.set([...c, 255], i * 4); });
  return { data, count };
}
```

- [ ] **Step 5: Implement `layout.js`**

Create `games/jungle-game-remake/js/layout.js`:

```js
/* Pure sizing and coordinate maths for the pixel pipeline, kept THREE-free so tests pin it. */

/** Integer upscale for a stage of cssW × cssH: chunky on big screens, never below 2. */
export function pickScale(cssW, cssH) {
  const s = Math.floor(Math.min(cssW / 400, cssH / 300));
  return Math.max(2, Math.min(4, s));
}

/** Low-res render size for that stage and scale (at least 1×1). */
export function lowRes(cssW, cssH, scale) {
  return { w: Math.max(1, Math.floor(cssW / scale)), h: Math.max(1, Math.floor(cssH / scale)) };
}

/** Board square → world; square centres sit on integer coordinates, (4,3) at the origin. */
export const cellToWorld = (row, col) => ({ x: col - 3, z: row - 4 });
export const worldToCell = (x, z) => ({ row: Math.round(z + 4), col: Math.round(x + 3) });

/**
 * A click ray is intersected twice: with the board plane (y = 0) and with the river surface.
 * River squares sit lower, so the y = 0 hit lands on the square behind; when the water-level hit
 * is a river square, it wins.
 */
export function resolvePick(groundCell, waterCell, waterCellIsWater) {
  if (waterCell && waterCellIsWater) return waterCell;
  return groundCell ?? null;
}
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `node --test tests/jungle-remake-voxel.test.mjs`
Expected: PASS, 12 tests

- [ ] **Step 7: Commit**

Message:

```
feat(jungle-remake): voxel mesher, palette and layout maths

Every model in the remake is procedural voxels, so a mesher that culls
hidden faces and bakes ambient occlusion is the foundation. The palette
and the integer-scale/cell maths live beside it, THREE-free, so the
parts most likely to regress silently are pinned by Node tests.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

Files: the three modules and `tests/jungle-remake-voxel.test.mjs`.

---

### Task 4: Page shell, HUD, audio and boot guard

**Files:**
- Create: `games/jungle-game-remake/index.html`
- Create: `games/jungle-game-remake/style.css`
- Create: `games/jungle-game-remake/js/audio.js`
- Create: `games/jungle-game-remake/js/hud.js`
- Create: `games/jungle-game-remake/js/main.js` (boot stub; replaced in Task 5)
- Modify: `tests/jungle-remake-voxel.test.mjs` (append the syntax gate)

**Interfaces:**
- Produces from `audio.js`: `Sound` with `ensure()`, `muted`, `toggle()`, `select()`, `move()`, `capture(rank)`, `splash()`, `trap()`, `rumble('heavy'|'soft')` and `win()`. It is the original module plus guarded storage.
- Produces from `hud.js`: `createHud({ onRestart, onSoundToggle })` returning:
  - `setTurn(player)`
  - `toast(text, type='info'|'success'|'error')`
  - `setPortraits(map)`, where `map['lion:red'] = dataURL`
  - `addCaptured(piece, fromXY?)`
  - `clearCaptured()`
  - `showWin(player, reason)`
  - `hideWin()`
  - `setSound(muted)`
- `index.html` contract:
  - `#stage` is the 3D area and `#view` is its canvas.
  - `window.__bootFail(kind)`, where `kind ∈ 'cdn'|'webgl'|'file'`, shows the fallback card once.
  - `main.js` sets `window.__booted = true` when it is running.

- [ ] **Step 1: Write `index.html`**

Create `games/jungle-game-remake/index.html`:

```html
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cờ Thú: Rừng Xanh</title>
<link rel="stylesheet" href="style.css">
<script type="importmap">
{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js" } }
</script>
</head>
<body>
<div class="app">
  <header class="bar">
    <div class="title">
      <span class="logo">🦁</span>
      <h1>CỜ THÚ <small>Rừng Xanh</small></h1>
    </div>
    <div class="status red" id="turnStatus"><span class="dot"></span><span id="turnText">Lượt: ĐỎ</span></div>
    <div class="controls">
      <button class="btn" id="soundBtn">🔊 Âm: BẬT</button>
      <button class="btn" id="toggleRules">📖 Luật chơi</button>
      <button class="btn primary" id="restartBtn">🔄 Chơi lại</button>
    </div>
  </header>

  <main class="stage" id="stage">
    <canvas id="view" aria-label="Bàn cờ thú"></canvas>
    <aside class="side red">
      <h2>🔴 ĐỎ</h2>
      <div class="turn-badge" id="redTurn">ĐANG ĐI</div>
      <h3>Quân đã mất</h3>
      <div class="captured" id="redCaptured"></div>
    </aside>
    <aside class="side blue">
      <h2>🔵 XANH</h2>
      <div class="turn-badge idle" id="blueTurn">CHỜ</div>
      <h3>Quân đã mất</h3>
      <div class="captured" id="blueCaptured"></div>
    </aside>
  </main>
</div>

<div class="overlay" id="overlay">
  <div class="card">
    <div class="overlay-emoji" id="overEmoji">🏆</div>
    <h2 id="overTitle">Chiến thắng!</h2>
    <p id="overReason"></p>
    <button class="btn primary" id="playAgainBtn">🔄 Chơi lại</button>
  </div>
</div>

<div class="overlay" id="rulesModal">
  <div class="card rules">
    <button class="close" id="rulesClose" aria-label="Đóng">✕</button>
    <h3>📜 Luật Cờ Thú</h3>
    <ul>
      <li>Mỗi lượt chỉ được đi một quân.</li>
      <li>Quân mạnh ăn quân yếu theo thứ tự: Voi🐘 → Sư tử🦁 → Hổ🐯 → Báo🐆 → Sói🐺 → Chó🐶 → Mèo🐱 → Chuột🐭.</li>
      <li>Chuột có thể ăn Voi (khi cả hai ở trên cạn).</li>
      <li><b>Chuột biết bơi:</b> có thể xuống sông. Thú trên cạn và thú dưới nước không ăn được nhau — chỉ Chuột dưới nước mới ăn được Chuột dưới nước.</li>
      <li>Không được vào hang của chính mình.</li>
      <li>Hổ nhảy dọc qua sông, Báo nhảy ngang qua sông, Sư tử nhảy cả dọc và ngang.</li>
      <li>Nếu có Chuột trong đường sông thì không được nhảy.</li>
      <li>Quân dính bẫy của đối phương bị mất sức, có thể bị bất kỳ quân nào ăn.</li>
      <li>Vào hang đối phương là thắng ngay.</li>
    </ul>
    <button class="btn primary" id="rulesOk">Đã hiểu 👍</button>
  </div>
</div>

<div class="overlay show" id="bootCard" hidden>
  <div class="card">
    <div class="overlay-emoji">🌿</div>
    <h2>Không mở được bàn cờ</h2>
    <p id="bootReason"></p>
    <button class="btn primary" onclick="location.reload()">🔄 Thử lại</button>
  </div>
</div>

<script>
  // Boot guard. Three.js comes from a CDN and ES modules do not load over file://; either way
  // the player should see why, not an empty page.
  window.__bootFail = function (kind) {
    var card = document.getElementById('bootCard');
    if (!card.hidden) return;                       // first failure wins
    var why = {
      cdn: 'Không tải được bộ máy 3D (Three.js) — kiểm tra kết nối mạng rồi tải lại trang.',
      webgl: 'Trình duyệt này không hỗ trợ WebGL nên không vẽ được bàn cờ 3D.',
      file: 'Trò chơi cần chạy qua máy chủ web (ví dụ: npx http-server) — mở trực tiếp file sẽ không tải được.'
    };
    document.getElementById('bootReason').textContent = why[kind] || why.cdn;
    card.hidden = false;
  };
  if (location.protocol === 'file:') window.__bootFail('file');
</script>
<script type="module">
  if (location.protocol !== 'file:') {
    import('./js/main.js').catch(function (err) {
      console.error(err);
      window.__bootFail('cdn');
    });
  }
</script>
</body>
</html>
```

- [ ] **Step 2: Write `style.css`**

Create `games/jungle-game-remake/style.css`:

```css
/* Light pixel-UI HUD in the color.png palette: cream cards, brown ink borders, hard drop
   shadows, stepped corners. The 3D view is the canvas inside .stage. */
:root {
  --ink: #2b1d14;
  --cream: #fffdf3;
  --paper: #fff1d6;
  --lime: #c7f02a;
  --lime-d: #5fae22;
  --water: #8fe6dd;
  --water-d: #3fb3b0;
  --red: #e2523f;
  --red-d: #a8302a;
  --blue: #3f8fe2;
  --blue-d: #2a5ea8;
  --step: polygon(0 4px, 4px 4px, 4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
                  100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%,
                  4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px));
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body {
  background: var(--water);
  color: var(--ink);
  font-family: "Trebuchet MS", "Segoe UI", system-ui, sans-serif;
  overflow: hidden;
}
.app { display: flex; flex-direction: column; height: 100vh; height: 100dvh; }

.bar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 8px 16px; background: var(--lime); border-bottom: 4px solid var(--ink);
  flex-wrap: wrap;
}
.title { display: flex; align-items: center; gap: 10px; }
.logo { font-size: 32px; }
.title h1 { margin: 0; font-size: 26px; letter-spacing: 3px; font-weight: 900; }
.title small { font-size: 14px; letter-spacing: 1px; color: var(--lime-d); -webkit-text-stroke: 0; }

.status {
  display: flex; align-items: center; gap: 8px; padding: 6px 14px; font-weight: 800;
  color: var(--cream); border: 3px solid var(--ink); clip-path: var(--step);
}
.status.red { background: var(--red); }
.status.blue { background: var(--blue); }
.status .dot { width: 10px; height: 10px; background: var(--cream); animation: blink 1s steps(2) infinite; }
@keyframes blink { 50% { opacity: .2; } }

.controls { display: flex; gap: 8px; flex-wrap: wrap; }
.btn {
  font: inherit; font-weight: 800; font-size: 14px; cursor: pointer;
  padding: 7px 12px; color: var(--ink); background: var(--cream);
  border: 3px solid var(--ink); box-shadow: 0 4px 0 var(--ink); clip-path: var(--step);
}
.btn:hover { background: var(--paper); }
.btn:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--ink); }
.btn.primary { background: var(--lime); }

.stage { position: relative; flex: 1; min-height: 0; overflow: hidden; }
#view {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  image-rendering: pixelated; image-rendering: crisp-edges; cursor: pointer;
}

.side {
  position: absolute; width: 196px; padding: 10px 12px;
  background: var(--cream); border: 3px solid var(--ink);
  box-shadow: 0 4px 0 var(--ink); clip-path: var(--step);
}
/* The iso board is a diamond: its empty corners are top-left and bottom-right. */
.side.red { left: 14px; top: 14px; }
.side.blue { right: 14px; bottom: 14px; }
.side h2 { margin: 0 0 6px; font-size: 18px; }
.side h3 { margin: 8px 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
.side.red h2 { color: var(--red-d); }
.side.blue h2 { color: var(--blue-d); }
.turn-badge {
  display: inline-block; padding: 3px 10px; font-size: 12px; font-weight: 900; color: var(--cream);
  background: var(--lime-d); border: 2px solid var(--ink);
}
.turn-badge.idle { background: #b9b7ad; opacity: .7; }
.captured { display: flex; flex-wrap: wrap; gap: 4px; min-height: 44px; }
.captured img, .cap-fly {
  width: 40px; height: 40px; image-rendering: pixelated; background: var(--paper);
  border: 2px solid var(--ink);
}
.cap-fly { position: fixed; z-index: 60; pointer-events: none; }

.toast {
  position: fixed; left: 50%; top: 84px; transform: translateX(-50%); z-index: 70;
  padding: 10px 18px; font-weight: 800; background: var(--cream);
  border: 3px solid var(--ink); box-shadow: 0 4px 0 var(--ink); clip-path: var(--step);
  transition: opacity .3s, transform .3s;
}
.toast.success { background: var(--lime); }
.toast.error { background: #ffb4a8; }
.toast.out { opacity: 0; transform: translate(-50%, -10px); }

.overlay {
  position: fixed; inset: 0; z-index: 80; display: none; align-items: center; justify-content: center;
  background: rgba(43, 29, 20, .45);
}
.overlay.show { display: flex; }
.overlay[hidden] { display: none; }
.card {
  position: relative; max-width: min(520px, calc(100vw - 32px)); padding: 22px 26px; text-align: center;
  background: var(--cream); border: 4px solid var(--ink); box-shadow: 0 6px 0 var(--ink);
  clip-path: var(--step);
}
.overlay-emoji { font-size: 56px; }
.card h2 { margin: 6px 0; font-size: 28px; }
.card h2.win-red { color: var(--red-d); }
.card h2.win-blue { color: var(--blue-d); }
.card.rules { text-align: left; max-height: calc(100vh - 40px); overflow: auto; }
.card.rules ul { padding-left: 20px; line-height: 1.5; }
.card .close {
  position: absolute; right: 10px; top: 8px; font-size: 18px; font-weight: 900;
  background: none; border: 0; cursor: pointer; color: var(--ink);
}

@media (max-width: 760px), (max-height: 520px) {
  .bar { padding: 6px 10px; }
  .title h1 { font-size: 20px; }
  .btn { font-size: 12px; padding: 5px 8px; }
  .side { width: auto; max-width: 46%; padding: 6px 8px; }
  .side.red { left: 8px; top: 8px; }
  .side.blue { right: 8px; bottom: 8px; }
  .side h2 { font-size: 14px; }
  .side h3 { display: none; }
  .captured { min-height: 0; }
  .captured img { width: 28px; height: 28px; }
}
```

- [ ] **Step 3: Write `audio.js`**

Create `games/jungle-game-remake/js/audio.js`. The body is lines 852–957 of `games/jungle-game.html` copied verbatim, with three exceptions: a module header, a guarded `localStorage`, and `export`:

```js
/* Web Audio synth, carried over from games/jungle-game.html unchanged so the remake sounds
   exactly like the original. Mute persists under `coThu.muted`, shared with the original. */

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked: session-only */ } },
};

export const Sound = (() => {
  let ac = null, master = null;
  let muted = store.get('coThu.muted') === '1';

  function ensure() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.9;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  // Nốt từ oscillator, có thể trượt cao độ
  function tone({ freq = 440, type = 'sine', dur = 0.15, gain = 0.2, attack = 0.006, release = null, slideTo = null, when = 0 }) {
    if (muted || !ensure()) return;
    const t0 = ac.currentTime + when;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    const rel = release ?? dur;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + rel);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + rel + 0.03);
  }

  // Tiếng ồn lọc (va chạm, nước, kim loại)
  function noise({ dur = 0.2, gain = 0.2, type = 'bandpass', freq = 1000, q = 1, freqTo = null, when = 0 }) {
    if (muted || !ensure()) return;
    const t0 = ac.currentTime + when;
    const frames = Math.floor(ac.sampleRate * dur);
    const buffer = ac.createBuffer(1, frames, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(); src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = type; filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, t0);
    if (freqTo) filter.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t0 + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.03);
  }

  return {
    ensure,
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      store.set('coThu.muted', muted ? '1' : '0');
      if (!muted) { ensure(); this.select(); }
      return muted;
    },
    // Chọn quân: blip nhẹ đi lên
    select() { tone({ freq: 560, type: 'triangle', dur: 0.08, gain: 0.11, slideTo: 820 }); },
    // Di chuyển: cú đáp mềm
    move() {
      tone({ freq: 210, type: 'triangle', dur: 0.13, gain: 0.15, slideTo: 130 });
      noise({ dur: 0.08, gain: 0.05, type: 'lowpass', freq: 800 });
    },
    // Ăn quân: thình + chém; thú lớn (rank cao) nghe nặng hơn
    capture(rank = 4) {
      const base = 260 - rank * 14;
      noise({ dur: 0.24, gain: 0.30, type: 'lowpass', freq: 460, freqTo: 110 });
      tone({ freq: base, type: 'square', dur: 0.2, gain: 0.22, slideTo: base * 0.4 });
      noise({ dur: 0.16, gain: 0.13, type: 'bandpass', freq: 2700, freqTo: 900, q: 0.8, when: 0.02 });
    },
    // Chuột bơi: nước bắn
    splash() {
      noise({ dur: 0.3, gain: 0.18, type: 'bandpass', freq: 700, freqTo: 2500, q: 0.6 });
      noise({ dur: 0.22, gain: 0.09, type: 'highpass', freq: 1300, when: 0.03 });
      tone({ freq: 900, type: 'sine', dur: 0.12, gain: 0.06, slideTo: 1500, when: 0.02 });
    },
    // Sập bẫy: tiếng "clack" kim loại
    trap() {
      noise({ dur: 0.06, gain: 0.30, type: 'highpass', freq: 2600 });
      tone({ freq: 190, type: 'square', dur: 0.05, gain: 0.18, slideTo: 80 });
      tone({ freq: 1500, type: 'square', dur: 0.04, gain: 0.10, when: 0.03 });
    },
    // Rung bàn cờ: tiếng ầm trầm; "heavy" sâu và to hơn "soft"
    rumble(intensity = 'heavy') {
      const heavy = intensity !== 'soft';
      noise({ dur: heavy ? 0.5 : 0.28, gain: heavy ? 0.34 : 0.15, type: 'lowpass', freq: heavy ? 260 : 200, freqTo: heavy ? 55 : 80 });
      tone({ freq: heavy ? 90 : 120, type: 'sine', dur: heavy ? 0.45 : 0.24, gain: heavy ? 0.22 : 0.11, slideTo: heavy ? 40 : 70 });
    },
    // Thắng: hợp âm rải đi lên
    win() {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
      notes.forEach((f, i) => {
        tone({ freq: f, type: 'triangle', dur: 0.5, gain: 0.16, when: i * 0.12 });
        tone({ freq: f * 2, type: 'sine', dur: 0.4, gain: 0.05, when: i * 0.12 });
      });
    },
  };
})();
```

- [ ] **Step 4: Write `hud.js`**

Create `games/jungle-game-remake/js/hud.js`:

```js
/* DOM HUD: turn banner, side panels, captured trays, toasts, end overlay, rules modal.
   Copy is the original game's, verbatim. */
import { ANIMALS, SIDE_NAME } from './rules.js';

export function createHud({ onRestart, onSoundToggle }) {
  const $ = id => document.getElementById(id);
  let portraits = {};
  let toastTimer = 0;

  $('restartBtn').addEventListener('click', onRestart);
  $('playAgainBtn').addEventListener('click', onRestart);
  $('soundBtn').addEventListener('click', onSoundToggle);

  const rules = $('rulesModal');
  const closeRules = () => rules.classList.remove('show');
  $('toggleRules').addEventListener('click', () => rules.classList.add('show'));
  $('rulesClose').addEventListener('click', closeRules);
  $('rulesOk').addEventListener('click', closeRules);
  rules.addEventListener('click', e => { if (e.target === rules) closeRules(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeRules(); });

  function setTurn(player) {
    const isRed = player === 'red';
    $('turnStatus').className = `status ${isRed ? 'red' : 'blue'}`;
    $('turnText').textContent = `Lượt: ${SIDE_NAME[player]}`;
    for (const [id, mine] of [['redTurn', isRed], ['blueTurn', !isRed]]) {
      $(id).textContent = mine ? 'ĐANG ĐI' : 'CHỜ';
      $(id).classList.toggle('idle', !mine);
    }
  }

  function toast(text, type = 'info') {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    clearTimeout(toastTimer);
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = text;
    document.body.appendChild(el);
    toastTimer = setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
    }, 1800);
  }

  function setPortraits(map) { portraits = map; }

  /** Add the lost piece to its side's tray; if `from` (viewport px) is given, fly it there. */
  function addCaptured(piece, from) {
    const tray = piece.player === 'red' ? $('redCaptured') : $('blueCaptured');
    const img = document.createElement('img');
    img.src = portraits[`${piece.type}:${piece.player}`] || '';
    img.alt = ANIMALS[piece.type].name;
    img.title = ANIMALS[piece.type].name;
    tray.appendChild(img);
    if (!from || !img.animate) return;
    const to = img.getBoundingClientRect();
    const fly = img.cloneNode();
    fly.className = 'cap-fly';
    fly.style.left = `${to.left}px`;
    fly.style.top = `${to.top}px`;
    document.body.appendChild(fly);
    img.style.visibility = 'hidden';
    fly.animate([
      { transform: `translate(${from.x - to.left - 20}px, ${from.y - to.top - 20}px) scale(1.6)` },
      { transform: 'translate(0, 0) scale(1)' },
    ], { duration: 700, easing: 'cubic-bezier(.3,.7,.3,1)' }).onfinish = () => {
      fly.remove();
      img.style.visibility = '';
    };
  }

  function clearCaptured() { $('redCaptured').innerHTML = ''; $('blueCaptured').innerHTML = ''; }

  function showWin(player, reason) {
    const isRed = player === 'red';
    $('overEmoji').textContent = isRed ? '🔴' : '🔵';
    const title = $('overTitle');
    title.textContent = `${isRed ? '🔴 ĐỎ' : '🔵 XANH'} chiến thắng! 🏆`;
    title.className = isRed ? 'win-red' : 'win-blue';
    $('overReason').textContent = reason;
    $('overlay').classList.add('show');
  }
  const hideWin = () => $('overlay').classList.remove('show');

  function setSound(muted) { $('soundBtn').textContent = muted ? '🔇 Âm: TẮT' : '🔊 Âm: BẬT'; }

  return { setTurn, toast, setPortraits, addCaptured, clearCaptured, showWin, hideWin, setSound };
}
```

- [ ] **Step 5: Write the boot stub `main.js`**

Create `games/jungle-game-remake/js/main.js`. Task 5 replaces it.

```js
/* Boot stub: proves the import map, Three.js and the HUD load. Replaced in Task 5. */
import * as THREE from 'three';
import { Sound } from './audio.js';
import { createHud } from './hud.js';

const hud = createHud({
  onRestart: () => hud.toast('Bàn cờ đã được đặt lại 🌿', 'info'),
  onSoundToggle: () => { Sound.toggle(); hud.setSound(Sound.muted); },
});
hud.setSound(Sound.muted);
hud.setTurn('red');
console.info('Three.js', THREE.REVISION);
window.__booted = true;
```

- [ ] **Step 6: Append the syntax gate to the voxel test file**

Append to `tests/jungle-remake-voxel.test.mjs`:

```js
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test('every remake module parses', () => {
  const dir = new URL('../games/jungle-game-remake/js/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.js'));
  assert.ok(files.length >= 6, `only ${files.length} modules found`);
  for (const f of files) {
    execFileSync(process.execPath, ['--check', fileURLToPath(new URL(f, dir))]);
  }
});
```

`execFileSync` throws, and so fails the test, on any parse error. Static `import` declarations in the middle of a module are hoisted, so appending them is valid.

- [ ] **Step 7: Run tests and static checks**

Run: `node --test 'tests/*.test.mjs'`
Expected: all pass, and the voxel file now reports 13 tests.

Run (in the background): `npx http-server -p 8000 -c-1`
Then run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/games/jungle-game-remake/index.html`
Expected: `200`. Do the same for `/games/jungle-game-remake/js/main.js` and expect `200`.

- [ ] **Step 8: Commit**

Message:

```
feat(jungle-remake): page shell, HUD, audio and boot guard

The remake needs the original's Vietnamese HUD around a canvas, and a
player whose CDN is blocked or who opens the file directly should see
why the board is missing instead of a blank page. The Web Audio synth
is the original's, so both versions sound the same and share the
coThu.muted preference.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task 5: Pixel pipeline, island, water and camera (milestone 1)

**Files:**
- Create: `games/jungle-game-remake/js/mesh.js`
- Create: `games/jungle-game-remake/js/pixel.js`
- Create: `games/jungle-game-remake/js/scene.js`
- Replace: `games/jungle-game-remake/js/main.js`

**Interfaces:**
- Consumes: `VoxelGrid`, `hash3` (Task 3); `C`, `TEAM`, `paletteRGBA` (Task 3); `pickScale`, `lowRes` (Task 3); `terrain`, `ROWS`, `COLS`, `trapOwner` (Task 1); `Sound`, `createHud` (Task 4).
- Produces from `mesh.js`:
  - `shared.uTime` (a uniform object)
  - `geometryFrom(grid, scale, pivot=[0,0,0], meshOpts) → BufferGeometry`, with positions `(v − pivot) · scale` and attributes `position`, `normal`, `color` and `sway`
  - `STATIC_MAT`, `lambert()`, `swayMaterial(amount)`, `voxelMesh(grid, scale, mat=STATIC_MAT, pivot, meshOpts) → Mesh` (casts and receives shadows)
- Produces from `pixel.js`:
  - `createPixelRenderer(canvas) → { renderer, size:{w,h,scale}, resize(cssW,cssH) → size, render(scene,camera), snapshot(scene,camera,w,h) → dataURL }`
  - It throws if WebGL is unavailable.
- Produces from `scene.js`:
  - Constants: `WATER_Y = −0.3`, `SWIM_Y = −0.42`, `SEA_Y = −1`, `CAMERA_BASE`
  - Functions: `tileKind(r,c)`, `ringTop(r,c)`, `createCamera()`, `fitCamera(camera, w, h)`
  - `buildWorld(scene) → world` with `world = { tiles[r][c] (Mesh|null), traps: Map, dens: Map, groundY(r,c), surfaceY(r,c), liftTile(r,c,on) }`

- [ ] **Step 1: Write `mesh.js`**

Create `games/jungle-game-remake/js/mesh.js`:

```js
/* THREE glue for voxel grids. Imported first by main.js: it turns colour management off so
   every hex in palette.js is a display value end to end — the post shader snaps to those same
   numbers, and an sRGB round-trip would shift every colour off the palette. */
import * as THREE from 'three';

THREE.ColorManagement.enabled = false;

/** Shared clock uniform for water, swaying grass and leaves. main.js advances it per frame. */
export const shared = { uTime: { value: 0 } };

export function geometryFrom(grid, scale, pivot = [0, 0, 0], meshOpts) {
  const m = grid.mesh(meshOpts);
  const pos = m.positions;
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] = (pos[i] - pivot[0]) * scale;
    pos[i + 1] = (pos[i + 1] - pivot[1]) * scale;
    pos[i + 2] = (pos[i + 2] - pivot[2]) * scale;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(m.colors, 3));
  geo.setAttribute('sway', new THREE.BufferAttribute(m.sway, 1));
  geo.setIndex(new THREE.BufferAttribute(m.indices, 1));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export const lambert = () => new THREE.MeshLambertMaterial({ vertexColors: true });
export const STATIC_MAT = lambert();

/** Lambert that bends vertices with the `sway` attribute (0 at the base, 1 at the top). */
export function swayMaterial(amount = 1) {
  const mat = lambert();
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = shared.uTime;
    sh.uniforms.uSway = { value: amount };
    sh.vertexShader = 'attribute float sway;\nuniform float uTime;\nuniform float uSway;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 swayW = modelMatrix * vec4(position, 1.0);
        float swayK = sway * sway * uSway;
        transformed.x += sin(uTime * 1.7 + swayW.x * 1.3 + swayW.z * 0.9) * 0.05 * swayK;
        transformed.z += cos(uTime * 1.3 + swayW.z * 1.1 + swayW.x * 0.4) * 0.035 * swayK;`);
  };
  mat.customProgramCacheKey = () => `sway${amount}`;
  return mat;
}

export function voxelMesh(grid, scale, mat = STATIC_MAT, pivot, meshOpts) {
  const mesh = new THREE.Mesh(geometryFrom(grid, scale, pivot, meshOpts), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
```

- [ ] **Step 2: Write `pixel.js`**

Create `games/jungle-game-remake/js/pixel.js`:

```js
/* The pixel-art pipeline. The scene renders at low resolution into a colour+depth target and a
   view-space-normal target; one fullscreen pass then
     1. darkens the rim pixel of every silhouette (depth jump to a farther neighbour),
     2. lightens the upward side of creases (block tops, as in color.png),
     3. adds 4×4 Bayer dither, and
     4. snaps every pixel to the palette.
   The canvas is drawn at that low resolution and CSS scales it by an integer with
   image-rendering: pixelated. */
import * as THREE from 'three';
import { paletteRGBA } from './palette.js';
import { pickScale, lowRes } from './layout.js';

const VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */`
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform sampler2D tPalette;
uniform int uCount;
uniform vec2 uRes;
uniform float uDither;
uniform float uEdge;
varying vec2 vUv;

float depthAt(vec2 p) { return texture2D(tDepth, (p + 0.5) / uRes).r; }
vec3 normalAt(vec2 p) { return texture2D(tNormal, (p + 0.5) / uRes).rgb * 2.0 - 1.0; }
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

void main() {
  vec2 p = floor(vUv * uRes);
  vec3 col = texture2D(tColor, (p + 0.5) / uRes).rgb;
  float d = depthAt(p);
  vec3 n = normalAt(p);

  float rim = 0.0;
  float crease = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 o = i == 0 ? vec2(1.0, 0.0) : i == 1 ? vec2(-1.0, 0.0) : i == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0);
    float dq = depthAt(p + o);
    vec3 nq = normalAt(p + o);
    rim = max(rim, step(uEdge, dq - d));
    float turn = 1.0 - dot(n, nq);
    crease = max(crease, step(0.35, turn) * step(abs(dq - d), uEdge) * step(nq.y + 0.2, n.y));
  }
  if (rim > 0.0) col *= 0.55;
  else if (crease > 0.0) col = min(col * 1.22 + 0.04, vec3(1.0));

  col += (bayer4(p) - 0.5) * uDither;

  vec3 best = col;
  float bestD = 1e9;
  for (int i = 0; i < 256; i++) {
    if (i >= uCount) break;
    vec3 c = texture2D(tPalette, vec2((float(i) + 0.5) / float(uCount), 0.5)).rgb;
    vec3 e = col - c;
    float dist = dot(e * e, vec3(2.0, 4.0, 3.0));
    if (dist < bestD) { bestD = dist; best = c; }
  }
  gl_FragColor = vec4(best, 1.0);
}`;

export function createPixelRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // hexes are display values (mesh.js)
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;            // hard-edged shadows read as pixel art

  const nearest = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
  const colorRT = new THREE.WebGLRenderTarget(1, 1, { ...nearest, depthTexture: new THREE.DepthTexture(1, 1) });
  const normalRT = new THREE.WebGLRenderTarget(1, 1, nearest);
  const normalMat = new THREE.MeshNormalMaterial();

  const pal = paletteRGBA();
  const palTex = new THREE.DataTexture(pal.data, pal.count, 1, THREE.RGBAFormat);
  palTex.minFilter = palTex.magFilter = THREE.NearestFilter;
  palTex.needsUpdate = true;

  const post = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: colorRT.texture },
      tDepth: { value: colorRT.depthTexture },
      tNormal: { value: normalRT.texture },
      tPalette: { value: palTex },
      uCount: { value: pal.count },
      uRes: { value: new THREE.Vector2(1, 1) },
      uDither: { value: 0.04 },
      uEdge: { value: 0.0025 },        // ≈ 0.2 world units with near 1 / far 80
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const quadScene = new THREE.Scene();
  quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const size = { w: 1, h: 1, scale: 2 };

  function setTargets(w, h) {
    renderer.setSize(w, h, false);
    colorRT.setSize(w, h);
    normalRT.setSize(w, h);
    post.uniforms.uRes.value.set(w, h);
  }

  function resize(cssW, cssH) {
    size.scale = pickScale(cssW, cssH);
    Object.assign(size, lowRes(cssW, cssH, size.scale));
    setTargets(size.w, size.h);
    canvas.style.width = `${size.w * size.scale}px`;
    canvas.style.height = `${size.h * size.scale}px`;
    return size;
  }

  function render(scene, camera) {
    renderer.shadowMap.autoUpdate = true;
    renderer.setRenderTarget(colorRT);
    renderer.render(scene, camera);

    // normals pass reuses this frame's shadow map
    renderer.shadowMap.autoUpdate = false;
    const bg = scene.background;
    scene.background = null;
    scene.overrideMaterial = normalMat;
    renderer.setClearColor(0x8080ff, 1);   // encodes the normal (0, 0, 1)
    renderer.setRenderTarget(normalRT);
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    scene.background = bg;

    renderer.setRenderTarget(null);
    renderer.render(quadScene, quadCam);
  }

  /** Render a scene through the full pipeline at w×h and return a PNG data URL. */
  function snapshot(scene, camera, w, h) {
    setTargets(w, h);
    render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    setTargets(size.w, size.h);
    return url;
  }

  return { renderer, size, resize, render, snapshot };
}
```

- [ ] **Step 3: Write `scene.js`**

Create `games/jungle-game-remake/js/scene.js`:

```js
/* The diorama: a grass-and-dirt voxel island (the color.png block look) floating in turquoise
   sea, the 7×9 board on top, two river pools cut into it, one warm sun, and the fixed true-
   isometric camera. Board tile tops are separate meshes so a hovered square can lift. */
import * as THREE from 'three';
import { VoxelGrid, hash3 } from './voxel.js';
import { C, TEAM } from './palette.js';
import { ROWS, COLS, terrain, trapOwner } from './rules.js';
import { voxelMesh, swayMaterial, STATIC_MAT, shared } from './mesh.js';

const V = 8;                          // terrain voxels per tile
export const WATER_Y = -0.3;          // river surface
export const SWIM_Y = -0.42;          // a swimming rat's feet: body half under the surface
export const SEA_Y = -1.0;
export const CAMERA_BASE = new THREE.Vector3(20, 20, 20);   // true isometric: yaw 45°, pitch 35.264°

// Island outline, rows r = −2…10 × cols c = −2…8. '.' = board square; digits = ring tile
// height (0 low, 1 level with the board, 2 raised); ' ' = open sea. Raised tiles stay on the
// far (top/left) sides so nothing tall stands between the camera and the board.
const ISLAND = [
  '  2222221  ',
  ' 222222211 ',
  '22.......10',
  '22.......10',
  '21.......10',
  '22.......10',
  '21.......10',
  '22.......10',
  '21.......10',
  '22.......10',
  '21.......10',
  ' 111111110 ',
  '  0000000  ',
];
const RING_H = { 0: 8, 1: 12, 2: 16 };
const BOARD_H = 12;
const RIVERBED_H = 5;

export function tileKind(r, c) {
  if (r >= 0 && r < ROWS && c >= 0 && c < COLS) return terrain[r][c];
  const ch = ISLAND[r + 2]?.[c + 2];
  return ch && ch !== ' ' ? 'ring' : null;
}
function tileHeight(r, c) {
  const kind = tileKind(r, c);
  if (kind === 'ring') return RING_H[ISLAND[r + 2][c + 2]];
  return kind === 'water' ? RIVERBED_H : BOARD_H;
}
/** World y of the top of island tile (r, c) — where scenery props stand. */
export const ringTop = (r, c) => tileHeight(r, c) / V - 1.5;

function grass(X, Z, light) {
  const n = hash3(X, 0, Z, 11);
  if (light) return n < 0.5 ? C.lime2 : n < 0.88 ? C.lime3 : C.lime1;
  return n < 0.55 ? C.lime3 : n < 0.85 ? C.lime2 : C.lime4;
}
function soil(X, y, Z, h) {
  const n = hash3(X, y, Z, 3);
  if (y === h - 2 && n < 0.55) return C.lime4;     // grass hangs over the block edge
  if (y === h - 3 && n < 0.2) return C.lime5;
  if (n < 0.035) return C.stone2;                  // pebbles in the dirt
  if (y < 3) return C.earth4;
  return y >= h - 5 ? C.earth2 : C.earth3;
}
function ringTopColor(X, Z, r, c, i, k) {
  if (hash3(r, c, 0, 41) < 0.16 && (i - 3.5) ** 2 + (k - 3.5) ** 2 < 7) {   // bare dirt patch
    const n = hash3(X, 1, Z, 5);
    return n < 0.6 ? C.earth1 : n < 0.9 ? C.earth2 : C.sand;
  }
  return grass(X, Z, false);
}
function riverbed(X, Z) {
  const n = hash3(X, 2, Z, 9);
  return n < 0.25 ? C.stone2 : n < 0.35 ? C.earth1 : C.sand;
}

function buildIsland() {
  const g = new VoxelGrid();
  for (let r = -2; r <= 10; r++) {
    for (let c = -2; c <= 8; c++) {
      const kind = tileKind(r, c);
      if (!kind) continue;
      const h = tileHeight(r, c);
      const ownTop = kind === 'land' || kind === 'trap' || kind === 'den';   // see tileTop()
      const fillTo = ownTop ? h - 2 : h;
      for (let i = 0; i < V; i++) {
        for (let k = 0; k < V; k++) {
          const X = (c + 2) * V + i, Z = (r + 2) * V + k;
          for (let y = 0; y < fillTo; y++) {
            const top = y === h - 1;
            g.set(X, y, Z, top ? (kind === 'water' ? riverbed(X, Z) : ringTopColor(X, Z, r, c, i, k))
              : soil(X, y, Z, h));
          }
        }
      }
    }
  }
  // voxel (44, 12, 52) → world (0, 0, 0): x = X/8 − 5.5, y = Y/8 − 1.5, z = Z/8 − 6.5
  return voxelMesh(g, 1 / V, STATIC_MAT, [44, 12, 52]);
}

/** The top two voxel layers of a board square, as its own mesh (so it can lift on hover). */
function tileTop(r, c, kind) {
  const g = new VoxelGrid();
  const light = (r + c) % 2 === 0;               // checkerboard of two grass tones
  for (let i = 0; i < V; i++) {
    for (let k = 0; k < V; k++) {
      const X = c * V + i, Z = r * V + k;
      const n = hash3(X, 7, Z, 21);
      g.set(i, 0, k, n < 0.55 ? C.lime4 : C.earth2);
      const inner = i >= 1 && i <= 6 && k >= 1 && k <= 6;
      let top = grass(X, Z, light);
      if (kind === 'trap' && inner) {
        const corner = (i === 1 || i === 6) && (k === 1 || k === 6);
        top = corner ? TEAM[trapOwner(r)].dark : n < 0.15 ? C.stone3 : n < 0.6 ? C.stone2 : C.stone1;
      } else if (kind === 'den' && inner) {
        top = n < 0.15 ? C.stone2 : n < 0.55 ? C.earth1 : C.sand;
      }
      g.set(i, 1, k, top);
    }
  }
  const mesh = voxelMesh(g, 1 / V, STATIC_MAT, [4, 0, 4]);
  mesh.position.set(c - 3, (BOARD_H - 2) / V - 1.5, r - 4);   // top face lands on y = 0
  mesh.userData.baseY = mesh.position.y;
  return mesh;
}

/** Little grass tufts along the edges of board squares, clear of the centre where pieces stand. */
function buildTufts() {
  const g = new VoxelGrid();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (terrain[r][c] !== 'land') continue;
      const n = hash3(r, c, 0, 61) < 0.6 ? 1 + (hash3(r, c, 1, 61) < 0.35 ? 1 : 0) : 0;
      for (let t = 0; t < n; t++) {
        const side = Math.floor(hash3(r, c, t, 62) * 4);
        const along = 2 + Math.floor(hash3(r, c, t, 63) * 12);
        const [i, k] = [[along, 1], [along, 14], [1, along], [14, along]][side];
        const X = c * 16 + i, Z = r * 16 + k;
        const h = 2 + Math.floor(hash3(r, c, t, 64) * 2);
        for (let y = 0; y < h; y++) g.set(X, y, Z, y === h - 1 ? C.lime2 : C.lime4);
        g.set(X + 1, 0, Z, C.lime3);
        g.set(X - 1, 1, Z, C.lime3);
      }
    }
  }
  const mesh = voxelMesh(g, 1 / 16, swayMaterial(0.6), [56, 0, 72]);
  mesh.castShadow = false;
  return mesh;
}

const WATER_VERT = /* glsl */`
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const WATER_FRAG = /* glsl */`
uniform float uTime;
uniform sampler2D uMask;
uniform vec4 uBounds;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uLight;
uniform vec3 uFoam;
varying vec3 vWorld;
void main() {
  vec2 q = floor(vWorld.xz * 8.0) / 8.0;                 // lock the pattern to the voxel grid
  float dist = texture2D(uMask, (q - uBounds.xy) / uBounds.zw).r;
  vec3 col = mix(uShallow, uDeep, smoothstep(0.15, 0.7, dist));
  float w = sin(q.x * 2.3 + uTime * 0.8) + sin(q.y * 1.9 - uTime * 1.1)
          + 0.6 * sin((q.x - q.y) * 4.1 + uTime * 1.6);
  if (w > 1.75) col = uLight;
  float foam = 0.13 + 0.05 * sin(uTime * 2.2 + (q.x + q.y) * 3.0);
  if (dist < foam) col = uFoam;
  gl_FragColor = vec4(col, 1.0);
}`;

/** Distance-to-shore texture: 0 on solid texels, rising to 1 at `cap` texels away. */
function distanceMask(w, h, solid, cap = 8) {
  const d = new Float32Array(w * h).fill(cap);
  const queue = [];
  for (let i = 0; i < w * h; i++) if (solid(i % w, (i / w) | 0)) { d[i] = 0; queue.push(i); }
  for (let qi = 0; qi < queue.length; qi++) {
    const i = queue[qi], x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (d[j] > d[i] + 1) { d[j] = d[i] + 1; queue.push(j); }
    }
  }
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = Math.round(Math.min(1, d[i] / cap) * 255);
    data.set([v, v, v, 255], i * 4);
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function waterMaterial(mask, bounds, [deep, shallow, light, foam]) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uMask: { value: mask },
      uBounds: { value: new THREE.Vector4(...bounds) },
      uDeep: { value: new THREE.Color(deep) },
      uShallow: { value: new THREE.Color(shallow) },
      uLight: { value: new THREE.Color(light) },
      uFoam: { value: new THREE.Color(foam) },
    },
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
  });
}

function buildPool(cx) {
  // 2 × 3 squares; a one-texel solid border makes the foam hug the walls
  const W = 2 * V + 2, H = 3 * V + 2;
  const mask = distanceMask(W, H, (x, y) => x === 0 || y === 0 || x === W - 1 || y === H - 1);
  const mat = waterMaterial(mask, [cx - 1 - 1 / V, -1.5 - 1 / V, W / V, H / V],
    [C.water3, C.water2, C.water1, C.water0]);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 3), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(cx, WATER_Y, 0);
  return mesh;
}

function buildSea() {
  const minX = -8.5, minZ = -9.5, W = 17 * V, H = 19 * V;
  const mask = distanceMask(W, H, (x, y) => {
    const wx = minX + (x + 0.5) / V, wz = minZ + (y + 0.5) / V;
    return !!tileKind(Math.floor(wz + 4.5), Math.floor(wx + 3.5));
  });
  const mat = waterMaterial(mask, [minX, minZ, 17, 19], [C.water4, C.water3, C.water2, C.water0]);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = SEA_Y;
  return mesh;
}

// Light levels are tuned for the palette-snap pass; adjust at playtest, keep shadows light.
const SUN = 2.2, SKY = 1.6;
function addLights(scene) {
  scene.add(new THREE.HemisphereLight(C.white, C.water2, SKY));
  const sun = new THREE.DirectionalLight(0xfff4d6, SUN);
  sun.position.set(8, 14, 3);        // lights the camera-facing +x sides, shades the +z sides
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
}

export function createCamera() {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 80);
  cam.position.copy(CAMERA_BASE);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  return cam;
}

const fitRef = createCamera();
/** Frame the board plus a strip of island, with headroom for tall pieces at the back. */
export function fitCamera(cam, w, h) {
  let hx = 0, hy = 0;
  const v = new THREE.Vector3();
  for (const x of [-4.6, 4.6]) for (const y of [-0.5, 1.6]) for (const z of [-5.6, 5.6]) {
    v.set(x, y, z).applyMatrix4(fitRef.matrixWorldInverse);
    hx = Math.max(hx, Math.abs(v.x));
    hy = Math.max(hy, Math.abs(v.y));
  }
  const aspect = w / h;
  const half = Math.max(hy, hx / aspect) * 1.04;
  Object.assign(cam, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
  cam.updateProjectionMatrix();
}

export function buildWorld(scene) {
  scene.background = new THREE.Color(C.water2);
  addLights(scene);
  scene.add(buildIsland(), buildSea(), buildPool(-1.5), buildPool(1.5), buildTufts());

  const tiles = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (terrain[r][c] === 'water') continue;
      tiles[r][c] = tileTop(r, c, terrain[r][c]);
      scene.add(tiles[r][c]);
    }
  }

  return {
    tiles,
    traps: new Map(),       // "r,c" → trap prop (Task 6)
    dens: new Map(),        // "r,c" → den prop (Task 6)
    groundY: (r, c) => (terrain[r][c] === 'water' ? SWIM_Y : 0),
    surfaceY: (r, c) => (terrain[r][c] === 'water' ? WATER_Y : 0),
    liftTile(r, c, on) {
      const t = tiles[r]?.[c];
      if (t) t.position.y = t.userData.baseY + (on ? 1 / 16 : 0);
    },
  };
}
```

- [ ] **Step 4: Replace `main.js` with the render loop**

Overwrite `games/jungle-game-remake/js/main.js`:

```js
/* Boot: renderer, scene, camera, HUD and the frame loop. Pieces arrive in Task 6, input in 7. */
import * as THREE from 'three';
import { shared } from './mesh.js';
import { createPixelRenderer } from './pixel.js';
import { buildWorld, createCamera, fitCamera } from './scene.js';
import { Sound } from './audio.js';
import { createHud } from './hud.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('view');

let pixel;
try {
  pixel = createPixelRenderer(canvas);
} catch (err) {
  window.__bootFail('webgl');
  throw err;
}

const scene = new THREE.Scene();
const camera = createCamera();
buildWorld(scene);

const hud = createHud({
  onRestart: () => {},
  onSoundToggle: () => { Sound.toggle(); hud.setSound(Sound.muted); },
});
hud.setSound(Sound.muted);
hud.setTurn('red');

function resize() {
  const r = stage.getBoundingClientRect();
  const s = pixel.resize(r.width, r.height);
  fitCamera(camera, s.w, s.h);
}
new ResizeObserver(resize).observe(stage);
resize();

function frame(now) {
  shared.uTime.value = now / 1000;
  pixel.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__booted = true;
```

- [ ] **Step 5: Static checks**

Run: `node --test 'tests/*.test.mjs'`
Expected: all pass. The syntax gate now covers 9 modules.

With `npx http-server -p 8000 -c-1` running:
`curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/games/jungle-game-remake/js/scene.js` → `200`.

- [ ] **Step 6: PLAYTEST milestone 1. Stop and ask the user.**

Ask the user to open <http://localhost:8000/games/jungle-game-remake/> and check:
- A crisp pixelated island with grass-topped dirt blocks, two turquoise river pools and foam at the shores. The board squares should show a two-tone checker. There are no pieces yet, which is expected.
- It looks like pixel art, not blurry 3D: hard outlines on block edges and light rims on block tops.
- Resizing the window keeps it crisp. A phone-width window (DevTools 375×600) still frames the whole board.
- The shadows feel light, not dark. If they don't, tune `SUN` and `SKY` in `scene.js` together with the user.

Apply the feedback, then continue.

- [ ] **Step 7: Commit**

Message:

```
feat(jungle-remake): pixel-art render pipeline and island diorama

The remake's look depends on rendering small and snapping to a palette,
not on filtering a full-resolution frame, which smears outlines. This
adds the low-res colour/depth/normal pipeline with rim outlines, crease
highlights, Bayer dither and palette snap, plus the voxel island, river
pools and sea with shoreline foam, under a fixed isometric camera.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task 6: Voxel animals, board props and piece views (milestone 2)

**Files:**
- Create: `games/jungle-game-remake/js/models.js`
- Create: `games/jungle-game-remake/js/board-props.js`
- Create: `games/jungle-game-remake/js/views.js`
- Replace: `games/jungle-game-remake/js/main.js`

**Interfaces:**
- Consumes: `VoxelGrid`, `hash3`, `C`, `TEAM`, `cellToWorld`, `ANIMALS`, `TRAPS`, `terrain`; `geometryFrom`, `voxelMesh`, `lambert`, `STATIC_MAT` (Task 5); `world` from `buildWorld` (Task 5).
- Produces from `models.js`:
  - `S = 1/16`
  - `SPECIES`
  - `buildAnimal(type, team) → { root, model, rig:{ body, head, eyes, legs:[fl,fr,bl,br], tail, bodyY, trunk?, earL?, earR? }, mat, height, colors }`. The `root` group is the board position, and `model` handles facing, squash and air. `model.rotation.order` is `'YXZ'`. Red faces +z (`rotation.y = 0`) and blue faces −z (`π`).
  - `buildTrap() → { group, setClosed(k∈[0,1]) }`
  - `buildDen(owner) → { group }`
  - `buildArrow() → Mesh`
- Produces from `board-props.js`: `addBoardProps(world)`, which fills `world.traps` (`"r,c" → trap`) and `world.dens` (`"r,c" → den`). Each prop is parented to its tile-top mesh.
- Produces from `views.js`:
  - `createViews({ scene, camera, world, getPixel }) → api` with
    - `views: Map<id, View>`, `add(piece) → View`, `remove(view)`, `clear()`, `get(id)`
    - `cellPos(r,c) → Vector3`, `resetPose(view)`, `setWeakened(view, on)`, `setSelected(id|null)`, `setActive(player)`
    - `hitboxes() → Mesh[]`, `update(dt, t)`
  - `View = { ...buildAnimal result, ring, badge, hit, piece, pos: Vector3 (logical ground position), air (height above ground), busy (true = a sequence owns the pose), seed, weakened, stars, flourish }`
  - `getPixel() → { ppu }`, where `ppu` is world units per low-res pixel
  - `makePortraits(pixel) → { 'type:team': dataURL }`

- [ ] **Step 1: Write `models.js`**

Create `games/jungle-game-remake/js/models.js`:

```js
/* Procedural voxel models. Animals are built from separate pivoted parts — body, head with
   eyes, four legs, tail, and species extras (elephant ears and trunk) — so they can animate.
   Part geometry is meshed once per species+team and cached; each animal gets its own
   material so a weakened piece can be tinted alone. */
import * as THREE from 'three';
import { VoxelGrid, hash3 } from './voxel.js';
import { C, TEAM } from './palette.js';
import { geometryFrom, voxelMesh, lambert, STATIC_MAT } from './mesh.js';

export const S = 1 / 16;   // animal voxel size: a tile is 16 voxels across

const mod = (a, n) => ((a % n) + n) % n;

// Proportions in voxels. The body is centred on x and z; the head grows forward (+z) from the
// neck; the tail grows backward (−z) from the rump.
export const SPECIES = {
  rat: {
    bw: 4, bh: 4, bl: 8, legH: 2, legW: 2, hw: 4, hh: 4, hl: 4, neck: 0, snout: [2, 2, 2],
    ears: 'round', earSize: 3, tail: { len: 10, t: 1, rise: 0.15, color: C.pink },
    fur: C.ratFur, belly: C.stone1, dark: C.ratDark, nose: C.pink, earIn: C.pink, paw: C.pink,
  },
  cat: {
    bw: 4, bh: 4, bl: 8, legH: 4, legW: 2, hw: 6, hh: 5, hl: 4, neck: 1, snout: [2, 2, 1],
    ears: 'point', earSize: 3, tail: { len: 8, t: 1, rise: 0.6, color: C.catFur, stripe: C.catStripe },
    fur: C.catFur, belly: C.cream, dark: C.catStripe, nose: C.pink, earIn: C.pink, paw: C.cream,
    muzzle: C.cream,
    pattern: (x, y, z) => (y >= 2 && mod(z, 3) === 0 ? C.catStripe : null),
  },
  dog: {
    bw: 6, bh: 5, bl: 10, legH: 4, legW: 2, hw: 6, hh: 5, hl: 5, neck: 1, snout: [4, 3, 3],
    ears: 'floppy', earSize: 4, tail: { len: 5, t: 1, rise: 0.8, color: C.dogFur },
    fur: C.dogFur, belly: C.dogMuzzle, dark: C.dogEar, nose: C.ink, earIn: C.dogEar,
    paw: C.dogMuzzle, muzzle: C.dogMuzzle,
    pattern: (x, y, z) => (y >= 3 && z >= -3 && z <= 0 && x >= 0 ? C.dogEar : null),   // saddle patch
  },
  wolf: {
    bw: 6, bh: 6, bl: 12, legH: 5, legW: 2, hw: 6, hh: 5, hl: 5, neck: 1, snout: [4, 3, 4],
    ears: 'point', earSize: 3, tail: { len: 7, t: 3, rise: -0.35, color: C.wolfFur, tip: C.wolfBelly },
    fur: C.wolfFur, belly: C.wolfBelly, dark: C.wolfDark, nose: C.ink, earIn: C.wolfDark,
    paw: C.wolfDark, muzzle: C.wolfBelly,
    pattern: (x, y, z, sp) => (y >= sp.bh - 1 ? C.wolfDark : null),
  },
  leopard: {
    bw: 6, bh: 5, bl: 12, legH: 5, legW: 2, hw: 6, hh: 5, hl: 5, neck: 1, snout: [4, 3, 2],
    ears: 'small', earSize: 2, tail: { len: 9, t: 1, rise: 0.3, color: C.leoFur, spots: true },
    fur: C.leoFur, belly: C.leoBelly, dark: C.leoSpot, nose: C.pink, earIn: C.leoSpot,
    paw: C.leoBelly, muzzle: C.leoBelly,
    pattern: (x, y, z) => (y > 0 && hash3(x, y, z, 5) < 0.17 ? C.leoSpot : null),
    headPattern: (x, y, z) => (y >= 2 && hash3(x, y, z, 6) < 0.12 ? C.leoSpot : null),
  },
  tiger: {
    bw: 6, bh: 6, bl: 14, legH: 5, legW: 2, hw: 8, hh: 6, hl: 5, neck: 1, snout: [4, 3, 2],
    ears: 'small', earSize: 2, tail: { len: 9, t: 1, rise: 0.3, color: C.tigerFur, stripe: C.ink },
    fur: C.tigerFur, belly: C.tigerBelly, dark: C.ink, nose: C.pink, earIn: C.ink,
    paw: C.tigerBelly, muzzle: C.tigerBelly,
    pattern: (x, y, z) => (y >= 1 && mod(z + (y >> 1), 4) === 0 ? C.ink : null),
    headPattern: (x, y, z, sp) => (y >= sp.hh - 2 && mod(x, 2) === 0 && z <= sp.hl - 3 ? C.ink : null),
  },
  lion: {
    bw: 8, bh: 6, bl: 14, legH: 5, legW: 2, hw: 8, hh: 7, hl: 5, neck: 1, snout: [4, 3, 2],
    ears: 'none', earSize: 0, tail: { len: 8, t: 1, rise: 0.1, color: C.lionFur, tuft: C.lionManeDark },
    fur: C.lionFur, belly: C.lionBelly, dark: C.lionMane, nose: C.ink, earIn: C.lionMane,
    paw: C.lionBelly, muzzle: C.lionBelly, mane: true,
  },
  elephant: {
    bw: 10, bh: 8, bl: 14, legH: 5, legW: 4, hw: 8, hh: 7, hl: 5, neck: 1, snout: null,
    ears: 'big', earSize: 7, tail: { len: 4, t: 1, rise: -0.5, color: C.eleSkin, tuft: C.eleDark },
    fur: C.eleSkin, belly: C.eleSkin, dark: C.eleDark, nose: C.eleDark, earIn: C.eleEar,
    paw: C.stone1, trunk: true, tusks: true,
    pattern: (x, y, z) => (mod(y, 3) === 0 && hash3(x, y, z, 7) < 0.3 ? C.eleDark : null),   // wrinkles
  },
};

function bodyGrid(sp, team) {
  const g = new VoxelGrid();
  const x0 = -sp.bw / 2, x1 = sp.bw / 2 - 1, z0 = -sp.bl / 2, z1 = sp.bl / 2 - 1, top = sp.bh - 1;
  g.box(x0, 0, z0, x1, top, z1, (x, y, z) => {
    const edgeX = x === x0 || x === x1, edgeZ = z === z0 || z === z1;
    if ((y === top || y === 0) && edgeX && edgeZ) return null;      // round the corners
    if (y === 0) return sp.belly;
    return sp.pattern?.(x, y, z, sp) ?? sp.fur;
  });
  // team bandana just behind the head, knot hanging at the chest
  const t = TEAM[team];
  for (let z = z1 - 3; z <= z1 - 2; z++) {
    for (let y = 1; y <= top; y++) { g.set(x0 - 1, y, z, t.main); g.set(x1 + 1, y, z, t.main); }
    for (let x = x0 - 1; x <= x1 + 1; x++) g.set(x, top + 1, z, t.main);
  }
  g.box(-1, 0, z1 + 1, 0, 1, z1 + 1, t.dark);
  return g;
}

function earsGrid(sp) {
  const g = new VoxelGrid();
  const x0 = -sp.hw / 2, hh = sp.hh, s = sp.earSize;
  if (sp.ears === 'round') {
    for (let dx = 0; dx < s; dx++) for (let dy = 0; dy < s; dy++) {
      if ((dx === 0 || dx === s - 1) && (dy === 0 || dy === s - 1)) continue;
      g.set(x0 - 1 + dx, hh - 1 + dy, 1, dx === 1 && dy === 1 ? sp.earIn : sp.fur);
    }
  } else if (sp.ears === 'point') {
    for (let j = 0; j < s; j++) for (let i = 0; i < s - j; i++) {
      g.set(x0 + Math.floor(j / 2) + i, hh + j, 1, j === 0 && i > 0 && i < s - 1 ? sp.earIn : sp.fur);
    }
  } else if (sp.ears === 'small') {
    g.box(x0, hh, 1, x0 + 1, hh + 1, 1, (x, y) => (x === x0 + 1 && y === hh ? sp.earIn : sp.fur));
  } else if (sp.ears === 'floppy') {
    g.box(x0 - 1, hh - s, 1, x0 - 1, hh - 1, 2, sp.dark);
  } else {
    return g;
  }
  return g.merge(g.mirrorX());
}

function headGrid(sp) {
  const g = new VoxelGrid();
  const x0 = -sp.hw / 2, x1 = sp.hw / 2 - 1, top = sp.hh - 1, front = sp.hl - 1;
  g.box(x0, 0, 0, x1, top, front, (x, y, z) => {
    if ((x === x0 || x === x1) && (y === top || y === 0) && (z === 0 || z === front)) return null;
    if (sp.muzzle && z === front && y <= 1) return sp.muzzle;            // cheeks
    return sp.headPattern?.(x, y, z, sp) ?? sp.fur;
  });
  if (sp.snout) {
    const [sw, sh, sl] = sp.snout;
    const sx0 = -sw / 2, sx1 = sw / 2 - 1, sz1 = sp.hl + sl - 1;
    g.box(sx0, 0, sp.hl, sx1, sh - 1, sz1, sp.muzzle ?? sp.fur);
    for (let x = Math.max(sx0, -1); x <= Math.min(sx1, 0); x++) g.set(x, sh - 1, sz1, sp.nose);
    if (sh >= 3) for (let x = sx0; x <= sx1; x++) g.set(x, 0, sz1, sp.dark);   // mouth line
  }
  if (sp.tusks) {
    for (const x of [-3, 2]) {
      g.set(x, 1, sp.hl, C.white);
      g.set(x, 0, sp.hl + 1, C.white);
      g.set(x, 0, sp.hl + 2, C.white);
    }
  }
  if (sp.mane) {
    g.box(x0 - 2, -2, -1, x1 + 2, sp.hh + 1, sp.hl - 3, (x, y, z) => {
      if (x >= x0 && x <= x1 && y >= 0 && y < sp.hh && z >= 0) return null;     // the head itself
      if ((x === x0 - 2 || x === x1 + 2) && (y === -2 || y === sp.hh + 1)) return null;
      return hash3(x, y, z, 17) < 0.35 ? C.lionManeDark : C.lionMane;
    });
  }
  return g.merge(earsGrid(sp));
}

const eyeY = sp => Math.max(2, sp.hh - 3);
function eyesGrid(sp) {
  // one voxel each, just proud of the face, so a blink can squash them without a hole behind
  return new VoxelGrid()
    .set(-sp.hw / 2, eyeY(sp), sp.hl, C.ink)
    .set(sp.hw / 2 - 1, eyeY(sp), sp.hl, C.ink);
}

function legGrid(sp) {
  const w = sp.legW;
  return new VoxelGrid().box(-w / 2, -sp.legH, -w / 2, w / 2 - 1, -1, w / 2 - 1,
    (x, y) => (y === -sp.legH ? sp.paw : sp.fur));
}

function tailGrid(sp) {
  const t = sp.tail;
  const g = new VoxelGrid();
  for (let i = 0; i < t.len; i++) {
    const y = Math.round(i * t.rise), z = -1 - i;
    const r = t.t === 3 && i < t.len - 2 ? 1 : 0;     // bushy tails taper at the tip
    let col = t.color;
    if (t.stripe && i % 2 === 1) col = t.stripe;
    if (t.spots && hash3(i, 3, 0, 9) < 0.3) col = sp.dark;
    if ((t.tip || t.tuft) && i >= t.len - 2) col = t.tip ?? t.tuft;
    g.box(-r, y - r, z, r, y + r, z, col);
  }
  if (t.tuft) {
    const end = t.len - 1, y = Math.round(end * t.rise);
    g.box(-1, y - 1, -2 - end, 0, y, -1 - end, t.tuft);
  }
  return g;
}

function trunkGrid() {
  const g = new VoxelGrid();
  for (let i = 0; i < 8; i++) g.box(-1, -i, 0, 0, -i, 1, i % 2 ? C.eleDark : C.eleSkin);
  g.box(-1, -8, 1, 0, -8, 3, C.eleSkin);              // the tip curls forward
  g.box(-1, -7, 3, 0, -7, 3, C.eleDark);
  return g;
}

function bigEarGrid(sp) {
  // rounded flap hinged at its front edge: outer skin at x = 0, pink inner face at x = 1
  const g = new VoxelGrid();
  for (let y = -6; y <= 3; y++) for (let z = -6; z <= 0; z++) {
    if (((y + 1.5) / 4.5) ** 2 + ((z + 2.5) / 3.5) ** 2 > 1) continue;
    g.set(0, y, z, sp.fur);
    g.set(1, y, z, sp.earIn);
  }
  return g;
}

const geoCache = new Map();
function cachedGeometry(key, make, pivot) {
  if (!geoCache.has(key)) geoCache.set(key, geometryFrom(make(), S, pivot));
  return geoCache.get(key);
}

export function buildAnimal(type, team) {
  const sp = SPECIES[type];
  const mat = lambert();
  const part = (name, make, pivot) => {
    const m = new THREE.Mesh(cachedGeometry(`${type}:${team}:${name}`, make, pivot), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  const root = new THREE.Group();
  const model = new THREE.Group();
  model.rotation.order = 'YXZ';            // facing first, then tilt/roll in the animal's frame
  root.add(model);

  const body = part('body', () => bodyGrid(sp, team));
  body.position.y = sp.legH * S;
  model.add(body);

  const headY = sp.legH + sp.bh - 2 + sp.neck;
  const head = new THREE.Group();
  head.position.set(0, headY * S, (sp.bl / 2 - 2) * S);
  head.add(part('head', () => headGrid(sp)));
  const ey = eyeY(sp);
  const eyes = part('eyes', () => eyesGrid(sp), [0, ey + 0.5, 0]);
  eyes.position.y = (ey + 0.5) * S;
  head.add(eyes);
  model.add(head);

  const lx = (sp.bw / 2 - sp.legW / 2) * S, lz = (sp.bl / 2 - sp.legW / 2 - 1) * S;
  const legs = [[-lx, lz], [lx, lz], [-lx, -lz], [lx, -lz]].map(([x, z]) => {   // fl, fr, bl, br
    const leg = part('leg', () => legGrid(sp));
    leg.position.set(x, sp.legH * S, z);
    model.add(leg);
    return leg;
  });

  const tail = part('tail', () => tailGrid(sp));
  tail.position.set(0, (sp.legH + sp.bh - 2) * S, (-sp.bl / 2) * S);
  model.add(tail);

  const rig = { body, head, eyes, legs, tail, bodyY: body.position.y };
  if (sp.trunk) {
    rig.trunk = part('trunk', trunkGrid);
    rig.trunk.position.set(0, (sp.hh - 3) * S, sp.hl * S);
    head.add(rig.trunk);
  }
  if (sp.ears === 'big') {
    rig.earL = part('earL', () => bigEarGrid(sp));
    rig.earL.position.set((-sp.hw / 2 - 2) * S, (sp.hh - 2) * S, 2 * S);
    rig.earR = part('earR', () => bigEarGrid(sp).mirrorX());
    rig.earR.position.set((sp.hw / 2 + 2) * S, (sp.hh - 2) * S, 2 * S);
    head.add(rig.earL, rig.earR);
  }

  model.rotation.y = team === 'red' ? 0 : Math.PI;
  const crown = sp.ears === 'point' ? sp.earSize : sp.ears === 'small' || sp.mane ? 2 : 0;
  return {
    root, model, rig, mat,
    height: (headY + sp.hh + crown) * S,
    colors: [sp.fur, sp.fur, sp.belly, sp.dark, TEAM[team].main],
  };
}

/** Snare on a trap square: four stakes and a rope, with two toothed jaws lying open. */
export function buildTrap() {
  const group = new THREE.Group();
  const base = new VoxelGrid();
  for (const [x, z] of [[-6, -6], [5, -6], [-6, 5], [5, 5]]) base.box(x, 0, z, x, 3, z, C.earth3);
  for (let i = -6; i <= 5; i++) {
    base.set(i, 2, -6, C.sand); base.set(i, 2, 5, C.sand);
    base.set(-6, 2, i, C.sand); base.set(5, 2, i, C.sand);
  }
  group.add(voxelMesh(base, S));

  const jaw = new VoxelGrid().box(0, 0, -4, 4, 0, 3, C.stone3);
  for (let z = -4; z <= 3; z += 2) jaw.set(4, 1, z, C.stone1);           // teeth on the inner edge
  const jawA = voxelMesh(jaw, S);
  jawA.position.set(-5 * S, 0.005, 0);
  const jawB = voxelMesh(jaw.mirrorX(), S);
  jawB.position.set(5 * S, 0.005, 0);
  group.add(jawA, jawB);

  return {
    group,
    setClosed(k) { jawA.rotation.z = k * 1.35; jawB.rotation.z = -k * 1.35; },
  };
}

/** Mossy stone arch over a den square. The opening faces along the rows, toward the board. */
export function buildDen(owner) {
  const t = TEAM[owner];
  const g = new VoxelGrid();
  const brick = (x, y, z) => {
    if (y % 2 === 0 && hash3(x, y, z, 4) < 0.6) return C.stone3;          // mortar course
    if (mod(x + z + (Math.floor(y / 2) % 2) * 2, 4) === 0) return C.stone3;
    return hash3(x, y, z, 5) < 0.3 ? C.stone1 : C.stone2;
  };
  g.box(-8, 0, -3, -5, 13, 2, brick);       // pillars on the square's left and right edges
  g.box(4, 0, -3, 7, 13, 2, brick);
  g.box(-9, 14, -4, 8, 15, 3, brick);       // lintel
  g.box(-6, 16, -3, 5, 16, 2, brick);       // stepped cap
  for (let i = 0; i < 46; i++) {            // ivy over the lintel and down the pillar faces
    const x = -9 + Math.floor(hash3(i, 1, 0, 31) * 18);
    const front = hash3(i, 2, 0, 31) < 0.5;
    const len = 2 + Math.floor(hash3(i, 3, 0, 31) * 10);
    const onPillar = (x >= -8 && x <= -5) || (x >= 4 && x <= 7);
    for (let j = 0; j < len; j++) {
      const y = 16 - j;
      if (y < 14 && !onPillar) break;
      const z = y >= 14 ? (front ? -5 : 4) : (front ? -4 : 3);
      g.set(x, y, z, hash3(x, y, z, 8) < 0.5 ? C.lime4 : C.lime3);
    }
  }
  const group = new THREE.Group();
  group.add(voxelMesh(g, S));

  // team banners on the pillars' outer faces (clear of pieces walking through the arch)
  const banner = new VoxelGrid();
  for (let y = 4; y <= 12; y++) for (let z = -2; z <= 1; z++) {
    banner.set(0, y, z, z === -2 || z === 1 || y === 12 ? t.dark : t.main);
  }
  banner.set(0, 3, -1, t.main).set(0, 3, 0, t.main);
  for (const [y, z] of [[7, -1], [7, 0], [8, -1], [8, 0], [10, -1], [10, 0]]) banner.set(0, y, z, C.white);
  const left = voxelMesh(banner, S);
  left.position.x = -9 * S;
  const right = voxelMesh(banner, S);
  right.position.x = 8 * S;
  group.add(left, right);
  return { group };
}

/** Bobbing gold arrow over the selected piece. */
export function buildArrow() {
  const g = new VoxelGrid();
  const widths = [0, 1, 2, 3, 1, 1, 1];
  widths.forEach((k, y) => g.box(-k, y, 0, k, y, 0, y === 0 ? C.flame : C.gold));
  const mesh = voxelMesh(g, S, STATIC_MAT, [0.5, 0, 0.5]);
  mesh.castShadow = false;
  return mesh;
}
```

- [ ] **Step 2: Write `board-props.js`**

Create `games/jungle-game-remake/js/board-props.js`:

```js
/* Traps and dens on their board squares. Each prop is parented to its square's tile-top mesh
   (local y 0.25 = the tile's top face) so it rises with the hover lift. */
import { TRAPS } from './rules.js';
import { buildTrap, buildDen } from './models.js';

export function addBoardProps(world) {
  for (const [r, c] of TRAPS) {
    const trap = buildTrap();
    trap.group.position.y = 0.25;
    world.tiles[r][c].add(trap.group);
    world.traps.set(`${r},${c}`, trap);
  }
  for (const [r, c] of [[0, 3], [8, 3]]) {
    const den = buildDen(r === 0 ? 'red' : 'blue');
    den.group.position.y = 0.25;
    world.tiles[r][c].add(den.group);
    world.dens.set(`${r},${c}`, den);
  }
}
```

- [ ] **Step 3: Write `views.js`**

Create `games/jungle-game-remake/js/views.js`:

```js
/* Piece views: one voxel animal per piece, plus its team ring and rank badge. Idle life comes
   from breathing, a look-around, the tail, blinks and an occasional species flourish. Positions
   snap to the low-res pixel grid so moving pieces step in whole pixels, like sprites. A view
   whose `busy` flag is set belongs to an animation sequence (anim.js), and idle leaves it alone. */
import * as THREE from 'three';
import { ANIMALS, terrain } from './rules.js';
import { C, TEAM, hexCss } from './palette.js';
import { buildAnimal, buildArrow } from './models.js';
import { cellToWorld } from './layout.js';

const PITCH = Math.atan(1 / Math.SQRT2);               // true-iso pitch, 35.264°
const COS_P = Math.cos(PITCH), SIN_P = Math.sin(PITCH);
const SCREEN_RIGHT = new THREE.Vector3(1, 0, -1).normalize();   // ground direction → screen right
const SCREEN_UP = new THREE.Vector3(-1, 0, -1).normalize();     // ground direction → screen up

const DIGITS = {
  1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'], 6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '010', '010', '010'], 8: ['111', '101', '111', '101', '111'],
};

function makeBadge(rank, team) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 9;
  const g = cv.getContext('2d');
  g.fillStyle = hexCss(C.ink); g.fillRect(0, 0, 9, 9);
  g.fillStyle = hexCss(TEAM[team].main); g.fillRect(1, 1, 7, 7);
  g.fillStyle = hexCss(C.white);
  DIGITS[rank].forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '1') g.fillRect(3 + x, 2 + y, 1, 1); }));
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: tex }));
  mesh.castShadow = false;
  return mesh;
}

const stretch = (v, k) => {
  const s = Math.sin(k * Math.PI);
  v.rig.legs[0].rotation.x = v.rig.legs[1].rotation.x = -0.7 * s;
  v.model.rotation.x = 0.12 * s;
  v.rig.head.rotation.x = -0.2 * s;
};
// Species flourishes, as poses of k ∈ [0, 1] over ~1.4 s.
const FLOURISH = {
  elephant(v, k) {
    const f = Math.sin(k * Math.PI * 4) * 0.7;
    v.rig.earL.rotation.y = -f; v.rig.earR.rotation.y = f;
    v.rig.trunk.rotation.x = -Math.sin(k * Math.PI) * 0.9;
  },
  lion(v, k) { v.rig.head.rotation.z = Math.sin(k * Math.PI * 6) * 0.25 * (1 - k); },
  cat(v, k) {
    const s = Math.sin(k * Math.PI);
    v.rig.legs[0].rotation.x = -1.3 * s;
    v.rig.head.rotation.x = 0.35 * s;
    v.rig.head.rotation.y = 0.3 * s;
  },
  rat(v, k) {
    v.rig.head.scale.z = 1 + 0.12 * Math.abs(Math.sin(k * Math.PI * 8));
    v.rig.head.rotation.y = Math.sin(k * Math.PI * 3) * 0.4;
  },
  dog(v, k) { v.rig.tail.rotation.y = Math.sin(k * Math.PI * 16) * 0.7; },
  wolf(v, k) { v.rig.head.rotation.x = -0.7 * Math.sin(Math.min(1, k * 1.4) * Math.PI); },
  tiger: stretch,
  leopard: stretch,
};

export function createViews({ scene, camera, world, getPixel }) {
  const views = new Map();
  const ringGeo = new THREE.RingGeometry(0.33, 0.43, 20);
  const hitGeo = new THREE.BoxGeometry(0.8, 1, 0.8);
  const hitMat = new THREE.MeshBasicMaterial();
  const starGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
  const starMat = new THREE.MeshBasicMaterial({ color: C.gold });
  const arrow = buildArrow();
  arrow.rotation.y = Math.PI / 4;             // face the camera
  arrow.visible = false;
  scene.add(arrow);
  const tmp = new THREE.Vector3();
  let selectedId = null;
  let activePlayer = 'red';

  function cellPos(r, c) {
    const { x, z } = cellToWorld(r, c);
    return new THREE.Vector3(x, world.groundY(r, c), z);
  }

  function add(piece) {
    const a = buildAnimal(piece.type, piece.player);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: TEAM[piece.player].main }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.015;
    const badge = makeBadge(ANIMALS[piece.type].rank, piece.player);
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.visible = false;
    hit.scale.y = a.height;
    hit.position.y = a.height / 2;
    hit.userData.pieceId = piece.id;
    a.root.add(ring, badge, hit);
    scene.add(a.root);
    const v = {
      ...a, ring, badge, hit, piece,
      pos: cellPos(piece.row, piece.col), air: 0, busy: false,
      seed: Math.random() * 100, blinkT: 1 + Math.random() * 4,
      nextFlourish: 3 + Math.random() * 6, flourish: null, weakened: false, stars: null,
    };
    views.set(piece.id, v);
    snap(v, getPixel().ppu);
    return v;
  }

  function remove(v) {
    scene.remove(v.root);
    v.mat.dispose();
    v.ring.material.dispose();
    v.badge.material.map.dispose();
    v.badge.material.dispose();
    v.badge.geometry.dispose();
    views.delete(v.piece.id);
  }
  const clear = () => [...views.values()].forEach(remove);

  function resetPose(v) {
    const R = v.rig;
    R.body.position.y = R.bodyY;
    R.head.rotation.set(0, 0, 0);
    R.head.scale.set(1, 1, 1);
    R.tail.rotation.set(0, 0, 0);
    R.legs.forEach(l => l.rotation.set(0, 0, 0));
    if (R.trunk) R.trunk.rotation.set(0, 0, 0);
    if (R.earL) { R.earL.rotation.set(0, 0, 0); R.earR.rotation.set(0, 0, 0); }
    v.model.rotation.x = 0;
    v.model.rotation.z = 0;
    v.model.scale.set(1, 1, 1);
  }

  function setWeakened(v, on) {
    if (v.weakened === on) return;
    v.weakened = on;
    v.mat.color.setHex(on ? 0xb0b0b0 : 0xffffff);
    if (on) {
      v.stars = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const m = new THREE.Mesh(starGeo, starMat);
        const a = (i * Math.PI * 2) / 3;
        m.position.set(Math.cos(a) * 0.18, 0, Math.sin(a) * 0.18);
        v.stars.add(m);
      }
      v.root.add(v.stars);
    } else {
      v.root.remove(v.stars);
      v.stars = null;
    }
  }

  /** Put the root on the pixel grid: the screen-space rounding error is undone along the ground. */
  function snap(v, ppu) {
    tmp.copy(v.pos).applyMatrix4(camera.matrixWorldInverse);
    const dx = Math.round(tmp.x / ppu) * ppu - tmp.x;
    const dy = Math.round(tmp.y / ppu) * ppu - tmp.y;
    v.root.position.copy(v.pos).addScaledVector(SCREEN_RIGHT, dx).addScaledVector(SCREEN_UP, dy / SIN_P);
    const step = ppu / COS_P;                      // one pixel of vertical world motion
    v.model.position.y = Math.round(v.air / step) * step;
  }

  function update(dt, t) {
    const { ppu } = getPixel();
    for (const v of views.values()) {
      const R = v.rig, s = v.seed;
      const active = v.piece.player === activePlayer;
      const sel = v.piece.id === selectedId;
      if (!v.busy) {
        if (v.flourish) {
          v.flourish.t += dt;
          const k = Math.min(1, v.flourish.t / v.flourish.dur);
          resetPose(v);
          v.flourish.fn(v, k);
          if (k >= 1) { v.flourish = null; resetPose(v); }
        } else {
          R.body.position.y = R.bodyY + Math.sin(t * 2.4 + s) * 0.012 * (active ? 1.5 : 1);
          R.head.rotation.x = Math.sin(t * 1.3 + s) * 0.06;
          R.head.rotation.y = Math.sin(t * 0.45 + s * 2) * (active ? 0.3 : 0.18);
          R.tail.rotation.y = Math.sin(t * 3 + s) * 0.3;
          if (R.trunk) R.trunk.rotation.x = Math.sin(t * 1.1 + s) * 0.15;
          if (R.earL) { const f = Math.sin(t * 1.6 + s) * 0.12; R.earL.rotation.y = -f; R.earR.rotation.y = f; }
          v.nextFlourish -= dt;
          if (v.nextFlourish <= 0) {
            v.nextFlourish = 6 + Math.random() * 8;
            v.flourish = { t: 0, dur: 1.4, fn: FLOURISH[v.piece.type] };
          }
        }
        const swimming = terrain[v.piece.row][v.piece.col] === 'water';
        v.air = sel ? Math.abs(Math.sin(t * 6)) * 0.08 : swimming ? 0.02 + Math.sin(t * 3 + s) * 0.02 : 0;
      }
      v.blinkT -= dt;
      if (v.blinkT < -0.12) v.blinkT = 2 + Math.random() * 4;
      R.eyes.scale.y = v.blinkT < 0 ? 0.25 : 1;
      v.ring.scale.setScalar(sel ? 1 + Math.sin(t * 8) * 0.08 : 1);
      v.ring.material.color.setHex(active ? TEAM[v.piece.player].main : TEAM[v.piece.player].dark);
      snap(v, ppu);
      v.badge.position.y = v.height + 0.2 + v.model.position.y;
      v.badge.quaternion.copy(camera.quaternion);
      if (v.stars) {
        v.stars.rotation.y = t * 3;
        v.stars.position.y = v.height + 0.02 + v.model.position.y;
      }
    }
    const sv = views.get(selectedId);
    arrow.visible = !!sv;
    if (sv) {
      arrow.position.set(sv.root.position.x,
        sv.root.position.y + sv.model.position.y + sv.height + 0.42 + Math.abs(Math.sin(t * 4)) * 0.08,
        sv.root.position.z);
    }
  }

  return {
    views, add, remove, clear, cellPos, resetPose, setWeakened, update,
    get: id => views.get(id),
    setSelected(id) { selectedId = id; },
    setActive(player) { activePlayer = player; },
    hitboxes: () => [...views.values()].map(v => v.hit),
  };
}

/** Portraits for the captured trays: each animal rendered through the same pixel pipeline. */
export function makePortraits(pixel) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.cream);
  scene.add(new THREE.HemisphereLight(C.white, C.water2, 1.6));
  const sun = new THREE.DirectionalLight(0xfff4d6, 2.2);
  sun.position.set(8, 14, 3);
  scene.add(sun);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 80);
  const out = {};
  for (const team of ['red', 'blue']) {
    for (const type of Object.keys(ANIMALS)) {
      const a = buildAnimal(type, team);
      a.model.rotation.y = Math.PI / 4;           // three-quarter view toward the camera
      scene.add(a.root);
      const half = 0.3 + a.height * 0.45;
      Object.assign(cam, { left: -half, right: half, top: half, bottom: -half });
      cam.updateProjectionMatrix();
      cam.position.set(20, 20 + a.height / 2, 20);
      cam.lookAt(0, a.height / 2, 0);
      cam.updateMatrixWorld();
      out[`${type}:${team}`] = pixel.snapshot(scene, cam, 40, 40);
      scene.remove(a.root);
      a.mat.dispose();
    }
  }
  return out;
}
```

- [ ] **Step 4: Replace `main.js`**

Overwrite `games/jungle-game-remake/js/main.js`:

```js
/* Boot: renderer, scene, camera, HUD, pieces and the frame loop. Input arrives in Task 7. */
import * as THREE from 'three';
import { shared } from './mesh.js';
import { createPixelRenderer } from './pixel.js';
import { buildWorld, createCamera, fitCamera } from './scene.js';
import { addBoardProps } from './board-props.js';
import { createViews, makePortraits } from './views.js';
import { createGame } from './rules.js';
import { Sound } from './audio.js';
import { createHud } from './hud.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('view');

let pixel;
try {
  pixel = createPixelRenderer(canvas);
} catch (err) {
  window.__bootFail('webgl');
  throw err;
}

const scene = new THREE.Scene();
const camera = createCamera();
const world = buildWorld(scene);
addBoardProps(world);

const getPixel = () => ({ ppu: (camera.top - camera.bottom) / camera.zoom / pixel.size.h });
const views = createViews({ scene, camera, world, getPixel });
const game = createGame();

const hud = createHud({
  onRestart: () => {},
  onSoundToggle: () => { Sound.toggle(); hud.setSound(Sound.muted); },
});
hud.setSound(Sound.muted);
hud.setTurn('red');
hud.setPortraits(makePortraits(pixel));

function resize() {
  const r = stage.getBoundingClientRect();
  const s = pixel.resize(r.width, r.height);
  fitCamera(camera, s.w, s.h);
}
new ResizeObserver(resize).observe(stage);
resize();

game.pieces.forEach(p => views.add(p));

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  shared.uTime.value = t;
  camera.updateMatrixWorld();
  views.update(dt, t);
  pixel.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__booted = true;
```

- [ ] **Step 5: Static checks**

Run: `node --test 'tests/*.test.mjs'`
Expected: all pass. The syntax gate now covers 12 modules.
`curl` returns `200` for `js/models.js`, `js/views.js` and `js/board-props.js`.

- [ ] **Step 6: PLAYTEST milestone 2. Stop and ask the user.**

Ask the user to reload and check:
- All 16 pieces stand on their starting squares. Each of the 8 animals is recognisable by silhouette: rat ears and tail, cat, floppy-eared dog, grey wolf with a bushy tail, spotted leopard, striped tiger, maned lion, and an elephant with trunk, tusks and big ears.
- Red pieces face the far side and Blue pieces face the camera. Team bandanas and rings read clearly, and the rank badges (1–8) are legible.
- Idle life: breathing, head turns, tails, blinks and occasional flourishes, with no jitter or shimmering while idle.
- The trap snares, den arches and banners are on their squares.

Apply the feedback (proportions in `SPECIES`, colours in `palette.js`), then continue.

- [ ] **Step 7: Commit**

Message:

```
feat(jungle-remake): voxel animals, traps, dens and idle life

The board needs pieces you can tell apart at a glance without emoji.
Each animal is an articulated voxel model with its own silhouette cues
(mane, trunk, stripes, spots, ears), a team bandana and ring, and a rank
badge, with idle breathing, blinks and species flourishes. Positions
snap to the low-res pixel grid so motion steps like sprite art.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task 7: Effects, animation sequences and input (milestone 3)

**Files:**
- Create: `games/jungle-game-remake/js/fx.js`
- Create: `games/jungle-game-remake/js/anim.js`
- Replace: `games/jungle-game-remake/js/main.js` (final)

**Interfaces:**
- Consumes: the views API (Task 6), `world` including `traps`, `groundY` and `surfaceY` (Tasks 5–6), `WATER_Y` (Task 5), `terrain`, `onEnemyTrap`, `ANIMALS`, `inBounds` (Task 1), `cellToWorld`, `worldToCell`, `resolvePick` (Task 3), `Sound`, `hud` (Task 4).
- Produces from `fx.js`:
  - `ease = { linear, out, in, inOut, outBack }`
  - `tween(ms, fn(e, k), easing) → Promise`
  - `wait(ms) → Promise`
  - `hitStop(ms)`, which freezes all tweens for that long
  - `updateTweens(dtMs)`
  - `createParticles(scene, max=900) → { spawn(opts), update(dt), clear() }`, where `opts = { pos, vel?, color, size?, sy?, flat?, life?, gravity?, drag?, floor?, onFloor?(p), spin?, shrink?, tail?, grow? }`
  - `startShake('heavy'|'soft')`
  - `shakeOffset(dt) → [px, py]` (whole low-res pixels)
- Produces from `anim.js`:
  - `createAnimator({ scene, camera, world, views, particles, sound, hud, camRig, toScreen })`, returning:
    - `play(events) → Promise`
    - `spawnAll(pieces) → Promise` (the drop-in)
    - `reset()`
    - `showMoves(moves)`
    - `clearMoves()`
    - `setHover(cell|null, game)`
    - `update(t)`
  - `camRig = { offset: Vector3, zoom }` is owned by main.js.

- [ ] **Step 1: Write `fx.js`**

Create `games/jungle-game-remake/js/fx.js`:

```js
/* Small effects kit: promise tweens with a global hit-stop, one pooled InstancedMesh of cubes
   for every particle (dust, blood, splashes, smoke, sparks, confetti, stains), and a camera
   shake measured in whole low-res pixels so the shaken frame stays crisp. */
import * as THREE from 'three';

export const ease = {
  linear: t => t,
  out: t => 1 - (1 - t) ** 3,
  in: t => t ** 3,
  inOut: t => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: t => { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
};

const tweens = new Set();
let frozen = 0;

/** Run fn(easedK, k) every frame for `ms`; resolves when done. */
export function tween(ms, fn, easing = ease.inOut) {
  return new Promise(res => tweens.add({ t: 0, d: Math.max(1, ms), fn, easing, res }));
}
export const wait = ms => tween(ms, () => {});
/** Freeze every tween for `ms` — the impact frame of a capture. */
export function hitStop(ms) { frozen = Math.max(frozen, ms); }

export function updateTweens(dtMs) {
  if (frozen > 0) { frozen -= dtMs; return; }
  for (const tw of [...tweens]) {
    tw.t += dtMs;
    const k = Math.min(1, tw.t / tw.d);
    tw.fn(tw.easing(k), k);
    if (k >= 1) { tweens.delete(tw); tw.res(); }
  }
}

export function createParticles(scene, max = 900) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, new THREE.Color(1, 1, 1));       // allocates instanceColor
  mesh.count = 0;
  mesh.frustumCulled = false;
  scene.add(mesh);

  const list = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const sc = new THREE.Vector3(), col = new THREE.Color();

  function spawn(o) {
    if (list.length >= max) return;
    const size = o.size ?? 0.05;
    list.push({
      p: o.pos.clone(), v: o.vel ? o.vel.clone() : new THREE.Vector3(),
      size, sy: o.flat ? 0.012 : (o.sy ?? size), color: o.color,
      life: o.life ?? 1, age: 0, g: o.gravity ?? 9, drag: o.drag ?? 0,
      floor: o.floor ?? -Infinity, onFloor: o.onFloor, spin: o.spin ?? 0, rot: Math.random() * 6,
      shrink: o.shrink ?? true, tail: o.tail ?? 1, grow: o.grow ?? 0,
    });
  }

  function update(dt) {
    const landed = [];
    for (let i = list.length - 1; i >= 0; i--) {
      const P = list[i];
      P.age += dt;
      if (P.age >= P.life) { list.splice(i, 1); continue; }
      P.v.y -= P.g * dt;
      if (P.drag) P.v.multiplyScalar(Math.max(0, 1 - P.drag * dt));
      P.p.addScaledVector(P.v, dt);
      P.rot += P.spin * dt;
      if (P.p.y < P.floor) {
        P.p.y = P.floor;
        if (P.onFloor) { landed.push(P); list.splice(i, 1); continue; }
        P.v.set(0, 0, 0);
        P.spin = 0;
      }
    }
    landed.forEach(P => P.onFloor(P));                 // may spawn stains; safe after the loop

    let n = 0;
    for (const P of list) {
      const left = 1 - P.age / P.life;
      const k = P.shrink ? Math.min(1, left / P.tail) : 1;
      const g = 1 + P.grow * (P.age / P.life);
      sc.set(P.size * k * g, P.sy * k * g, P.size * k * g);
      q.setFromEuler(e.set(P.rot, P.rot * 0.7, 0));
      m4.compose(P.p, q, sc);
      mesh.setMatrixAt(n, m4);
      mesh.setColorAt(n, col.setHex(P.color));
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  return { spawn, update, clear: () => { list.length = 0; } };
}

const shake = { t: 0, dur: 1, amp: 0 };
export function startShake(intensity = 'heavy') {
  const heavy = intensity !== 'soft';
  shake.amp = heavy ? 4 : 2;
  shake.dur = shake.t = heavy ? 0.55 : 0.35;
}
/** This frame's shake offset in whole low-res pixels. */
export function shakeOffset(dt) {
  if (shake.t <= 0) return [0, 0];
  shake.t -= dt;
  const a = Math.round(shake.amp * Math.max(0, shake.t / shake.dur));
  return [Math.round((Math.random() * 2 - 1) * a), Math.round((Math.random() * 2 - 1) * a)];
}
```

- [ ] **Step 2: Write `anim.js`**

Create `games/jungle-game-remake/js/anim.js`:

```js
/* Replays rules.js event lists as animation: hops, river jumps, swims, pounce-and-gore captures,
   trap snaps and the victory. It also owns the move markers and the hover cursor. Each
   sequence marks its views busy so idle animation keeps its hands off them. */
import * as THREE from 'three';
import { ANIMALS, terrain, onEnemyTrap } from './rules.js';
import { C } from './palette.js';
import { VoxelGrid } from './voxel.js';
import { geometryFrom } from './mesh.js';
import { WATER_Y } from './scene.js';
import { tween, wait, ease, hitStop, startShake } from './fx.js';

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const rand = (a, b) => a + Math.random() * (b - a);

function markerGeometry(kind) {
  // 16 × 16 voxel frame on one square: corner brackets + centre dot for a move, a full frame and
  // claw marks for a capture, plain corner brackets for the hover cursor
  const g = new VoxelGrid();
  const col = kind === 'capture' ? C.red : kind === 'hover' ? C.white : C.lime1;
  const edge = (i, j) => g.set(i, 0, j, col);
  for (let i = 1; i <= 14; i++) {
    const bracket = i <= 4 || i >= 11;
    if (kind === 'capture' || bracket) { edge(i, 1); edge(i, 14); edge(1, i); edge(14, i); }
  }
  if (kind === 'move') g.box(7, 0, 7, 8, 0, 8, col);
  if (kind === 'capture') for (const o of [-3, 0, 3]) for (let s = 0; s < 6; s++) g.set(5 + s + o, 0, 10 - s, C.redDark);
  return geometryFrom(g, 1 / 16, [8, 0, 8], { jitter: 0 });
}

export function createAnimator({ scene, camera, world, views, particles, sound, hud, camRig, toScreen }) {
  const markerMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const geos = { move: markerGeometry('move'), capture: markerGeometry('capture'), hover: markerGeometry('hover') };
  const markers = [];
  const cursor = new THREE.Mesh(geos.hover, markerMat);
  cursor.visible = false;
  scene.add(cursor);
  let lifted = null;
  const ripples = new Set();
  const rippleGeo = new THREE.RingGeometry(0.16, 0.2, 18);

  // ---------- markers and hover ----------
  function showMoves(moves) {
    clearMoves();
    for (const m of moves) {
      const mesh = new THREE.Mesh(m.capture ? geos.capture : geos.move, markerMat);
      const p = views.cellPos(m.row, m.col);
      mesh.position.set(p.x, world.surfaceY(m.row, m.col) + 0.012, p.z);
      mesh.userData.capture = !!m.capture;
      scene.add(mesh);
      markers.push(mesh);
    }
  }
  function clearMoves() { markers.splice(0).forEach(m => scene.remove(m)); }

  function setHover(cell, game) {
    if (lifted) { world.liftTile(lifted.row, lifted.col, false); lifted = null; }
    cursor.visible = !!cell;
    if (!cell) return;
    const p = views.cellPos(cell.row, cell.col);
    cursor.position.set(p.x, world.surfaceY(cell.row, cell.col) + 0.02, p.z);
    if (terrain[cell.row][cell.col] !== 'water' && !game.pieceAt(cell.row, cell.col)) {
      world.liftTile(cell.row, cell.col, true);
      cursor.position.y += 1 / 16;
      lifted = cell;
    }
  }

  // ---------- particles ----------
  function dust(at, n = 6, colors = [C.sand, C.earth1, C.stone1]) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(0.4, 1.1);
      particles.spawn({
        pos: new THREE.Vector3(at.x + Math.cos(a) * 0.15, at.y + 0.04, at.z + Math.sin(a) * 0.15),
        vel: new THREE.Vector3(Math.cos(a) * s, rand(0.3, 0.8), Math.sin(a) * s),
        color: pick(colors), size: rand(0.05, 0.09), life: rand(0.35, 0.6), gravity: -0.3, drag: 3, grow: 0.6,
      });
    }
  }
  function splash(at, colors = [C.water0, C.water1, C.white]) {
    for (let i = 0; i < 16; i++) {
      const a = rand(0, Math.PI * 2), s = rand(0.3, 1);
      particles.spawn({
        pos: new THREE.Vector3(at.x, WATER_Y + 0.05, at.z),
        vel: new THREE.Vector3(Math.cos(a) * s, rand(1.4, 2.6), Math.sin(a) * s),
        color: pick(colors), size: rand(0.03, 0.06), life: 1, gravity: 8, floor: WATER_Y, onFloor: () => {},
      });
    }
  }
  function ripple(at, color = C.water0, delay = 0) {
    wait(delay).then(() => {
      const m = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({ color }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(at.x, WATER_Y + 0.006, at.z);
      scene.add(m);
      ripples.add(m);
      tween(700, k => m.scale.setScalar(0.5 + k * 1.8), ease.out).then(() => {
        scene.remove(m); m.material.dispose(); ripples.delete(m);
      });
    });
  }
  function stain(p, size, life, floorY) {
    particles.spawn({
      pos: new THREE.Vector3(p.x, floorY + 0.006, p.z), color: pick([C.blood, C.bloodDark]),
      size, flat: true, life, gravity: 0, tail: 0.3,
    });
  }
  function gore(at, inWater) {
    const floorY = inWater ? WATER_Y : 0.004;
    for (let i = 0; i < 64; i++) {
      const a = rand(0, Math.PI * 2), out = rand(0.6, 2.2);
      const size = rand(0.03, 0.075);
      particles.spawn({
        pos: new THREE.Vector3(at.x, at.y + 0.3, at.z),
        vel: new THREE.Vector3(Math.cos(a) * out, rand(1.5, 4.5), Math.sin(a) * out),
        color: pick([C.blood, C.blood, C.bloodDark, C.red]),
        size, sy: Math.random() < 0.4 ? size * 2.2 : size,          // some elongated streaks
        life: rand(1.6, 2.8), gravity: 9, floor: floorY, spin: rand(-8, 8), shrink: false,
        onFloor: inWater ? () => {} : P => { if (Math.random() < 0.35) stain(P.p, rand(0.05, 0.13), rand(3, 5), floorY); },
      });
    }
    if (inWater) {
      splash(at, [C.blood, C.water1, C.bloodDark, C.water0]);
      ripple(at, C.blood);
      ripple(at, C.bloodDark, 160);
    } else {
      for (let i = 0; i < 5; i++) {
        stain({ x: at.x + rand(-0.35, 0.35), z: at.z + rand(-0.35, 0.35) }, rand(0.14, 0.3), rand(4, 5.5), floorY);
      }
    }
  }
  function smoke(at) {
    for (let i = 0; i < 20; i++) {
      particles.spawn({
        pos: new THREE.Vector3(at.x + rand(-0.3, 0.3), at.y + rand(0.1, 0.5), at.z + rand(-0.3, 0.3)),
        vel: new THREE.Vector3(rand(-0.3, 0.3), rand(0.4, 0.9), rand(-0.3, 0.3)),
        color: pick([C.stone1, C.stone2, C.white]), size: rand(0.16, 0.3), life: rand(1.4, 2.2),
        gravity: 0, drag: 0.8, grow: 1.2, tail: 0.4,
      });
    }
  }
  function sparks(at) {
    for (let i = 0; i < 14; i++) {
      const a = rand(0, Math.PI * 2), s = rand(0.8, 2);
      particles.spawn({
        pos: new THREE.Vector3(at.x, 0.12, at.z), vel: new THREE.Vector3(Math.cos(a) * s, rand(0.8, 2), Math.sin(a) * s),
        color: pick([C.gold, C.white, C.flame]), size: 0.035, life: 0.5, gravity: 6,
      });
    }
  }
  function chunks(v) {
    for (let i = 0; i < 40; i++) {
      const a = rand(0, Math.PI * 2), s = rand(0.5, 1.8);
      particles.spawn({
        pos: new THREE.Vector3(v.pos.x + rand(-0.2, 0.2), v.pos.y + rand(0.05, v.height), v.pos.z + rand(-0.2, 0.2)),
        vel: new THREE.Vector3(Math.cos(a) * s, rand(1, 2.8), Math.sin(a) * s),
        color: pick(v.colors), size: rand(0.05, 0.08), life: rand(0.9, 1.4), gravity: 9,
        floor: v.pos.y, spin: rand(-10, 10), tail: 0.5,
      });
    }
  }
  function confetti() {
    for (let i = 0; i < 140; i++) {
      particles.spawn({
        pos: new THREE.Vector3(rand(-3.5, 3.5), rand(3, 5), rand(-4.5, 4.5)),
        vel: new THREE.Vector3(rand(-0.3, 0.3), rand(-0.6, 0), rand(-0.3, 0.3)),
        color: pick([C.lime1, C.lime2, C.flowerPink, C.flowerYellow, C.white, C.flowerViolet]),
        size: 0.05, sy: 0.015, life: rand(3, 4.5), gravity: 0.9, drag: 0.6, spin: rand(-6, 6), floor: 0.01,
      });
    }
  }

  // ---------- motion helpers ----------
  function swingLegs(v, a) {
    const [fl, fr, bl, br] = v.rig.legs;
    fl.rotation.x = br.rotation.x = a;
    fr.rotation.x = bl.rotation.x = -a;
  }
  async function faceTo(v, dx, dz) {
    if (!dx && !dz) return;
    const from = v.model.rotation.y;
    let to = Math.atan2(dx, dz);
    to = from + ((((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI);   // shortest way
    if (Math.abs(to - from) < 0.01) return;
    await tween(140, k => { v.model.rotation.y = from + (to - from) * k; }, ease.out);
  }
  async function hop(v, to, { height = 0.28, ms = 340, legs = true } = {}) {
    const from = v.pos.clone();
    await tween(ms, (e, k) => {
      v.pos.lerpVectors(from, to, k);
      v.air = Math.sin(Math.PI * k) * height;
      if (legs) swingLegs(v, Math.sin(k * Math.PI * 2) * 0.7);
    }, ease.linear);
    v.pos.copy(to);
    v.air = 0;
    swingLegs(v, 0);
  }
  async function squashLand(v, amt = 0.22) {
    await tween(90, k => v.model.scale.set(1 + amt * k, 1 - amt * k, 1 + amt * k), ease.out);
    await tween(180, k => {
      const s = amt * (1 - k);
      v.model.scale.set(1 + s, 1 - s, 1 + s);
    }, ease.outBack);
    v.model.scale.set(1, 1, 1);
  }
  async function crouch(v, ms = 150, amt = 0.2) {
    await tween(ms, k => v.model.scale.set(1 + amt * 0.5 * k, 1 - amt * k, 1 + amt * 0.5 * k), ease.out);
    v.model.scale.set(1, 1, 1);
  }
  function flash(v) {
    const white = new THREE.MeshBasicMaterial({ color: C.white });
    const saved = [];
    v.model.traverse(o => { if (o.isMesh) { saved.push([o, o.material]); o.material = white; } });
    wait(120).then(() => { saved.forEach(([o, m]) => { o.material = m; }); white.dispose(); });
  }

  // ---------- sequences ----------
  async function playStep(v, to) {
    const heavy = v.piece.type === 'elephant';
    sound.move();
    await hop(v, to, { height: heavy ? 0.12 : 0.28, ms: heavy ? 480 : 340 });
    dust(to, heavy ? 14 : 6);
    if (heavy) { startShake('soft'); sound.rumble('soft'); }
    await squashLand(v, heavy ? 0.12 : 0.2);
  }

  async function playJump(v, to) {
    sound.move();
    await crouch(v);
    const dist = v.pos.distanceTo(to);
    await hop(v, to, { height: 0.6 + dist * 0.28, ms: 520 + dist * 70, legs: false });
    dust(to, 18);
    startShake('soft');                    // visual only: the original plays no rumble here
    await squashLand(v, 0.3);
  }

  async function playSwim(v, mv, to) {
    const into = terrain[mv.to.row][mv.to.col] === 'water';
    const fromWater = terrain[mv.from.row][mv.from.col] === 'water';
    if (into) sound.splash(); else sound.move();
    await hop(v, to, { height: into && fromWater ? 0.1 : 0.3, ms: 380 });
    if (into) {
      splash(to);
      ripple(to); ripple(to, undefined, 180); ripple(to, undefined, 360);
    } else {
      for (let i = 0; i < 8; i++) {          // drips shaken off on the bank
        particles.spawn({
          pos: new THREE.Vector3(to.x + rand(-0.15, 0.15), 0.25, to.z + rand(-0.15, 0.15)),
          vel: new THREE.Vector3(rand(-0.4, 0.4), rand(0.2, 0.8), rand(-0.4, 0.4)),
          color: pick([C.water0, C.water1]), size: 0.03, life: 0.6, gravity: 8, floor: 0, onFloor: () => {},
        });
      }
      await squashLand(v, 0.15);
    }
  }

  async function knockAndShatter(victim, away) {
    victim.busy = true;
    victim.flourish = null;
    const start = victim.pos.clone();
    await tween(260, (e, k) => {
      victim.pos.copy(start).addScaledVector(away, 0.3 * e);
      victim.air = Math.sin(k * Math.PI) * 0.15;
      victim.model.rotation.z = e * 1.4;
    }, ease.out);
    chunks(victim);
    views.remove(victim);
  }

  async function playCapture(v, victim, cap, mv, to) {
    const isJump = mv.type === 'jump';
    const from = v.pos.clone();
    await crouch(v, 160, 0.22);
    const strike = from.clone().lerp(to, isJump ? 0.85 : 0.6);
    await hop(v, strike, {
      height: isJump ? 0.6 + from.distanceTo(to) * 0.28 : 0.35,
      ms: isJump ? 600 : 240, legs: false,
    });

    // impact
    sound.capture(ANIMALS[v.piece.type].rank);
    hitStop(90);
    flash(victim);
    gore(to, cap.inWater);
    if (cap.heavy) { startShake('heavy'); sound.rumble('heavy'); }
    if (cap.ratElephant) smoke(to);
    hud.toast(cap.message, 'success');
    hud.addCaptured(cap.victim, toScreen(victim.pos));

    const away = new THREE.Vector3(to.x - from.x, 0, to.z - from.z).normalize();
    knockAndShatter(victim, away);          // runs alongside the attacker's landing
    await hop(v, to, { height: 0.15, ms: 200, legs: false });
    await squashLand(v, 0.25);
  }

  async function playTrap(v, e) {
    const trap = world.traps.get(`${e.at.row},${e.at.col}`);
    sound.trap();
    hud.toast(e.message, 'info');
    await tween(70, k => trap.setClosed(k), ease.in);
    sparks(v.pos);
    await tween(120, (x, k) => { v.air = Math.sin(k * Math.PI) * 0.1; }, ease.linear);
    v.air = 0;
    wait(450).then(() => tween(300, k => trap.setClosed(1 - k), ease.inOut));
  }

  async function playWin(e, v) {
    const base = v.model.rotation.y;
    for (let i = 0; i < 2; i++) {
      await tween(380, (x, k) => {
        v.air = Math.sin(k * Math.PI) * 0.5;
        if (i === 1) v.model.rotation.y = base + k * Math.PI * 2;
      }, ease.linear);
    }
    v.air = 0;
    v.model.rotation.y = base;
    confetti();
    for (const w of views.views.values()) {
      if (w.piece.player === e.player) continue;
      w.busy = true;
      tween(500, k => {
        w.model.rotation.x = 0.3 * k;
        w.model.scale.set(1, 1 - 0.15 * k, 1);
        w.rig.head.rotation.x = 0.5 * k;
      }, ease.out);
    }
    const target = new THREE.Vector3(v.pos.x, 0, v.pos.z).multiplyScalar(0.6);
    await tween(1200, k => { camRig.offset.copy(target).multiplyScalar(k); camRig.zoom = 1 + 0.35 * k; }, ease.inOut);
    hud.showWin(e.player, e.reason);
    sound.win();
  }

  async function play(events) {
    const cap = events.find(e => e.type === 'capture');
    const mv = events.find(e => e.type === 'move' || e.type === 'jump' || e.type === 'swim');
    const v = views.get(mv.piece.id);
    v.busy = true;
    v.flourish = null;
    views.resetPose(v);
    const to = views.cellPos(mv.to.row, mv.to.col);
    await faceTo(v, mv.to.col - mv.from.col, mv.to.row - mv.from.row);

    if (cap) await playCapture(v, views.get(cap.victim.id), cap, mv, to);
    else if (mv.type === 'jump') await playJump(v, to);
    else if (mv.type === 'swim') await playSwim(v, mv, to);
    else await playStep(v, to);

    for (const e of events) {
      if (e.type === 'trap') await playTrap(v, e);
      if (e.type === 'turn') { views.setActive(e.player); hud.setTurn(e.player); }
      if (e.type === 'win') await playWin(e, v);
    }
    for (const w of views.views.values()) views.setWeakened(w, onEnemyTrap(w.piece));
    if (!events.some(e => e.type === 'win')) { views.resetPose(v); v.busy = false; }
  }

  async function spawnAll(pieces) {
    const list = pieces.map(p => views.add(p));
    list.forEach(v => { v.busy = true; v.root.visible = false; v.air = 3; });
    await Promise.all(list.map(async (v, i) => {
      await wait(i * 55);
      v.root.visible = true;
      await tween(380, e => { v.air = 3 * (1 - e); }, ease.in);
      v.air = 0;
      dust(v.pos, 5);
      await squashLand(v, 0.2);
      v.busy = false;
    }));
  }

  function reset() {
    clearMoves();
    setHover(null);
    views.clear();
    particles.clear();
    camRig.offset.set(0, 0, 0);
    camRig.zoom = 1;
    views.setActive('red');
    for (const trap of world.traps.values()) trap.setClosed(0);
  }

  function update(t) {
    const pulse = 0.9 + 0.1 * Math.abs(Math.sin(t * 4));
    for (const m of markers) m.scale.setScalar(m.userData.capture ? 1 : pulse);
  }

  return { play, spawnAll, reset, showMoves, clearMoves, setHover, update };
}
```

Two notes on `anim.js`:

- `setHover(null)` inside `reset()` passes no `game`. That is safe because the `!cell` early return comes before `game` is used.
- In `faceTo`, the shortest-angle expression wraps the difference into (−π, π]. A blue piece (rotation π) stepping toward −z needs no turn and returns early.

- [ ] **Step 3: Replace `main.js` with the final version**

Overwrite `games/jungle-game-remake/js/main.js`:

```js
/* Cờ Thú: Rừng Xanh — boot, frame loop, picking and the input lock. Rules state changes at
   once in rules.js; anim.js replays the event list while input is locked. */
import * as THREE from 'three';
import { shared } from './mesh.js';
import { createPixelRenderer } from './pixel.js';
import { buildWorld, createCamera, fitCamera, CAMERA_BASE, WATER_Y } from './scene.js';
import { addBoardProps } from './board-props.js';
import { createViews, makePortraits } from './views.js';
import { createAnimator } from './anim.js';
import { updateTweens, createParticles, shakeOffset } from './fx.js';
import { createGame, terrain, inBounds } from './rules.js';
import { worldToCell, resolvePick } from './layout.js';
import { Sound } from './audio.js';
import { createHud } from './hud.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('view');

let pixel;
try {
  pixel = createPixelRenderer(canvas);
} catch (err) {
  window.__bootFail('webgl');
  throw err;
}

const scene = new THREE.Scene();
const camera = createCamera();
const world = buildWorld(scene);
addBoardProps(world);
const particles = createParticles(scene);
const camRig = { offset: new THREE.Vector3(), zoom: 1 };

const getPixel = () => ({ ppu: (camera.top - camera.bottom) / camera.zoom / pixel.size.h });
const views = createViews({ scene, camera, world, getPixel });
const game = createGame();

let busy = false;
let pendingRestart = false;
let selected = null;

const hud = createHud({
  onRestart: () => restart(),
  onSoundToggle: () => { Sound.toggle(); hud.setSound(Sound.muted); },
});
hud.setSound(Sound.muted);
hud.setTurn('red');
hud.setPortraits(makePortraits(pixel));

function toScreen(pos) {
  const v = pos.clone().project(camera);
  const r = canvas.getBoundingClientRect();
  return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
}

const animator = createAnimator({ scene, camera, world, views, particles, sound: Sound, hud, camRig, toScreen });

function resize() {
  const r = stage.getBoundingClientRect();
  const s = pixel.resize(r.width, r.height);
  fitCamera(camera, s.w, s.h);
}
new ResizeObserver(resize).observe(stage);
resize();

// ---------- picking ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_Y);
const hitPt = new THREE.Vector3();

function cellAt(plane) {
  if (!ray.ray.intersectPlane(plane, hitPt)) return null;
  const cell = worldToCell(hitPt.x, hitPt.z);
  return inBounds(cell.row, cell.col) ? cell : null;
}

function cellFromEvent(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(views.hitboxes(), false);
  if (hits.length) {
    const p = game.pieces.find(q => q.id === hits[0].object.userData.pieceId);
    if (p) return { row: p.row, col: p.col };
  }
  const water = cellAt(waterPlane);
  return resolvePick(cellAt(groundPlane), water, !!water && terrain[water.row][water.col] === 'water');
}

// ---------- input: the original handlePieceClick / handleCellClick semantics ----------
function select(piece) {
  selected = piece;
  views.setSelected(piece ? piece.id : null);
  if (piece) animator.showMoves(game.getValidMoves(piece));
  else animator.clearMoves();
}

async function doMove(piece, row, col) {
  select(null);
  animator.setHover(null, game);
  busy = true;
  const events = game.applyMove(piece, row, col);
  await animator.play(events);
  busy = false;
  if (pendingRestart) { pendingRestart = false; restart(); }
}

function onCell(cell) {
  if (busy || game.gameOver || !cell) return;
  Sound.ensure();
  const { row, col } = cell;
  const piece = game.pieceAt(row, col);
  const legal = selected && game.getValidMoves(selected).some(m => m.row === row && m.col === col);

  if (piece && piece.player !== game.currentPlayer) {
    if (!selected) return;
    if (legal) doMove(selected, row, col);
    else hud.toast('Nước đi không hợp lệ', 'error');
    return;
  }
  if (piece) {
    if (selected === piece) { select(null); return; }
    select(piece);
    Sound.select();
    return;
  }
  if (legal) doMove(selected, row, col);
}

canvas.addEventListener('click', e => onCell(cellFromEvent(e)));
canvas.addEventListener('pointermove', e => {
  if (busy || game.gameOver || e.pointerType === 'touch') return;
  animator.setHover(cellFromEvent(e), game);
});
canvas.addEventListener('pointerleave', () => animator.setHover(null, game));

// ---------- restart ----------
async function restart() {
  if (busy) { pendingRestart = true; return; }
  busy = true;
  select(null);
  animator.reset();
  game.restart();
  hud.hideWin();
  hud.clearCaptured();
  hud.setTurn('red');
  hud.toast('Bàn cờ đã được đặt lại 🌿', 'info');
  await animator.spawnAll(game.pieces);
  busy = false;
  if (pendingRestart) { pendingRestart = false; restart(); }
}

// ---------- frame loop ----------
// the camera never rotates, only moves, so its axes are fixed
const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

function placeCamera(dt) {
  const { ppu } = getPixel();
  // keep the push-in offset and the shake on whole low-res pixels so the frame stays crisp
  const o = camRig.offset;
  const ox = Math.round(o.dot(right) / ppu) * ppu, oy = Math.round(o.dot(up) / ppu) * ppu;
  const [sx, sy] = shakeOffset(dt);
  camera.position.copy(CAMERA_BASE)
    .addScaledVector(right, ox + sx * ppu)
    .addScaledVector(up, oy + sy * ppu)
    .addScaledVector(forward, o.dot(forward));
  if (camera.zoom !== camRig.zoom) { camera.zoom = camRig.zoom; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  shared.uTime.value = t;
  updateTweens(dt * 1000);
  particles.update(dt);
  placeCamera(dt);
  views.update(dt, t);
  animator.update(t);
  pixel.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

busy = true;
animator.spawnAll(game.pieces).then(() => {
  busy = false;
  if (pendingRestart) { pendingRestart = false; restart(); }
});
window.__booted = true;
```

- [ ] **Step 4: Static checks**

Run: `node --test 'tests/*.test.mjs'`
Expected: all pass. The syntax gate now covers 14 modules.
`curl` returns `200` for `js/anim.js` and `js/fx.js`.

Hand-trace these before the playtest, reading the code rather than running it:
- (a) Click your own piece, then your own piece again: the selection toggles off, as in the original.
- (b) Click an enemy piece with nothing selected: nothing happens.
- (c) Click an enemy piece out of range with a selection: the toast "Nước đi không hợp lệ".
- (d) A capture whose victim stands on the attacker's trap: `play` runs `playCapture`, then `playTrap` for the same square, and the jaws snap on the attacker. That matches the original firing `createTrapEffect` on any trap square.
- (e) Restart during `play()`: `pendingRestart` is set and `doMove` runs `restart()` after `play` resolves.

- [ ] **Step 5: PLAYTEST milestone 3. Stop and ask the user.**

Ask the user to play a full game and check:
- The opening drop-in, hover lift with cursor brackets, the selection arrow with lime move markers and red capture markers.
- Step hops with squash and dust. The elephant stomps with a soft shake and rumble.
- Tiger, leopard and lion river jumps arc high with a dust ring on landing.
- The rat dives with a splash and ripples, swims half-submerged and climbs out dripping.
- Captures: crouch and pounce, a white flash on impact with a short freeze, a gory pixel blood spray with stains that fade, the victim knocked over and shattering into voxel chunks, and its portrait flying into the captured tray. Rat-takes-elephant adds smoke, and an in-river capture gives a red splash.
- Traps snap with sparks. A piece on an enemy trap looks grey with circling stars.
- Win: victory leap, confetti, losers slump, a camera push-in, then the overlay. "Chơi lại" resets everything, including mid-animation.
- Clicking a river square selects that river square.
- The sounds match the original.

Apply the feedback, then continue.

- [ ] **Step 6: Commit**

Message:

```
feat(jungle-remake): animated moves, gory captures and input

Rules now drive the board: clicks follow the original's select/capture
semantics, and each event list replays as animation (hops, river jumps,
swims, pounce-and-shatter captures with pixel blood, trap snaps, the
victory). Input is locked while a sequence runs, and a restart pressed
mid-animation is queued instead of tearing pieces out from under it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task 8: Scenery props and ambient life (milestone 4)

**Files:**
- Create: `games/jungle-game-remake/js/props.js`
- Create: `games/jungle-game-remake/js/scenery.js`
- Modify: `games/jungle-game-remake/js/main.js` (two insertions)

**Interfaces:**
- Consumes: `VoxelGrid`, `hash3`, `C`, `geometryFrom`, `voxelMesh`, `swayMaterial`, `STATIC_MAT`; `ringTop`, `SEA_Y`, `WATER_Y` (Task 5).
- Produces from `props.js`:
  - `buildTree(seed, size) → Group`, `buildBush(seed) → Mesh`, `buildRock(seed, size) → Mesh`
  - `buildMushrooms(seed) → Mesh`, `buildLog() → Mesh`, `buildFlowers(seed) → Mesh`
  - `buildTorch() → { group, flame }`, `buildDock() → Mesh`, `buildBamboo(seed) → Mesh`
  - `buildLily(seed, flower) → Mesh`, `buildButterfly(color) → { group, wingL, wingR }`, `buildFish() → Mesh`
- Produces from `scenery.js`: `buildScenery(scene) → { update(dt, t) }`

- [ ] **Step 1: Write `props.js`**

Create `games/jungle-game-remake/js/props.js`:

```js
/* Scenery props for the island ring, after reference/image01–02 and color.png: layered pixel
   trees with hanging vines, bushes, rocks, mushrooms, a mossy log, flower patches, torches by
   the dens, a small dock, bamboo in the shallows, lily pads, butterflies and fish shadows.
   1 voxel = 1/16 tile, like the animals. */
import * as THREE from 'three';
import { VoxelGrid, hash3 } from './voxel.js';
import { C } from './palette.js';
import { geometryFrom, voxelMesh, swayMaterial, STATIC_MAT } from './mesh.js';

const S = 1 / 16;
const mod = (a, n) => ((a % n) + n) % n;
const pickH = (arr, h) => arr[Math.floor(h * arr.length) % arr.length];
const noShadow = m => { m.castShadow = false; return m; };

export function buildTree(seed = 1, size = 1) {
  const group = new THREE.Group();
  const H = Math.round(20 * size);
  const bark = (x, y, z) => (hash3(x, y, z, seed) < 0.12 ? C.earth4 : mod(x + y + z, 3) === 0 ? C.earth3 : C.earth2);
  const trunk = new VoxelGrid().box(-2, 0, -2, 1, H - 1, 1, bark);
  trunk.box(-3, 0, -3, 2, 1, 2, (x, y, z) => ((x === -3 || x === 2) && (z === -3 || z === 2) ? null : bark(x, y, z)));
  for (let i = 0; i < 5; i++) {                  // two branches reaching into the canopy
    trunk.set(2 + i, H - 7 + i, 0, C.earth3);
    trunk.set(-3 - i, H - 5 + i, 0, C.earth3);
  }
  group.add(voxelMesh(trunk, S));

  const canopy = new VoxelGrid();
  const clumps = [[0, H + 4, 0, 10, 7, 10], [6, H + 1, 3, 6, 5, 6], [-6, H + 2, -2, 7, 5, 6], [2, H + 8, -3, 6, 4, 6]];
  for (const [cx, cy, cz, rx, ry, rz] of clumps) {
    const jx = Math.round((hash3(cx, seed, 1, 2) - 0.5) * 4);
    canopy.ellipsoid(cx * size + jx, cy, cz * size, rx * size, ry * size, rz * size, (x, y, z) => {
      const t = (y - cy) / (ry * size), n = hash3(x, y, z, seed + 3);
      if (t > 0.45) return n < 0.3 ? C.lime0 : C.lime1;
      if (t > 0) return n < 0.12 ? C.lime3 : C.lime2;
      if (t > -0.5) return n < 0.12 ? C.lime4 : C.lime3;
      return C.lime4;
    });
  }
  for (let i = 0; i < 16; i++) {                 // vines hanging from the canopy's underside
    const x = Math.round((hash3(i, seed, 0, 51) - 0.5) * 18 * size);
    const z = Math.round((hash3(i, seed, 1, 51) - 0.5) * 18 * size);
    let y0 = null;
    for (let y = H - 4; y < H + 14; y++) if (canopy.has(x, y, z)) { y0 = y; break; }
    if (y0 === null) continue;
    const len = 3 + Math.floor(hash3(i, seed, 2, 51) * 8);
    for (let j = 1; j <= len; j++) canopy.set(x, y0 - j, z, j % 3 === 0 ? C.lime5 : C.lime4);
  }
  group.add(voxelMesh(canopy, S, swayMaterial(0.35)));
  return group;
}

export function buildBush(seed = 1) {
  const g = new VoxelGrid().ellipsoid(0, 3, 0, 6, 4, 5, (x, y, z) => {
    if (y < 0) return null;
    const n = hash3(x, y, z, seed);
    if (n < 0.05) return pickH([C.white, C.flowerPink, C.flowerYellow], hash3(x, y, z, seed + 1));
    return y > 4 ? (n < 0.4 ? C.lime1 : C.lime2) : n < 0.5 ? C.lime3 : C.lime4;
  });
  return voxelMesh(g, S, swayMaterial(0.25));
}

export function buildRock(seed = 1, size = 1) {
  const g = new VoxelGrid().ellipsoid(0, 1.5, 0, 5 * size, 3.5 * size, 4 * size, (x, y, z) => {
    if (y < 0) return null;
    const n = hash3(x, y, z, seed);
    if (y >= 3.5 * size && n < 0.35) return C.lime3;               // moss on top
    if (y >= 3 * size) return C.stone1;
    return y >= 1 ? (n < 0.15 ? C.stone3 : C.stone2) : C.stone3;
  });
  return voxelMesh(g, S);
}

export function buildMushrooms(seed = 1) {
  const g = new VoxelGrid();
  for (const [x, z, h] of [[0, 0, 5], [4, 2, 3], [-3, 3, 4]]) {
    g.box(x, 0, z, x + 1, h - 1, z + 1, C.cream);
    g.ellipsoid(x + 0.5, h, z + 0.5, 2.6, 1.6, 2.6,
      (cx, cy, cz) => (cy < h ? null : hash3(cx, cy, cz, seed) < 0.22 ? C.white : C.red));
  }
  return voxelMesh(g, S);
}

export function buildLog() {
  const g = new VoxelGrid();
  for (let x = -9; x <= 8; x++) for (let y = 0; y <= 6; y++) for (let z = -3; z <= 3; z++) {
    const d = (y - 3) ** 2 + z ** 2;
    if (d > 10) continue;
    let col = mod(x, 4) === 0 ? C.earth3 : C.earth2;
    if (x === -9 || x === 8) col = d < 3 ? C.sand : d < 6 ? C.earth1 : C.earth3;   // growth rings
    else if (y >= 5 && hash3(x, y, z, 12) < 0.45) col = C.lime3;                    // moss
    g.set(x, y, z, col);
  }
  return voxelMesh(g, S);
}

export function buildFlowers(seed = 1) {
  const g = new VoxelGrid();
  for (let i = 0; i < 6; i++) {
    const x = Math.round((hash3(i, seed, 0, 71) - 0.5) * 12);
    const z = Math.round((hash3(i, seed, 1, 71) - 0.5) * 12);
    const h = 2 + Math.floor(hash3(i, seed, 2, 71) * 3);
    const petal = pickH([C.flowerPink, C.flowerYellow, C.white, C.flowerViolet, C.red], hash3(i, seed, 3, 71));
    for (let y = 0; y < h; y++) g.set(x, y, z, C.lime4);
    g.set(x + 1, 1, z, C.lime3);                                      // a leaf
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.set(x + dx, h, z + dz, petal);
    g.set(x, h, z, petal === C.flowerYellow ? C.flame : C.flowerYellow);
  }
  return noShadow(voxelMesh(g, S, swayMaterial(0.8)));
}

export function buildTorch() {
  const group = new THREE.Group();
  const pole = new VoxelGrid()
    .box(-1, 0, -1, 0, 13, 0, (x, y) => (y % 4 === 0 ? C.earth4 : C.earth3))
    .box(-2, 14, -2, 1, 15, 1, C.stone3);
  group.add(voxelMesh(pole, S));
  const fire = new VoxelGrid()
    .box(-2, 0, -2, 1, 1, 1, C.flame)
    .box(-1, 2, -1, 0, 3, 0, C.gold)
    .set(-1, 4, -1, C.white)
    .set(0, 4, 0, C.gold);
  const flame = new THREE.Mesh(geometryFrom(fire, S), new THREE.MeshBasicMaterial({ vertexColors: true }));
  flame.position.y = 16 * S;
  group.add(flame);
  return { group, flame };
}

export function buildDock() {
  const g = new VoxelGrid();
  for (let x = 0; x < 32; x++) for (let z = -6; z <= 5; z++) {
    g.set(x, 0, z, mod(x, 4) === 3 ? C.earth4 : hash3(x, 0, z, 81) < 0.5 ? C.earth2 : C.earth3);
  }
  for (const x of [1, 14, 28]) for (const z of [-6, 5]) g.box(x, -12, z, x + 1, 2, z, C.earth4);
  return voxelMesh(g, S);
}

export function buildBamboo(seed = 1) {
  const g = new VoxelGrid();
  const h = 22 + Math.floor(hash3(seed, 0, 0, 91) * 10);
  g.box(0, 0, 0, 1, h, 1, (x, y) => (y % 6 === 0 ? C.lime5 : x === 0 ? C.lime3 : C.lime4));
  for (const [y, side, dz] of [[h - 2, 1, 0], [h - 5, -1, 1], [h - 9, 1, 1]]) {
    for (let i = 1; i <= 4; i++) g.set(side > 0 ? 1 + i : -i, y - (i >> 1), dz ? i : 0, C.lime2);
  }
  return voxelMesh(g, S, swayMaterial(1));
}

export function buildLily(seed = 1, flower = false) {
  const g = new VoxelGrid();
  for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) {
    if (x * x + z * z > 18) continue;
    if (z > 0 && Math.abs(x) < 1) continue;          // the notch
    g.set(x, 0, z, x * x + z * z > 12 ? C.lime4 : C.lime3);
  }
  if (flower) g.box(-1, 1, -2, 0, 1, -1, C.flowerPink).set(0, 2, -2, C.white).set(-1, 2, -1, C.flowerYellow);
  return noShadow(voxelMesh(g, S));
}

export function buildButterfly(color) {
  const group = new THREE.Group();
  group.add(noShadow(voxelMesh(new VoxelGrid().box(0, 0, -1, 0, 0, 1, C.ink), S, STATIC_MAT, [0.5, 0, 0])));
  const wing = new VoxelGrid().box(0, 0, -1, 2, 0, 1, (x, y, z) => (x === 2 && z === 0 ? C.flowerYellow : color));
  const wingR = noShadow(voxelMesh(wing, S));
  wingR.position.x = 0.5 * S;
  const wingL = noShadow(voxelMesh(wing.mirrorX(), S));
  wingL.position.x = -0.5 * S;
  group.add(wingL, wingR);
  return { group, wingL, wingR };
}

export function buildFish() {
  const g = new VoxelGrid();
  for (const [z, w] of [[3, 0], [2, 1], [1, 1], [0, 1], [-1, 0], [-2, 0], [-3, 1]]) g.box(-w, 0, z, w, 0, z, C.water5);
  const m = voxelMesh(g, S, new THREE.MeshBasicMaterial({ vertexColors: true }), [0.5, 0, 0.5]);
  m.castShadow = m.receiveShadow = false;
  return m;
}
```

- [ ] **Step 2: Write `scenery.js`**

Create `games/jungle-game-remake/js/scenery.js`:

```js
/* Places the scenery props on the island ring and animates the ambient life: torch flames,
   butterflies over the grass, fish shadows circling in the sea. Tall props sit on the far
   (top) sides — high columns, low rows — and the near sides get only low ones, so nothing hides the board. */
import * as THREE from 'three';
import { C } from './palette.js';
import { ringTop, SEA_Y, WATER_Y } from './scene.js';
import {
  buildTree, buildBush, buildRock, buildMushrooms, buildLog, buildFlowers, buildTorch,
  buildDock, buildBamboo, buildLily, buildButterfly, buildFish,
} from './props.js';

const tileAt = (r, c) => new THREE.Vector3(c - 3, ringTop(r, c), r - 4);

export function buildScenery(scene) {
  const place = (obj, r, c, { dx = 0, dz = 0, rot = 0 } = {}) => {
    const p = tileAt(r, c);
    obj.position.set(p.x + dx, p.y, p.z + dz);
    obj.rotation.y = rot;
    scene.add(obj);
    return obj;
  };

  // [row, col, seed, size] — all on the far ring
  for (const [r, c, seed, size] of [[-2, 6, 1, 1.15], [-2, 1, 2, 1], [-1, 7, 3, 1.1], [2, 8, 4, 1.2],
    [5, 8, 5, 1], [8, 8, 6, 1.1], [-2, 4, 7, 0.85]]) {
    place(buildTree(seed, size), r, c, { rot: seed });
  }
  [[-1, 6], [-1, 0], [3, 7], [7, 7], [3, -1], [6, -1], [9, 6]]
    .forEach(([r, c], i) => place(buildBush(i + 1), r, c, { rot: i }));
  [[1, -1, 1, 1], [9, 0, 2, 0.8], [5, 7, 3, 1.2], [-2, 0, 4, 0.9], [10, 3, 5, 0.7]]
    .forEach(([r, c, seed, size]) => place(buildRock(seed, size), r, c, { rot: seed }));
  [[1, 7], [8, -1], [10, 5]].forEach(([r, c], i) => place(buildMushrooms(i + 1), r, c, { rot: i * 2 }));
  place(buildLog(), 6, 7, { rot: -0.3 });
  [[0, 7], [2, -1], [4, -1], [9, 5], [9, 1], [10, 2], [4, 7], [-1, 5], [-1, 1], [7, -1], [10, 0]]
    .forEach(([r, c], i) => place(buildFlowers(i + 1), r, c));

  // torches beside each den, nudged toward the board
  const torches = [];
  for (const [r, c, dz] of [[-1, 2, 0.3], [-1, 4, 0.3], [9, 2, -0.3], [9, 4, -0.3]]) {
    const t = buildTorch();
    place(t.group, r, c, { dz });
    torches.push(t.flame);
  }

  const dock = buildDock();
  dock.position.set(-5.4, -0.56, 2);
  dock.rotation.y = Math.PI;            // reach out over the sea on the −x side
  scene.add(dock);

  for (const [x, z, seed] of [[6.3, -3, 1], [6, 2.6, 2], [2.5, -7.3, 3], [-1.5, -7.4, 4], [-6.4, -5.5, 5]]) {
    const b = buildBamboo(seed);
    b.position.set(x, SEA_Y, z);
    scene.add(b);
  }
  for (const [x, z, flower] of [[2.15, -1.1, true], [0.8, 1.15, false], [-2.2, 0.4, false], [-0.85, -1.2, true]]) {
    const l = buildLily(1, flower);
    l.position.set(x, WATER_Y + 0.005, z);
    l.rotation.y = x * 2;
    scene.add(l);
  }

  const flies = [[-1, 5, C.flowerPink], [9, 3, C.flowerYellow], [4, -1, C.white], [3, 7, C.flowerViolet]]
    .map(([r, c, color], i) => {
      const b = buildButterfly(color);
      scene.add(b.group);
      return { ...b, base: tileAt(r, c), seed: i * 2.3 };
    });

  const fish = [[7, -2, 1.2, 0.5], [-6.8, 1.5, 1, -0.6], [1.5, 8.2, 1.4, 0.4], [-7.2, -6, 0.9, 0.7], [6.5, 7, 1.1, -0.45]]
    .map(([x, z, r, speed], i) => {
      const mesh = buildFish();
      scene.add(mesh);
      return { mesh, c: new THREE.Vector3(x, 0, z), r, speed, a: i * 1.3 };
    });

  function update(dt, t) {
    torches.forEach((f, i) => {
      f.scale.set(1, 0.85 + 0.25 * Math.abs(Math.sin(t * 9 + i * 1.7)) + Math.random() * 0.05, 1);
    });
    for (const b of flies) {
      const s = b.seed;
      b.group.position.set(
        b.base.x + Math.sin(t * 0.7 + s) * 0.8,
        b.base.y + 0.5 + Math.sin(t * 2.1 + s) * 0.15,
        b.base.z + Math.cos(t * 0.5 + s * 2) * 0.8);
      b.group.rotation.y = t * 0.7 + s;
      const f = Math.sin(t * 18 + s) * 0.9;
      b.wingL.rotation.z = -f;
      b.wingR.rotation.z = f;
    }
    for (const f of fish) {
      f.a += f.speed * dt;
      f.mesh.position.set(f.c.x + Math.cos(f.a) * f.r, SEA_Y + 0.004, f.c.z + Math.sin(f.a) * f.r);
      f.mesh.rotation.y = Math.atan2(-Math.sin(f.a) * Math.sign(f.speed), Math.cos(f.a) * Math.sign(f.speed));
    }
  }

  return { update };
}
```

- [ ] **Step 3: Wire it into `main.js`**

In `games/jungle-game-remake/js/main.js`:
- Add `import { buildScenery } from './scenery.js';` after the `board-props.js` import.
- Replace `addBoardProps(world);` with:

```js
addBoardProps(world);
const scenery = buildScenery(scene);
```

- Replace `  animator.update(t);` (inside `frame`) with:

```js
  animator.update(t);
  scenery.update(dt, t);
```

- [ ] **Step 4: Static checks**

Run: `node --test 'tests/*.test.mjs'`
Expected: all pass. The syntax gate now covers 16 modules.
`curl` returns `200` for `js/props.js` and `js/scenery.js`.

- [ ] **Step 5: PLAYTEST milestone 4. Stop and ask the user.**

Ask the user to check:
- Big pixel trees with hanging vines and swaying canopies on the far sides; bushes, rocks, mushrooms, a mossy log and flower patches on the ring; torches flickering beside both dens; a dock; bamboo in the shallows; lily pads in the pools; butterflies; fish shadows circling.
- Nothing tall hides any board square or piece, and the frame rate still feels smooth, including on a phone if available.
- Overall, the look matches `reference/color.png`: light, lime and turquoise, crisp pixels.

Apply the feedback (positions are data arrays in `scenery.js`), then continue.

- [ ] **Step 6: Commit**

Message:

```
feat(jungle-remake): island scenery and ambient life

A bare island read as a test scene rather than the jungle diorama in the
references. The ring now carries layered trees with vines, bushes,
rocks, mushrooms, a log, flowers, den torches, a dock, bamboo and lily
pads, with butterflies and fish shadows moving. Tall props stay on the
far sides so the board is never hidden.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task 9: Register in the hub, README and CLAUDE.md

**Files:**
- Modify: `index.html` (the `games` array)
- Modify: `README.md` (game list)
- Modify: `CLAUDE.md` (network exceptions, folder games, tests)

**Interfaces:**
- Consumes: the finished game at `games/jungle-game-remake/index.html`.

- [ ] **Step 1: Add the hub entry**

In `index.html`, find the existing entry whose `path` is `"games/jungle-game.html"` and note its `category` value. Append this object as the last element of the `games` array, using that same category so the remake lands in the same sector:

```js
    {
      icon: "🦁",
      title: "Cờ Thú: Rừng Xanh",
      description: "Cờ Thú làm lại: diorama pixel art isometric, thú voxel sống động, luật chơi giữ nguyên!",
      category: "<same category as the jungle-game.html entry>",
      tags: ["Pixel art", "2 người", "Tiếng Việt"],
      added: "2026-10-13",
      color: "linear-gradient(135deg, #3d7f24, #c7f02a)",
      path: "games/jungle-game-remake/index.html"
    }
```

Put a comma after the previous last entry. The `color` last stop `#c7f02a` is not used by any existing entry. Confirm with `grep -n "c7f02a" index.html`, which should return only this line.

- [ ] **Step 2: Add the README line**

In `README.md` under `## Danh sách game`, append:

```
- `games/jungle-game-remake/` - Cờ Thú làm lại: diorama pixel art isometric (Three.js), luật chơi giữ nguyên.
```

- [ ] **Step 3: Update `CLAUDE.md`**

Make three edits:
1. In "Games — `games/*.html`", change "with **four exceptions**:" to "with **five exceptions**:". Insert this sentence right after the `games/magic-shooter.html` clause:
   "`games/jungle-game-remake/` (a folder game) loads Three.js 0.160.0 from jsDelivr through an import map, and its boot guard shows a fallback card when the CDN, WebGL or `file://` gets in the way (test that card when touching it),"
2. In "Adding a new game", change "`games/last-quarter/` is the only one so far." to "`games/last-quarter/`, `games/tham-tu-mang/` and `games/jungle-game-remake/` are examples."
3. At the end of "The testable-region pattern" section, add:
   "`games/jungle-game-remake/` keeps its rules in the DOM-free module `js/rules.js`, a 1:1 port of `games/jungle-game.html`. `tests/jungle-remake-parity.test.mjs` lifts the original's rule functions out of the HTML and compares move generation on thousands of random positions. A rule change in either file must be mirrored in the other, or that test fails."

- [ ] **Step 4: Full verification**

Run: `node --test 'tests/*.test.mjs'`
Expected: every test passes. Paste the summary line (`# pass N`, `# fail 0`) into the report.

With the server running: `curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/index.html` → `200`.

- [ ] **Step 5: PLAYTEST final. Stop and ask the user.**

Ask the user to:
- open the hub at <http://localhost:8000/> and confirm the "Cờ Thú: Rừng Xanh" card renders with the lime gradient, sits in the same sector as Cờ Thú, and opens the remake;
- confirm the original Cờ Thú card still works;
- play one last full game.

- [ ] **Step 6: Commit**

Message:

```
feat(hub): add Cờ Thú: Rừng Xanh to the game menu

Nothing scans games/, so the remake is unreachable until the hub lists
it. It goes in beside the original Cờ Thú card rather than replacing it.
CLAUDE.md now records the remake's CDN exception and the parity test
that ties its rules to jungle-game.html.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

Files: `index.html`, `README.md`, `CLAUDE.md`.
