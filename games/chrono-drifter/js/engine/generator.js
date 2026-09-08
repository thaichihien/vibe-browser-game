/* Rolls an encounter. DOM-free.
   Order matters: era → rival factions → format → difficulty → rosters → your side.
   Each draw constrains the next, which is how the result stays coherent instead of
   turning into a costume box. */

import { FORMATS, DIFFICULTIES } from './formats.js';
import { RING, strongAgainst, elName } from './elements.js';
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

/**
 * Draft one side. `extra` carries what the format needs beyond a faction:
 *   { taken }  units already spoken for, so a mirror match cannot draw the same
 *              fighter twice
 *   { el }     the element this side must be built from
 */
function draft(rng, era, factionKey, spec, extra = {}) {
  const taken = extra.taken || [];
  const free = (u) => !taken.includes(u);
  const roster = era.units.filter(u => u.faction === factionKey && free(u));
  const out = [];
  const n = randInt(rng, spec.n[0], spec.n[1]);

  if (spec.pool === 'boss') {
    out.push(era.boss);
    const m = randInt(rng, spec.minions[0], spec.minions[1]);
    for (let i = 0; i < m; i++) out.push(pick(rng, era.mooks));

  } else if (spec.pool === 'mook') {
    for (let i = 0; i < n; i++) out.push(pick(rng, era.mooks));

  } else if (spec.pool === 'rabble') {
    // the rank and file of THIS faction plus the nameless, with replacement —
    // duplicates are the point, but a side is still a side
    const rabble = [...era.units.filter(u => u.tier === 'grunt' && u.faction === factionKey), ...era.mooks];
    for (let i = 0; i < n; i++) out.push(pick(rng, rabble));

  } else if (spec.pool === 'nolegend') {
    // nobody with an ultimate, so the whole battle is skills and energy
    const plain = roster.filter(u => u.tier !== 'legend');
    out.push(...sample(rng, plain, Math.min(n, plain.length)));
    while (out.length < n) out.push(pick(rng, era.mooks));

  } else if (spec.pool === 'element') {
    // Built around one element, and it stays pure: the size comes from what the
    // era can actually field (`extra.want`), because padding a mono-element side
    // with a stranger is exactly the thing this format is about.
    const want = extra.want || n;
    const mine = era.units.filter(u => u.el === extra.el && free(u));
    out.push(...sample(rng, mine, Math.min(want, mine.length)));
    const kin = era.mooks.filter(u => u.el === extra.el);
    while (out.length < want && kin.length) out.push(pick(rng, kin));

  } else {
    // named units come out of the faction pool without replacement
    const want = spec.pool === 'named' ? Math.min(n, roster.length) : n;
    out.push(...sample(rng, roster, want));
    while (out.length < n) out.push(pick(rng, era.mooks));   // rank and file fills the rest
  }

  return out;
}

/**
 * The ring pair this era can stage: `hi` beats `lo`, `lo` answers with numbers.
 * Scored on the countered side's depth, because that is the side the format needs
 * bodies for, with at least two behind the counter itself.
 */
function counterPair(rng, era) {
  const pool = [...era.units, ...era.mooks];
  const count = (el) => pool.filter(u => u.el === el).length;
  let best = [], top = -1;
  for (const hi of RING) {
    const lo = strongAgainst(hi)[0];
    if (count(hi) < 2) continue;
    const score = Math.min(5, count(lo)) * 10 + Math.min(3, count(hi));
    if (score > top) { top = score; best = [[hi, lo]]; }
    else if (score === top) best.push([hi, lo]);
  }
  if (!best.length) return null;                    // era cannot stage it; caller falls back
  const [hi, lo] = pick(rng, best);
  let nHi = Math.min(3, count(hi));
  let nLo = Math.min(5, count(lo));
  if (nLo <= nHi) nHi = Math.max(2, nLo - 1);       // the countered side is never the smaller
  return { hi, lo, nHi, nLo };
}

