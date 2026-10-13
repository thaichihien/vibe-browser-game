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
