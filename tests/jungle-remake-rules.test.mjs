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