/**
 * Rough parity without balancing 11 formats × every era by hand.
 * `edgeA` / `edgeB` say how much the matchup itself is already worth to a side —
 * TƯƠNG KHẮC hands one side a ×1.6 swing and takes ×0.7 back, so its raw stat
 * line is *supposed* to be the smaller one and padding it would undo the format.
 */
export function balance(a, b, edgeA = 1, edgeB = 1) {
  const score = arr => arr.reduce((s, u) => s + u.pwr * Math.sqrt(u.hp), 0);
  const r = (score(a) * edgeA) / (score(b) * edgeB);
  const bump = (arr, k) => arr.forEach(u => { u.hp = Math.round(u.hp * k); });
  if (r > 1.1) bump(b, Math.min(2.4, r));
  else if (r < 1 / 1.1) bump(a, Math.min(2.4, 1 / r));
}

/** What being on the right side of the wheel is worth: ×1.6 out, ×0.7 back. */
export const COUNTER_EDGE = 1.6 / 0.7;

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

  /* Who each side is drawn from. The default is the rivalry rule — two factions
     the era declares as enemies, which is what stops knights standing beside
     monsters — and the draft formats bend exactly one thing about it each. */
  let [fa, fb] = pick(rng, era.rivalries);
  let teamA, teamB, labelA = null, labelB = null, foeEra = era, hiIsA = false;

  if (format.sameFaction) {
    // one house against itself: both sides out of one roster, nobody twice
    fb = fa;
    teamA = draft(rng, era, fa, format.a);
    teamB = draft(rng, era, fb, format.b, { taken: teamA });
    labelA = `${era.factions[fa]} — Phe Ly Khai`;
    labelB = `${era.factions[fa]} — Phe Trung Thành`;

  } else if (format.counter && counterPair(rng, era)) {
    // one element against the element it beats; the countered side brings numbers
    const { hi, lo, nHi, nLo } = counterPair(rng, era);
    hiIsA = true;
    teamA = draft(rng, era, fa, format.a, { el: hi, want: nHi });
    teamB = draft(rng, era, fb, format.b, { el: lo, want: nLo, taken: teamA });
    labelA = `Phe ${elName(era, hi)}`;
    labelB = `Phe ${elName(era, lo)}`;

  } else if (format.crossEra) {
    // the other side falls in from a different age entirely
    const others = eras.filter(e => e.key !== era.key);
    foeEra = others.length ? pick(rng, others) : era;
    teamA = draft(rng, era, fa, format.a);
    teamB = draft(rng, foeEra, fb, format.b);
    labelA = era.name;
    labelB = foeEra.name;

  } else {
    teamA = draft(rng, era, fa, format.a);
    teamB = draft(rng, era, fb, format.b);
  }

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
  // the counter side is meant to be outgunned on paper; the wheel is the rest of it
  const edgeMine = hiIsA === !playerOnB ? COUNTER_EDGE : 1;
  const edgeFoes = hiIsA === playerOnB ? COUNTER_EDGE : 1;
  balance(mine, foes, hiIsA ? edgeMine : 1, hiIsA ? edgeFoes : 1);

  // some formats do not start anyone at full: KẺ SỐNG SÓT drops you into a fight
  // already in progress, so everyone arrives wounded and part-drained
  if (format.wounded) {
    const span = (r) => r[0] + rng() * (r[1] - r[0]);
    for (const u of [...mine, ...foes]) { u.hp0 = span(format.wounded.hp); u.ep0 = span(format.wounded.ep); }
  }

  mine = uniquify(mine);
  foes = uniquify(foes);

  // a format that rewrites who the sides ARE has to rewrite what they are called
  const nameOf = (k, label) => label || era.factions[k] || (foeEra.factions && foeEra.factions[k]) || '—';
  return {
    seed, rng, era, format, difficulty, mine, foes,
    yourSide: nameOf(playerOnB ? fb : fa, playerOnB ? labelB : labelA),
    foeSide: nameOf(playerOnB ? fa : fb, playerOnB ? labelA : labelB),
    title: pick(rng, era.titles)
  };
}
