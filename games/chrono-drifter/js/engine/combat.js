/* Combat resolution. DOM-free on purpose: the tests import this directly and the
   AI searches over it, so nothing here may touch document or window.

   `resolve()` returns an ordered list of EVENTS rather than a finished board. The
   renderer replays them as staggered animations; the AI scores them on a clone. */

import { mult } from './elements.js';
import { WAIT_KIND, DMG, HEAL, BUFF, DEBUFF, WAIT, WAIT_CHARGE, WAIT_GUARD } from './moves.js';

export const TICK_GOAL = 1000;
export const ULT_FULL = 100;
const CHARGE_ON_ACT = 12;
const CHARGE_ON_HIT = 8;
const BUFF_TURNS = 4;
const DOT_TURNS = 3;

/** Effective stat after buffs and debuffs. Never drops below 1. */
export function statOf(u, key) {
  let v = u[key];
  for (const b of u.buffs) if (b.stat === key) v *= 1 + b.pct / 100;
  return Math.max(1, v);
}

export const living = (state, side) => state.units.filter(u => u.alive && (!side || u.side === side));

/* Two units that both out-heal their own damage would fight forever — a real
   possibility in a duel between sustain builds. So the timeline itself runs out of
   patience: past a soft cap every turn hits harder and heals for less, until the
   battle has to end. It doubles as the pacing guarantee the tests assert on. */
export const FATIGUE_CAP = 3;
export function fatigueOf(state) {
  if (!state.softCap) return 0;
  return Math.min(FATIGUE_CAP, Math.max(0, (state.turns - state.softCap) / state.softCap));
}

export function createBattle({ era, format, mine, foes, difficulty, rng, seed }) {
  let id = 0;
  const mk = (def, side, slot) => ({
    ...def, uid: `${side}${id++}`, side, slot,
    max: def.hp, hp: def.hp,
    charge: 0, buffs: [], dots: [], shield: 0,
    taunt: 0, stunned: 0, silenced: 0, marked: 0, ramp: 0, chargeup: 0, extraTurns: 0,
    alive: true, gauge: 0
  });
  const n = mine.length + foes.length;
  return {
    seed, rng, era, format, difficulty,
    units: [...mine.map((d, i) => mk(d, 'ally', i)), ...foes.map((d, i) => mk(d, 'foe', i))],
    round: 1, turns: 0, softCap: format.par * n, over: false, won: null, actor: null
  };
}

/* ── the tick queue ─────────────────────────────────────────────────────────
   Everyone accrues SPD per tick and acts at 1000, so Haste and Slow visibly
   reorder the timeline instead of changing an invisible number. */

/** Peek the next `n` actors without disturbing the real queue. */
export function turnOrder(state, n = 8) {
  const sim = living(state).map(u => ({ u, g: u.gauge, s: statOf(u, 'spd') }));
  const out = [];
  while (out.length < n && sim.length) {
    let best = sim[0];
    for (const x of sim) if (x.g > best.g || (x.g === best.g && x.s > best.s)) best = x;
    const need = Math.max(0, (TICK_GOAL - best.g) / best.s);
    for (const x of sim) x.g += x.s * need;
    out.push(best.u);
    best.g -= TICK_GOAL;
  }
  return out;
}

/** Advance the clock until somebody is ready, and hand them the turn. */
export function nextActor(state) {
  const alive = living(state);
  if (!alive.length) return null;
  for (let guard = 0; guard < 200000; guard++) {
    for (const u of alive) u.gauge += statOf(u, 'spd');
    const ready = alive.filter(u => u.gauge >= TICK_GOAL);
    if (ready.length) {
      ready.sort((a, b) => (b.gauge - a.gauge) || (statOf(b, 'spd') - statOf(a, 'spd')));
      ready[0].gauge -= TICK_GOAL;
      return ready[0];
    }
  }
  return null;
}

/** Tick everything that lives on the actor at the top of their turn. */
export function openTurn(state, u) {
  const ev = [];
  for (const b of u.buffs) b.t--;
  u.buffs = u.buffs.filter(b => b.t > 0);
  if (u.taunt > 0) u.taunt--;
  if (u.marked > 0) u.marked--;
  if (u.silenced > 0) u.silenced--;

  for (const d of u.dots) {
    d.t--;
    u.hp -= d.amt;
    ev.push({ t: 'dmg', tgt: u.uid, n: d.amt, el: d.el, em: 1, crit: false, dot: true });
    if (u.hp <= 0) { kill(u); ev.push({ t: 'death', tgt: u.uid }); break; }
  }
  u.dots = u.dots.filter(d => d.t > 0);

  if (u.alive && u.stunned > 0) {
    u.stunned--;
    ev.push({ t: 'note', tgt: u.uid, text: 'CHOÁNG' });
    ev.push({ t: 'skip', src: u.uid });
  }
  return ev;
}

const kill = (u) => { u.hp = 0; u.alive = false; u.buffs = []; u.dots = []; u.shield = 0; u.taunt = 0; };

