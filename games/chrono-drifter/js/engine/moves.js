/* The archetype library.
   960 hand-written skills would be unauthorable, so a character's move is only an
   INSTANCE of one of these: `S('Cào Than','EMBER',1.2)`. "Cầu Lửa" and "Thương Plasma"
   are the same archetype wearing different labels, which is why the era data
   files are names and numbers rather than logic. */

import { elName } from './elements.js';

export const DMG = 'dmg', HEAL = 'heal', BUFF = 'buff', DEBUFF = 'debuff', WAIT_KIND = 'wait';

/* ── damage ─────────────────────────────────────────────────────────────── */
export const S       = (name, el, pow)        => ({ id: 'STRIKE',  name, el, kind: DMG, pow });
export const AOE     = (name, el, pow)        => ({ id: 'CLEAVE',  name, el, kind: DMG, pow, all: true });
export const ARC     = (name, el, pow)        => ({ id: 'ARC',     name, el, kind: DMG, pow, arc: 2 });
export const PIERCE  = (name, el, pow)        => ({ id: 'PIERCE',  name, el, kind: DMG, pow, pierce: true });
export const SNIPE   = (name, el, pow)        => ({ id: 'SNIPE',   name, el, kind: DMG, pow, crit: true });
export const DRAIN   = (name, el, pow)        => ({ id: 'DRAIN',   name, el, kind: DMG, pow, drain: .5 });
export const EXEC    = (name, el, pow)        => ({ id: 'EXECUTE', name, el, kind: DMG, pow, execute: true });
export const RAMP    = (name, el, pow)        => ({ id: 'RAMP',    name, el, kind: DMG, pow, ramp: .25 });
export const FIXED   = (name, el, amt)        => ({ id: 'FIXED',   name, el, kind: DMG, pow: 1, fixed: amt });
export const DOT     = (name, el, pow, tick)  => ({ id: 'DOT',     name, el, kind: DMG, pow, dot: tick });
export const MARK    = (name, el, pow)        => ({ id: 'MARK',    name, el, kind: DMG, pow, mark: true });
export const STUN    = (name, el, pow)        => ({ id: 'STUN',    name, el, kind: DMG, pow, stun: true });
export const SILENCE = (name, el, pow)        => ({ id: 'SILENCE', name, el, kind: DMG, pow, silence: true });

/* ── support ────────────────────────────────────────────────────────────── */
export const H       = (name, amt)            => ({ id: 'HEAL',    name, kind: HEAL, amt });
export const HALL    = (name, amt)            => ({ id: 'MENDALL', name, kind: HEAL, amt, all: true });
export const REGEN   = (name, amt)            => ({ id: 'REGEN',   name, kind: HEAL, amt: 0, regen: amt });
export const REVIVE  = (name, pct)            => ({ id: 'REVIVE',  name, kind: HEAL, amt: 0, revive: pct });
export const CLEANSE = (name, amt)            => ({ id: 'CLEANSE', name, kind: HEAL, amt, cleanse: true });

/* ── buff ───────────────────────────────────────────────────────────────── */
export const B       = (name, stat, pct)      => ({ id: 'BUFF',    name, kind: BUFF, stat, pct, self: true });
export const R       = (name, stat, pct)      => ({ id: 'RALLY',   name, kind: BUFF, stat, pct, team: true });
export const BARRIER = (name, amt)            => ({ id: 'BARRIER', name, kind: BUFF, shield: amt, self: true });
export const TAUNT   = (name, amt)            => ({ id: 'TAUNT',   name, kind: BUFF, shield: amt, taunt: 2, self: true });
export const CHARGEUP= (name)                 => ({ id: 'CHARGE',  name, kind: BUFF, chargeup: true, self: true });

/* ── debuff ─────────────────────────────────────────────────────────────── */
export const X       = (name, stat, pct)      => ({ id: 'HEX',     name, kind: DEBUFF, stat, pct });
export const XALL    = (name, stat, pct)      => ({ id: 'HEXALL',  name, kind: DEBUFF, stat, pct, all: true });
export const STEAL   = (name, amt)            => ({ id: 'STEAL',   name, kind: DEBUFF, steal: amt });

/* ── ultimates (legends and bosses only) ──────────────────────────────────
   Thirteen shapes, because "damage everyone" is not a signature. An ultimate
   should say something about who the character is. */
