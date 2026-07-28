import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './harness.mjs';

const { CARDS, Rules, neighborsOf } = load(['ENGINE'], ['CARDS', 'Rules', 'neighborsOf']);

test('roster has exactly 30 cards with sequential ids', () => {
  assert.equal(CARDS.length, 30);
  CARDS.forEach((c, i) => assert.equal(c.id, i));
});

test('rarity counts are 14 common, 10 uncommon, 6 rare', () => {
  const by = r => CARDS.filter(c => c.r === r).length;
  assert.equal(by('common'), 14);
  assert.equal(by('uncommon'), 10);
  assert.equal(by('rare'), 6);
});

test('every edge value is an integer in 1..10', () => {
  for (const c of CARDS) {
    for (const d of ['n', 'e', 's', 'w']) {
      assert.ok(Number.isInteger(c[d]), `${c.name}.${d} not an integer`);
      assert.ok(c[d] >= 1 && c[d] <= 10, `${c.name}.${d} out of range: ${c[d]}`);
    }
  }
});

test('edge sums stay inside their rarity band', () => {
  const band = { common: [10, 16], uncommon: [17, 22], rare: [25, 30] };
  for (const c of CARDS) {
    const sum = c.n + c.e + c.s + c.w;
    const [lo, hi] = band[c.r];
    assert.ok(sum >= lo && sum <= hi, `${c.name} sum ${sum} outside ${c.r} band ${lo}-${hi}`);
  }
});

test('every card has a distinct emoji and name', () => {
  assert.equal(new Set(CARDS.map(c => c.emoji)).size, 30);
  assert.equal(new Set(CARDS.map(c => c.name)).size, 30);
});

// Board helper: `spec` maps cell index -> [cardId, owner].
function makeBoard(spec) {
  const b = Array(9).fill(null);
  for (const [idx, [cardId, owner]] of Object.entries(spec)) {
    b[Number(idx)] = { cardId, owner };
  }
  return b;
}
const flat = res => res.waves.flat();

test('neighborsOf respects board edges — no wrapping', () => {
  assert.deepEqual(neighborsOf(0).map(n => n.dir).sort(), ['e', 's']);
  assert.deepEqual(neighborsOf(4).map(n => n.dir).sort(), ['e', 'n', 's', 'w']);
  assert.deepEqual(neighborsOf(8).map(n => n.dir).sort(), ['n', 'w']);
  // cell 3 is column 0 — it must have no west neighbour
  assert.ok(!neighborsOf(3).some(n => n.dir === 'w'));
});

test('BASIC: higher facing edge flips one enemy card', () => {
  // cell 4 holds enemy 🐀 (id 0, w:1). We place 🐲 (id 28, e:6) at cell 3.
  // Our east 6 vs their west 1 -> flip.
  const board = makeBoard({ 4: [0, 1] });
  const res = Rules.resolve(board, 3, 28, 0);
  assert.deepEqual(flat(res), [4]);
});

test('BASIC: equal facing edges do not flip', () => {
  // 🐜 (id 11) has e:4 and w:4. Place it against itself across a boundary.
  const board = makeBoard({ 4: [11, 1] });
  const res = Rules.resolve(board, 3, 11, 0);
  assert.deepEqual(flat(res), []);
});

test('BASIC: never flips a card you already own', () => {
  const board = makeBoard({ 4: [0, 0] });
  const res = Rules.resolve(board, 3, 28, 0);
  assert.deepEqual(flat(res), []);
});

test('resolve does not mutate the board it is given', () => {
  const board = makeBoard({ 4: [0, 1] });
  const snapshot = JSON.stringify(board);
  Rules.resolve(board, 3, 28, 0);
  assert.equal(JSON.stringify(board), snapshot);
});

test('resolve reports no combo when only BASIC fired', () => {
  const board = makeBoard({ 4: [0, 1] });
  const res = Rules.resolve(board, 3, 28, 0);
  assert.equal(res.same, false);
  assert.equal(res.plus, false);
  assert.equal(res.comboDepth, 0);
});

// These three tests are built so a same-direction lookup bug (comparing my
// edge against the neighbour's edge in the SAME direction, instead of via
// OPPOSITE) would NOT flip, while the correct OPPOSITE-edge comparison DOES.
// The existing BASIC tests above use cards where both directions happen to
// agree, so they can't catch this class of bug.

test('BASIC compares the OPPOSITE edge, not the same-direction edge (east)', () => {
  // cell 5 holds enemy 🐙 (id 9, w:2, e:7). We place 🕷️ (id 4, e:3) at cell 4.
  // Correct: our east 3 vs their west 2 -> 3 > 2, flip.
  // Same-direction bug would compare our east 3 vs their east 7 -> no flip.
  const board = makeBoard({ 5: [9, 1] });
  const res = Rules.resolve(board, 4, 4, 0);
  assert.deepEqual(flat(res), [5]);
});

test('BASIC compares the OPPOSITE edge, not the same-direction edge (west)', () => {
  // cell 4 holds enemy 🐢 (id 13, e:4, w:6). We place 🦍 (id 21, w:5) at cell 5.
  // Correct: our west 5 vs their east 4 -> 5 > 4, flip.
  // Same-direction bug would compare our west 5 vs their west 6 -> no flip.
  const board = makeBoard({ 4: [13, 1] });
  const res = Rules.resolve(board, 5, 21, 0);
  assert.deepEqual(flat(res), [4]);
});

test('BASIC compares the OPPOSITE edge, not the same-direction edge (north)', () => {
  // cell 1 holds enemy 🦅 (id 14, s:2, n:8). We place 🕷️ (id 4, n:4) at cell 4.
  // Correct: our north 4 vs their south 2 -> 4 > 2, flip.
  // Same-direction bug would compare our north 4 vs their north 8 -> no flip.
  const board = makeBoard({ 1: [14, 1] });
  const res = Rules.resolve(board, 4, 4, 0);
  assert.deepEqual(flat(res), [1]);
});