/* ── targeting ─────────────────────────────────────────────────────────── */

export function needsTarget(m) {
  if (m.kind === WAIT_KIND) return false;
  if (m.self || m.team || m.all) return false;
  return true;
}

export function targetsFor(state, u, m) {
  if (!needsTarget(m)) return [];
  const side = (m.kind === HEAL) ? u.side : (u.side === 'ally' ? 'foe' : 'ally');
  let list = living(state, side);
  if (m.revive) list = state.units.filter(x => x.side === u.side && !x.alive);
  // a taunting defender soaks every single-target attack aimed at their side
  if (m.kind === DMG || m.kind === DEBUFF) {
    const wall = list.filter(x => x.taunt > 0);
    if (wall.length) list = wall;
  }
  return list.map(x => x.uid);
}

export function legalMoves(state, u) {
  const out = u.mv.map(m => ({ ...m }));
  if (u.ult) out.push({ ...u.ult, isUlt: true, locked: u.charge < ULT_FULL });
  out.push({ ...WAIT });
  if (u.silenced > 0) for (const m of out) if (m.kind !== WAIT_KIND) m.locked = true;
  return out;
}

/* ── damage ─────────────────────────────────────────────────────────────── */

export function damageOf(state, src, tgt, m) {
  const rng = state.rng;
  if (m.fixed) return { n: m.fixed, em: 1, crit: false, fixed: true };
  const raw = statOf(src, 'pwr') * (m.pow || 1) * (0.92 + rng() * 0.16) * (1 + (src.ramp || 0));
  let def = (m.el === 'STEEL') ? statOf(tgt, 'grd') : statOf(tgt, 'wrd');
  if (m.pierce) def *= 0.5;
  const em = mult(m.el, tgt.el);
  const crit = rng() < (m.crit ? 0.32 : 0.10);
  let n = raw * (100 / (100 + def)) * em * (crit ? 1.5 : 1);
  if (m.execute && tgt.hp / tgt.max < 0.35) n *= 1.8;
  if (tgt.marked > 0) n *= 1.25;
  if (src.chargeup > 0) n *= 2;
  n *= 1 + fatigueOf(state);
  return { n: Math.max(1, Math.round(n)), em, crit, fixed: false };
}

function applyDamage(state, tgt, n, el, meta, ev) {
  if (tgt.shield > 0) {
    const eaten = Math.min(tgt.shield, n);
    tgt.shield -= eaten; n -= eaten;
    ev.push({ t: 'shield', tgt: tgt.uid, n: eaten });
  }
  if (n > 0) tgt.hp -= n;
  tgt.charge = Math.min(ULT_FULL, tgt.charge + CHARGE_ON_HIT);
  ev.push({ t: 'dmg', tgt: tgt.uid, n, el, em: meta.em, crit: meta.crit });
  if (tgt.hp <= 0) { kill(tgt); ev.push({ t: 'death', tgt: tgt.uid }); }
  return n;
}

/* ── resolution ─────────────────────────────────────────────────────────── */

/**
 * Play one move. Mutates `state` and returns the ordered events to animate.
 * `targetUid` may be null for self/team/all moves.
 */
