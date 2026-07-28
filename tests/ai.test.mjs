import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './harness.mjs';

const { CARDS, Rules, Deal, AI } = load(
  ['ENGINE', 'AI'],
  ['CARDS', 'Rules', 'Deal', 'AI']
);

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeBoard(spec) {
  const b = Array(9).fill(null);
  for (const [idx, [cardId, owner]] of Object.entries(spec)) {
    b[Number(idx)] = { cardId, owner };
  }
  return b;
}

// Play one full match and return final scores.
function playMatch(diffA, diffB, rng) {
  const hands = Deal.hands(rng);
  const board = Array(9).fill(null);
  let turn = rng() < 0.5 ? 0 : 1;
  while (Rules.legalCells(board).length) {
    const diff = turn === 0 ? diffA : diffB;
    const mv = AI.pick(board, hands, turn, diff, rng);
    const res = Rules.resolve(board, mv.cellIdx, mv.cardId, turn);
    board[mv.cellIdx] = { cardId: mv.cardId, owner: turn };
    res.waves.flat().forEach(c => { board[c].owner = turn; });
    hands[turn].splice(hands[turn].indexOf(mv.cardId), 1);
    turn = 1 - turn;
  }
  return Rules.score(board, hands);
}

for (const diff of ['easy', 'normal', 'hard']) {
  test(`${diff} AI always returns a legal move`, () => {
    const rng = seeded(1);
    for (let i = 0; i < 100; i++) {
      const hands = Deal.hands(rng);
      const board = makeBoard({ 4: [hands[1][0], 1] });
      hands[1].shift();
      const mv = AI.pick(board, hands, 0, diff, rng);
      assert.ok(hands[0].includes(mv.cardId), `${diff} played a card not in hand`);
      assert.ok(Rules.legalCells(board).includes(mv.cellIdx), `${diff} played on a taken cell`);
    }
  });
}

test('normal AI takes an available capture', () => {
  // Enemy 🐀 (id 0, w:1) sits at cell 4. Hand holds 🐲 (id 28, e:6), which
  // flips it from cell 3. A greedy AI must find that.
  const board = makeBoard({ 4: [0, 1] });
  const hands = [[28, 1, 2, 3, 5], [29]];
  const mv = AI.pick(board, hands, 0, 'normal', seeded(3));
  const res = Rules.resolve(board, mv.cellIdx, mv.cardId, 0);
  assert.ok(res.waves.flat().length >= 1, 'normal AI passed up a free capture');
});

test('hard beats normal over a run of matches', () => {
  const rng = seeded(2026);
  let hardWins = 0, normalWins = 0;
  for (let i = 0; i < 60; i++) {
    const [a, b] = playMatch('hard', 'normal', rng);
    if (a > b) hardWins++;
    else if (b > a) normalWins++;
  }
  assert.ok(hardWins > normalWins, `hard ${hardWins} vs normal ${normalWins}`);
});

test('normal beats easy over a run of matches', () => {
  const rng = seeded(1234);
  let normalWins = 0, easyWins = 0;
  for (let i = 0; i < 60; i++) {
    const [a, b] = playMatch('normal', 'easy', rng);
    if (a > b) normalWins++;
    else if (b > a) easyWins++;
  }
  assert.ok(normalWins > easyWins, `normal ${normalWins} vs easy ${easyWins}`);
});

test('AI.pick does not mutate the board or hands', () => {
  const board = makeBoard({ 4: [0, 1] });
  const hands = [[28, 1, 2, 3, 5], [29]];
  const snap = JSON.stringify({ board, hands });
  AI.pick(board, hands, 0, 'hard', seeded(9));
  assert.equal(JSON.stringify({ board, hands }), snap);
});
