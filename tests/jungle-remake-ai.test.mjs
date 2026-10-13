/* Cờ Thú remake — the AI. Its move generator runs on its own compact board, so the first test
   holds it to rules.js on positions reached by seeded random play; the rest check that each
   level only plays legal moves, never misses a win in one, and does not stall the game by
   shuffling. Hard is time-limited, so these runs pass a small `timeMs`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../games/jungle-game-remake/js/rules.js';
import { chooseMove, fromPieces, generate, positionKey } from '../games/jungle-game-remake/js/ai.js';

const COLS = 7;

function mulberry32(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function legalMoves(game) {
  const out = [];
  for (const p of game.pieces.filter(q => q.player === game.currentPlayer)) {
    for (const m of game.getValidMoves(p)) out.push(`${p.row},${p.col}>${m.row},${m.col}`);
  }
  return out.sort();
}

function aiMoves(game) {
  return generate(fromPieces(game.pieces, game.currentPlayer))
    .map(m => {
      const from = m & 127, to = m >> 7;
      return `${Math.floor(from / COLS)},${from % COLS}>${Math.floor(to / COLS)},${to % COLS}`;
    })
    .sort();
}

/** A board of just these pieces, `player` to move. */
function position(player, pieces) {
  const game = createGame();
  game.pieces = pieces.map((p, id) => ({ id, ...p }));
  game.currentPlayer = player;
  return game;
}

function play(game, move) {
  const piece = game.pieceAt(move.from.row, move.from.col);
  assert.ok(piece, `no piece at ${move.from.row},${move.from.col}`);
  assert.equal(piece.player, game.currentPlayer, 'AI moved the wrong side');
  assert.equal(piece.type, move.type);
  return game.applyMove(piece, move.to.row, move.to.col);   // throws on an illegal move
}

test('AI move generator matches rules.js on random positions', () => {
  const random = mulberry32(1234);
  let checked = 0;
  for (let g = 0; g < 60; g++) {
    const game = createGame();
    for (let ply = 0; ply < 120 && !game.gameOver; ply++) {
      assert.deepEqual(aiMoves(game), legalMoves(game), `game ${g} ply ${ply}`);
      checked++;
      const moves = game.pieces.filter(p => p.player === game.currentPlayer)
        .flatMap(p => game.getValidMoves(p).map(m => [p, m]));
      if (!moves.length) break;
      const [p, m] = moves[Math.floor(random() * moves.length)];
      game.applyMove(p, m.row, m.col);
    }
  }
  assert.ok(checked > 3000, `only ${checked} positions checked`);
});

test('every level returns a legal move from the opening, for either side', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    for (const player of ['red', 'blue']) {
      const game = createGame();
      game.currentPlayer = player;
      play(game, chooseMove(game.pieces, player, level, { timeMs: 100 }));
    }
  }
});

test('every level takes a den entry when one is on the board', () => {
  // blue cat beside red's den, with a free red wolf next to the blue lion as a distraction
  const game = position('blue', [
    { type: 'cat', player: 'blue', row: 1, col: 3 },
    { type: 'lion', player: 'blue', row: 5, col: 3 },
    { type: 'wolf', player: 'red', row: 4, col: 3 },
    { type: 'rat', player: 'red', row: 8, col: 0 },
  ]);
  for (const level of ['easy', 'normal', 'hard']) {
    for (let seed = 1; seed <= 5; seed++) {
      const m = chooseMove(game.pieces, 'blue', level, { random: mulberry32(seed), timeMs: 100 });
      assert.deepEqual(m.to, { row: 0, col: 3 }, `${level} seed ${seed} missed the den`);
    }
  }
});

test('normal and hard take a free piece and do not hand one over', () => {
  // the red tiger can take an undefended blue wolf
  const capture = position('red', [
    { type: 'tiger', player: 'red', row: 2, col: 3 },
    { type: 'wolf', player: 'blue', row: 3, col: 3 },
    { type: 'cat', player: 'red', row: 0, col: 0 },
    { type: 'dog', player: 'blue', row: 8, col: 6 },
  ]);
  for (const level of ['normal', 'hard']) {
    const m = chooseMove(capture.pieces, 'red', level, { timeMs: 200 });
    assert.deepEqual([m.type, m.to], ['tiger', { row: 3, col: 3 }], `${level} skipped a free wolf`);
  }

  // the red wolf at 4,3 has the blue lion two squares away; stepping to 5,3 puts it in reach
  const danger = position('red', [
    { type: 'wolf', player: 'red', row: 4, col: 3 },
    { type: 'lion', player: 'blue', row: 6, col: 3 },
    { type: 'rat', player: 'red', row: 0, col: 0 },
    { type: 'rat', player: 'blue', row: 8, col: 6 },
  ]);
  for (const level of ['normal', 'hard']) {
    const m = chooseMove(danger.pieces, 'red', level, { timeMs: 200 });
    assert.notDeepEqual(m.to, { row: 5, col: 3 }, `${level} walked the wolf into the lion`);
  }
});

test('the position key ignores ids and changes with the side to move', () => {
  const a = createGame().pieces;
  const b = a.map(p => ({ ...p, id: p.id + 100 })).reverse();
  assert.equal(positionKey(a, 'red'), positionKey(b, 'red'));
  assert.notEqual(positionKey(a, 'red'), positionKey(a, 'blue'));
});

// A full game between two levels, keeping the history the way main.js does. A side that is
// ahead and allowed to repeat positions shuffles forever, so finishing at all is the check.
function match(redLevel, blueLevel, seed, maxPlies = 300) {
  const game = createGame();
  const random = mulberry32(seed);
  const history = [positionKey(game.pieces, game.currentPlayer)];
  const seen = new Map();
  for (let ply = 0; ply < maxPlies && !game.gameOver; ply++) {
    const level = game.currentPlayer === 'red' ? redLevel : blueLevel;
    const move = chooseMove(game.pieces, game.currentPlayer, level, { history, random, timeMs: 40 });
    if (!move) break;
    play(game, move);
    const key = positionKey(game.pieces, game.currentPlayer);
    history.push(key);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return { game, plies: history.length - 1, maxRepeat: Math.max(0, ...seen.values()) };
}

test('normal beats easy, and the stronger side does not shuffle', () => {
  let normalWins = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const redNormal = seed % 2 === 1;
    const { game, maxRepeat } = match(redNormal ? 'normal' : 'easy', redNormal ? 'easy' : 'normal', seed);
    if (game.gameOver && game.winner === (redNormal ? 'red' : 'blue')) normalWins++;
    assert.ok(maxRepeat <= 3, `seed ${seed}: a position came up ${maxRepeat} times`);
  }
  assert.ok(normalWins >= 5, `normal won only ${normalWins}/6 against easy`);
});

test('hard beats normal', () => {
  let hardWins = 0;
  for (let seed = 1; seed <= 4; seed++) {
    const redHard = seed % 2 === 1;
    const { game } = match(redHard ? 'hard' : 'normal', redHard ? 'normal' : 'hard', seed);
    if (game.gameOver && game.winner === (redHard ? 'red' : 'blue')) hardWins++;
  }
  assert.ok(hardWins >= 3, `hard won only ${hardWins}/4 against normal`);
});
