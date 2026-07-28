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

// Standard SAME fixture, used by several tests below.
// Place 🐜 (id 11: n4 e4 s3 w4) at centre cell 4. Cell 4's occupied contacts:
//   west  = cell 3 = 🐢 (id 13, e:4)  -> our w:4 ties  -> SAME contact
//   east  = cell 5 = 🐗 (id 20, w:4)  -> our e:4 ties  -> SAME contact
// Neither tie can be taken by BASIC, which needs a *strictly* greater edge.
test('SAME: two equal facing edges flip both enemies', () => {
  const board = makeBoard({ 3: [13, 1], 5: [20, 1] });
  const res = Rules.resolve(board, 4, 11, 0);
  assert.equal(res.same, true);
  assert.deepEqual(flat(res).sort((a, b) => a - b), [3, 5]);
});

test('SAME: a single equal edge is not enough', () => {
  const board = makeBoard({ 5: [20, 1] }); // one equal contact only
  const res = Rules.resolve(board, 4, 11, 0);
  assert.equal(res.same, false);
});

test('SAME: friendly neighbour counts toward the threshold but is not flipped', () => {
  // Same geometry, but cell 3 is ours. SAME still fires — two equal contacts —
  // and only the enemy at cell 5 flips.
  const board = makeBoard({ 3: [13, 0], 5: [20, 1] });
  const res = Rules.resolve(board, 4, 11, 0);
  assert.equal(res.same, true);
  assert.deepEqual(flat(res), [5]);
});

test('SAME takes cards BASIC never could', () => {
  // This is the whole point of the rule. Both contacts are exact ties, so a
  // BASIC-only engine flips nothing here.
  const board = makeBoard({ 3: [13, 1], 5: [20, 1] });
  const res = Rules.resolve(board, 4, 11, 0);
  assert.equal(CARDS[13].e, CARDS[11].w); // tie, not a win
  assert.equal(CARDS[20].w, CARDS[11].e); // tie, not a win
  assert.deepEqual(flat(res).sort((a, b) => a - b), [3, 5]);
});

// PLUS fixture, deliberately built so BASIC and SAME both flip nothing —
// every capture here is PLUS's doing alone.
// Place 🐜 (id 11: n4 e4 s3 w4) at centre cell 4:
//   west = cell 3 = 🐍 (id 7,  e:5) -> our w:4 loses to 5;  sum 4 + 5 = 9
//   east = cell 5 = 👾 (id 25, w:5) -> our e:4 loses to 5;  sum 4 + 5 = 9
// Sums tie at 9, so PLUS flips both despite our edges being *weaker*.
test('PLUS: two equal edge-sums flip both enemies', () => {
  const board = makeBoard({ 3: [7, 1], 5: [25, 1] });
  const res = Rules.resolve(board, 4, 11, 0);
  assert.equal(res.plus, true);
  assert.equal(res.same, false);
  assert.deepEqual(flat(res).sort((a, b) => a - b), [3, 5]);
});

test('PLUS: differing sums do not fire, and weak edges take nothing', () => {
  // 🐀 (id 0, e:2) west -> sum 6;  👾 (id 25, w:5) east -> sum 9.
  const board = makeBoard({ 3: [0, 1], 5: [25, 1] });
  const res = Rules.resolve(board, 4, 11, 0);
  assert.equal(res.plus, false);
  assert.deepEqual(flat(res), [3]); // only the BASIC flip on 🐀 (4 > 2)
});

test('PLUS: a group of friendly-only cards does not fire', () => {
  const board = makeBoard({ 3: [7, 0], 5: [25, 0] }); // equal sums, both ours
  const res = Rules.resolve(board, 4, 11, 0);
  assert.equal(res.plus, false);
  assert.deepEqual(flat(res), []);
});

test('SAME and PLUS both fire on a board that satisfies each', () => {
  // The Task 3 SAME fixture also has tied sums (4+4 and 4+4), so both rules
  // fire on the same placement. They are checked independently.
  const board = makeBoard({ 3: [13, 1], 5: [20, 1] });
  const res = Rules.resolve(board, 4, 11, 0);
  assert.equal(res.same, true);
  assert.equal(res.plus, true);
});

