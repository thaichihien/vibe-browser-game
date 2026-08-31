/* Fighting: target acquisition, swings, projectiles, auras and the king's
   faction ability.

   Every unit that is not a worker defends itself without being told to. That is
   what lets a garrison hold ground while the king is a thousand pixels away, and
   it is the reason the retinue needs four orders rather than forty. */

import {
  ORDERS, TILE, clamp, dist, rnd, pick, norm
} from './config.js';
import { blockedAtPx } from './world.js';
import { applyDamage, healEntity, isHostile, makeUnit } from './entities.js';
import { moveEntity, moveToward, queryHash } from './units.js';
import { steerField, fieldTo } from './pathfind.js';
import { placeBuilding, defOf, centerOf } from './buildings.js';
import { burst, ring, floatText, dust, confetti, flash } from './fx.js';
import { Sound } from './audio.js';

export const AGGRO = 190;          // how far a unit notices trouble on its own
const CHASE_LEASH = 300;           // how far it will follow trouble from its post

/* Cross the map properly.

   Local steering is fine for the last few tiles and hopeless for the first few
   thousand — a lake or a rock ridge stops it dead. Anything with a distant goal
   reads the flow field instead, and only falls back to steering on arrival. */
export function marchTo(G, e, goal, dt, speed = e.speed) {
  const d = dist(e, goal);
  if (d < 190) return moveToward(G.world, e, goal.x, goal.y, dt, speed);
  const field = fieldTo(G.fields, G.world, goal.x, goal.y);
  const step = steerField(field, e.x, e.y);
  if (step) {
    e.face = Math.atan2(goal.y - e.y, goal.x - e.x);
    return moveEntity(G.world, e, step[0], step[1], dt, speed);
  }
  return moveToward(G.world, e, goal.x, goal.y, dt, speed);
}

/* ── auras ────────────────────────────────────────────────────────────────── */

/* Recomputed from scratch each tick rather than tracked as buffs, so a unit that
   walks out of a bell's range simply stops benefiting — no bookkeeping. */
export function clearAuras(u) { u.auraDmg = 1; u.auraHaste = 1; }

export function applyAura(G, source, aura, dt) {
  const near = queryHash(G.hash, source.x, source.y, aura.radius, G.scratch);
  for (const e of near) {
    if (!e.alive || e.kd !== source.kd || e.kind === 'npc') continue;
    if (dist(source, e) > aura.radius) continue;
    if (aura.kind === 'damage') e.auraDmg = Math.max(e.auraDmg || 1, aura.value);
    else if (aura.kind === 'atkSpeed') e.auraHaste = Math.max(e.auraHaste || 1, aura.value);
    else if (aura.kind === 'heal' && e.hp < e.maxHp) healEntity(e, aura.value * dt);
  }
}

/* ── one fighter's frame ──────────────────────────────────────────────────── */

export function updateFighter(G, u, dt) {
  const world = G.world, kd = u.kingdom;

  if (u.atkCd > 0) u.atkCd -= dt;
  if (u.hasteT > 0) { u.hasteT -= dt; if (u.hasteT <= 0) u.haste = 1; }
  u.bob += dt * (u.state === 'walk' ? 11 : 7);

  /* pigs mend themselves when they stand still near home */
  const regen = kd.faction.passive.idleRegen;
  if (regen && u.state === 'idle' && u.hp < u.maxHp) {
    const home = kd.castle;
    if (home && dist(u, home) < 420) healEntity(u, regen * dt);
  }

  const anchor = u.inRetinue ? kd.king : (u.post || u);

  /* keep the current target only while it is alive and still worth crossing to */
  if (u.target && (!u.target.alive || dist(u, u.target) > CHASE_LEASH * 1.4
      || dist(anchor, u.target) > CHASE_LEASH + (u.inRetinue ? 260 : 0))) {
    u.target = null;
  }

  if (!u.target) u.target = acquire(G, u, anchor);

  if (u.target) { engage(G, u, u.target, dt); return; }
  followOrder(G, u, dt);
}

