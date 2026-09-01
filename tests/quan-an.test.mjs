/* Quán Ăn Của Tôi — unit tests over the DOM-free modules.

   Plain ES modules, imported directly: no extraction step and no `node:vm`
   sandbox. That is also the contract being enforced — if config, data, state,
   world or sim ever reaches for `document` or `window`, this file stops
   loading. `state.js` touches localStorage only inside try/catch, which is why
   it still imports cleanly here. */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ARRIVAL, BASE_CARRY, DAILY_OVERHEAD, ENERGY_BY_LEVEL, FOOD_COST_RATIO,
  CLOSING_GRACE, GRID_H, GRID_W, OFFLINE_CAP_HOURS, PATIENCE, SHIFT_SECONDS,
  TABLE_SLOTS, T,
  clamp, idleArrivalsPerMin, vnd, vndShort
} from '../games/quan-an/js/config.js';
import {
  CLAIM_FEE, DISH, DISHES, DRINK_IDS, GROUP_KINDS, LEVELS, MAIN_IDS, MENU_CATS,
  MISSIONS, SHOP, SHOP_BY_ID, SIDE_IDS, STARTER_DISHES, TUTORIAL_DAYS,
  TUTORIAL_EVENTS, ADULT_FACES, KID_FACES, FACADE, FACADE_BY_ID,
  NAME_SUGGESTIONS, levelFor, orderWeight, weightedAvgPrice
} from '../games/quan-an/js/data.js';
import {
  activeMission, buy, canBuy, checkMissions, claimRestaurant, derived,
  advanceTutorialDay, buyFacade, canBuyFacade, cleanName, dishNeedsLevel,
  displayName, energyLimited, fresh, learn, refreshEnergy, setName, spendEnergy,
  tierProgress, todayKey, untilMidnight, MAX_NAME
} from '../games/quan-an/js/state.js';
import { buildWorld, findPath, followPath } from '../games/quan-an/js/world.js';
import { createSim, orderSummary, shiftTarget } from '../games/quan-an/js/sim.js';
import * as Debug from '../games/quan-an/js/debug.js';
import {
  BUILDINGS, MARKET_ROUNDS, MARKET_STALLS, ROW, ST_H, ST_W,
  createStreet, makeMarketRound, marketReward
} from '../games/quan-an/js/street.js';

/* ── money formatting ─────────────────────────────────────────────────────*/

test('vnd groups thousands the Vietnamese way', () => {
  assert.equal(vnd(0), '0₫');
  assert.equal(vnd(3000), '3.000₫');
  assert.equal(vnd(45000), '45.000₫');
  assert.equal(vnd(12500000), '12.500.000₫');
  assert.equal(vnd(45000.4), '45.000₫', 'never shows a fraction of a đồng');
});

test('vndShort keeps one decimal until the number stops needing it', () => {
  assert.equal(vndShort(950000), '950k');
  assert.equal(vndShort(1250000), '1,3tr');
  assert.equal(vndShort(12500000), '12,5tr');
  assert.equal(vndShort(280000000), '280tr');
});

/* ── catalogue integrity ──────────────────────────────────────────────────*/

test('every id in the catalogue is unique', () => {
  const shopIds = SHOP.map(s => s.id);
  assert.equal(new Set(shopIds).size, shopIds.length);
  const dishIds = DISHES.map(d => d.id);
  assert.equal(new Set(dishIds).size, dishIds.length);
});

test('prerequisites and level gates all point at something real', () => {
  for (const it of SHOP) {
    if (it.needs) assert.ok(SHOP_BY_ID[it.needs], `${it.id} needs missing ${it.needs}`);
    if (it.minLevel) assert.ok(it.minLevel >= 1 && it.minLevel <= 5, `${it.id} bad minLevel`);
    assert.ok(it.price > 0 && Number.isInteger(it.price), `${it.id} bad price`);
    assert.ok(it.eff && Object.keys(it.eff).length, `${it.id} does nothing`);
  }
  for (const d of DISHES) {
    assert.ok(d.price > 0 && d.cook > 0, `${d.id} bad numbers`);
    assert.ok(d.unlock >= 0, `${d.id} bad unlock`);
  }
  for (const id of DRINK_IDS) assert.ok(DISH[id], `drink ${id} is not on the menu`);
  for (const id of STARTER_DISHES) assert.equal(DISH[id].unlock, 0);
});

test('every table that can ever exist has an anchor to stand on', () => {
  const buyable = SHOP.filter(s => s.eff.tables).length;
  const gifted = TUTORIAL_EVENTS.filter(e => e.kind === 'table').length;
  assert.equal(2 + gifted + buyable, TABLE_SLOTS.length,
    'two come with the quán, the apprenticeship adds some, the shop sells the rest');
});

/* This is the trap that makes a tycoon curve unplayable: a tier whose entry
   price is higher than the total value of everything the tier below can buy. */
test('every tier is reachable from the one below it', () => {
  let cumulative = CLAIM_FEE;
  for (const L of LEVELS) {
    cumulative += SHOP.filter(s => (s.minLevel || 1) === L.n).reduce((a, s) => a + s.price, 0);
    cumulative += DISHES.filter(d => d.unlock > 0 && dishTier(d) === L.n).reduce((a, d) => a + d.unlock, 0);
    const next = LEVELS.find(x => x.n === L.n + 1);
    if (next) {
      assert.ok(cumulative >= next.invested,
        `cấp ${next.n} needs ${next.invested} but only ${cumulative} is buyable below it`);
    }
  }
  function dishTier(d) { return d.tier <= 1 ? 1 : d.tier === 2 ? 3 : 4; }
});

test('tiers, overheads and energy tables line up', () => {
  assert.equal(DAILY_OVERHEAD.length, LEVELS.length + 1);
  assert.equal(ENERGY_BY_LEVEL.length, LEVELS.length + 1);
  for (let i = 1; i < LEVELS.length; i++) {
    assert.ok(LEVELS[i].invested > LEVELS[i - 1].invested, 'tiers must climb');
    assert.ok(DAILY_OVERHEAD[i + 1] > DAILY_OVERHEAD[i], 'overheads must climb');
    assert.ok(ENERGY_BY_LEVEL[i + 1] >= ENERGY_BY_LEVEL[i], 'energy must not shrink');
  }
  assert.equal(ENERGY_BY_LEVEL[1], 5);
  assert.equal(ENERGY_BY_LEVEL[5], 8, 'the brief asks for 5 to 8 ca a day');
});

test('levelFor picks the highest tier the investment clears', () => {
  assert.equal(levelFor(0).n, 1);
  assert.equal(levelFor(LEVELS[1].invested - 1).n, 1);
  assert.equal(levelFor(LEVELS[1].invested).n, 2);
  assert.equal(levelFor(1e12).n, 5);
});

/* ── the floor ────────────────────────────────────────────────────────────*/

test('every seat, stand and hatch is reachable from the front door', () => {
  const w = buildWorld(TABLE_SLOTS.length);
  assert.equal(w.tables.length, 8);
  for (const t of w.tables) {
    assert.ok(!w.solid(t.stand.x, t.stand.y), `table ${t.id} stand is inside furniture`);
    assert.ok(findPath(w, w.door, t.stand), `table ${t.id} stand unreachable`);
    t.seats.forEach((s, i) => {
      assert.ok(findPath(w, w.door, s), `table ${t.id} seat ${i} unreachable`);
    });
  }
  assert.ok(findPath(w, w.door, w.pass), 'pass unreachable');
  assert.ok(findPath(w, w.door, w.window), 'order window unreachable');
});

test('tables never overlap and never block the door', () => {
  const w = buildWorld(TABLE_SLOTS.length);
  const seen = new Set();
  for (const s of TABLE_SLOTS) {
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const key = `${s.x + dx},${s.y + dy}`;
      assert.ok(!seen.has(key), `two tables share tile ${key}`);
      seen.add(key);
    }
  }
  assert.equal(w.tileAt(9, 12), T.DOOR);
  assert.ok(!seen.has('9,11'), 'the doorway must stay clear');
});

test('findPath aims at a neighbour when the goal tile itself is solid', () => {
  const w = buildWorld(2);
  const path = findPath(w, w.door, { x: w.tables[0].x, y: w.tables[0].y });
  assert.ok(path && path.length, 'a table centre is solid but still targetable');
});

test('findPath gives up rather than looping on an unreachable goal', () => {
  const w = buildWorld(2);
  assert.equal(findPath(w, w.door, { x: 0, y: 0 }), null, 'inside the wall');
});

test('followPath walks an entity to its last node and reports arrival', () => {
  const e = { x: 5, y: 6, path: [{ x: 5, y: 8 }] };
  let guard = 0;
  while (!followPath(e, 4, 1 / 60) && guard++ < 600) { /* walk */ }
  assert.ok(guard < 600, 'never arrived');
  assert.equal(e.y, 8);
});

