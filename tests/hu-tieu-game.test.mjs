import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../games/hu-tieu/js/game.js';

/** Cook one bowl exactly to an order through the same taps a player makes. */
function cook(s, order) {
  assert.ok(G.tapNoodleTray(s, order.noodle));
  const b = s.baskets.findIndex(x => x.noodle);
  G.step(s, G.COOK_TIME + 0.01);
  assert.ok(G.tapBasket(s, b));
  assert.ok(order.style === 'kho' ? G.tapSauce(s) : G.tapBroth(s));
  for (const t of order.tops) assert.ok(G.tapTopping(s, t));
  if (order.hanh) {
    if (!s.scallion.pile) { assert.ok(G.tapChop(s)); G.step(s, G.CHOP_TIME + 0.01); }
    assert.ok(G.tapExtra(s, 'hanh'));
  }
  for (const k of ['gia', 'tieu', 'ot']) if (order[k]) assert.ok(G.tapExtra(s, k));
}

const seatOf = s => s.seats.findIndex(c => c && c.phase === 'wait');
const arrive = s => { for (let i = 0; i < 200 && seatOf(s) < 0; i++) G.step(s, 0.1); return s.seats[seatOf(s)]; };

test('planDay is deterministic and every order uses only that day\'s menu', () => {
  G.LEVELS.forEach((lv, i) => {
    assert.deepEqual(G.planDay(i), G.planDay(i));
    for (const c of G.planDay(i)) for (const it of c.items) {
      if (it.kind === 'tea') { assert.ok(lv.tea > 0); continue; }
      assert.ok(lv.noodles.includes(it.noodle));
      assert.ok(lv.styles.includes(it.style));
      assert.ok(it.tops.length >= 1 && it.tops.length <= lv.maxTops);
      for (const t of it.tops) assert.ok(lv.tops.includes(t));
    }
  });
});

test('star targets rise strictly', () => {
  G.LEVELS.forEach((_, i) => {
    const [a, b, c] = G.targets(i);
    assert.ok(a < b && b < c);
  });
});

test('a correctly cooked bowl is served to the customer who ordered it and paid with a tip', () => {
  const s = G.newGame(0);
  const c = arrive(s);
  cook(s, c.items[0]);
  const bowl = s.bowls.findIndex(b => b.noodle);
  assert.ok(G.tapBowl(s, bowl));
  assert.equal(c.phase, 'leave');
  const paid = s.coins[c.seat].amount;
  assert.ok(paid > G.bowlPrice(c.items[0]), 'fast service tips');
  G.collect(s, c.seat);
  assert.equal(s.money, paid);
});

test('a wrong bowl is not served; tapping it selects it, and trash empties it', () => {
  const s = G.newGame(0);
  const c = arrive(s);
  const wrong = { ...c.items[0], tops: c.items[0].tops.includes('tom') ? ['thit'] : ['tom'] };
  if (G.sameBowl(wrong, c.items[0])) wrong.tops = ['thit', 'tom'];
  cook(s, wrong);
  const bowl = s.bowls.findIndex(b => b.noodle);
  G.tapBowl(s, bowl);
  assert.equal(c.phase, 'wait');
  assert.equal(s.selected, bowl);
  assert.ok(G.tapTrash(s));
  assert.equal(s.bowls[bowl].noodle, null);
});

test('noodles go mushy after the hold window and can only be thrown away', () => {
  const s = G.newGame(0);
  s.queue = [];
  G.tapNoodleTray(s, 'hu');
  G.step(s, G.COOK_TIME + G.HOLD_TIME + 0.1);
  assert.equal(G.basketState(s.baskets[0]), 'mushy');
  G.tapBasket(s, 0);
  assert.equal(s.baskets[0].noodle, null);
  assert.ok(s.bowls.every(b => !b.noodle));
  assert.equal(s.wasted, 1);
});

test('selected bowl receives the next topping', () => {
  const s = G.newGame(0);
  s.queue = [];
  for (let i = 0; i < 2; i++) { G.tapNoodleTray(s, 'hu'); }
  G.step(s, G.COOK_TIME + 0.01);
  G.tapBasket(s, 0); G.tapBasket(s, 1);
  G.tapBowl(s, 1);
  G.tapTopping(s, 'tom');
  assert.deepEqual(s.bowls[1].tops, ['tom']);
  assert.deepEqual(s.bowls[0].tops, []);
});

test('an ignored customer leaves angry and the day ends', () => {
  const s = G.newGame(0);
  for (let i = 0; i < 3000 && !s.over; i++) G.step(s, 0.1);
  assert.ok(s.over);
  assert.equal(s.lost, G.LEVELS[0].customers);
  assert.equal(G.starsFor(s), 0);
});

test('a perfect day earns three stars', () => {
  for (const lvl of [0, 5, 9]) {
    const s = G.newGame(lvl);
    for (let i = 0; i < 20000 && !s.over; i++) {
      G.step(s, 0.05);
      for (const c of s.seats) {
        if (!c || c.phase !== 'wait') continue;
        c.items.forEach((it, k) => {
          if (c.served[k]) return;
          if (it.kind === 'tea') {
            G.tapTeaJug(s);
            G.step(s, G.TEA_TIME);
            G.tapGlass(s, s.glasses.findIndex(g => g.state === 'full'));
          } else {
            cook(s, it);
            G.tapBowl(s, s.bowls.findIndex(b => b.noodle));
          }
        });
      }
      s.coins.forEach((m, i) => m && G.collect(s, i));
    }
    assert.ok(s.over, `level ${lvl} finished`);
    assert.equal(s.lost, 0);
    assert.equal(G.starsFor(s), 3, `level ${lvl}: ${s.money} vs ${s.targets}`);
  }
});

test('hành lá must be chopped before it can go in, and each chop yields a few bowls', () => {
  const s = G.newGame(0);
  s.queue = [{ ...s.queue[0], arriveAt: 1e9 }];      // keep the day open
  G.tapNoodleTray(s, 'hu');
  G.step(s, G.COOK_TIME + 0.01);
  G.tapBasket(s, 0);
  assert.equal(G.tapExtra(s, 'hanh'), false, 'nothing chopped yet');
  G.tapChop(s);
  G.step(s, G.CHOP_TIME + 0.01);
  assert.equal(s.scallion.pile, G.CHOP_YIELD);
  assert.ok(G.tapExtra(s, 'hanh'));
  assert.equal(s.scallion.pile, G.CHOP_YIELD - 1);
  assert.equal(G.tapExtra(s, 'hanh'), false, 'a bowl takes hành once');
});

test('a bowl with hành for a "không hành" customer is not served', () => {
  const s = G.newGame(3);
  const c = arrive(s);
  const order = c.items.find(i => i.kind === 'bowl');
  cook(s, { ...order, hanh: !order.hanh });
  G.tapBowl(s, s.bowls.findIndex(b => b.noodle));
  assert.equal(c.phase, 'wait');
});

test('day 1 orders always want hành and giá, and never tiêu or ớt', () => {
  for (const c of G.planDay(0)) for (const it of c.items) {
    assert.ok(it.hanh && it.gia && !it.tieu && !it.ot);
  }
});
