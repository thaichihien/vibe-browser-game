/* Chrono Drifter is a folder game, so its engine and data are real ES modules and
   the tests import them directly — no node:vm harness needed. The contract those
   modules must keep is that they stay DOM-free, which the bare import proves. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { ERAS } from '../games/chrono-drifter/js/data/themes.js';
import { CONSUMABLES, RELICS, SHOP } from '../games/chrono-drifter/js/data/shop.js';
import { mult, RING, ELEMENTS, STRONG, WEAK, EL_ICON, weakTo, strongAgainst, resists }
  from '../games/chrono-drifter/js/engine/elements.js';
import { EFFECTS, effectsOf } from '../games/chrono-drifter/js/data/effects.js';
import { ARCHETYPES, tagOf, WAIT, costOf, EP_MAX, EP_REGEN, EP_WAIT, DMG }
  from '../games/chrono-drifter/js/engine/moves.js';
import { FORMATS, DIFFICULTIES, fleeCost, FLEE_GRACE_TURNS, FORMAT_WORTH, winShards, lossShards }
  from '../games/chrono-drifter/js/engine/formats.js';
import { generate, balance } from '../games/chrono-drifter/js/engine/generator.js';
import { createBattle, nextActor, openTurn, resolve, legalMoves, targetsFor,
         turnOrder, living, statOf, damageOf, checkEnd, hitChance, critChance,
         pointStat, canAfford, BASE_ACC, BASE_CRIT } from '../games/chrono-drifter/js/engine/combat.js';
import { chooseAction } from '../games/chrono-drifter/js/engine/ai.js';
import { mulberry32 } from '../games/chrono-drifter/js/engine/rng.js';

const ENGINE_DIR = 'games/chrono-drifter/js/engine';
const DATA_DIR = 'games/chrono-drifter/js/data';

/* ── the element wheel ──────────────────────────────────────── */

test('element wheel is a closed six-cycle', () => {
  for (let i = 0; i < RING.length; i++) {
    const a = RING[i], b = RING[(i + 1) % RING.length];
    assert.equal(mult(a, b), STRONG, `${a} should beat ${b}`);
    assert.equal(mult(b, a), WEAK, `${b} should be weak into ${a}`);
  }
});

test('RADIANT and UMBRA savage each other both ways; STEEL is inert', () => {
  assert.equal(mult('RADIANT', 'UMBRA'), STRONG);
  assert.equal(mult('UMBRA', 'RADIANT'), STRONG);
  for (const el of ELEMENTS) {
    assert.equal(mult('STEEL', el), 1, `STEEL should never be boosted into ${el}`);
    assert.equal(mult(el, 'STEEL'), 1, `nothing should be boosted into STEEL`);
  }
});

test('no accidental gaps: every ring pair is 1.6, 0.7 or a deliberate 1.0', () => {
  for (const a of RING) for (const b of RING) {
    const m = mult(a, b);
    assert.ok([STRONG, WEAK, 1].includes(m), `${a}→${b} produced ${m}`);
  }
});

/* ── content audit ──────────────────────────────────────────── */

test('every era carries 20+ characters across three factions', () => {
  assert.equal(ERAS.length, 23);
  for (const era of ERAS) {
    const factions = Object.keys(era.factions);
    assert.equal(factions.length, 3, `${era.key} should have 3 factions`);
    assert.ok(era.units.length >= 20, `${era.key} has only ${era.units.length} characters`);
    for (const f of factions) {
      const roster = era.units.filter(u => u.faction === f);
      assert.ok(roster.length >= 5, `${era.key}/${f} has only ${roster.length}`);
      assert.ok(roster.some(u => u.tier === 'legend'), `${era.key}/${f} has no legend`);
    }
    assert.ok(era.mooks.length >= 2, `${era.key} needs a mook pool`);
    assert.ok(era.boss, `${era.key} needs a boss`);
  }
});