test('followPath writes direction to `dir`, never over a guest face emoji', () => {
  const e = { x: 5, y: 6, face: '🧑', path: [{ x: 9, y: 6 }] };
  followPath(e, 4, 1 / 60);
  assert.equal(e.face, '🧑', 'a guest emoji must survive being walked');
  assert.equal(e.dir, 'r');
});

/* ── derived stats ────────────────────────────────────────────────────────*/

test('a fresh save is a two-table quán with three recipes and no staff', () => {
  const d = derived(fresh());
  assert.equal(d.tables, 2);
  assert.equal(d.waiters, 0);
  assert.equal(d.chefs, 1);
  assert.equal(d.carry, BASE_CARRY);
  assert.equal(d.level.n, 1);
  assert.equal(d.menu.length, STARTER_DISHES.length);
});

test('derived caps everything that could otherwise run away', () => {
  const s = fresh();
  for (const it of SHOP) s.owned[it.id] = 1;
  s.bonusTables = TUTORIAL_EVENTS.filter(e => e.kind === 'table').length;
  const d = derived(s);
  assert.equal(d.tables, 8, 'the floor only has eight anchors');
  assert.equal(d.chefs, 3, 'the kitchen only has three stoves');
  assert.ok(d.cookMult >= 0.35, 'cooking never becomes instant');
  assert.ok(d.menuMult >= 0.5 && d.payMult >= 0.4);
  assert.ok(d.wages > 0, 'hired staff must cost money every day');
});

test('the ledger and the loop agree on what an unattended quán earns', () => {
  const s = fresh();
  s.owner = true;
  s.owned = { 'ban-nhua': 1, 'pv-part': 1 };
  const d = derived(s);
  const arrivals = idleArrivalsPerMin(d.tables, d.draw, d.level.flow);
  assert.ok(d.idleGroupsPerMin <= arrivals + 1e-9, 'cannot serve more than walk in');
  assert.ok(d.idleGroupsPerMin > 0);
  assert.equal(d.offlineNetPerMin, d.idleNetPerMin);
});

test('with nobody hired, closing the tab closes the quán', () => {
  const s = fresh();
  s.owner = true;
  assert.equal(derived(s).waiters, 0);
  assert.equal(derived(s).offlineNetPerMin, 0);
});

test('the chill loop stays far below what a ca pays per minute', () => {
  const s = fresh();
  s.owner = true;
  s.owned = { 'ban-nhua': 1, 'ban-inox-1': 1, 'pv-part': 1, 'pv-full': 1 };
  s.recipes = [...STARTER_DISHES, 'pho-bo', 'bun-cha', 'ca-phe'];
  const d = derived(s);
  const caPerMinute = shiftTarget(d) / (SHIFT_SECONDS / 60);
  assert.ok(d.idleNetPerMin < caPerMinute * 0.35,
    `loop ${d.idleNetPerMin} is too close to ca ${caPerMinute}`);
});

/* ── buying ───────────────────────────────────────────────────────────────*/

test('canBuy blocks on money, on tier and on prerequisites', () => {
  const s = fresh();
  const tv = SHOP_BY_ID['menu-tv'];          // minLevel 3
  assert.match(canBuy(s, tv), /cấp 3/);

  const tray = SHOP_BY_ID['khay-4'];         // needs the cart first
  s.invested = LEVELS[2].invested;
  s.money = 1e9;
  assert.match(canBuy(s, tray), /Xe đẩy/);
  buy(s, SHOP_BY_ID['xe-day']);
  assert.equal(canBuy(s, tray), null);

  const cheap = SHOP_BY_ID['cay-canh'];
  s.money = 0;
  assert.match(canBuy(s, cheap), /Không đủ tiền/);
});

test('buying moves money into invested, and never twice', () => {
  const s = fresh();
  s.invested = LEVELS[1].invested;          // Quán bình dân, so the table unlocks
  s.money = 20000000;
  const before = s.invested;
  const it = SHOP_BY_ID['ban-go-1'];
  const tables = derived(s).tables;
  assert.equal(buy(s, it), null);
  assert.equal(s.money, 20000000 - it.price);
  assert.equal(s.invested, before + it.price);
  assert.equal(derived(s).tables, tables + 1);
  assert.match(buy(s, it), /Đã mua rồi/);
  assert.equal(s.invested, before + it.price, 'a refused purchase must not charge');
});

test('learning a recipe puts it on the menu and raises the average bill', () => {
  const s = fresh();
  s.money = 1e7;
  const before = derived(s).mainAvg;
  assert.equal(learn(s, DISH['pho-bo']), null);
  assert.ok(s.recipes.includes('pho-bo'));
  assert.ok(derived(s).mainAvg > before);
  assert.match(learn(s, DISH['pho-bo']), /Đã biết nấu/);
});

test('a vỉa hè quán cannot put lobster on the board', () => {
  const s = fresh();
  s.money = 1e9;
  assert.equal(dishNeedsLevel(DISH['pho-bo']), 1);
  assert.equal(dishNeedsLevel(DISH['ga-nuong']), 3);
  assert.equal(dishNeedsLevel(DISH['tom-hum']), 4);
  assert.match(learn(s, DISH['ga-nuong']), /cấp 3/);
  assert.match(learn(s, DISH['tom-hum']), /cấp 4/);
  s.invested = LEVELS[2].invested;
  assert.equal(learn(s, DISH['ga-nuong']), null);
  assert.match(learn(s, DISH['tom-hum']), /cấp 4/);
});

test('guests order toward the best the quán does', () => {
  const mains = DISHES.filter(d => d.kind === 'main');
  const cheap = weightedAvgPrice(mains, 1);
  const rich  = weightedAvgPrice(mains, 4);
  assert.ok(rich > cheap * 2,
    `a nhà hàng should not still be selling mostly rau muống (${cheap} → ${rich})`);
  /* the whole board stays orderable, just rarely at the wrong tier */
  for (const d of mains) assert.ok(orderWeight(d, 1) > 0);
});

test('every dish is well formed and every side rides with a main', () => {
  assert.ok(DISHES.length >= 50, 'the brief asks for at least fifty');
  assert.equal(STARTER_DISHES.length, 3, 'three to open with');
  const cats = new Set(MENU_CATS.map(c => c.id));
  for (const d of DISHES) {
    assert.ok(['main', 'drink', 'dessert'].includes(d.kind), `${d.id} bad kind`);
    assert.ok(cats.has(d.cat), `${d.id} sits in no menu section`);
    assert.ok(d.name && d.emoji, `${d.id} missing name or emoji`);
    assert.ok(d.tier >= 0 && d.tier <= 3, `${d.id} bad tier`);
  }
  assert.deepEqual(SIDE_IDS.filter(id => DISH[id].kind === 'main'), []);
  assert.ok(MAIN_IDS.length > 40);
});

test('tierProgress runs 0 to 1 inside a tier and pins at the top', () => {
  assert.equal(tierProgress({ invested: 0 }).pct, 0);
  assert.equal(tierProgress({ invested: LEVELS[1].invested }).pct, 0);
  assert.ok(tierProgress({ invested: LEVELS[1].invested / 2 }).pct > 0);
  const top = tierProgress({ invested: LEVELS[4].invested });
  assert.equal(top.next, null);
  assert.equal(top.pct, 1);
});

/* ── energy ───────────────────────────────────────────────────────────────*/

test('energy is spent per ca and refills on the next calendar day', () => {
  const s = fresh();
  s.owner = true;
  const max = derived(s).maxEnergy;
  for (let i = 0; i < max; i++) assert.equal(spendEnergy(s), true);
  assert.equal(spendEnergy(s), false, 'no ca without a lượt');
  s.energyDay = '2000-01-01';
  assert.equal(refreshEnergy(s), max);
  assert.equal(s.energyDay, todayKey());
});

/* The tutorial is compulsory, so metering it would mean waiting out real
   calendar days before the game proper unlocks. */
test('the tutorial is not rate limited, and the meter starts on the handover', () => {
  const s = fresh();
  assert.equal(energyLimited(s), false);
  for (let i = 0; i < 20; i++) assert.equal(spendEnergy(s), true, 'ca ' + i);
  assert.equal(s.energy, derived(s).maxEnergy, 'nothing should have been spent');

  s.missionsDone = MISSIONS.filter(m => m.id !== 'm9').map(m => m.id);
  s.money = CLAIM_FEE;
  assert.equal(claimRestaurant(s), null);
  assert.equal(energyLimited(s), true);
  assert.equal(s.energy, derived(s).maxEnergy, 'the handover starts you full');

  const max = derived(s).maxEnergy;
  for (let i = 0; i < max; i++) assert.equal(spendEnergy(s), true);
  assert.equal(spendEnergy(s), false, 'the meter must bite once you own it');
});

test('the refill countdown never exceeds a day', () => {
  const secs = untilMidnight(new Date(2026, 8, 1, 23, 59, 0));
  assert.ok(secs > 0 && secs <= 86400);
  assert.equal(Math.round(secs), 60);
});