export const U        = (name, el, pow)       => ({ id: 'ANNIHILATE', name, el, kind: DMG, pow, all: true, ult: true });
export const UEXEC    = (name, el, pow)       => ({ id: 'PURGE',      name, el, kind: DMG, pow, all: true, execute: true, ult: true });
export const UMEND    = (name, amt)           => ({ id: 'FULLMEND',   name, kind: HEAL, amt, all: true, cleanse: true, ult: true });
export const UTIME    = (name)                => ({ id: 'TIMESTOP',   name, kind: BUFF, extraTurns: 2, self: true, ult: true });
/** One target, enormous, straight through armour. The assassin's answer. */
export const UNUKE    = (name, el, pow)       => ({ id: 'SUNDERBLOW', name, el, kind: DMG, pow, pierce: true, ult: true });
/** Three hops, each harder than the last. */
export const UCHAIN   = (name, el, pow)       => ({ id: 'CHAIN',      name, el, kind: DMG, pow, arc: 3, chain: .35, ult: true });
/** Everyone bleeds and the caster drinks it. */
export const UDRAIN   = (name, el, pow)       => ({ id: 'DEVOUR',     name, el, kind: DMG, pow, all: true, drain: .6, ult: true });
/** No damage at all — it simply ruins the other side. */
export const UCURSE   = (name, el, tick)      => ({ id: 'CURSE',      name, el, kind: DEBUFF, all: true, pct: 30, curse: true, dot: tick, ult: true });
/** The wall: team shield plus regeneration. */
export const UGUARD   = (name, shield, regen) => ({ id: 'AEGIS',      name, kind: BUFF, team: true, shield, regen, ult: true });
/** Everyone who fell gets back up. */
export const URAISE   = (name, pct)           => ({ id: 'RAISE',      name, kind: HEAL, amt: 0, reviveAll: pct, ult: true });
/** Moderate damage, but nobody moves afterwards. */
export const USTUN    = (name, el, pow)       => ({ id: 'SHATTER',    name, el, kind: DMG, pow, all: true, stun: true, ult: true });
/** Turn yourself into the problem for four turns. */
export const URAGE    = (name)                => ({ id: 'RAGE',       name, kind: BUFF, self: true, rage: true, ult: true });
/** Spend your own blood for one impossible hit. */
export const USACRIFY = (name, el, pow)       => ({ id: 'SACRIFICE',  name, el, kind: DMG, pow, sacrifice: .35, crit: true, ult: true });

/** The fifth option, and a real one: stalling to reach an ultimate is a line of play. */
export const WAIT = { id: 'WAIT', name: 'Chờ', kind: WAIT_KIND, self: true };
export const WAIT_CHARGE = 25;
export const WAIT_GUARD = 20;

/** Every archetype id the data files are allowed to reference. */
export const ARCHETYPES = [
  'STRIKE', 'CLEAVE', 'ARC', 'PIERCE', 'SNIPE', 'DRAIN', 'EXECUTE', 'RAMP', 'FIXED',
  'DOT', 'MARK', 'STUN', 'SILENCE',
  'HEAL', 'MENDALL', 'REGEN', 'REVIVE', 'CLEANSE',
  'BUFF', 'RALLY', 'BARRIER', 'TAUNT', 'CHARGE',
  'HEX', 'HEXALL', 'STEAL',
  'ANNIHILATE', 'PURGE', 'FULLMEND', 'TIMESTOP', 'SUNDERBLOW', 'CHAIN', 'DEVOUR',
  'CURSE', 'AEGIS', 'RAISE', 'SHATTER', 'RAGE', 'SACRIFICE',
  'WAIT'
];

/* ── energy ───────────────────────────────────────────────────────────────
   Every skill draws on one pool, so a turn becomes a question of what you can
   still afford next turn rather than a free pick from four buttons. Ultimates
   cost nothing — the CHARGE meter already gates those. */
export const EP_MAX = 80;
export const EP_REGEN = 10;        // restored at the top of your own turn
export const EP_WAIT = 30;         // Chờ gives this much on top of the regen

/* Tuned against 600 simulated battles: the cheap pokes are sustainable on
   regeneration alone, the heavy hitters are not. That gap is the decision. */
const BASE_COST = {
  STRIKE: 11, CLEAVE: 29, ARC: 21, PIERCE: 16, SNIPE: 19, DRAIN: 16,
  EXECUTE: 18, RAMP: 13, FIXED: 14, DOT: 18, MARK: 11, STUN: 24, SILENCE: 24,
  HEAL: 22, MENDALL: 32, REGEN: 20, REVIVE: 36, CLEANSE: 18,
  BUFF: 13, RALLY: 23, BARRIER: 21, TAUNT: 18, CHARGE: 16,
  HEX: 13, HEXALL: 27, STEAL: 10,
  WAIT: 0
};

