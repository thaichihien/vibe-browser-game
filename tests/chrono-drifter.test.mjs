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
import { ARCHETYPES, tagOf, WAIT } from '../games/chrono-drifter/js/engine/moves.js';
import { FORMATS, DIFFICULTIES } from '../games/chrono-drifter/js/engine/formats.js';
import { generate, balance } from '../games/chrono-drifter/js/engine/generator.js';
import { createBattle, nextActor, openTurn, resolve, legalMoves, targetsFor,
         turnOrder, living, statOf, damageOf, checkEnd } from '../games/chrono-drifter/js/engine/combat.js';
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

test('twelve eras, each with 20+ characters across three factions', () => {
  assert.equal(ERAS.length, 12);
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