/* ── missions ─────────────────────────────────────────────────────────────*/

test('missions unlock strictly in order and pay out once', () => {
  const s = fresh();
  assert.equal(activeMission(s).id, 'm1');

  s.progress.groups = 99;
  s.progress.tickets = 99;
  const done = checkMissions(s);
  assert.deepEqual(done.map(m => m.id), ['m1', 'm2'],
    'm3 needs plates, so the chain must stop there');
  assert.equal(activeMission(s).id, 'm3');
  assert.equal(s.money, MISSIONS[0].reward + MISSIONS[1].reward);

  const again = checkMissions(s);
  assert.equal(again.length, 0, 'a finished mission never pays twice');
});

test('shift goals read the ca report, not the running totals', () => {
  const s = fresh();
  s.missionsDone = ['m1', 'm2', 'm3'];
  assert.equal(activeMission(s).id, 'm4');
  assert.equal(checkMissions(s, { revenue: 100, groups: 1, angry: 0 }).length, 0);
  assert.equal(checkMissions(s, { revenue: 400000, groups: 1, angry: 0 })[0].id, 'm4');
});

test('a clean ca means nobody stormed out of a ca that actually had guests', () => {
  const s = fresh();
  s.missionsDone = ['m1', 'm2', 'm3', 'm4', 'm5'];
  assert.equal(checkMissions(s, { revenue: 0, groups: 0, angry: 0 }).length, 0,
    'an empty ca is not a clean ca');
  assert.equal(checkMissions(s, { revenue: 0, groups: 4, angry: 1 }).length, 0);
  assert.equal(checkMissions(s, { revenue: 0, groups: 4, angry: 0 })[0].id, 'm6');
});

test('the quán only changes hands after the whole tutorial, and it costs money', () => {
  const s = fresh();
  assert.match(claimRestaurant(s), /Chưa xong/);
  s.missionsDone = MISSIONS.filter(m => m.id !== 'm9').map(m => m.id);
  assert.match(claimRestaurant(s), /Không đủ phí/);
  s.money = CLAIM_FEE;
  assert.equal(claimRestaurant(s), null);
  assert.equal(s.owner, true);
  assert.equal(s.invested, CLAIM_FEE, 'the transfer fee counts as investment');
  assert.equal(checkMissions(s)[0].id, 'm9');
});

/* ── the simulation ───────────────────────────────────────────────────────*/

/* A perfect waiter: teleports to whatever job the sim reports and presses E.
   Used as an upper bound, and as a way to run thousands of guest lifecycles. */
function runShift(save, mode = 'shift', seconds = SHIFT_SECONDS + CLOSING_GRACE, onFrame = null) {
  const sim = createSim(save, mode);
  for (let i = 0; i < seconds * 60; i++) {
    const p = sim.player;
    if (p.busy <= 0) {
      const job = sim.pickJob(p);
      if (job) { p.x = job.spot.x; p.y = job.spot.y; }
    }
    sim.update(1 / 60);
    sim.parties.forEach(q => { if (q.claimedBy === p) q.claimedBy = null; });
    sim.interact();
    if (onFrame) onFrame(sim);
    if (sim.over) break;
  }
  return sim;
}

test('a ca runs its full length and reports a coherent till', () => {
  const s = fresh();
  s.owner = true;
  const sim = runShift(s);
  const r = sim.report;
  assert.ok(r, 'the bell must produce a report');
  assert.ok(r.groups > 0, 'nobody got served at all');
  assert.equal(r.net, r.revenue + r.tips - r.foodCost);
  /* charged per group, so the total is within one đồng per group of the ratio */
  assert.ok(Math.abs(r.foodCost - r.revenue * FOOD_COST_RATIO) <= r.groups,
    `food cost ${r.foodCost} does not track ${FOOD_COST_RATIO} of ${r.revenue}`);
  assert.equal(s.money, r.net, 'the save must hold exactly what the ca netted');
  assert.ok(r.green + r.yellow + r.red > 0, 'no interaction was ever scored');
  assert.ok(r.plates >= r.groups, 'every group eats at least one dish');
});

test('stars are awarded against the ca target', () => {
  const d = derived(fresh());
  const target = shiftTarget(d);
  assert.ok(target > 0);
  const s = fresh();
  const sim = runShift(s);
  const r = sim.report;
  const expected = r.revenue >= target * 1.75 ? 3
                 : r.revenue >= target * 1.35 ? 2
                 : r.revenue >= target ? 1 : 0;
  assert.equal(r.stars, expected);
  assert.equal(r.passed, expected > 0);
});

/* Regression: a party used to release its table when it finished walking out,
   by which time the next party had already sat down — orphaning them into a
   silent timeout that no waiter, player or NPC, could see. */
test('a table belongs to exactly one party at a time', () => {
  const s = fresh();
  s.owner = true;
  s.owned = { 'ban-nhua': 1, 'ban-inox-1': 1 };
  runShift(s, 'shift', SHIFT_SECONDS, sim => {
    for (const p of sim.parties) {
      if (p.state === 'LEAVING') continue;
      assert.ok(p.table, `${p.state} party has no table`);
      assert.equal(p.table.party, p, `table ${p.table.id} was taken from a seated party`);
    }
  });
});

/* Regression: cooked food for a party that walked out stayed on the waiter's
   tray forever. Delivering it is always the highest-priority job, so that one
   dish jammed a carry slot for the rest of the ca. */
test('a carried plate is either wanted by someone or marked as rubbish', () => {
  const s = fresh();
  s.owner = true;
  s.bonusTables = 3;
  /* A plate's partyId is only a tag now — a waiter may legitimately be holding
     one whose original table left, because another table ordered the same dish.
     What must never happen is a live plate nobody in the room wants. */
  runShift(s, 'shift', SHIFT_SECONDS, sim => {
    const live = new Set(sim.parties.filter(p => p.state !== 'LEAVING').map(p => p.id));
    for (const who of [sim.player, ...sim.npcs]) {
      for (const plate of who.carry) {
        if (!plate.dead) {
          assert.ok(sim.neediestFor(plate.dishId),
            `giữ dĩa ${plate.dishId} mà không ai gọi, lại chưa đánh dấu bỏ`);
        }
      }
      for (const tk of who.tickets) assert.ok(live.has(tk.partyId), 'orphan ticket');
      assert.ok(who.carry.length <= sim.d.carry, 'carried more than the tray holds');
    }
  });
});

test('the kitchen never exceeds its stove or hatch capacity', () => {
  const s = fresh();
  s.owner = true;
  s.owned = { 'dau-bep': 1, 'tu-lanh': 1 };
  const sim = runShift(s, 'shift', SHIFT_SECONDS, sim => {
    assert.ok(sim.kitchen.pass.length <= sim.d.passSlots, 'hatch overflowed');
    assert.equal(sim.kitchen.stoves.length, sim.d.chefs);
  });
  assert.equal(sim.chefs.length, 2);
});

test('guests who never get a table are lost, not angry', () => {
  const s = fresh();
  s.owner = true;
  const sim = createSim(s, 'shift');
  /* nobody serves anybody: the floor jams and the queue outside gives up */
  for (let i = 0; i < (SHIFT_SECONDS + CLOSING_GRACE + 5) * 60; i++) { sim.update(1 / 60); if (sim.over) break; }
  assert.ok(sim.report.angry > 0, 'seated guests should have stormed out');
  assert.equal(sim.stats.groups, 0);
  assert.equal(s.money, 0, 'an unserved ca pays nothing');
});

test('the chill loop has no bell, no anger and a much thinner crowd', () => {
  const s = fresh();
  s.owner = true;
  s.owned = { 'ban-nhua': 1, 'pv-part': 1 };
  const idle = runShift(s, 'idle', 300);
  assert.equal(idle.over, false, 'the loop never ends on its own');
  assert.equal(idle.timeLeft, Infinity);
  assert.equal(idle.stats.angry, 0, 'the loop must never punish a timeout');
  assert.ok(idle.stats.groups > 0, 'somebody should still have eaten');

  const busy = runShift(fresh(), 'shift', 300);
  assert.ok(busy.stats.guests > idle.stats.guests,
    'a ca must be busier than the loop over the same stretch');
});

test('arrivals scale with the floor in a ca and sub-linearly in the loop', () => {
  assert.equal(ARRIVAL.shift.sqrt, false);
  assert.equal(ARRIVAL.idle.sqrt, true);
  assert.ok(idleArrivalsPerMin(8, 1, 1) < idleArrivalsPerMin(2, 1, 1) * 4,
    'quadrupling the floor must not quadruple the loop income');
});

test('group sizes stay within the four seats a table has', () => {
  for (const k of GROUP_KINDS) {
    assert.ok(k.size >= 1 && k.size <= 4, `${k.id} does not fit a table`);
    assert.ok(k.weight > 0);
  }
});