function acquire(G, u, anchor) {
  /* healers look for wounded friends, everyone else looks for enemies */
  if (u.heal) {
    const near = queryHash(G.hash, u.x, u.y, u.range, G.scratch);
    let best = null, worst = 1;
    for (const e of near) {
      if (!e.alive || e.kd !== u.kd || e === u || e.kind === 'npc') continue;
      const f = e.hp / e.maxHp;
      if (f >= 0.98 || f >= worst) continue;
      if (dist(u, e) > u.range) continue;
      worst = f; best = e;
    }
    return best;
  }

  const near = queryHash(G.hash, u.x, u.y, AGGRO, G.scratch);
  let best = null, bd = Infinity;
  for (const e of near) {
    if (!isHostile(u, e) || e.kind === 'npc') continue;
    if (dist(anchor, e) > CHASE_LEASH + (u.inRetinue ? 260 : 0)) continue;
    const d = dist(u, e);
    if (d > AGGRO || d >= bd) continue;
    bd = d; best = e;
  }
  if (best) return best;

  /* nothing alive nearby — a building will do, if we came here to attack */
  if (u.order === ORDERS.ATTACK || u.creep) {
    for (const b of G.buildings) {
      if (!b.alive || b.kd === u.kd) continue;
      if (dist(u, b) - b.radius > AGGRO) continue;
      return b;
    }
  }
  return null;
}

function engage(G, u, target, dt) {
  const reach = u.range + (target.radius || 0);
  const d = dist(u, target);

  if (d > reach) {
    u.state = 'walk';
    moveToward(G.world, u, target.x, target.y, dt, u.speed * (u.haste || 1));
    return;
  }

  u.state = 'fight';
  u.face = Math.atan2(target.y - u.y, target.x - u.x);
  if (u.atkCd > 0) return;
  u.atkCd = u.atkEvery / ((u.haste || 1) * (u.auraHaste || 1));

  if (u.heal) {
    G.projectiles.push({
      x: u.x, y: u.y - 10, target, speed: 480, dmg: u.dmg, heal: true,
      glyph: u.projectile || '💚', from: u
    });
    return;
  }

  const power = u.dmg * (u.auraDmg || 1) * (u.kingdom?.items?.horn && u.inRetinue ? 1.25 : 1);

  if (u.projectile) {
    G.projectiles.push({
      x: u.x, y: u.y - 10, target, speed: 430, dmg: power, glyph: u.projectile,
      from: u, ranged: true, siege: u.siege
    });
    return;
  }

  /* melee lands now */
  const dealt = target.kind === 'building'
    ? applyDamage(target, power, { siege: u.siege })
    : applyDamage(target, power * (u.burst && target.hp === target.maxHp ? u.burst : 1), {});

  if (target.kind === 'building') G.onBuildingHit(target, dealt);
  else G.onHit(u, target, dealt);

  if (u.knockback && target.alive && target.kind !== 'building') {
    const [nx, ny] = norm(target.x - u.x, target.y - u.y);
    const kx = target.x + nx * u.knockback * 0.35, ky = target.y + ny * u.knockback * 0.35;
    if (!blockedAtPx(G.world, kx, ky)) { target.x = kx; target.y = ky; }
  }
}

/* ── standing orders ──────────────────────────────────────────────────────── */

function followOrder(G, u, dt) {
  const kd = u.kingdom;

  if (u.inRetinue) {
    const k = kd.king;
    if (!k || !k.alive) { u.inRetinue = false; return; }
    const slot = u.slot || { x: 0, y: 0 };
    const tx = k.x + slot.x, ty = k.y + slot.y;
    if (dist(u, { x: tx, y: ty }) > 26) {
      u.state = 'walk';
      moveToward(G.world, u, tx, ty, dt, u.speed * (dist(u, k) > 260 ? 1.25 : 1));
    } else u.state = 'idle';
    return;
  }

  if (u.order === ORDERS.ATTACK || u.order === ORDERS.HOME || u.order === ORDERS.SCOUT) {
    const goal = u.goal;
    if (!goal) { u.order = ORDERS.HOLD; return; }
    if (dist(u, goal) < 44) {
      u.order = ORDERS.HOLD;
      u.post = { x: u.x, y: u.y };
      return;
    }
    u.state = 'march';
    /* one flow field per order, shared by everyone marching to it */
    const field = fieldTo(G.fields, G.world, goal.x, goal.y);
    const step = steerField(field, u.x, u.y);
    if (step) moveEntity(G.world, u, step[0], step[1], dt, u.speed * (u.haste || 1));
    else moveToward(G.world, u, goal.x, goal.y, dt);
    return;
  }

  /* HOLD: drift near the post, which is also what a fresh recruit does at its
     rally point until somebody comes and enlists it */
  const post = u.post || (kd.castle ? { x: kd.castle.x, y: kd.castle.y + 90 } : null);
  if (!post) { u.state = 'idle'; return; }
  const d = dist(u, post);
  if (d > 70) { u.state = 'walk'; moveToward(G.world, u, post.x, post.y, dt, u.speed * 0.8); return; }

  u.state = 'idle';
  u.idleT -= dt;
  if (u.idleT <= 0) {
    u.idleT = rnd(2.2, 5);
    u.wander = { x: post.x + rnd(-46, 46), y: post.y + rnd(-46, 46) };
  }
  if (u.wander) moveToward(G.world, u, u.wander.x, u.wander.y, dt, u.speed * 0.36);
}

