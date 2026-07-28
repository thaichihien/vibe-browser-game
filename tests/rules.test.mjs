import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './harness.mjs';

const { CARDS } = load(['ENGINE'], ['CARDS']);

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