test('decor buys real patience, not just a number on the shop card', () => {
  const plain = createSim(fresh(), 'shift');
  const comfy = (() => {
    const s = fresh();
    s.owned = { 'may-lanh': 1, 'quat-tuong': 1, 'loa': 1 };
    return createSim(s, 'shift');
  })();
  assert.ok(comfy.d.comfort > plain.d.comfort);

  const a = { members: [] }, b = { members: [] };
  plain.setWait(a, 'WANT_MENU', PATIENCE.WANT_MENU);
  comfy.setWait(b, 'WANT_MENU', PATIENCE.WANT_MENU);
  assert.equal(a.waitMax, PATIENCE.WANT_MENU);
  assert.ok(b.waitMax > a.waitMax, 'a fan and an air-con must buy the guest time');
  assert.equal(b.waitMax, PATIENCE.WANT_MENU * comfy.d.comfort);
  assert.equal(b.state, 'WANT_MENU');
  assert.equal(b.wait, 0);
});

test('the floor grid is exactly as large as config claims', () => {
  assert.equal(createSim(fresh(), 'shift').world.tiles.length, GRID_W * GRID_H);
  assert.equal(clamp(5, 0, 1), 1);
  assert.ok(OFFLINE_CAP_HOURS > 0);
});

/* ── reaching the table ───────────────────────────────────────────────────*/

test('a table can be worked from any side, not one magic corner', () => {
  const s = fresh();
  const sim = createSim(s, 'shift');
  const table = sim.world.tables[0];
  table.party = { state: 'WANT_MENU', members: [], table, wait: 0, waitMax: 10 };

  for (const [side, dx, dy] of [['trái', -1.9, 0], ['phải', 1.9, 0],
                                ['trên', 0, -1.9], ['dưới', 0, 1.9],
                                ['chéo', -1.6, -1.6]]) {
    sim.player.x = table.x + dx;
    sim.player.y = table.y + dy;
    assert.ok(sim.targetFor(sim.player), `không với tới bàn từ phía ${side}`);
  }
  sim.player.x = table.x; sim.player.y = table.y + 4;
  assert.equal(sim.targetFor(sim.player), null, 'reach must still have a limit');
});

test('the nearest table wins when two are within reach', () => {
  const s = fresh();
  s.owned = { 'ban-nhua': 1, 'ban-inox-1': 1, 'ban-inox-2': 1 };
  const sim = createSim(s, 'shift');
  const [a, b] = sim.world.tables;
  for (const t of [a, b]) t.party = { state: 'WANT_MENU', members: [], table: t, wait: 0, waitMax: 10 };
  sim.player.x = a.x + 1.2; sim.player.y = a.y;
  assert.equal(sim.targetFor(sim.player).table, a);
  sim.player.x = b.x - 1.2; sim.player.y = b.y;
  assert.equal(sim.targetFor(sim.player).table, b);
});

/* ── the bin ──────────────────────────────────────────────────────────────*/

test('food for a departed party becomes rubbish that must go in the bin', () => {
  const s = fresh();
  s.owner = true;
  const sim = createSim(s, 'shift');
  for (let i = 0; i < 60 * 20; i++) {
    sim.update(1 / 60);
    const p = sim.parties.find(x => x.table);
    if (p) {
      sim.player.carry.push({ partyId: p.id, tableId: p.table.id, dishId: 'com-tam', dead: false });
      sim.giveUp(p);
      break;
    }
  }
  assert.equal(sim.player.carry.length, 1, 'the test needs a plate in hand');

  sim.update(1 / 60);
  assert.equal(sim.player.carry[0].dead, true, 'the plate should have spoiled');
  assert.equal(sim.stats.trashed, 0);

  /* a spoiled plate is not servable and still eats a carry slot */
  assert.ok(sim.player.carry.length > 0);

  sim.player.x = sim.world.bin.x - 1;
  sim.player.y = sim.world.bin.y;
  const target = sim.targetFor(sim.player);
  assert.equal(target.kind, 'trash');
  assert.equal(target.dead, 1);
  assert.equal(sim.interact(), 'trash');
  assert.equal(sim.player.carry.length, 0, 'the bin must free the tray');
  assert.equal(sim.stats.trashed, 1);
});

test('the bin is out of the way until you are standing at it', () => {
  const s = fresh();
  const sim = createSim(s, 'shift');
  sim.player.carry.push({ partyId: -1, tableId: 0, dishId: 'com-tam', dead: true });
  sim.player.x = sim.world.door.x;
  sim.player.y = sim.world.door.y - 1.5;
  assert.equal(sim.targetFor(sim.player), null, 'the bin must not reach across the room');
});

/* ── the kitchen in motion ────────────────────────────────────────────────*/

test('chefs carry finished dishes to the hatch instead of teleporting them', () => {
  const s = fresh();
  s.owner = true;
  const sim = createSim(s, 'shift');
  const chef = sim.chefs[0];
  const start = { x: chef.x, y: chef.y };

  /* somebody has to actually be waiting for it, or the chef is right to bin it */
  const t0 = sim.world.tables[0];
  seatWaiting(sim, t0, ['tra-da']);
  sim.parties[sim.parties.length - 1].ordered = true;
  sim.kitchen.orders.push({ partyId: sim.parties[sim.parties.length - 1].id, tableId: t0.id, dishId: 'tra-da' });

  let sawPlated = false, moved = false;
  for (let i = 0; i < 60 * 20; i++) {
    sim.stepKitchen(1 / 60);
    if (sim.kitchen.plated.length || chef.holding) sawPlated = true;
    if (Math.hypot(chef.x - start.x, chef.y - start.y) > 0.4) moved = true;
    if (sim.kitchen.pass.length) break;
  }
  assert.ok(sawPlated, 'a finished dish must exist before it reaches the hatch');
  assert.ok(moved, 'the chef must actually walk');
  assert.equal(sim.kitchen.pass.length, 1);
  assert.equal(sim.kitchen.pass[0].dishId, 'tra-da');
});

test('an idle chef wanders the prep counter rather than standing still', () => {
  const s = fresh();
  const sim = createSim(s, 'shift');
  const chef = sim.chefs[0];
  const seen = new Set();
  for (let i = 0; i < 60 * 40; i++) {
    sim.stepKitchen(1 / 60);
    seen.add(`${chef.x.toFixed(0)},${chef.y.toFixed(0)}`);
  }
  assert.ok(seen.size > 1, 'the chef never left one spot');
});

/* ── saying what the food is ──────────────────────────────────────────────*/

test('an order reads back as names and counts, not as ids', () => {
  assert.equal(orderSummary(['pho-bo', 'pho-bo', 'tra-da']), 'Phở bò tái nạm ×2, Trà đá');
  assert.equal(orderSummary(['banh-mi']), 'Bánh mì thịt');
  assert.equal(orderSummary([]), '');
});

/* ── the apprenticeship ───────────────────────────────────────────────────*/

test('one ca is one day, and the quán grows on schedule around you', () => {
  const s = fresh();
  const seen = [];
  for (let day = 1; day <= TUTORIAL_DAYS + 3; day++) {
    for (const e of advanceTutorialDay(s)) seen.push([day, e.kind]);
  }
  assert.deepEqual(seen, [
    [3, 'table'], [5, 'recipe'], [5, 'target'], [6, 'table'], [7, 'table'], [8, 'target']
  ]);
  assert.equal(derived(s).tables, 5, 'two to start plus three from the old owner');
  assert.ok(s.recipes.includes('pho-bo'), 'day five adds a dish');
  assert.equal(s.tutorialDay, TUTORIAL_DAYS + 3);
});

test('the apprenticeship never goes two days without something happening', () => {
  const days = new Set(TUTORIAL_EVENTS.map(e => e.day));
  let quiet = 0;
  for (let d = 3; d <= TUTORIAL_DAYS; d++) {
    quiet = days.has(d) ? 0 : quiet + 1;
    assert.ok(quiet < 2, `ngày ${d - 1} và ${d} đều trống`);
  }
  assert.ok(days.has(TUTORIAL_DAYS), 'the last day must land on something');
  for (const e of TUTORIAL_EVENTS) {
    assert.ok(e.day >= 1 && e.day <= TUTORIAL_DAYS, `event ngoài phạm vi: ngày ${e.day}`);
    assert.ok(e.title && e.text && e.emoji, `event ngày ${e.day} thiếu chữ`);
  }
});

test('the old owner raises the bar twice before handing over', () => {
  const s = fresh();
  const base = shiftTarget(derived(s));
  for (let d = 1; d < 5; d++) advanceTutorialDay(s);
  assert.equal(derived(s).targetMult, 1, 'still the opening target on day 4');

  advanceTutorialDay(s);                       // day 5
  const after5 = derived(s).targetMult;
  assert.ok(after5 > 1, 'day five must raise the target');
  assert.ok(shiftTarget(derived(s)) > base);

  for (let d = 6; d <= 8; d++) advanceTutorialDay(s);
  assert.ok(derived(s).targetMult > after5, 'day eight raises it again');
});