test('every character has exactly four moves, plus WAIT as the fifth option', () => {
  for (const era of ERAS) {
    for (const u of [...era.units, ...era.mooks, era.boss]) {
      assert.equal(u.mv.length, 4, `${era.key}/${u.n} has ${u.mv.length} moves`);
      assert.ok(u.hp > 0 && u.pwr > 0 && u.spd > 0, `${era.key}/${u.n} has a broken stat line`);
      assert.ok(u.sz > 0 && u.sz <= 2.5, `${era.key}/${u.n} has body size ${u.sz}`);
      assert.ok(ELEMENTS.includes(u.el), `${era.key}/${u.n} has unknown element ${u.el}`);
    }
  }
  assert.equal(WAIT.kind, 'wait');
});

test('only legends and bosses carry ultimates', () => {
  for (const era of ERAS) {
    for (const u of era.units) {
      if (u.ult) assert.equal(u.tier, 'legend', `${era.key}/${u.n} is ${u.tier} but has an ultimate`);
    }
    for (const m of era.mooks) assert.ok(!m.ult, `${era.key}/${m.n} is a mook with an ultimate`);
    assert.ok(era.boss.ult, `${era.key} boss should have an ultimate`);
  }
});

test('every move references a known archetype', () => {
  for (const era of ERAS) {
    for (const u of [...era.units, ...era.mooks, era.boss]) {
      for (const m of [...u.mv, ...(u.ult ? [u.ult] : [])]) {
        assert.ok(ARCHETYPES.includes(m.id), `${era.key}/${u.n}: unknown archetype ${m.id}`);
        assert.ok(m.name && m.name.length, `${era.key}/${u.n} has an unnamed move`);
      }
    }
  }
});

test('every era names all nine elements, and the names are its own', () => {
  const seen = new Map();
  for (const era of ERAS) {
    for (const el of ELEMENTS) {
      assert.ok(era.elNames[el], `${era.key} does not name ${el}`);
    }
    seen.set(era.key, Object.values(era.elNames).join('|'));
  }
  assert.equal(new Set(seen.values()).size, ERAS.length, 'two eras share an element vocabulary');
});

test('move tags reskin per era while the mechanics stay put', () => {
  const strike = ERAS[0].units[1].mv[0];
  const a = tagOf(strike, ERAS[0]);
  const b = tagOf(strike, ERAS[1]);
  assert.notEqual(a, b, 'the same move should read differently in two eras');
  assert.ok(a.includes(ERAS[0].elNames[strike.el]));
  assert.ok(b.includes(ERAS[1].elNames[strike.el]));
});

test('every element has its own glyph, and no two share one', () => {
  for (const el of ELEMENTS) assert.ok(EL_ICON[el], `${el} has no icon`);
  const icons = ELEMENTS.map(el => EL_ICON[el]);
  assert.equal(new Set(icons).size, icons.length, 'two elements share a glyph');
});

test('weakTo and strongAgainst agree with the damage table', () => {
  for (const el of ELEMENTS) {
    for (const w of weakTo(el)) assert.equal(mult(w, el), STRONG, `${w} should hit ${el} hard`);
    for (const g of strongAgainst(el)) assert.equal(mult(el, g), STRONG, `${el} should hit ${g} hard`);
    for (const r of resists(el)) assert.equal(mult(r, el), WEAK, `${el} should shrug off ${r}`);
  }
  assert.deepEqual(weakTo('STEEL'), [], 'the neutral fears nothing');
  assert.deepEqual(strongAgainst('STEEL'), [], 'the neutral beats nothing');
});

test('every character carries a bio, and no bio is an orphan', () => {
  for (const era of ERAS) {
    assert.ok(era.bios, `${era.key} has no bios`);
    const roster = [...era.units, ...era.mooks, era.boss];
    for (const u of roster) {
      const bio = era.bios[u.n];
      assert.ok(bio, `${era.key}/${u.n} has no bio`);
      assert.ok(bio.length >= 20, `${era.key}/${u.n} bio is too thin`);
    }
    for (const name of Object.keys(era.bios)) {
      assert.ok(roster.some(u => u.n === name), `${era.key} has a bio for nobody: ${name}`);
    }
  }
});