export function resolve(state, actor, move, targetUid) {
  const ev = [];
  const rng = state.rng;
  const byId = (id) => state.units.find(u => u.uid === id);
  const foes = living(state, actor.side === 'ally' ? 'foe' : 'ally');
  const allies = living(state, actor.side);
  const m = move;

  state.turns++;
  if (!state.warned && fatigueOf(state) > 0) {
    state.warned = true;
    ev.push({ t: 'note', tgt: actor.uid, text: 'THỜI GIAN ĐANG SỤP' });
    ev.push({ t: 'log', text: 'Thời đại bắt đầu đẩy bạn ra: mọi đòn đánh mạnh dần, mọi phép hồi yếu đi.' });
  }
  if (m.isUlt || m.ult) { ev.push({ t: 'ult', src: actor.uid, name: m.name }); actor.charge = 0; }
  ev.push({ t: 'log', text: m.kind === WAIT_KIND ? `${actor.n} nén lại, tích nộ.` : `${actor.n} dùng ${m.name}.` });

  if (m.kind === WAIT_KIND) {
    actor.charge = Math.min(ULT_FULL, actor.charge + WAIT_CHARGE);
    actor.buffs.push({ stat: 'grd', pct: WAIT_GUARD, t: 2 }, { stat: 'wrd', pct: WAIT_GUARD, t: 2 });
    ev.push({ t: 'wait', src: actor.uid });

  } else if (m.kind === HEAL) {
    let list = m.all ? allies : [byId(targetUid) || weakest(allies)];
    if (m.revive) {
      const fallen = state.units.filter(u => u.side === actor.side && !u.alive);
      const t = byId(targetUid) || fallen[0];
      if (t) {
        t.alive = true; t.hp = Math.round(t.max * m.revive);
        ev.push({ t: 'revive', tgt: t.uid, n: t.hp });
      }
      list = [];
    }
    for (const t of list) {
      if (!t) continue;
      if (m.cleanse) { t.buffs = t.buffs.filter(b => b.pct > 0); t.dots = []; t.marked = 0; ev.push({ t: 'note', tgt: t.uid, text: 'GIẢI TRẠNG THÁI' }); }
      if (m.regen) { t.buffs.push({ stat: null, regen: m.regen, t: DOT_TURNS }); ev.push({ t: 'note', tgt: t.uid, text: `HỒI ${m.regen}/LƯỢT` }); }
      if (m.amt) {
        const before = t.hp;
        t.hp = Math.min(t.max, t.hp + m.amt * healScale(state));
        ev.push({ t: 'heal', tgt: t.uid, n: Math.round(t.hp - before) });
      }
    }

  } else if (m.kind === BUFF) {
    if (m.extraTurns) { actor.extraTurns += m.extraTurns; ev.push({ t: 'note', tgt: actor.uid, text: 'THỜI GIAN NGƯNG ĐỌNG' }); }
    if (m.chargeup) { actor.chargeup = 2; ev.push({ t: 'note', tgt: actor.uid, text: 'DỒN LỰC' }); }
    const list = m.team ? allies : [actor];
    for (const t of list) {
      if (m.stat) t.buffs.push({ stat: m.stat, pct: m.pct, t: BUFF_TURNS });
      if (m.shield) { t.shield += m.shield; ev.push({ t: 'shield', tgt: t.uid, n: m.shield, gain: true }); }
      if (m.taunt) t.taunt = m.taunt + 1;
      ev.push({ t: 'buff', tgt: t.uid, label: m.name });
    }

  } else if (m.kind === DEBUFF) {
    const list = m.all ? foes : [byId(targetUid) || pickFoe(rng, foes)];
    for (const t of list) {
      if (!t) continue;
      if (m.steal) {
        const taken = Math.min(t.charge, m.steal);
        t.charge -= taken; actor.charge = Math.min(ULT_FULL, actor.charge + taken);
        ev.push({ t: 'note', tgt: t.uid, text: `−${taken} NỘ` });
      }
      if (m.stat) { t.buffs.push({ stat: m.stat, pct: -m.pct, t: BUFF_TURNS }); ev.push({ t: 'debuff', tgt: t.uid, label: m.name }); }
    }

  } else { // damage
    let targets;
    if (m.all) targets = foes;
    else if (m.arc) targets = shuffle(rng, foes).slice(0, m.arc);
    else targets = [byId(targetUid) || pickFoe(rng, foes)].filter(Boolean);

    if (!m.all && targets[0]) ev.push({ t: 'lunge', src: actor.uid, tgt: targets[0].uid });
    let dealt = 0;
    for (const t of targets) {
      if (!t.alive) continue;
      ev.push({ t: 'proj', src: actor.uid, tgt: t.uid, el: m.el });
      const d = damageOf(state, actor, t, m);
      dealt += applyDamage(state, t, d.n, m.el, d, ev);
      if (t.alive) {
        if (m.dot) t.dots.push({ amt: m.dot, el: m.el, t: DOT_TURNS });
        if (m.mark) t.marked = DOT_TURNS;
        if (m.stun) t.stunned = 1;
        if (m.silence) t.silenced = 2;
      }
    }
    if (m.drain && actor.alive && dealt > 0) {
      const back = Math.round(dealt * m.drain);
      actor.hp = Math.min(actor.max, actor.hp + back);
      ev.push({ t: 'heal', tgt: actor.uid, n: back });
    }
    if (m.ramp) actor.ramp = Math.min(1, (actor.ramp || 0) + m.ramp);
    else actor.ramp = 0;
    if (actor.chargeup > 0) actor.chargeup = 0;
  }

  if (m.kind !== WAIT_KIND) actor.charge = Math.min(ULT_FULL, actor.charge + CHARGE_ON_ACT);

  // regen ticks after the actor has spent their turn
  for (const b of actor.buffs) {
    if (b.regen && actor.alive) {
      actor.hp = Math.min(actor.max, actor.hp + b.regen);
      ev.push({ t: 'heal', tgt: actor.uid, n: b.regen });
    }
  }

  const end = checkEnd(state);
  if (end) ev.push(end);
  return ev;
}

export function checkEnd(state) {
  const mine = living(state, 'ally').length;
  const foes = living(state, 'foe').length;
  if (mine && foes) return null;
  state.over = true;
  state.won = mine > 0;
  return { t: 'end', won: state.won };
}

export const healScale = (state) => Math.max(0.08, 1 - fatigueOf(state) * 0.55);

const weakest = (arr) => arr.reduce((a, b) => (a.hp / a.max <= b.hp / b.max ? a : b), arr[0]);
const pickFoe = (rng, arr) => arr[Math.floor(rng() * arr.length)];
function shuffle(rng, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