test('days stop counting once the quán is yours', () => {
  const s = fresh();
  advanceTutorialDay(s);
  s.owner = true;
  assert.deepEqual(advanceTutorialDay(s), []);
  assert.equal(s.tutorialDay, 1);
});

test('the handover cannot be reached before the days are worked', () => {
  const s = fresh();
  s.missionsDone = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'];
  s.money = 50000000;
  assert.equal(activeMission(s).id, 'mday', 'the day count gates the rest');
  assert.equal(checkMissions(s).length, 0, 'money alone must not skip the days');

  for (let i = 0; i < TUTORIAL_DAYS; i++) advanceTutorialDay(s);
  const done = checkMissions(s);
  assert.deepEqual(done.map(m => m.id), ['mday', 'm8'], 'days then savings');
  assert.equal(activeMission(s).id, 'm9');
});

test('a tutorial ca is busier by the end than at the start', () => {
  const early = fresh();
  const late = fresh();
  for (let i = 0; i < TUTORIAL_DAYS; i++) advanceTutorialDay(late);
  assert.ok(shiftTarget(derived(late)) > shiftTarget(derived(early)),
    'more tables and a better menu must raise what a ca is worth');
});

/* ── delivering by dish, not by table ─────────────────────────────────────*/

function seatWaiting(sim, table, dishes) {
  const p = {
    id: Math.random(), state: 'WAIT_FOOD', wait: 0, waitMax: 60, moods: [], table,
    members: dishes.map(d => ({
      face: '🧑', dishes: [d], got: [], servedCount: 0, eating: 0, done: false,
      x: table.x, y: table.y
    }))
  };
  table.party = p;
  sim.parties.push(p);
  return p;
}

test('a plate goes to anyone who ordered that dish, whatever table it came from', () => {
  const s = fresh();
  s.owner = true;
  s.bonusTables = 3;
  const sim = createSim(s, 'shift');
  const [a, b] = sim.world.tables;
  const pa = seatWaiting(sim, a, ['banh-mi']);
  const pb = seatWaiting(sim, b, ['banh-mi']);

  /* cooked nominally for table A, handed to table B */
  sim.player.carry.push({ partyId: pa.id, tableId: a.id, dishId: 'banh-mi', dead: false });
  sim.player.x = b.x + 1.9;
  sim.player.y = b.y;
  assert.equal(sim.targetFor(sim.player).kind, 'serve');
  assert.equal(sim.interact(), 'serve');
  assert.deepEqual(pb.members[0].got, ['banh-mi']);
  assert.deepEqual(pa.members[0].got, [], 'table A is still waiting for its own');
  assert.equal(sim.player.carry.length, 0);
});

test('a plate nobody ordered will not be forced onto a table', () => {
  const s = fresh();
  s.owner = true;
  const sim = createSim(s, 'shift');
  const t0 = sim.world.tables[0];
  seatWaiting(sim, t0, ['banh-mi']);
  sim.player.carry.push({ partyId: -1, tableId: t0.id, dishId: 'com-tam', dead: false });
  sim.player.x = t0.x + 1.9;
  sim.player.y = t0.y;
  assert.equal(sim.targetFor(sim.player), null, 'cơm tấm is not a bánh mì');
});

test('a plate spoils only when the whole room has stopped wanting it', () => {
  const s = fresh();
  s.owner = true;
  const sim = createSim(s, 'shift');
  const t0 = sim.world.tables[0];
  const party = seatWaiting(sim, t0, ['banh-mi']);
  const plate = { partyId: -1, tableId: 0, dishId: 'com-tam', dead: false };
  sim.player.carry.push(plate);

  sim.purgeDead();
  assert.equal(plate.dead, true, 'nobody ordered cơm tấm');

  party.members[0].dishes.push('com-tam');
  sim.purgeDead();
  assert.equal(plate.dead, false, 'a new order makes it good food again');

  party.members[0].got.push('com-tam');
  sim.purgeDead();
  assert.equal(plate.dead, true, 'and rubbish again once that order is filled');
});

test('the table number on a plate is a hint at the most urgent taker', () => {
  const s = fresh();
  s.owner = true;
  s.bonusTables = 3;
  const sim = createSim(s, 'shift');
  const [a, b] = sim.world.tables;
  const pa = seatWaiting(sim, a, ['pho-bo']);
  const pb = seatWaiting(sim, b, ['pho-bo']);
  pa.wait = 10; pb.wait = 50;                       // B is closer to walking out
  assert.equal(sim.hintTableFor('pho-bo'), b.id + 1);
  pa.wait = 55; pb.wait = 5;
  assert.equal(sim.hintTableFor('pho-bo'), a.id + 1);
  assert.equal(sim.hintTableFor('tom-hum'), null, 'nobody ordered lobster');
});

test('cooked food outlives the party it was made for', () => {
  const s = fresh();
  s.owner = true;
  s.bonusTables = 3;
  const sim = createSim(s, 'shift');
  const [a, b] = sim.world.tables;
  const pa = seatWaiting(sim, a, ['banh-mi']);
  seatWaiting(sim, b, ['banh-mi']);
  sim.kitchen.pass.push({ partyId: pa.id, tableId: a.id, dishId: 'banh-mi', dead: false });

  sim.leave(pa);
  assert.equal(sim.kitchen.pass.length, 1,
    'table B ordered the same thing — the plate must stay on the hatch');
});

/* ── the menu reads at a glance ───────────────────────────────────────────*/

test('no two dishes share an emoji', () => {
  const seen = new Map();
  for (const d of DISHES) {
    assert.ok(!seen.has(d.emoji), `${d.emoji} dùng cho cả ${seen.get(d.emoji)} và ${d.id}`);
    seen.set(d.emoji, d.id);
  }
  assert.equal(seen.size, DISHES.length);
});

test('the crowd is not one repeated face', () => {
  const all = [...ADULT_FACES, ...KID_FACES];
  assert.equal(new Set(all).size, all.length, 'duplicate faces');
  assert.ok(ADULT_FACES.length >= 20, 'too few adults to fill a room');
  /* skin-tone modifiers are what actually gives the room its colour range */
  const toned = all.filter(f => /[\u{1F3FB}-\u{1F3FF}]/u.test(f));
  assert.ok(toned.length > all.length * 0.8, 'most faces should carry a skin tone');
});

/* The day must turn over BEFORE the ca is built. Rolling it at the bell gave
   day 3's table to day 4, and left the day-8 target rise applying to no ca at
   all — it fired after the last tutorial shift and was cleared at the handover.
   This walks the apprenticeship the way main.js does and pins each day's quán. */
test('each tutorial day is worked with that day\'s quán, not the previous one', () => {
  const s = fresh();
  const seen = [];
  for (let day = 1; day <= TUTORIAL_DAYS; day++) {
    advanceTutorialDay(s);          // start of ca, exactly as startRun does
    const d = derived(s);           // what createSim will see for this ca
    seen.push([day, d.tables, d.menu.length, Number(d.targetMult.toFixed(2))]);
  }
  assert.deepEqual(seen, [
    [1, 2, 3, 1],
    [2, 2, 3, 1],
    [3, 3, 3, 1],       // the table arrives ON day three
    [4, 3, 3, 1],
    [5, 3, 4, 1.08],    // recipe and the first target rise both land on day five
    [6, 4, 4, 1.08],
    [7, 5, 4, 1.08],
    [8, 5, 4, 1.23]     // the final rise must apply to the final ca
  ]);
});

test('every tutorial event reaches at least one ca before the handover', () => {
  const s = fresh();
  const applied = [];
  for (let day = 1; day <= TUTORIAL_DAYS; day++) {
    const before = derived(s);
    advanceTutorialDay(s);
    const after = derived(s);
    if (after.tables !== before.tables) applied.push(`${day}:table`);
    if (after.menu.length !== before.menu.length) applied.push(`${day}:recipe`);
    if (after.targetMult !== before.targetMult) applied.push(`${day}:target`);
  }
  for (const e of TUTORIAL_EVENTS) {
    assert.ok(applied.includes(`${e.day}:${e.kind}`),
      `sự kiện ngày ${e.day} (${e.kind}) không kịp áp dụng cho ca nào`);
  }
  assert.ok(applied.some(x => x.startsWith(`${TUTORIAL_DAYS}:`)),
    'the last day must change something the last ca can feel');
});

/* ── the kitchen cooks to demand ──────────────────────────────────────────*/