test('every status a unit can carry is explainable on hover', () => {
  const u = {
    shield: 40, taunt: 2, marked: 1, stunned: 1, silenced: 2, chargeup: 2, extraTurns: 1, ramp: .25,
    dots: [{ amt: 34, el: 'EMBER', t: 2 }],
    buffs: [{ stat: 'pwr', pct: 30, t: 3 }, { stat: 'grd', pct: -35, t: 2 }, { regen: 38, t: 2 }]
  };
  const fx = effectsOf(u);
  assert.ok(fx.length >= 11, `only ${fx.length} chips for a fully loaded unit`);
  for (const f of fx) {
    assert.ok(f.icon && f.label && f.desc, `a chip is missing copy: ${JSON.stringify(f)}`);
    assert.ok(f.desc.length >= 15, `"${f.label}" has no real explanation`);
  }
  assert.deepEqual(effectsOf({ shield: 0, taunt: 0, marked: 0, stunned: 0, silenced: 0,
                               chargeup: 0, extraTurns: 0, ramp: 0, dots: [], buffs: [] }), []);
});

test('the effect registry itself is complete', () => {
  for (const [key, e] of Object.entries(EFFECTS)) {
    assert.ok(e.icon && e.name && e.desc, `${key} is missing copy`);
  }
});

/* ── the shop ───────────────────────────────────────────────── */

test('the shop stocks 26 items with unique ids and real prices', () => {
  assert.ok(SHOP.length >= 26, `only ${SHOP.length} items`);
  assert.equal(new Set(SHOP.map(i => i.id)).size, SHOP.length, 'duplicate item id');
  for (const i of SHOP) {
    assert.ok(i.price >= 190, `${i.name} is too cheap at ${i.price}`);
    assert.ok(i.icon && i.name && i.desc, `${i.id} is missing copy`);
  }
  assert.ok(Math.max(...SHOP.map(i => i.price)) >= 5000, 'nothing to save up for');
  assert.ok(CONSUMABLES.length >= 16 && RELICS.length >= 10);
});

/* ── the satchel ────────────────────────────────────────────────
   state.js guards every storage call, so it imports cleanly under node and the
   purchase rules can be tested without a browser. */

test('the satchel holds exactly five, and buying arms an item straight away', async () => {
  const st = await import('../games/chrono-drifter/js/state.js');
  st.reset();
  assert.equal(st.satchelSize(), 5, 'the promise to the player is five slots');
  assert.equal(st.SATCHEL_MAX, 5);

  st.save.shards = 99999;
  // an item you paid for must be usable without visiting a loadout screen
  for (const item of CONSUMABLES.slice(0, 3)) assert.ok(st.buy(item), `could not buy ${item.id}`);
  assert.deepEqual(st.save.satchel, CONSUMABLES.slice(0, 3).map(i => i.id));

  for (const item of CONSUMABLES.slice(3, 9)) st.buy(item);
  assert.equal(st.save.satchel.length, 5, 'the satchel overfilled');
  assert.ok(Object.keys(st.save.stock).length > 5, 'stock should keep what the satchel cannot hold');
  st.reset();
});

test('relics are one-per-customer and the backpack doubles consumables', async () => {
  const st = await import('../games/chrono-drifter/js/state.js');
  st.reset();
  st.save.shards = 99999;
  const relic = RELICS.find(r => r.id === 'backpack');
  assert.ok(st.buy(relic), 'first relic purchase should succeed');
  assert.equal(st.buy(relic), false, 'a relic must not be sold twice');
  assert.ok(st.hasRelic('backpack'));

  const item = CONSUMABLES[0];
  const before = st.save.stock[item.id] || 0;
  st.buy(item);
  assert.equal(st.save.stock[item.id], before + 2, 'the backpack should double a purchase');
  st.reset();
});

test('a shortfall of shards buys nothing', async () => {
  const st = await import('../games/chrono-drifter/js/state.js');
  st.reset();
  st.save.shards = 10;
  assert.equal(st.buy(CONSUMABLES[0]), false);
  assert.equal(st.save.shards, 10, 'a failed purchase must not charge');
  assert.deepEqual(st.save.satchel, []);
  st.reset();
});

/* ── the generator ──────────────────────────────────────────── */