/** What a move costs to cast. Ultimates are free; raw power nudges the rest. */
export function costOf(m) {
  if (!m) return 0;
  if (m.ult || m.isUlt) return 0;
  // Chờ must always be free, or a drained unit has no legal move at all
  if (m.kind === WAIT_KIND || m.id === 'WAIT') return 0;
  const base = BASE_COST[m.id] ?? 14;
  const heft = m.pow ? Math.round((m.pow - 1) * 8) : 0;
  return Math.max(4, base + heft);
}

const STAT_VI = { pwr: 'PWR', grd: 'GRD', wrd: 'WRD', spd: 'SPD', acc: 'CHÍNH XÁC', crt: 'CHÍ MẠNG' };
/** acc and crt are percentage POINTS, not multipliers: +25 means +25%, not ×1.25. */
export const POINT_STATS = ['acc', 'crt'];
const pt = (stat) => POINT_STATS.includes(stat) ? 'đ' : '%';

/** The Vietnamese label under a move button, built per era so elements reskin. */
export function tagOf(m, era) {
  if (m.kind === WAIT_KIND) return `+${WAIT_CHARGE} nộ · +${EP_WAIT} NL · +${WAIT_GUARD}% thủ`;
  if (m.kind === HEAL) {
    const bits = [];
    if (m.reviveAll) bits.push(`hồi sinh MỌI đồng đội đã gục ở ${Math.round(m.reviveAll * 100)}%`);
    if (m.revive) bits.push(`hồi sinh ${Math.round(m.revive * 100)}%`);
    if (m.regen) bits.push(`hồi ${m.regen}/lượt`);
    if (m.amt) bits.push(`hồi ${m.amt} máu`);
    if (m.all) bits.push('toàn phe');
    if (m.cleanse) bits.push('giải trạng thái');
    return bits.join(' · ');
  }
  if (m.kind === BUFF) {
    if (m.rage) return 'bản thân +80% PWR, +40% SPD, +30đ chí mạng · 4 lượt';
    if (m.extraTurns) return `hành động thêm ${m.extraTurns} lượt`;
    if (m.chargeup) return 'đòn kế tiếp nhân đôi';
    const bits = [];
    if (m.shield) bits.push(`${m.team ? 'toàn phe ' : ''}khiên ${m.shield}`);
    if (m.regen) bits.push(`hồi ${m.regen}/lượt`);
    if (m.taunt) bits.push(`khiêu khích ${m.taunt} lượt`);
    if (m.stat) bits.push(`${m.team ? 'toàn phe ' : ''}+${m.pct}${pt(m.stat)} ${STAT_VI[m.stat] || m.stat}`);
    return bits.join(' · ');
  }
  if (m.kind === DEBUFF) {
    if (m.steal) return `hút ${m.steal} nộ`;
    if (m.curse) return `toàn phe −${m.pct}% mọi chỉ số${m.dot ? ` · ${m.dot} máu/lượt` : ''}`;
    return `${m.all ? 'toàn phe ' : ''}−${m.pct}${pt(m.stat)} ${STAT_VI[m.stat] || m.stat}`;
  }
  const bits = [elName(era, m.el)];
  bits.push(m.fixed ? `${m.fixed} cố định` : `×${m.pow}`);
  if (m.all) bits.push('toàn phe');
  if (m.arc) bits.push(`${m.arc} mục tiêu`);
  if (m.pierce) bits.push('xuyên giáp');
  if (m.crit) bits.push('dễ chí mạng');
  if (m.drain) bits.push('hút máu');
  if (m.execute) bits.push('kết liễu');
  if (m.ramp) bits.push('tăng dần');
  if (m.chain) bits.push(`mỗi lần dội +${Math.round(m.chain * 100)}%`);
  if (m.sacrifice) bits.push(`trả ${Math.round(m.sacrifice * 100)}% máu bản thân`);
  if (m.dot) bits.push(`bỏng ${m.dot}/lượt`);
  if (m.mark) bits.push('đánh dấu');
  if (m.stun) bits.push('choáng');
  if (m.silence) bits.push('câm lặng');
  return bits.join(' · ');
}