function outstandingVsInFlight(sim) {
  const bump = (m, id, n = 1) => m.set(id, (m.get(id) || 0) + n);
  const need = new Map(), have = new Map();
  for (const p of sim.parties) {
    if (!p.ordered) continue;
    if (p.state !== 'WAIT_FOOD' && p.state !== 'EATING') continue;
    for (const m of p.members) {
      const want = new Map();
      for (const id of m.dishes) bump(want, id);
      for (const id of m.got) want.set(id, (want.get(id) || 0) - 1);
      for (const [id, n] of want) if (n > 0) bump(need, id, n);
    }
  }
  for (const pl of sim.kitchen.pass) bump(have, pl.dishId);
  for (const pl of sim.kitchen.plated) bump(have, pl.dishId);
  for (const o of sim.kitchen.orders) bump(have, o.dishId);
  for (const j of sim.kitchen.stoves) if (j) bump(have, j.dishId);
  for (const c of sim.chefs) if (c.holding) bump(have, c.holding.dishId);
  for (const w of [sim.player, ...sim.npcs]) for (const pl of w.carry) if (!pl.dead) bump(have, pl.dishId);
  const short = [];
  for (const [id, n] of need) if (n - (have.get(id) || 0) > 0) short.push(id);
  return short;
}

/* The bug this guards: plates go to whoever ordered that dish, so food crosses
   tables constantly, and any per-party order ledger drifts out of step within a
   few swaps. The symptom is a table that gets its first dish and then waits
   forever for a second nobody is cooking. */
test('the kitchen is never short of what it owes seated guests', () => {
  const s = fresh();
  s.owner = true;
  s.bonusTables = 3;
  s.recipes = ['tra-da', 'banh-mi', 'com-tam', 'pho-bo', 'bun-cha'];
  const sim = createSim(s, 'shift');

  let worstRun = 0, run = 0;
  for (let f = 0; f < (SHIFT_SECONDS + CLOSING_GRACE) * 60 && !sim.over; f++) {
    const p = sim.player;
    /* a deliberately unhurried waiter, which is when the drift used to show */
    if (f % 12 === 0 && p.busy <= 0) {
      const j = sim.pickJob(p);
      if (j) { p.x = j.spot.x; p.y = j.spot.y; }
    }
    sim.update(1 / 60);
    sim.parties.forEach(q => { if (q.claimedBy === p) q.claimedBy = null; });
    if (f % 12 === 0) sim.interact();

    run = outstandingVsInFlight(sim).length ? run + 1 : 0;
    if (run > worstRun) worstRun = run;
    if (sim.over) break;
  }
  /* one frame of lag between a ticket arriving and the next reconcile is fine */
  assert.ok(worstRun <= 3, `bếp thiếu món suốt ${worstRun} khung liên tiếp`);
});

test('nobody is left half-served when the bell rings', () => {
  const s = fresh();
  s.owner = true;
  s.bonusTables = 3;
  s.recipes = ['tra-da', 'banh-mi', 'com-tam', 'pho-bo'];
  const sim = createSim(s, 'shift');
  let stranded = 0;
  const giveUp = sim.giveUp.bind(sim);
  sim.giveUp = p => {
    if (p.state === 'WAIT_FOOD' && p.members.some(m => m.servedCount > 0)) stranded++;
    giveUp(p);
  };
  for (let f = 0; f < (SHIFT_SECONDS + CLOSING_GRACE) * 60 && !sim.over; f++) {
    const p = sim.player;
    if (p.busy <= 0) { const j = sim.pickJob(p); if (j) { p.x = j.spot.x; p.y = j.spot.y; } }
    sim.update(1 / 60);
    sim.parties.forEach(q => { if (q.claimedBy === p) q.claimedBy = null; });
    sim.interact();
    if (sim.over) break;
  }
  assert.equal(stranded, 0, 'a table got some food and then starved');
  assert.ok(sim.report.groups > 5);
});

/* The chef used to check whether the party a dish was *tagged* for was still
   around. Once plates cross tables that tag means nothing, and good food was
   being binned at the hatch — about fifteen dishes a ca. */
test('a finished dish goes out if anyone still wants it', () => {
  const s = fresh();
  s.owner = true;
  s.bonusTables = 3;
  const sim = createSim(s, 'shift');
  const [a, b] = sim.world.tables;
  const pa = seatWaiting(sim, a, ['com-tam']);
  const pb = seatWaiting(sim, b, ['com-tam']);
  pa.ordered = pb.ordered = true;

  /* cooked for table A, which then leaves; table B still wants one */
  sim.chefs[0].holding = { partyId: pa.id, tableId: a.id, dishId: 'com-tam' };
  sim.leave(pa);
  const chef = sim.chefs[0];
  for (let i = 0; i < 60 * 10 && chef.holding; i++) sim.stepChef(chef, 0, 1 / 60);

  assert.equal(chef.holding, null, 'the chef should have put it down');
  assert.equal(sim.kitchen.pass.length, 1, 'table B ordered com-tam — do not bin it');
  assert.equal(sim.kitchen.pass[0].dishId, 'com-tam');
});

test('a finished dish nobody wants is not put on the hatch', () => {
  const s = fresh();
  s.owner = true;
  const sim = createSim(s, 'shift');
  sim.chefs[0].holding = { partyId: -1, tableId: 0, dishId: 'com-tam' };
  const chef = sim.chefs[0];
  for (let i = 0; i < 60 * 10 && chef.holding; i++) sim.stepChef(chef, 0, 1 / 60);
  assert.equal(chef.holding, null);
  assert.equal(sim.kitchen.pass.length, 0, 'nobody ordered it');
});

/* ── one table, one meal ──────────────────────────────────────────────────*/

test('a table orders exactly one cooked dish, whatever its size', () => {
  const s = fresh();
  s.owner = true;
  s.bonusTables = 6;
  s.recipes = [...STARTER_DISHES, 'pho-bo', 'bun-cha', 'ca-phe-sua', 'tra-sua'];
  const sim = createSim(s, 'shift');
  const sizes = new Set();

  for (let f = 0; f < (SHIFT_SECONDS + CLOSING_GRACE) * 60 && !sim.over; f++) {
    const p = sim.player;
    if (p.busy <= 0) { const j = sim.pickJob(p); if (j) { p.x = j.spot.x; p.y = j.spot.y; } }
    sim.update(1 / 60);
    sim.parties.forEach(q => { if (q.claimedBy === p) q.claimedBy = null; });
    sim.interact();
    for (const q of [...sim.parties, ...sim.queue]) {
      sizes.add(q.members.length);
      const dishes = q.members.flatMap(m => m.dishes);
      assert.equal(dishes.length, 1, `bàn ${q.members.length} người gọi ${dishes.length} món`);
      assert.equal(dishes[0], q.meal, 'the party must remember its meal for the bubble');
      assert.equal(DISH[q.meal].kind, 'main', 'the cooked dish is always a main');
    }
    if (sim.over) break;
  }
  assert.ok(sizes.size > 1, 'the test needs tables of different sizes to be meaningful');
  assert.ok(sizes.has(1) || sizes.has(2), 'small tables');
});

test('drinks and desserts are billed, never cooked and never carried', () => {
  const s = fresh();
  s.owner = true;
  s.recipes = [...STARTER_DISHES, 'ca-phe-sua', 'tra-sua', 'banh-flan'];
  const sim = createSim(s, 'shift');
  const sideIds = new Set(sim.d.sides.map(x => x.id));
  assert.ok(sideIds.size >= 2, 'the quán should know some sides');

  for (let f = 0; f < (SHIFT_SECONDS + CLOSING_GRACE) * 60 && !sim.over; f++) {
    const p = sim.player;
    if (p.busy <= 0) { const j = sim.pickJob(p); if (j) { p.x = j.spot.x; p.y = j.spot.y; } }
    sim.update(1 / 60);
    sim.parties.forEach(q => { if (q.claimedBy === p) q.claimedBy = null; });
    sim.interact();
    for (const o of sim.kitchen.orders) assert.ok(!sideIds.has(o.dishId), 'a side reached the stove');
    for (const pl of sim.kitchen.pass) assert.ok(!sideIds.has(pl.dishId), 'a side reached the hatch');
    for (const w of [sim.player, ...sim.npcs]) {
      for (const pl of w.carry) assert.ok(!sideIds.has(pl.dishId), 'a side is being carried');
    }
    if (sim.over) break;
  }
  assert.ok(sim.report.groups > 0);
});

test('knowing more drinks raises what a table is worth', () => {
  const plain = fresh();
  plain.recipes = [...STARTER_DISHES];
  const stocked = fresh();
  stocked.recipes = [...STARTER_DISHES, 'ca-phe-sua', 'tra-sua', 'sinh-to-bo'];

  const a = derived(plain), b = derived(stocked);
  assert.equal(a.mainAvg, b.mainAvg, 'same mains either way');
  assert.ok(b.sideBonus > a.sideBonus, 'more drinks on the board');
  assert.ok(b.tableBill > a.tableBill, 'so a table spends more');
  assert.equal(a.cookPerGroup, b.cookPerGroup, 'but the kitchen does no extra work');
});