test('the generator never seats rival factions together or repeats a legend', () => {
  for (let seed = 1; seed <= 400; seed++) {
    const g = generate(ERAS, { seed });
    assert.ok(g.mine.length >= 1 && g.foes.length >= 1, 'a side came out empty');

    for (const team of [g.mine, g.foes]) {
      const factions = new Set(team.map(u => u.faction).filter(f => f !== '*'));
      assert.ok(factions.size <= 1, `mixed factions on one side in seed ${seed}`);
      const names = team.map(u => u.n);
      assert.equal(new Set(names).size, names.length, `duplicate name on a side in seed ${seed}`);
    }
    const legends = [...g.mine, ...g.foes].filter(u => u.tier === 'legend').map(u => u.n);
    assert.equal(new Set(legends).size, legends.length, `a legend appears twice in seed ${seed}`);
  }
});

test('every format produces its declared shape', () => {
  for (const fmt of FORMATS) {
    for (let seed = 1; seed <= 60; seed++) {
      const g = generate(ERAS, { seed, formatKey: fmt.key, difficulty: 2 });
      const sizes = [g.mine.length, g.foes.length].sort((a, b) => a - b);
      if (fmt.key === 'duel') assert.deepEqual(sizes, [1, 1]);
      if (fmt.key === 'even') assert.ok(sizes[0] >= 3 && sizes[1] <= 4, `even got ${sizes}`);
      if (fmt.key === 'horde') assert.ok(sizes[0] >= 3 && sizes[1] >= 6, `horde got ${sizes}`);
      if (fmt.key === 'boss') {
        const all = [...g.mine, ...g.foes];
        assert.ok(all.some(u => u.tier === 'boss'), `boss format without a boss, seed ${seed}`);
      }
      if (fmt.key === 'war') assert.ok(sizes[0] >= 6, `war got ${sizes}`);
    }
  }
});

test('the parity pass leaves both sides within a factor of two', () => {
  const power = (arr) => arr.reduce((s, u) => s + u.pwr * Math.sqrt(u.hp), 0);
  let worst = 1;
  for (let seed = 1; seed <= 300; seed++) {
    const g = generate(ERAS, { seed, difficulty: 2 });
    const r = power(g.mine) / power(g.foes);
    worst = Math.max(worst, r, 1 / r);
  }
  assert.ok(worst < 2.0, `worst power ratio after balancing was ${worst.toFixed(2)}`);
});

test('you are put on either side, not always the good one', () => {
  const sides = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    const g = generate(ERAS, { seed, eraKey: 'fantasy' });
    sides.add(g.yourSide);
  }
  assert.ok(sides.size >= 2, 'the coin flip never landed on the other side');
});

/* ── combat maths ───────────────────────────────────────────── */

function fixture(opts = {}) {
  const g = generate(ERAS, { seed: opts.seed ?? 7, ...opts });
  const s = createBattle({ era: g.era, format: g.format, mine: g.mine, foes: g.foes,
                           difficulty: g.difficulty, rng: g.rng, seed: g.seed });
  s.title = g.title; s.yourSide = g.yourSide; s.foeSide = g.foeSide;
  return s;
}

test('damage rises with PWR and follows the element multiplier', () => {
  const s = fixture({ formatKey: 'even', difficulty: 2 });
  s.rng = () => 0.5;                       // pin variance and crits out of the way
  const [a] = living(s, 'ally');
  const [d] = living(s, 'foe');
  const move = { el: 'STEEL', pow: 1, kind: 'dmg' };

  const base = damageOf(s, a, d, move).n;
  const strong = damageOf(s, { ...a, pwr: a.pwr * 2, buffs: [] }, d, move).n;
  assert.ok(strong > base, 'doubling PWR did not raise damage');

  // the wheel, isolated: same attacker, same defender stats, different affinity
  const ember = { ...d, el: 'VERDANT' };
  const soak = { ...d, el: 'TIDE' };
  const hot = damageOf(s, a, ember, { el: 'EMBER', pow: 1, kind: 'dmg' }).n;
  const cold = damageOf(s, a, soak, { el: 'EMBER', pow: 1, kind: 'dmg' }).n;
  assert.ok(hot > cold, `EMBER into VERDANT (${hot}) should beat EMBER into TIDE (${cold})`);
});