/* ── the king's faction ability ───────────────────────────────────────────── */

export function useAbility(G, kd) {
  const k = kd.king;
  if (!k || !k.alive || k.abilityCd > 0) { if (kd.isPlayer) Sound.deny(); return false; }

  const f = kd.faction, a = f.ability;
  const shrine = kd.buildings.some(b => b.alive && b.built && b.key === 'shrine');
  k.abilityCd = (f.ability.cd || 52) * (shrine ? 0.75 : 1);

  Sound.ability();
  ring(G.fx, k.x, k.y, f.color, 10, a.radius || 200, 0.7, 5);

  switch (f.id) {
    case 'pig': {
      const near = queryHash(G.hash, k.x, k.y, a.radius, G.scratch);
      for (const e of near) {
        if (!e.alive || e.kd !== kd.id) continue;
        if (dist(k, e) > a.radius) continue;
        healEntity(e, a.heal);
        confetti(G.fx, e.x, e.y, ['🍖', '🍎'], 4);
      }
      break;
    }
    case 'chicken': {
      for (const u of kd.retinue) { u.haste = a.atkSpeed; u.hasteT = a.duration; }
      confetti(G.fx, k.x, k.y, ['🐣', '📢'], 14);
      break;
    }
    case 'cow': {
      /* the charge is a timed state on the king; the trample lands in update */
      k.charge = { t: a.duration, speed: a.speed, dmg: a.trample, hit: new Set() };
      for (const u of kd.retinue) { u.haste = 1.6; u.hasteT = a.duration; }
      break;
    }
    case 'sheep': {
      const def = defOf(kd, 'wall');
      let made = 0;
      for (let i = 0; i < a.walls * 2 && made < a.walls; i++) {
        const ang = (i / (a.walls * 2)) * Math.PI * 2;
        const tx = Math.floor((k.x + Math.cos(ang) * a.radius) / TILE);
        const ty = Math.floor((k.y + Math.sin(ang) * a.radius) / TILE);
        const b = placeBuilding(G, kd, def, tx, ty, { instant: true, free: true });
        if (b) { made++; dust(G.fx, b.x, b.y, '#e8f0ff', 6); }
      }
      break;
    }
    case 'rabbit': {
      /* burrow home — the one faction that gets to ignore the map's size */
      const anchors = kd.buildings.filter(b => b.alive && b.built && (b.def.anchor || b.key === 'castle'));
      const target = anchors.sort((p, q) => dist(k, q) - dist(k, p))[0] || kd.castle;
      if (target) {
        burst(G.fx, k.x, k.y, '#c7a6ff', 20, 180, '🕳️');
        const dx = target.x - k.x, dy = target.y + 80 - k.y;
        k.x = target.x; k.y = target.y + 80;
        for (const u of kd.retinue) { u.x += dx + rnd(-20, 20); u.y += dy + rnd(-20, 20); }
        burst(G.fx, k.x, k.y, '#c7a6ff', 20, 180, '🕳️');
        if (kd.isPlayer) G.snapCameraToKing?.();
      }
      break;
    }
  }
  return true;
}

/* the cow charge, ticked from the king's frame */
export function updateCharge(G, k, dt) {
  if (!k.charge) return;
  k.charge.t -= dt;
  const near = queryHash(G.hash, k.x, k.y, 46, G.scratch);
  for (const e of near) {
    if (!isHostile(k, e) || k.charge.hit.has(e.id)) continue;
    if (dist(k, e) > 46) continue;
    k.charge.hit.add(e.id);
    G.onHit(k, e, applyDamage(e, k.charge.dmg, {}));
    const [nx, ny] = norm(e.x - k.x, e.y - k.y);
    e.x += nx * 30; e.y += ny * 30;
  }
  dust(G.fx, k.x, k.y + 12, '#d8c9a3', 2);
  if (k.charge.t <= 0) k.charge = null;
}