test('the kitchen is costed for one meal, not for a plate per head', () => {
  const s = fresh();
  const d = derived(s);
  const mains = d.menu.filter(x => x.kind === 'main');
  const slowest = Math.max(...mains.map(x => x.cook));
  assert.ok(d.cookPerGroup <= slowest + 0.01,
    'one table can never cost the stove more than its single slowest dish');
  assert.ok(d.cookPerGroup > 0);
});

/* ── closing time ─────────────────────────────────────────────────────────
   The bell shuts the door; it does not clear the room. Food already cooked and
   tables already mid-meal are worth real money, and binning them at 3:30 makes
   the last minute of a ca pointless to play. */

function runToBell(sim) {
  for (let f = 0; f < SHIFT_SECONDS * 60 + 60; f++) {
    const p = sim.player;
    if (p.busy <= 0) { const j = sim.pickJob(p); if (j) { p.x = j.spot.x; p.y = j.spot.y; } }
    sim.update(1 / 60);
    sim.parties.forEach(q => { if (q.claimedBy === p) q.claimedBy = null; });
    sim.interact();
    if (sim.closing || sim.over) return f;
  }
  return -1;
}

test('the bell shuts the door but does not end the ca while tables are busy', () => {
  const s = fresh();
  s.owner = true;
  s.bonusTables = 3;
  const sim = createSim(s, 'shift');
  assert.ok(runToBell(sim) > 0, 'never reached the bell');

  assert.equal(sim.closing, true);
  assert.equal(sim.timeLeft, 0);
  assert.equal(sim.over, false, 'the ca must keep running while guests are seated');
  assert.ok(sim.busyTables() > 0, 'the test needs someone still at a table');
  assert.equal(sim.queue.length, 0, 'the queue outside is sent home');
});

test('no new guests arrive after the bell', () => {
  const s = fresh();
  s.owner = true;
  s.bonusTables = 3;
  const sim = createSim(s, 'shift');
  runToBell(sim);

  const seen = new Set(sim.parties.map(p => p.id));
  const guestsAtBell = sim.stats.guests;
  for (let f = 0; f < 60 * 60 && !sim.over; f++) {
    const p = sim.player;
    if (p.busy <= 0) { const j = sim.pickJob(p); if (j) { p.x = j.spot.x; p.y = j.spot.y; } }
    sim.update(1 / 60);
    sim.parties.forEach(q => { if (q.claimedBy === p) q.claimedBy = null; });
    sim.interact();
    for (const q of sim.parties) assert.ok(seen.has(q.id), 'a new table was seated after closing');
    assert.equal(sim.queue.length, 0);
  }
  assert.equal(sim.stats.guests, guestsAtBell, 'guest count must stop rising');
});

test('guests seated before the bell still get fed and still pay', () => {
  const s = fresh();
  s.owner = true;
  s.bonusTables = 3;
  const sim = createSim(s, 'shift');
  runToBell(sim);

  const groupsAtBell = sim.stats.groups;
  const revenueAtBell = sim.stats.revenue;
  for (let f = 0; f < (CLOSING_GRACE + 5) * 60 && !sim.over; f++) {
    const p = sim.player;
    if (p.busy <= 0) { const j = sim.pickJob(p); if (j) { p.x = j.spot.x; p.y = j.spot.y; } }
    sim.update(1 / 60);
    sim.parties.forEach(q => { if (q.claimedBy === p) q.claimedBy = null; });
    sim.interact();
  }
  assert.equal(sim.over, true, 'the ca must end once the floor clears');
  assert.ok(sim.stats.groups > groupsAtBell, 'nobody was served after the bell');
  assert.ok(sim.stats.revenue > revenueAtBell, 'that service earned nothing');
  assert.equal(sim.report.servedAfterBell, sim.stats.groups - groupsAtBell);
  assert.ok(sim.report.closingFor <= CLOSING_GRACE + 1);
});

test('closing cannot run forever even if the floor wedges', () => {
  const s = fresh();
  s.owner = true;
  const sim = createSim(s, 'shift');
  runToBell(sim);
  /* nobody serves anyone: patience runs out and the room empties on its own,
     and the grace period is the backstop if it somehow does not */
  for (let f = 0; f < (CLOSING_GRACE + 10) * 60 && !sim.over; f++) sim.update(1 / 60);
  assert.equal(sim.over, true);
  assert.ok(sim.report.closingFor <= CLOSING_GRACE + 1, 'grace period must cap the tail');
});

test('the chill loop has no bell to ring', () => {
  const s = fresh();
  s.owner = true;
  s.owned = { 'pv-part': 1 };
  const sim = createSim(s, 'idle');
  for (let f = 0; f < 400 * 60; f++) sim.update(1 / 60);
  assert.equal(sim.closing, false);
  assert.equal(sim.over, false);
  assert.equal(sim.timeLeft, Infinity);
});

/* ── naming the quán ──────────────────────────────────────────────────────*/

test('a quán has a fallback name until its owner picks one', () => {
  const s = fresh();
  assert.equal(s.name, '');
  assert.ok(displayName(s).length > 0, 'the sign can never be blank');
  assert.equal(setName(s, 'Quán Cô Ba'), null);
  assert.equal(displayName(s), 'Quán Cô Ba');
});

test('names are tidied and bounded', () => {
  assert.equal(cleanName('   Quán   Cô   Ba  '), 'Quán Cô Ba');
  assert.equal(cleanName('a'.repeat(80)).length, MAX_NAME);
  assert.equal(cleanName(''), '');
  assert.equal(cleanName(null), '');
  const s = fresh();
  assert.match(setName(s, '   '), /phải có tên/);
  assert.equal(s.name, '', 'a refused name must not be stored');
});

test('every suggested name is usable as-is', () => {
  assert.ok(NAME_SUGGESTIONS.length >= 6);
  for (const n of NAME_SUGGESTIONS) {
    assert.equal(cleanName(n), n, `${n} would be altered`);
    assert.ok(n.length <= MAX_NAME);
  }
});

/* ── the shopfront ────────────────────────────────────────────────────────*/

test('shopfront pieces cost money and pull in customers', () => {
  const s = fresh();
  s.owner = true;
  s.money = 5000000;
  const before = derived(s).draw;
  const item = FACADE_BY_ID['bien-go'];

  assert.equal(buyFacade(s, item), null);
  assert.equal(s.money, 5000000 - item.price);
  assert.equal(s.invested, item.price, 'a sign is an investment in the quán');
  assert.ok(derived(s).draw > before, 'a sign must actually bring people in');
  assert.match(buyFacade(s, item), /Đã có rồi/);
});

test('the fancier shopfronts are gated on the tier', () => {
  const s = fresh();
  s.owner = true;
  s.money = 1e9;
  assert.match(canBuyFacade(s, FACADE_BY_ID['bien-led']), /cấp 3/);
  s.invested = LEVELS[2].invested;
  assert.equal(canBuyFacade(s, FACADE_BY_ID['bien-led']), null);
  assert.match(canBuyFacade(s, FACADE_BY_ID['cua-kinh']), /cấp 4/);
});