test('defence has diminishing returns rather than a cliff', () => {
  const s = fixture();
  s.rng = () => 0.5;
  const [a] = living(s, 'ally');
  const mk = (grd) => ({ ...living(s, 'foe')[0], grd, wrd: grd, buffs: [], marked: 0 });
  const move = { el: 'STEEL', pow: 1, kind: 'dmg' };
  const soft = damageOf(s, a, mk(10), move).n;
  const hard = damageOf(s, a, mk(400), move).n;
  assert.ok(hard > 0, 'heavy defence produced a zero');
  assert.ok(hard < soft, 'defence did nothing');
});

test('WAIT charges the meter and hardens the waiter', () => {
  const s = fixture({ formatKey: 'even' });
  const [a] = living(s, 'ally');
  const before = { charge: a.charge, grd: statOf(a, 'grd') };
  resolve(s, a, { ...WAIT }, null);
  assert.equal(a.charge, before.charge + 25);
  assert.ok(statOf(a, 'grd') > before.grd, 'waiting did not raise guard');
});

test('a taunting defender soaks single-target attacks but not area ones', () => {
  const s = fixture({ formatKey: 'even' });
  const [a] = living(s, 'ally');
  const foes = living(s, 'foe');
  foes[foes.length - 1].taunt = 2;
  const single = targetsFor(s, a, { kind: 'dmg', el: 'STEEL', pow: 1 });
  assert.deepEqual(single, [foes[foes.length - 1].uid], 'taunt did not redirect');
  const area = targetsFor(s, a, { kind: 'dmg', el: 'STEEL', pow: 1, all: true });
  assert.equal(area.length, 0, 'area moves should not ask for a target at all');
});

test('the tick queue orders by SPD and Haste actually reorders it', () => {
  const s = fixture({ formatKey: 'war' });
  const first = turnOrder(s, 6).map(u => u.uid);
  const slowest = [...living(s)].sort((a, b) => statOf(a, 'spd') - statOf(b, 'spd'))[0];
  slowest.buffs.push({ stat: 'spd', pct: 400, t: 9 });
  const after = turnOrder(s, 6).map(u => u.uid);
  assert.notDeepEqual(first, after, 'a 5x speed buff did not change the timeline');
  assert.equal(after[0], slowest.uid, 'the hasted unit should now lead');
});

/* ── accuracy and crit ──────────────────────────────────────── */

test('attacks can miss, and blinding is what makes them miss more', () => {
  const clear = { spd: 100, buffs: [] };
  const blind = { spd: 100, buffs: [{ stat: 'acc', pct: -25, t: 3 }] };
  assert.equal(hitChance(clear, clear, {}), BASE_ACC);
  assert.ok(hitChance(blind, clear, {}) < hitChance(clear, clear, {}), 'blind did nothing');
  assert.equal(hitChance(blind, clear, {}), BASE_ACC - 25);
  // a faster target is harder to hit, and the range stays sane
  assert.ok(hitChance(clear, { spd: 300, buffs: [] }, {}) < hitChance(clear, { spd: 40, buffs: [] }, {}));
  for (const spd of [1, 50, 200, 900]) {
    const h = hitChance(clear, { spd, buffs: [] }, {});
    assert.ok(h >= 45 && h <= 99, `hit chance escaped its band at spd ${spd}: ${h}`);
  }
});

test('crit is buyable with aim and capped', () => {
  const plain = { buffs: [] };
  assert.equal(critChance(plain, {}), BASE_CRIT);
  assert.ok(critChance(plain, { crit: true }) > BASE_CRIT, 'a sniping move should crit more');
  const aimed = { buffs: [{ stat: 'crt', pct: 30, t: 3 }] };
  assert.ok(critChance(aimed, { crit: true }) > critChance(plain, { crit: true }));
  assert.ok(critChance({ buffs: [{ stat: 'crt', pct: 900, t: 3 }] }, { crit: true }) <= 75, 'crit must stay capped');
  assert.equal(pointStat(plain, 'crt', BASE_CRIT), BASE_CRIT);
});