// Cell layout:  0 1 2
//               3 4 5
//               6 7 8
test('COMBO: a SAME-flipped card cascades into its own neighbour', () => {
  // Task 3's SAME fixture, plus a weak enemy below cell 3.
  // SAME flips cell 3 (🐢 id 13) and cell 5 (🐗 id 20).
  // The captured 🐢 at cell 3 has s:4, and cell 6 holds 🐀 (id 0, n:3) -> 4 > 3, combo.
  const board = makeBoard({ 3: [13, 1], 5: [20, 1], 6: [0, 1] });
  const res = Rules.resolve(board, 4, 11, 0);
  assert.equal(res.same, true);
  assert.deepEqual(res.waves[0].sort((a, b) => a - b), [3, 5]);
  assert.deepEqual(res.waves[1], [6]);
  assert.equal(res.comboDepth, 1);
});

test('COMBO: cards flipped by BASIC do not seed a cascade', () => {
  // Place 🐲 (id 28: n10 e6 s8 w4) at cell 4 — pure BASIC flip on cell 5.
  // Cell 5 = 🐀 (id 0, w:1) flips. Cell 8 below it holds a weak enemy 🐁 (id 1, n:1),
  // which the flipped 🐀 (id 0, s:4) would beat — but BASIC flips never combo.
  const board = makeBoard({ 5: [0, 1], 8: [1, 1] });
  const res = Rules.resolve(board, 4, 28, 0);
  assert.deepEqual(res.waves[0], [5]);
  assert.equal(res.waves.length, 1);
  assert.equal(res.comboDepth, 0);
});

test('COMBO: cascade runs multiple levels deep, one array per level', () => {
  // A deliberate three-wave chain:
  //   place 🐜 (id 11) at cell 4 -> SAME flips cell 3 (🐢 id 13) and cell 5 (🐗 id 20).
  //   Cell 7 holds 🦇 (id 10, n:7 e:3 s:2 w:3): our s:3 vs their n:7 is not a tie,
  //   not a BASIC win, and its sum (3+7=10) doesn't join the SAME contacts' 8-group,
  //   so it survives wave 0 untouched.
  //   captured 🐢 at cell 3 (s:4) beats cell 6 = 🐁 (id 1, n:1)   -> wave 1
  //   captured 🐁 at cell 6 (e:4) beats cell 7 = 🦇 (id 10, w:3)  -> wave 2
  const board = makeBoard({ 3: [13, 1], 5: [20, 1], 6: [1, 1], 7: [10, 1] });
  const res = Rules.resolve(board, 4, 11, 0);
  assert.equal(res.waves.length, 3);
  assert.deepEqual(res.waves[0].sort((a, b) => a - b), [3, 5]);
  assert.deepEqual(res.waves[1], [6]);
  assert.deepEqual(res.waves[2], [7]);
  assert.equal(res.comboDepth, 2);
});

test('COMBO: a card is never flipped twice in one resolution', () => {
  const board = makeBoard({ 3: [13, 1], 5: [20, 1], 6: [1, 1], 7: [10, 1] });
  const res = Rules.resolve(board, 4, 11, 0);
  const all = res.waves.flat();
  assert.equal(new Set(all).size, all.length);
});

test('PLUS: a three-member sum group flips every enemy in it', () => {
  // Same geometry, but cell 7 holds 🐛 (id 3, n:5): our s:3 + their n:5 = 8,
  // which joins the 8-sum group the two SAME contacts already form (4+4).
  // All three contacts share sum 8, so PLUS takes all three at once.
  const board = makeBoard({ 3: [13, 1], 5: [20, 1], 7: [3, 1] });
  const res = Rules.resolve(board, 4, 11, 0);
  assert.equal(res.plus, true);
  assert.deepEqual(res.waves[0].sort((a, b) => a - b), [3, 5, 7]);
});
