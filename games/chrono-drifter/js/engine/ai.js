/* The opposition, tiered by difficulty. DOM-free.
   Very Easy flails; Very Hard scores threats, focus-fires and holds its ultimate
   for a turn it can actually close with. */

import { statOf, living, damageOf, legalMoves, targetsFor, ULT_FULL } from './combat.js';
import { mult } from './elements.js';
import { HEAL, BUFF, DEBUFF, DMG, WAIT_KIND } from './moves.js';

/** Pick a move and a target for `actor`. Returns { move, targetUid }. */
export function chooseAction(state, actor) {
  const tier = state.difficulty.ai;             // 0 = flailing … 4 = mean
  const rng = state.rng;
  const foes = living(state, actor.side === 'ally' ? 'foe' : 'ally');
  const allies = living(state, actor.side);
  const moves = legalMoves(state, actor).filter(m => !m.locked && m.kind !== WAIT_KIND);
  if (!moves.length || !foes.length) return { move: legalMoves(state, actor).at(-1), targetUid: null };

  // tier 0: pick anything at all
  if (tier === 0) {
    const m = moves[Math.floor(rng() * moves.length)];
    return { move: m, targetUid: firstTarget(state, actor, m, rng) };
  }

  // an ultimate that is ready is almost always the play — but the mean tiers wait
  // for a turn where it actually kills something
  const ult = moves.find(m => m.isUlt);
  // a pure-heal ultimate on a healthy team is a wasted meter
  const ultIsWaste = ult && ult.kind === HEAL && allies.every(a => a.hp / a.max > .7);
  if (ult && !ultIsWaste && actor.charge >= ULT_FULL) {
    const kills = foes.filter(f => damageOf({ ...state, rng: () => .5 }, actor, f, ult).n >= f.hp).length;
    if (tier < 3 || kills > 0 || foes.length >= 3 || rng() < .35) {
      return { move: ult, targetUid: firstTarget(state, actor, ult, rng) };
    }
  }

  // keep the team standing
  if (tier >= 2) {
    const heal = moves.find(m => m.kind === HEAL && m.amt);
    const hurt = allies.filter(a => a.hp / a.max < .45).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
    if (heal && hurt && rng() < (tier >= 3 ? .9 : .7)) return { move: heal, targetUid: hurt.uid };
    const revive = moves.find(m => m.revive);
    const fallen = state.units.find(u => u.side === actor.side && !u.alive);
    if (revive && fallen) return { move: revive, targetUid: fallen.uid };
  }

  // score every damaging option against every reachable target
  let best = null;
  const fixedRng = { ...state, rng: () => .5 };
  for (const m of moves) {
    if (m.kind !== DMG) continue;
    const pool = m.all || m.arc ? [foes[0]] : reachable(state, actor, m, foes);
    for (const t of pool) {
      if (!t) continue;
      let sc = damageOf(fixedRng, actor, t, m).n;
      if (m.all) sc *= foes.length * .85;
      if (m.arc) sc *= Math.min(m.arc, foes.length) * .9;
      if (!m.all && sc >= t.hp) sc *= 1.7;                      // a kill is worth reaching for
      if (tier >= 3) {
        sc *= 1 + threat(t) / 400;                              // shoot the dangerous one
        if (m.dot && t.dots.length) sc *= .7;                   // do not stack what is already burning
        if (m.mark && t.marked) sc *= .7;
      }
      if (tier >= 4 && t.hp / t.max < .4 && m.execute) sc *= 1.4;
      if (sc > (best?.sc ?? -1)) best = { move: m, tgt: (m.all || m.arc) ? null : t, sc };
    }
  }

  // set up instead of swinging, sometimes — a metronome is not an opponent
  const util = moves.filter(m => m.kind === BUFF || m.kind === DEBUFF);
  const setupChance = tier >= 3 ? .16 : tier === 2 ? .2 : .3;
  if (util.length && (!best || rng() < setupChance)) {
    const m = util[Math.floor(rng() * util.length)];
    return { move: m, targetUid: firstTarget(state, actor, m, rng) };
  }
  if (!best) {
    const m = moves[Math.floor(rng() * moves.length)];
    return { move: m, targetUid: firstTarget(state, actor, m, rng) };
  }
  return { move: best.move, targetUid: best.tgt ? best.tgt.uid : null };
}

/** How much trouble this unit is if left alone. */
function threat(u) {
  return statOf(u, 'pwr') * (1 + u.charge / 200) * (u.tier === 'legend' || u.tier === 'boss' ? 1.4 : 1);
}

/** Respect taunt: single-target attacks can only reach the wall while it stands. */
function reachable(state, actor, m, foes) {
  const wall = foes.filter(f => f.taunt > 0);
  return wall.length ? wall : foes;
}

function firstTarget(state, actor, m, rng) {
  const ids = targetsFor(state, actor, m);
  if (!ids.length) return null;
  return ids[Math.floor(rng() * ids.length)];
}