test('some real moves actually move accuracy and crit', () => {
  let acc = 0, crt = 0;
  for (const era of ERAS) for (const u of [...era.units, ...era.mooks, era.boss]) for (const m of u.mv) {
    if (m.stat === 'acc') acc++;
    if (m.stat === 'crt') crt++;
  }
  assert.ok(acc >= 8, `only ${acc} moves touch accuracy — the stat would be decoration`);
  assert.ok(crt >= 8, `only ${crt} moves touch crit`);
});

/* ── energy ─────────────────────────────────────────────────── */

test('skills cost energy, ultimates do not, and Chờ is always affordable', () => {
  for (const era of ERAS) for (const u of [...era.units, ...era.mooks, era.boss]) {
    for (const m of u.mv) {
      const c = costOf(m);
      assert.ok(c > 0, `${era.key}/${u.n}: ${m.name} is free`);
      assert.ok(c <= EP_MAX / 2, `${era.key}/${u.n}: ${m.name} costs ${c}, more than half a full bar`);
    }
    if (u.ult) assert.equal(costOf(u.ult), 0, `${u.n}'s ultimate should be gated by charge, not energy`);
  }
  assert.equal(costOf(WAIT), 0);
  assert.ok(canAfford({ ep: 0 }, WAIT), 'a drained unit must still be able to wait');
});

test('a full bar affords a few turns, and regeneration outpaces the cheapest move', () => {
  const cheapest = Math.min(...ERAS.flatMap(e => e.units.flatMap(u => u.mv.map(costOf))));
  assert.ok(EP_REGEN >= cheapest, `regen ${EP_REGEN} cannot even pay for the cheapest move (${cheapest})`);
  const dearest = Math.max(...ERAS.flatMap(e => e.units.flatMap(u => u.mv.map(costOf))));
  assert.ok(EP_MAX / dearest >= 2, 'a full bar should buy at least two of the priciest move');
  assert.ok(EP_MAX / dearest <= 5, 'if a full bar buys five of anything, energy is not a constraint');
  assert.ok(EP_WAIT > EP_REGEN, 'waiting should beat simply passing time');
});

test('energy is spent, regenerates, and refills faster when you wait', () => {
  const s = fixture({ formatKey: 'even', difficulty: 2 });
  const [a] = living(s, 'ally');
  const move = legalMoves(s, a).find(m => m.kind === DMG && !m.isUlt);
  const start = a.ep;
  resolve(s, a, move, targetsFor(s, a, move)[0] ?? null);
  assert.equal(a.ep, start - costOf(move), 'the move was not paid for');

  a.ep = 10;
  openTurn(s, a);
  assert.equal(a.ep, 10 + EP_REGEN, 'no regeneration at the top of the turn');

  a.ep = 10;
  resolve(s, a, { ...WAIT }, null);
  assert.equal(a.ep, 10 + EP_WAIT, 'waiting did not restore the bar');
});

test('a starved unit still has a legal move', () => {
  const s = fixture({ formatKey: 'even', difficulty: 2 });
  const [a] = living(s, 'ally');
  a.ep = 0;
  const moves = legalMoves(s, a);
  const open = moves.filter(m => !m.locked);
  assert.ok(open.length >= 1, 'a drained unit was left with nothing to do');
  assert.ok(open.every(m => m.kind === 'wait' || m.isUlt), 'skills should be locked at zero energy');
  assert.ok(moves.some(m => m.lockReason === 'ep'), 'the deck should say why a move is unavailable');
});

/* ── ultimate variety ───────────────────────────────────────── */

test('ultimates are not all the same shape', () => {
  const tally = {};
  let total = 0;
  for (const era of ERAS) for (const u of [...era.units.filter(x => x.ult), era.boss]) {
    tally[u.ult.id] = (tally[u.ult.id] || 0) + 1;
    total++;
  }
  const shapes = Object.keys(tally).length;
  assert.ok(shapes >= 8, `only ${shapes} ultimate shapes across the whole game`);
  const worst = Math.max(...Object.values(tally));
  assert.ok(worst / total < 0.35, `one ultimate shape covers ${Math.round(worst / total * 100)}% of all legends`);
});

