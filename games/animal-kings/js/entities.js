/* Factories and damage maths. DOM-free — imported directly by the test suite. */

import {
  KING, POP_START, SLOT_COLORS, SLOT_NAMES, START_RES, RETINUE_BASE, ORDERS, clamp
} from './config.js';
import { FACTION_BY_ID, unitStats } from './factions.js';

let seq = 1;
export const nextId = () => seq++;
export function resetIds() { seq = 1; }

/* ── kingdom ──────────────────────────────────────────────────────────────── */

export function makeKingdom(slot, factionId, isPlayer = false) {
  const faction = FACTION_BY_ID[factionId];
  if (!faction) throw new Error('unknown faction: ' + factionId);
  return {
    id: slot, slot, faction, isPlayer,
    name: isPlayer ? faction.name : `${faction.name} (${SLOT_NAMES[slot]})`,
    color: SLOT_COLORS[slot],
    res: { ...START_RES },
    pop: 0, popCap: POP_START,
    units: [], buildings: [], retinue: [], retinueCap: RETINUE_BASE,
    upgrades: { weapon: 0, armor: 0, retinue: 0 },
    items: {}, king: null, castle: null, alive: true, ai: null,
    stats: { made: 0, lost: 0, built: 0, razed: 0, killed: 0,
             gathered: { food: 0, wood: 0, gold: 0 }, kingGathered: 0 }
  };
}

export const canAfford = (kd, cost) =>
  kd.res.food >= (cost.food || 0) && kd.res.wood >= (cost.wood || 0) && kd.res.gold >= (cost.gold || 0);

export function spend(kd, cost) {
  kd.res.food -= cost.food || 0;
  kd.res.wood -= cost.wood || 0;
  kd.res.gold -= cost.gold || 0;
}

export function refund(kd, cost) {
  kd.res.food += cost.food || 0;
  kd.res.wood += cost.wood || 0;
  kd.res.gold += cost.gold || 0;
}

export function gain(kd, kind, amount) {
  kd.res[kind] += amount;
  kd.stats.gathered[kind] += amount;
}

/* ── the king ─────────────────────────────────────────────────────────────── */

export function makeKing(kd, x, y) {
  const k = {
    id: nextId(), kind: 'king', kd: kd.id, kingdom: kd,
    x, y, vx: 0, vy: 0, face: 0, radius: KING.radius,
    hp: KING.hp, maxHp: KING.hp,
    stamina: KING.staminaMax, staminaIdle: 0,
    speed: KING.speed, dmg: KING.dmg, range: KING.range, atkEvery: KING.atkEvery,
    atkCd: 0, abilityCd: 0, swing: 0, alive: true,
    glyph: kd.faction.king, armor: 0,
    action: null,          // what the contextual verb resolved to this frame
    busy: 0, bob: Math.random() * 6.28,
    carryFlash: 0
  };
  kd.king = k;
  return k;
}

/* ── units ────────────────────────────────────────────────────────────────── */

export function makeUnit(kd, classKey, x, y) {
  const s = unitStats(kd.faction.id, classKey);
  const armorUp = kd.upgrades.armor * 0.15;
  const dmgUp = 1 + kd.upgrades.weapon * 0.15;
  const u = {
    id: nextId(), kind: 'unit', cls: classKey, kd: kd.id, kingdom: kd,
    x, y, vx: 0, vy: 0, face: 0,
    radius: classKey === 'champion' ? 15 : 12,
    hp: Math.round(s.hp * (1 + armorUp)), maxHp: Math.round(s.hp * (1 + armorUp)),
    dmg: Math.round(s.dmg * dmgUp), range: s.range, atkEvery: s.atkEvery,
    speed: s.speed, pop: s.pop, glyph: s.glyph, badge: s.badge, name: s.name,
    armor: (s.armor || 0) + (kd.faction.passive.armor || 0),
    heal: !!s.heal, siege: s.siege || 1, projectile: s.projectile || null,
    knockback: s.knockback || 0, burst: s.burst || 0, aura: s.aura || null,
    atkCd: 0, target: null, order: ORDERS.FOLLOW, post: null, field: null,
    inRetinue: false, alive: true, state: 'idle',
    carry: 0, carryKind: null, node: null, site: null, home: null,
    bob: Math.random() * 6.28, idleT: 0, wander: null, flee: 0
  };
  kd.units.push(u);
  kd.pop += u.pop;
  kd.stats.made++;
  return u;
}

/* neutral wildlife belongs to nobody and answers to nothing */
export function makeCreep(x, y, glyph = '🐺', tier = 0) {
  return {
    id: nextId(), kind: 'unit', cls: 'creep', kd: -1, kingdom: null,
    x, y, vx: 0, vy: 0, face: 0, radius: 13,
    hp: 95 + tier * 55, maxHp: 95 + tier * 55,
    dmg: 13 + tier * 6, range: 34, atkEvery: 1.0, speed: 92 + tier * 8,
    glyph, badge: null, name: 'Thú Hoang', armor: 0, heal: false, siege: 1,
    projectile: null, knockback: 0, burst: 0, aura: null,
    atkCd: 0, target: null, order: 'guard', post: { x, y }, field: null,
    inRetinue: false, alive: true, state: 'idle', creep: true,
    carry: 0, carryKind: null, node: null, site: null, home: null,
    bob: Math.random() * 6.28, idleT: 0, wander: null, flee: 0, leash: 300
  };
}

/* ── damage ───────────────────────────────────────────────────────────────── */

/* One entry point for every hit in the game. Kings resist ranged specifically —
   the win condition must never be removable by something the player never saw. */
export function applyDamage(target, amount, opts = {}) {
  if (!target || !target.alive) return 0;
  let dmg = amount;

  if (opts.ranged && target.kind === 'king') dmg *= KING.rangedResist;
  if (target.kind === 'building') dmg *= opts.siege || 1;
  dmg *= 1 - clamp(target.armor || 0, 0, 0.8);
  if (opts.multiplier) dmg *= opts.multiplier;

  dmg = Math.max(1, Math.round(dmg));
  target.hp -= dmg;
  if (target.hp <= 0) { target.hp = 0; target.alive = false; }
  return dmg;
}

export function healEntity(target, amount) {
  if (!target || !target.alive) return 0;
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  return target.hp - before;
}

export const isHostile = (a, b) => {
  if (!a || !b || !a.alive || !b.alive) return false;
  if (a.kd === b.kd) return false;
  return true;   // creeps (kd -1) are hostile to everyone, and everyone to them
};

export const popFree = kd => kd.popCap - kd.pop;