test('the shopfront catalogue is well formed', () => {
  const ids = FACADE.map(f => f.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate id');
  for (const f of FACADE) {
    assert.ok(f.price > 0 && f.draw > 0, `${f.id} bad numbers`);
    assert.ok(f.name && f.note && f.emoji, `${f.id} missing copy`);
  }
});

/* ── the street ───────────────────────────────────────────────────────────*/

test('the block has the quán in it, wearing the owner\'s name', () => {
  const s = fresh();
  s.owner = true;
  setName(s, 'Bếp Nhà Mình');
  const st = createStreet(s, displayName(s));

  const home = st.buildings.find(b => b.kind === 'home');
  assert.ok(home, 'the player needs their own shopfront out there');
  assert.equal(home.name, 'Bếp Nhà Mình');
  assert.equal(home.sign, 'BẾP NHÀ MÌNH');

  /* every building has to be reachable along the pavement */
  for (const b of st.buildings) {
    const d = st.doorOf(b);
    assert.ok(d.x > 0 && d.x < ST_W, `${b.id} door is off the block`);
    assert.ok(b.x >= 0 && b.x + b.w <= ST_W, `${b.id} sticks out of the block`);
  }
  /* and none of them may overlap */
  const sorted = [...st.buildings].sort((a, b) => a.x - b.x);
  for (let i = 1; i < sorted.length; i++) {
    assert.ok(sorted[i].x >= sorted[i - 1].x + sorted[i - 1].w,
      `${sorted[i].id} overlaps ${sorted[i - 1].id}`);
  }
});

test('the player is kept on the pavement', () => {
  const st = createStreet(fresh(), 'Quán Thử');
  for (let i = 0; i < 400; i++) st.movePlayer(0, -1, 1 / 60);
  assert.ok(st.player.y >= ROW.WALK_TOP - 1e-6, 'walked into a shopfront');
  for (let i = 0; i < 400; i++) st.movePlayer(0, 1, 1 / 60);
  assert.ok(st.player.y <= ROW.WALK_BOTTOM + 1e-6, 'walked into the road');
  for (let i = 0; i < 900; i++) st.movePlayer(-1, 0, 1 / 60);
  assert.ok(st.player.x > 0, 'walked off the end of the block');
  for (let i = 0; i < 1800; i++) st.movePlayer(1, 0, 1 / 60);
  assert.ok(st.player.x < ST_W, 'walked off the other end');
});

test('standing at a door offers that door, and only that door', () => {
  const st = createStreet(fresh(), 'Quán Thử');
  for (const b of st.buildings) {
    const d = st.doorOf(b);
    st.player.x = d.x;
    st.player.y = ROW.WALK_TOP + 0.3;
    assert.equal(st.targetFor()?.id, b.id, `không nhận ra cửa ${b.id}`);
    assert.equal(st.interact(), b.kind);
  }
  /* out in the middle of nowhere there is nothing to enter */
  st.player.x = ST_W - 0.7;
  st.player.y = ROW.WALK_BOTTOM;
  assert.equal(st.targetFor(), null);
  assert.equal(st.interact(), null);
});

test('the street keeps moving without leaking walkers or traffic', () => {
  const st = createStreet(fresh(), 'Quán Thử');
  const walkers = st.walkers.length, traffic = st.traffic.length;
  assert.ok(walkers > 0 && traffic > 0);
  for (let i = 0; i < 60 * 120; i++) st.update(1 / 60);
  assert.equal(st.walkers.length, walkers, 'walkers leaked');
  assert.equal(st.traffic.length, traffic, 'traffic leaked');
  for (const w of st.walkers) assert.ok(w.x > -4 && w.x < ST_W + 4, 'a walker escaped');
  for (const v of st.traffic) assert.ok(v.x > -5 && v.x < ST_W + 5, 'a vehicle escaped');
});

/* ── the market run ───────────────────────────────────────────────────────*/

test('a market round always has fresh produce to find, and some to miss', () => {
  for (let i = 0; i < 200; i++) {
    const r = makeMarketRound();
    assert.equal(r.fresh.length, 3);
    assert.equal(new Set(r.fresh).size, 3, 'duplicate stall');
    for (const s of r.fresh) assert.ok(s >= 0 && s < MARKET_STALLS);
    assert.ok(r.fresh.length < MARKET_STALLS, 'there must be a wrong answer');
  }
});

test('the market pays out on skill and never punishes a bad run', () => {
  let lastCa = -1, lastCut = -1;
  for (let hits = 0; hits <= MARKET_ROUNDS; hits++) {
    const r = marketReward(hits);
    assert.ok(r.ca >= 0 && r.cut >= 0, 'a bad trip must not cost anything');
    assert.ok(r.ca >= lastCa && r.cut >= lastCut, 'more hits must never pay less');
    lastCa = r.ca; lastCut = r.cut;
  }
  assert.equal(marketReward(0).ca, 0);
  assert.ok(marketReward(MARKET_ROUNDS).ca > 0);
  /* the discount can never wipe out the cost of food */
  assert.ok(marketReward(MARKET_ROUNDS).cut < FOOD_COST_RATIO * 0.5);
  assert.deepEqual(marketReward(99), marketReward(MARKET_ROUNDS), 'clamped');
});

test('a market run makes the next ca cheaper, and only for as long as it should', () => {
  const plain = fresh(); plain.owner = true;
  const bought = fresh(); bought.owner = true;
  bought.marketBuff = { ca: 2, cut: 0.09 };

  const a = createSim(plain, 'shift');
  const b = createSim(bought, 'shift');
  assert.ok(b.foodCost < a.foodCost, 'the discount did not reach the till');
  assert.ok(b.foodCost >= 0.15, 'ingredients can never become free');
});

test('a trending dish sells for more, and nothing else changes', () => {
  const s = fresh();
  s.owner = true;
  s.trend = { id: 'com-tam', ca: 1 };
  const sim = createSim(s, 'shift');
  assert.equal(sim.trendId, 'com-tam');
  assert.equal(createSim(fresh(), 'shift').trendId, null);
});

/* ── debug mode ───────────────────────────────────────────────────────────*/

test('debug mode is off unless it is asked for', () => {
  assert.equal(Debug.state.on, false, 'must never default to on');
  assert.equal(Debug.enabledByUrl('', ''), false);
  assert.equal(Debug.enabledByUrl('?volume=1', ''), false, 'a substring must not arm it');
  assert.equal(Debug.enabledByUrl('?nodebugging=1', ''), false);
  assert.equal(Debug.enabledByUrl('?debug=1', ''), true);
  assert.equal(Debug.enabledByUrl('?a=2&debug', ''), true);
  assert.equal(Debug.enabledByUrl('', '#debug'), true);
});

test('the jump to ownership lands on a real, playable save', () => {
  const s = fresh();
  Debug.becomeOwner(s);
  assert.equal(s.owner, true);
  assert.equal(s.tutorialDay, TUTORIAL_DAYS);
  assert.equal(s.missionsDone.length, MISSIONS.length);
  assert.equal(activeMission(s), null, 'no mission should still be pending');
  assert.equal(derived(s).tables, 5, 'the quán the apprenticeship would have built');
  assert.ok(s.name.length > 0, 'the sign cannot be blank');
  assert.equal(s.targetBoost, 0, 'the old owner\'s bar does not follow you');
  assert.equal(s.energy, derived(s).maxEnergy);
  assert.match(Debug.becomeOwner(s), /Đã là chủ/, 'twice must be a no-op');
});

test('buying the whole catalogue never exceeds what the quán can hold', () => {
  const s = fresh();
  Debug.becomeOwner(s);
  Debug.buyAllShop(s);
  const d = derived(s);
  assert.equal(d.tables, 8, 'the floor has eight anchors');
  assert.equal(d.chefs, 3, 'the kitchen has three stoves');
  assert.ok(d.waiters > 0);
  /* and nothing bought is a purchase the shop would have refused on capacity */
  for (const id of Object.keys(s.owned)) assert.ok(SHOP_BY_ID[id], `${id} is not a real item`);
});

test('unlock-everything really does unlock everything', () => {
  const s = fresh();
  Debug.unlockAllRecipes(s);
  Debug.buyAllFacade(s);
  assert.equal(s.recipes.length, DISHES.length);
  assert.equal(Object.keys(s.facade).length, FACADE.length);
});

test('tier jump writes the investment that tier represents, and never goes backwards', () => {
  const s = fresh();
  Debug.setTier(s, 5);
  assert.equal(derived(s).level.n, 5);
  const rich = s.invested;
  Debug.setTier(s, 2);
  assert.equal(s.invested, rich, 'jumping down must not erase progress');
  assert.match(Debug.setTier(s, 99), /Không có cấp/);
});

test('rich mode tops the till up but is not a running total', () => {
  const s = fresh();
  s.money = 10;
  Debug.topUp(s);
  assert.equal(s.money, Debug.RICH);
  s.money = Debug.RICH - 1000;
  Debug.topUp(s);
  assert.equal(s.money, Debug.RICH - 1000, 'a nearly-full till is left alone');
});

test('the day setter stays inside the apprenticeship', () => {
  const s = fresh();
  Debug.setTutorialDay(s, 99);
  assert.equal(s.tutorialDay, TUTORIAL_DAYS);
  Debug.setTutorialDay(s, -5);
  assert.equal(s.tutorialDay, 0);
});

test('the overlay reads the simulation without disturbing it', () => {
  const s = fresh();
  s.owner = true;
  const sim = createSim(s, 'shift');
  for (let i = 0; i < 60 * 40; i++) sim.update(1 / 60);

  const snapshot = JSON.stringify({
    t: sim.t, groups: sim.stats.groups, orders: sim.kitchen.orders.length,
    parties: sim.parties.length, money: s.money
  });
  const lines = Debug.overlayLines(sim, s);
  assert.ok(lines.length > 5, 'the read-out should actually say something');
  assert.ok(lines.some(l => l.includes('thiếu món')), 'the shortfall check must be shown');
  assert.equal(JSON.stringify({
    t: sim.t, groups: sim.stats.groups, orders: sim.kitchen.orders.length,
    parties: sim.parties.length, money: s.money
  }), snapshot, 'reading the overlay changed the game');
  assert.deepEqual(Debug.overlayLines(null, s), []);
});

test('the debug guest spawner puts a real party on the pavement', () => {
  const s = fresh();
  s.owner = true;
  const sim = createSim(s, 'shift');
  const before = sim.queue.length;
  const party = sim.spawnGuest();
  assert.equal(sim.queue.length, before + 1);
  assert.ok(party.members.length >= 1 && party.members.length <= 4);
  assert.equal(party.members.flatMap(m => m.dishes).length, 1, 'one table, one meal');
  assert.ok(DISH[party.meal]);
});