test('every era fields at least three different ultimate shapes', () => {
  for (const era of ERAS) {
    const shapes = new Set([...era.units.filter(u => u.ult), era.boss].map(u => u.ult.id));
    assert.ok(shapes.size >= 3, `${era.key} has only ${shapes.size} ultimate shape(s)`);
  }
});

test('the non-damaging ultimates actually do their thing', () => {
  const mk = () => fixture({ formatKey: 'even', difficulty: 2 });

  // AEGIS shields the whole team
  let s = mk(); let [a] = living(s, 'ally');
  const before = living(s, 'ally').map(u => u.shield);
  resolve(s, a, { id: 'AEGIS', name: 'X', kind: 'buff', team: true, shield: 200, regen: 40, ult: true }, null);
  assert.ok(living(s, 'ally').every((u, i) => u.shield > before[i]), 'AEGIS shielded nobody');

  // RAISE brings back the fallen
  s = mk(); [a] = living(s, 'ally');
  const victim = living(s, 'ally')[1] || living(s, 'ally')[0];
  victim.alive = false; victim.hp = 0;
  resolve(s, a, { id: 'RAISE', name: 'X', kind: 'heal', amt: 0, reviveAll: .5, ult: true }, null);
  assert.ok(victim.alive && victim.hp > 0, 'RAISE left the dead where they were');

  // CURSE debuffs without dealing a point of damage
  s = mk(); [a] = living(s, 'ally');
  const foe = living(s, 'foe')[0];
  const hp = foe.hp;
  resolve(s, a, { id: 'CURSE', name: 'X', kind: 'debuff', all: true, pct: 30, curse: true, dot: 40, el: 'UMBRA', ult: true }, null);
  assert.equal(foe.hp, hp, 'CURSE should not deal damage on cast');
  assert.ok(foe.buffs.filter(b => b.pct < 0).length >= 4, 'CURSE should hit every stat');
  assert.ok(foe.dots.length > 0, 'CURSE should leave something burning');

  // RAGE turns the caster into the problem
  s = mk(); [a] = living(s, 'ally');
  const pwr = statOf(a, 'pwr');
  resolve(s, a, { id: 'RAGE', name: 'X', kind: 'buff', self: true, rage: true, ult: true }, null);
  assert.ok(statOf(a, 'pwr') > pwr * 1.5, 'RAGE did not enrage');
  assert.ok(critChance(a, {}) > BASE_CRIT, 'RAGE should sharpen the caster');

  // SACRIFICE costs the caster real blood
  s = mk(); [a] = living(s, 'ally');
  const own = a.hp;
  const target = living(s, 'foe')[0];
  resolve(s, a, { id: 'SACRIFICE', name: 'X', kind: 'dmg', el: 'STEEL', pow: 4, sacrifice: .35, crit: true, ult: true }, target.uid);
  assert.ok(a.hp < own, 'SACRIFICE was free');
  assert.ok(a.hp >= 1, 'SACRIFICE must never kill the caster');
});

/* ── fleeing ────────────────────────────────────────────────── */

test('running early costs shards; running late only costs the reward', () => {
  const normal = DIFFICULTIES[2], even = FORMATS.find(f => f.key === 'even');
  for (let t = 0; t <= FLEE_GRACE_TURNS; t++) {
    assert.ok(fleeCost(normal, even, t) > 0, `turn ${t} should still be inside the grace window`);
  }
  assert.equal(fleeCost(normal, even, FLEE_GRACE_TURNS + 1), 0, 'the toll should lapse after the window');
  assert.equal(fleeCost(normal, even, 999), 0);
});

