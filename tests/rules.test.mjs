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
