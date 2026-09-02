/* Rolls an encounter. DOM-free.
   Order matters: era → rival factions → format → difficulty → rosters → your side.
   Each draw constrains the next, which is how the result stays coherent instead of
   turning into a costume box. */

import { FORMATS, DIFFICULTIES } from './formats.js';
import { mulberry32, randomSeed, randInt, pick, sample } from './rng.js';

/** A legend never appears twice; the nameless get Roman numerals. */
const NUMERAL = 'ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ';

/** Number the repeats so the combat log stays readable. Legends never get here twice. */
function uniquify(team) {
  const seen = {};
  return team.map(d => {
    const base = d.baseName || d.n;
    seen[base] = (seen[base] || 0) + 1;
    const k = seen[base];
    return { ...d, baseName: base, n: k > 1 ? `${base} ${NUMERAL[k - 1]}` : base };
  });
}

function draft(rng, era, factionKey, spec) {
  const roster = era.units.filter(u => u.faction === factionKey);
  const out = [];
  const n = randInt(rng, spec.n[0], spec.n[1]);

  if (spec.pool === 'boss') {
    out.push(era.boss);
    const m = randInt(rng, spec.minions[0], spec.minions[1]);
    for (let i = 0; i < m; i++) out.push(pick(rng, era.mooks));
  } else if (spec.pool === 'mook') {
    for (let i = 0; i < n; i++) out.push(pick(rng, era.mooks));
  } else {
    // named units come out of the faction pool without replacement
    const want = spec.pool === 'named' ? Math.min(n, roster.length) : n;
    out.push(...sample(rng, roster, want));
    while (out.length < n) out.push(pick(rng, era.mooks));   // rank and file fills the rest
  }

  return out;
}

/** Rough parity without balancing 5 formats × 12 eras by hand. */
export function balance(a, b) {
  const score = arr => arr.reduce((s, u) => s + u.pwr * Math.sqrt(u.hp), 0);
  const r = score(a) / score(b);
  const bump = (arr, k) => arr.forEach(u => { u.hp = Math.round(u.hp * k); });
  if (r > 1.1) bump(b, Math.min(2.4, r));
  else if (r < 1 / 1.1) bump(a, Math.min(2.4, 1 / r));
}

/**
 * Roll a whole encounter.
 * `opts` may pin any of { seed, eraKey, formatKey, difficulty } — the tests and
 * the debug menu use that; normal play pins nothing.
 */
export function generate(eras, opts = {}) {
  const seed = opts.seed ?? randomSeed();
  const rng = mulberry32(seed);

  const era = opts.eraKey ? eras.find(e => e.key === opts.eraKey) : pick(rng, eras);
  const format = opts.formatKey ? FORMATS.find(f => f.key === opts.formatKey) : pick(rng, FORMATS);
  const difficulty = DIFFICULTIES[opts.difficulty ?? randInt(rng, 0, 4)];

  // two factions that are actually declared enemies — never a free-for-all pool
  const [fa, fb] = pick(rng, era.rivalries);

  const teamA = draft(rng, era, fa, format.a);
  const teamB = draft(rng, era, fb, format.b);

  const playerOnB = rng() < .5;                      // your side is a coin flip, not a choice
  let mine = (playerOnB ? teamB : teamA).map(d => ({ ...d }));
  let foes = (playerOnB ? teamA : teamB).map(d => ({ ...d }));

  // the mean tiers hand the opposition a spare body — before balancing, so it counts
  if (difficulty.edge > 0 && format.key !== 'duel' && format.key !== 'boss') {
    for (let i = 0; i < difficulty.edge && foes.length < 8; i++) foes.push({ ...pick(rng, era.mooks) });
  }
  // difficulty leans on the opposition's stat line
  for (const u of foes) {
    u.hp = Math.round(u.hp * difficulty.stat);
    u.pwr = Math.round(u.pwr * difficulty.stat);
    u.grd = Math.round(u.grd * difficulty.stat);
    u.wrd = Math.round(u.wrd * difficulty.stat);
  }
  balance(mine, foes);
  mine = uniquify(mine);
  foes = uniquify(foes);

  const nameOf = k => era.factions[k];
  return {
    seed, rng, era, format, difficulty, mine, foes,
    yourSide: nameOf(playerOnB ? fb : fa),
    foeSide: nameOf(playerOnB ? fa : fb),
    title: pick(rng, era.titles)
  };
}