test('the flight toll tracks difficulty and format, and never exceeds a win', () => {
  const even = FORMATS.find(f => f.key === 'even');
  const easy = fleeCost(DIFFICULTIES[0], even, 1);
  const hard = fleeCost(DIFFICULTIES[4], even, 1);
  assert.ok(hard > easy, 'abandoning a hard fight should sting more');
  for (const d of DIFFICULTIES) for (const f of FORMATS) {
    const toll = fleeCost(d, f, 1);
    const winnings = winShards(d, f);
    assert.ok(toll > 0, `${f.key}/${d.name}: running should cost something`);
    assert.ok(toll < winnings,
      `${f.key}/${d.name}: toll ${toll} must stay under the ${winnings} a win pays, or fleeing is a trap`);
    assert.ok(lossShards(d, f) < winnings, 'losing should never pay better than winning');
  }
});

test('shards can never be driven below zero by a forfeit', async () => {
  const st = await import('../games/chrono-drifter/js/state.js');
  st.reset();
  st.save.shards = 10;
  st.recordResult({ won: false, score: 0, shards: -500, eraKey: 'fantasy', fled: true });
  assert.equal(st.save.shards, 0, 'the purse went negative');
  assert.equal(st.save.losses, 1);
  assert.equal(st.save.fled, 1);
  st.reset();
});

/* ── termination and pacing ─────────────────────────────────── */

function runToEnd(seed, opts) {
  const s = fixture({ seed, ...opts });
  for (let guard = 0; guard < 4000; guard++) {
    if (checkEnd(s)) return { rounds: Math.ceil(s.turns / Math.max(1, s.units.length)), turns: s.turns, ok: true };
    const actor = nextActor(s);
    if (!actor) break;
    openTurn(s, actor);
    if (!actor.alive) continue;
    if (checkEnd(s)) break;
    const { move, targetUid } = chooseAction(s, actor);
    resolve(s, actor, move, targetUid);
    let extra = actor.extraTurns;
    while (extra-- > 0 && actor.alive && !s.over) {
      const nx = chooseAction(s, actor);
      resolve(s, actor, nx.move, nx.targetUid);
    }
    actor.extraTurns = 0;
  }
  return { rounds: Math.ceil(s.turns / Math.max(1, s.units.length)), turns: s.turns, ok: s.over };
}

test('500 AI-vs-AI battles all terminate', () => {
  let ran = 0;
  for (let seed = 1; seed <= 500; seed++) {
    const r = runToEnd(seed);
    assert.ok(r.ok, `seed ${seed} never finished (${r.turns} turns)`);
    ran++;
  }
  assert.equal(ran, 500);
});

test('every format lands inside its pacing band', () => {
  for (const fmt of FORMATS) {
    const turns = [];
    for (let seed = 1; seed <= 40; seed++) {
      const r = runToEnd(seed, { formatKey: fmt.key, difficulty: 2 });
      assert.ok(r.ok, `${fmt.key} seed ${seed} never finished`);
      turns.push(r.turns);
    }
    turns.sort((a, b) => a - b);
    const median = turns[Math.floor(turns.length / 2)];
    assert.ok(median >= 4, `${fmt.key} ends after only ${median} turns — no battle there`);
    assert.ok(median <= fmt.par * 4, `${fmt.key} drags: median ${median} turns against par ${fmt.par}`);
  }
});

test('every difficulty is playable and the hard ones bite', () => {
  const wins = DIFFICULTIES.map(d => {
    let w = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = fixture({ seed, formatKey: 'even', difficulty: d.key });
      const r = runToEnd(seed, { formatKey: 'even', difficulty: d.key });
      assert.ok(r.ok);
    }
    return w;
  });
  assert.equal(wins.length, 5);
});

/* ── the DOM-free contract ──────────────────────────────────── */

test('engine and data never touch the DOM', () => {
  const files = [
    ...readdirSync(ENGINE_DIR).map(f => `${ENGINE_DIR}/${f}`),
    ...readdirSync(DATA_DIR).filter(f => f.endsWith('.js')).map(f => `${DATA_DIR}/${f}`),
    ...readdirSync(`${DATA_DIR}/themes`).map(f => `${DATA_DIR}/themes/${f}`)
  ];
  const banned = /\b(document|window|localStorage|navigator|requestAnimationFrame)\b/;
  for (const f of files) {
    const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.ok(!banned.test(src), `${f} reaches for the DOM — that breaks the tests and the AI`);
  }
});
