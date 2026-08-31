/* The game object and the loop.

   Everything a system needs hangs off `G`. Systems are plain functions taking
   `G` and a dt; nothing here reaches into the DOM except through `hooks`, which
   main.js supplies. */

import {
  KING, TILE, CARRY, DAY_LENGTH, START_WORKERS, INTERACT_RANGE, ENLIST_RANGE,
  BUILD_RANGE, ORDERS, RES_ICON, clamp, dist, rnd, pick, angleDiff
} from './config.js';
import {
  generateWorld, nearestNode, harvestNode, blockedAtPx, tileCenter, reachableTile
} from './world.js';
import { makeRenderer } from './render.js';
import { makeCamera, resizeCamera, snapCamera, updateCamera, shakeCamera, onScreen } from './camera.js';
import { makeFx, updateFx, burst, ring, dust, floatText, flash, confetti } from './fx.js';
import { makeInput } from './input.js';
import { makeFieldCache, passable } from './pathfind.js';
import {
  makeKingdom, makeKing, makeUnit, makeCreep, resetIds,
  applyDamage, healEntity, isHostile, gain, nextId
} from './entities.js';
import {
  moveEntity, moveToward, separate, makeSpatialHash, rebuildHash, queryHash,
  updateWorker, nearestDropoff
} from './units.js';
import {
  BUILDINGS, defOf, defsFor, placeBuilding, placementError, canPlace, centerOf,
  advanceBuild, razeBuilding, onBuilt, rallyPoint, footTiles
} from './buildings.js';
import { unitStats } from './factions.js';
import { updateFighter, clearAuras, applyAura, useAbility, updateCharge } from './combat.js';
import { makeAI, updateAI, updateAIKing, PROFILES } from './ai.js';
import { makeCourierState, updateMessengers, report } from './messenger.js';
import { makeDuties, updateDuties, DUTIES } from './duties.js';
import { ITEMS } from './ui.js';
import { enlist, dismiss, command, pruneRetinue } from './retinue.js';
import { Sound } from './audio.js';

/* Two townspeople, flanking the castle.

   There used to be a third — a captain who queued units into whichever barracks
   had the shortest line. He was a second door onto the barracks' own panel, so
   he went; his upgrades moved to the merchant, who is now the only place gold is
   spent. Training happens at the building that does the training. */
const NPCS = [
  { kind: 'merchant', glyph: '🛒', name: 'Thương Nhân', dx: -104, dy: 52 },
  { kind: 'builder',  glyph: '🔨', name: 'Thợ Xây',     dx: 104,  dy: 52 }
];

export function createGame(canvas, setup, hooks = {}) {
  resetIds();
  const world = generateWorld(setup.seed, setup.players);

  const G = {
    world, canvas, hooks, setup,
    R: makeRenderer(canvas),
    cam: makeCamera(),
    fx: makeFx(),
    input: makeInput(canvas),
    hash: makeSpatialHash(),
    fields: makeFieldCache(20),
    messages: makeCourierState(),
    duties: makeDuties(),

    kingdoms: [], actors: [], buildings: [], npcs: [],
    projectiles: [], couriers: [],
    player: null,
    time: 0, running: false, paused: false, over: null,
    promptTarget: null, ghost: null,
    scratch: []
  };

  /* ── kingdoms ───────────────────────────────────────────────────────────── */
  setup.factions.forEach((fid, slot) => {
    const kd = makeKingdom(slot, fid, slot === 0);
    const start = world.starts[slot];
    G.kingdoms.push(kd);

    /* the castle sits centred on the start tile */
    const def = BUILDINGS.castle;
    const ctx = start.tx - Math.floor(def.foot / 2), cty = start.ty - Math.floor(def.foot / 2);
    const castle = placeBuilding(G, kd, def, ctx, cty, { instant: true, free: true });

    const king = makeKing(kd, castle.x - 70, castle.y + 158);
    G.actors.push(king);

    for (let i = 0; i < START_WORKERS; i++) {
      const a = (i / START_WORKERS) * Math.PI * 2;
      const w = makeUnit(kd, 'worker', castle.x + Math.cos(a) * 92, castle.y + Math.sin(a) * 92);
      w.want = i === 0 ? 'food' : 'wood';
      G.actors.push(w);
    }

    /* the three people you have to walk to — only the player's are interactive,
       but every kingdom gets them so an enemy town reads as a town */
    for (const n of NPCS) {
      G.npcs.push({
        id: nextId(), kind: 'npc', npc: n.kind, glyph: n.glyph, name: n.name,
        kd: kd.id, kingdom: kd, x: castle.x + n.dx, y: castle.y + n.dy,
        radius: 14, alive: true, bob: Math.random() * 6.28
      });
    }
  });
  G.player = G.kingdoms[0];
  for (const kd of G.kingdoms) {
    if (!kd.isPlayer) kd.ai = makeAI(G, kd, setup.difficulty ?? 1);
  }
  G.difficultyName = PROFILES[clamp(setup.difficulty ?? 1, 0, 3)].name;

  /* Bind the renderer to the camera now, not at the first draw. The king aims by
     projecting the cursor back into the world, and that happens inside update —
     one frame before anything is painted. */
  G.R.cam = G.cam;

  /* ── wildlife ───────────────────────────────────────────────────────────── */
  /* Camps sit on top of gold seams, and a seam is solid rock — so a ring of
     positions drops most of the pack inside the mountain. Collect the open
     ground around the seam first, then seat the pack in it. A camp has to be
     tight enough that walking into one wakes the whole pack, or it is not a
     camp, it is three unrelated wolves. */
  for (const camp of world.creepCamps) {
    const spots = [];
    for (let r = 1; r <= 5 && spots.length < camp.count * 4; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const tx = camp.tx + dx, ty = camp.ty + dy;
          if (!passable(world, tx, ty) || !reachableTile(world, tx, ty)) continue;
          const c = tileCenter(tx, ty);
          spots.push(c);
        }
      }
    }
    for (let i = 0; i < camp.count && spots.length; i++) {
      const spot = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
      const c = makeCreep(spot.x + rnd(-8, 8), spot.y + rnd(-8, 8),
        i % 3 === 0 ? '🐍' : '🐺', camp.count > 4 ? 1 : 0);
      c.post = { x: c.x, y: c.y };     // guard where it stands, not inside the rock
      c.den = { x: camp.x, y: camp.y };
      G.actors.push(c);
    }
  }

  snapCamera(G.cam, G.player.king);

  /* ── income helpers ─────────────────────────────────────────────────────── */

  /* one funnel for every resource that lands in a treasury, so a faction bonus
     is applied in exactly one place */
  function credit(kd, kind, amount) {
    let v = amount;
    if (kind === 'food' && kd.faction.passive.foodBonus) v *= 1 + kd.faction.passive.foodBonus;
    gain(kd, kind, v);
    return v;
  }
  G.credit = credit;

  const workerHooks = {
    onDeposit(u, drop, amount, kind) {
      const got = credit(u.kingdom, kind, amount);
      if (onScreen(G.cam, drop.x, drop.y, 80)) {
        floatText(G.fx, drop.x, drop.y - 30, `+${Math.round(got)} ${RES_ICON[kind]}`, '#ffe08a', 0.9, 13);
        if (u.kingdom.isPlayer) Sound.coin();
      }
    }
  };

  /* ── the king ───────────────────────────────────────────────────────────── */

  function spendStamina(k, amount) {
    k.stamina = Math.max(0, k.stamina - amount);
    k.staminaIdle = 0;
  }
  G.spendStamina = spendStamina;

  /* What is in front of the king right now. One verb, resolved by priority:
     a fight beats a job, and a job beats nothing. */
  function resolveAction(k) {
    const kd = k.kingdom;
    const reach = KING.range;

    const near = queryHash(G.hash, k.x, k.y, reach + 60, G.scratch);
    let enemy = null, bd = Infinity;
    for (const e of near) {
      if (!isHostile(k, e)) continue;
      const d = dist(k, e) - e.radius;
      if (d > reach) continue;
      if (Math.abs(angleDiff(Math.atan2(e.y - k.y, e.x - k.x), k.face)) > KING.arc) continue;
      if (d < bd) { bd = d; enemy = e; }
    }
    if (enemy) return { type: 'attack', target: enemy };

    /* enemy buildings are legitimate targets for the king's own hands */
    for (const b of G.buildings) {
      if (!b.alive || b.kd === k.kd) continue;
      if (dist(k, b) - b.radius > reach) continue;
      return { type: 'attack', target: b };
    }

    /* a site of ours that still needs raising, or one of ours that is hurt */
    for (const b of kd.buildings) {
      if (!b.alive) continue;
      if (dist(k, b) - b.radius > reach + 10) continue;
      if (!b.built) return { type: 'build', target: b };
      if (b.hp < b.maxHp) return { type: 'repair', target: b };
    }

    const fx = Math.cos(k.face), fy = Math.sin(k.face);
    const n = nearestNode(world, k.x + fx * 30, k.y + fy * 30, null, 2);
    if (n && dist(k, n) < reach + 16) return { type: 'harvest', target: n };

    return null;
  }

  const ACTION_VERB = {
    attack: 'Tấn công', build: 'Xây', repair: 'Sửa',
    harvest: { wood: 'Chặt gỗ', food: 'Gặt lúa', gold: 'Đào vàng' }
  };

  function doAction(k, act, dt) {
    const kd = k.kingdom;
    if (act.type === 'attack') {
      if (k.atkCd > 0 || k.stamina < 3) return;
      k.atkCd = k.atkEvery;
      k.swing = 0.18;
      spendStamina(k, KING.swingCost);
      kingSwing(k, act.target);
      return;
    }

    if (act.type === 'build') {
      if (k.stamina < 1) return;
      act.target.builders++;              // the king counts as a pair of hands
      spendStamina(k, KING.harvestDrain * 0.7 * dt);
      if (Math.random() < dt * 9) dust(G.fx, act.target.x + rnd(-20, 20), act.target.y, '#d8c9a3', 2);
      if (Math.random() < dt * 3) Sound.build();
      return;
    }

    if (act.type === 'repair') {
      const b = act.target;
      if (k.stamina < 1) return;
      const heal = KING.repairRate * dt;
      const cost = heal * KING.repairCost;
      if (kd.res.wood < cost) return;
      kd.res.wood -= cost;
      b.hp = Math.min(b.maxHp, b.hp + heal);
      spendStamina(k, KING.harvestDrain * 0.5 * dt);
      if (Math.random() < dt * 8) dust(G.fx, b.x + rnd(-18, 18), b.y, '#cfe0ff', 2);
      return;
    }

    if (act.type === 'harvest') {
      if (k.stamina < 1) return;
      kingHarvest(k, act.target, dt);
    }
  }

  /* The king's cleave. Shared with the AI king so both sides swing the same
     weapon — anything else and the two halves of the game drift apart. */
  function kingSwing(k, focus = null) {
    const hit = queryHash(G.hash, k.x, k.y, KING.range + 60, G.scratch);
    let any = false;
    for (const e of hit) {
      if (!isHostile(k, e) || e.kind === 'npc') continue;
      if (dist(k, e) - e.radius > KING.range) continue;
      if (Math.abs(angleDiff(Math.atan2(e.y - k.y, e.x - k.x), k.face)) > KING.arc) continue;
      onHit(k, e, applyDamage(e, k.dmg, {}));
      any = true;
    }
    for (const b of G.buildings) {
      if (!b.alive || b.kd === k.kd) continue;
      if (dist(k, b) - b.radius > KING.range) continue;
      onBuildingHit(b, applyDamage(b, k.dmg, {}));
      any = true;
    }
    if (any && onScreen(G.cam, k.x, k.y)) Sound.hit();
    if (onScreen(G.cam, k.x, k.y)) {
      ring(G.fx, k.x + Math.cos(k.face) * 26, k.y + Math.sin(k.face) * 26, '#ffe6a8', 8, 40, 0.2, 3);
    }
  }
  G.kingSwing = kingSwing;

  function kingHarvest(k, n, dt) {
    const kd = k.kingdom;
    let rate = KING.harvestRate;
    if (kd.faction.affinity === n.kind) rate *= 1.35;
    const took = harvestNode(world, n, rate * dt);
    if (took <= 0) return 0;
    /* straight into the treasury — no hauling, which is the whole point */
    const got = credit(kd, n.kind, took);
    kd.stats.kingGathered += got;
    k.carryFlash = 0.25;
    spendStamina(k, KING.harvestDrain * dt);
    const seen = onScreen(G.cam, k.x, k.y, 60);
    if (seen && Math.random() < dt * 10) {
      dust(G.fx, n.x + rnd(-12, 12), n.y,
        n.kind === 'wood' ? '#c89a5c' : n.kind === 'food' ? '#e8d47a' : '#ffd76e', 2);
      if (kd.isPlayer) {
        if (n.kind === 'wood') Sound.chop(); else if (n.kind === 'food') Sound.reap(); else Sound.mine();
      }
    }
    if (seen && Math.random() < dt * 2.2) {
      floatText(G.fx, k.x, k.y - 34, `+${RES_ICON[n.kind]}`, '#ffe08a', 0.7, 12);
    }
    return got;
  }
  G.kingHarvest = kingHarvest;

  function updateKing(k, dt) {
    if (!k.alive) return;
    const I = G.input;
    const kd = k.kingdom;
    const isPlayer = kd.isPlayer;

    if (isPlayer) {
      const ax = I.axis();

      /* The king faces where he walks, and keeps facing that way when he stops.
         No aiming device: the same stick that moves him also points him, which is
         what makes the contextual verb legible — whatever he is walking at is
         whatever Space will act on. */
      if (ax.dx || ax.dy) k.face = Math.atan2(ax.dy, ax.dx);
      const wantSprint = (I.keys.has('ShiftLeft') || I.keys.has('ShiftRight')) && k.stamina > 1;
      const sprinting = wantSprint && (ax.dx || ax.dy);
      const speed = k.speed * (sprinting ? KING.sprint : 1);

      if (ax.dx || ax.dy) {
        moveEntity(world, k, ax.dx, ax.dy, dt, speed);
        k.bob += dt * (sprinting ? 15 : 10);
        if (Math.random() < dt * (sprinting ? 26 : 11)) dust(G.fx, k.x, k.y + 12, '#e6dcc0', 1);
      }
      if (sprinting) spendStamina(k, KING.sprintDrain * dt);

      k.action = resolveAction(k);
      const acting = I.keys.has('Space') || (I.mouse.down && !G.ghost);
      if (acting && k.action) doAction(k, k.action, dt);

      if (I.took('KeyR') || I.tookVirtual('ability')) useAbility(G, kd);
      if (I.took('KeyF') || I.tookVirtual('dismiss')) dismiss(G, kd);
      if (I.took('Digit1') || I.tookVirtual('order-attack')) command(G, kd, ORDERS.ATTACK);
      if (I.took('Digit2') || I.tookVirtual('order-hold'))   command(G, kd, ORDERS.HOLD);
      if (I.took('Digit3') || I.tookVirtual('order-home'))   command(G, kd, ORDERS.HOME);
      if (I.took('Digit4') || I.tookVirtual('order-scout'))  command(G, kd, ORDERS.SCOUT);
    }

    if (k.charge) {
      updateCharge(G, k, dt);
      const ax2 = kd.isPlayer ? G.input.axis() : { dx: Math.cos(k.face), dy: Math.sin(k.face) };
      if (ax2.dx || ax2.dy) moveEntity(world, k, ax2.dx, ax2.dy, dt, k.speed * k.charge.speed);
    }

    /* stamina only returns after a beat of not spending — the pause is what
       stops the king harvesting and sprinting in the same breath */
    k.staminaIdle += dt;
    if (k.staminaIdle >= KING.staminaRest) {
      k.stamina = Math.min(KING.staminaMax, k.stamina + KING.staminaRegen * dt);
    }

    if (k.atkCd > 0) k.atkCd -= dt;
    if (k.abilityCd > 0) k.abilityCd -= dt;
    if (k.swing > 0) k.swing -= dt;
    if (k.carryFlash > 0) k.carryFlash -= dt;

    if (kd.castle && kd.castle.alive && dist(k, kd.castle) < 260) {
      healEntity(k, KING.regenNearCastle * dt);
    }
  }

  /* ── buildings ──────────────────────────────────────────────────────────── */

  function updateBuilding(b, dt) {
    if (!b.alive) return;
    const kd = b.kingdom;

    if (!b.built) { advanceBuild(G, b, dt); b.builders = 0; return; }

    if (!b.announced) {
      b.announced = true;
      report(G, kd, 'built', b.x, b.y, `${b.def.name} đã dựng xong`, 'built' + b.id);
    }

    if (b.def.trickle) {
      for (const [kind, rate] of Object.entries(b.def.trickle)) credit(kd, kind, rate * dt);
    }

    if (b.queue.length) {
      b.trainT -= dt;
      if (b.trainT <= 0) {
        const job = b.queue.shift();
        const stats = unitStats(kd.faction.id, job.cls);
        if (kd.pop + stats.pop <= kd.popCap) {
          const p = rallyPoint(b);
          const u = makeUnit(kd, job.cls, p.x, p.y);
          u.want = job.cls === 'worker' ? pick(['wood', 'food']) : null;
          u.post = { x: p.x, y: p.y };
          G.actors.push(u);
          burst(G.fx, p.x, p.y, kd.color, 8, 90);
          if (kd.isPlayer) Sound.train();
          hooks.onTrained?.(kd, u, b);
        } else {
          /* pop-capped: the order goes back on the front of the queue and the
             building idles — a courier will mention it */
          b.queue.unshift(job);
          b.trainT = 1.5;
          report(G, kd, 'blocked', b.x, b.y, `${b.def.name} đứng im: hết chỗ ở`, 'pop' + b.id);
          return;
        }
        b.trainT = b.queue.length ? unitStats(kd.faction.id, b.queue[0].cls).build : 0;
      }
    }

    if (b.def.attack) {
      b.atkCd -= dt;
      if (b.atkCd <= 0) {
        const near = queryHash(G.hash, b.x, b.y, b.def.attack.range, G.scratch);
        let best = null, bd = Infinity;
        for (const e of near) {
          if (!isHostile(b, e)) continue;
          const d = dist(b, e);
          if (d > b.def.attack.range || d >= bd) continue;
          bd = d; best = e;
        }
        if (best) {
          b.atkCd = b.def.attack.every;
          G.projectiles.push({
            x: b.x, y: b.y - 18, target: best, speed: 420, dmg: b.def.attack.dmg,
            glyph: '🏹', from: b, ranged: true
          });
        }
      }
    }

    /* the chicken nest, and anything else that spits units out for free */
    if (b.def.spawner) {
      b.spawnT -= dt;
      if (b.spawnT <= 0) {
        b.spawnT = b.def.spawner.every;
        const stats = unitStats(kd.faction.id, b.def.spawner.cls);
        if (kd.pop + stats.pop <= kd.popCap) {
          const p = rallyPoint(b);
          const u = makeUnit(kd, b.def.spawner.cls, p.x, p.y);
          u.post = { x: p.x, y: p.y };
          G.actors.push(u);
          confetti(G.fx, p.x, p.y, ['🐣', '🥚'], 6);
        }
      }
    }

    b.smoke = b.hp / b.maxHp < 0.34 ? (b.smoke + dt) : 0;
    if (b.smoke > 0 && Math.random() < dt * 6) {
      dust(G.fx, b.x + rnd(-14, 14), b.y - 10, '#6d6d6d', 1);
    }
    b.builders = 0;
  }

  /* Anything the king can see, he knows. Everything else has to be carried to
     him — including, at the top of the list, the first sight of an enemy king. */
  let watchT = 0;
  function watchForEnemies(dt) {
    watchT -= dt;
    if (watchT > 0) return;
    watchT = 1.1;
    const kd = G.player;

    for (const other of G.kingdoms) {
      if (other === kd || !other.king || !other.king.alive) continue;
      const seen = G.actors.some(a =>
        a.alive && a.kd === kd.id && a.kind === 'unit' && dist(a, other.king) < 320)
        || onScreen(G.cam, other.king.x, other.king.y);
      if (!seen) continue;
      other.seenBy = other.seenBy || new Set();
      if (other.seenBy.has(kd.id)) continue;
      other.seenBy.add(kd.id);
      report(G, kd, 'kingSeen', other.king.x, other.king.y,
        `Đã tìm ra vua ${other.faction.name}!`, 'king' + other.id);
    }

    /* hostiles standing among our own buildings */
    for (const b of kd.buildings) {
      if (!b.alive) continue;
      const near = queryHash(G.hash, b.x, b.y, 300, G.scratch);
      for (const e of near) {
        if (!e.alive || e.kd === kd.id || e.kd === -1 || e.kind === 'npc') continue;
        if (dist(b, e) > 300) continue;
        report(G, kd, 'spotted', b.x, b.y,
          `Quân địch xuất hiện gần ${b.def.name}`, 'spot' + b.id);
        break;
      }
    }
  }

  function onBuildingHit(b, dealt) {
    burst(G.fx, b.x + rnd(-16, 16), b.y + rnd(-10, 10), '#ffb066', 5, 80);
    floatText(G.fx, b.x, b.y - 26, '-' + dealt, '#ffb066', 0.7, 13);
    if (!b.alive) {
      burst(G.fx, b.x, b.y, '#ff8040', 26, 200, '💥');
      ring(G.fx, b.x, b.y, '#ffb066', 10, 110, 0.6, 4);
      if (onScreen(G.cam, b.x, b.y)) shakeCamera(G.cam, 9);
      report(G, b.kingdom, 'razed', b.x, b.y, `${b.def.name} đã bị san phẳng!`, 'raze' + b.id);
      razeBuilding(G, b);
    } else {
      report(G, b.kingdom, 'attacked', b.x, b.y, `${b.def.name} đang bị tấn công!`, 'atk' + b.id);
    }
  }
  G.onBuildingHit = onBuildingHit;

  /* ── projectiles ────────────────────────────────────────────────────────── */

  function updateProjectiles(dt) {
    for (let i = G.projectiles.length - 1; i >= 0; i--) {
      const p = G.projectiles[i];
      if (!p.target || !p.target.alive) { G.projectiles.splice(i, 1); continue; }
      const dx = p.target.x - p.x, dy = p.target.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const step = p.speed * dt;
      p.face = Math.atan2(dy, dx);
      if (d <= step + p.target.radius) {
        if (p.heal) healEntity(p.target, p.dmg);
        else if (p.target.kind === 'building') {
          onBuildingHit(p.target, applyDamage(p.target, p.dmg, { ranged: true, siege: p.siege || 1 }));
        } else {
          onHit(p.from, p.target, applyDamage(p.target, p.dmg, { ranged: true }));
        }
        G.projectiles.splice(i, 1);
      } else {
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
      }
    }
  }

  /* ── wildlife ───────────────────────────────────────────────────────────── */

  function updateCreep(c, dt) {
    if (c.atkCd > 0) c.atkCd -= dt;
    const near = queryHash(G.hash, c.x, c.y, 240, G.scratch);
    let best = null, bestD = Infinity;
    for (const e of near) {
      if (!e.alive || e.kd === -1 || e.kind === 'npc') continue;
      const d = dist(c, e);
      if (d < bestD) { bestD = d; best = e; }
    }
    const homeD = dist(c, c.post);

    if (best && bestD < 240 && homeD < c.leash) {
      c.state = 'chase';
      if (bestD > c.range + best.radius) moveToward(world, c, best.x, best.y, dt);
      else if (c.atkCd <= 0) {
        c.atkCd = c.atkEvery;
        onHit(c, best, applyDamage(best, c.dmg, {}));
      }
    } else if (homeD > 70) {
      c.state = 'return';
      moveToward(world, c, c.post.x, c.post.y, dt, c.speed * 0.7);
    } else {
      c.state = 'idle';
      c.idleT -= dt;
      if (c.idleT <= 0) {
        c.idleT = rnd(1.4, 3.6);
        c.wander = { x: c.post.x + rnd(-70, 70), y: c.post.y + rnd(-70, 70) };
      }
      if (c.wander) moveToward(world, c, c.wander.x, c.wander.y, dt, c.speed * 0.45);
    }
    c.bob += dt * 8;
  }

  /* ── shared reactions ───────────────────────────────────────────────────── */

  function onHit(from, target, dealt) {
    burst(G.fx, target.x, target.y - 8, '#ffdca8', 5, 90);
    floatText(G.fx, target.x, target.y - 22, '-' + dealt, '#ff9d9d', 0.7, 13);
    if (target.kind === 'king' && target.kingdom.isPlayer) shakeCamera(G.cam, 4);
    if (!target.alive) onDeath(target, from);
  }
  G.onHit = onHit;

  function onDeath(e, killer) {
    burst(G.fx, e.x, e.y, '#ff6b6b', 14, 150, e.glyph);
    ring(G.fx, e.x, e.y, '#ff8080', 6, 46, 0.4, 2);
    if (e.kingdom) {
      e.kingdom.stats.lost++;
      e.kingdom.pop = Math.max(0, e.kingdom.pop - (e.pop || 0));
    }
    if (killer && killer.kingdom) killer.kingdom.stats.killed++;
    if (e.kingdom && e.kind === 'unit' && !e.courier) {
      report(G, e.kingdom, 'lost', e.x, e.y, `Mất một ${e.name} ở nơi xa`, 'lost');
    }

    if (e.kind === 'king') {
      e.kingdom.alive = false;
      flash(G.fx, '#ff3b5c', 0.7);
      shakeCamera(G.cam, 18);
      Sound.death();
      const standing = G.kingdoms.filter(k => k.alive);
      G.over = {
        winner: standing.length === 1 ? standing[0] : (standing.includes(G.player) ? G.player : standing[0] || null),
        loser: e.kingdom, killer, time: G.time
      };
      G.running = false;
      hooks.onOver?.(G.over);
    }
  }
  G.onDeath = onDeath;

  /* ── the prompt ─────────────────────────────────────────────────────────── */

  /* `E` does three different jobs, so the prompt has to say which one it is
     about to do. Whatever is nearest wins — including a knot of soldiers, which
     is what stops the town's NPCs from swallowing every press near home. */
  function updatePrompt(k) {
    const kd = k.kingdom;
    let best = null, bd = INTERACT_RANGE;

    for (const n of G.npcs) {
      if (n.kd !== k.kd) continue;
      const d = dist(k, n);
      if (d < bd) { bd = d; best = { x: n.x, y: n.y - 26, label: n.name, kind: 'npc', ref: n }; }
    }
    for (const b of kd.buildings) {
      if (!b.alive || !b.built || !b.def.trains) continue;
      const d = dist(k, b) - b.radius;
      if (d < bd) { bd = d; best = { x: b.x, y: b.y - b.radius - 14, label: b.def.name, kind: 'building', ref: b }; }
    }

    if (kd.retinue.length < kd.retinueCap) {
      const near = queryHash(G.hash, k.x, k.y, ENLIST_RANGE, G.scratch);
      let n = 0, closest = null, cd = Infinity;
      for (const u of near) {
        if (!u.alive || u.kd !== k.kd || u.kind !== 'unit') continue;
        if (u.cls === 'worker' || u.courier || u.inRetinue) continue;
        const d = dist(k, u);
        if (d > ENLIST_RANGE) continue;
        n++;
        if (d < cd) { cd = d; closest = u; }
      }
      if (n && cd < bd) {
        const take = Math.min(n, kd.retinueCap - kd.retinue.length);
        best = {
          x: closest.x, y: closest.y - 26,
          label: `Chiêu mộ ${take} quân`, kind: 'enlist', ref: null
        };
      }
    }
    G.promptTarget = best;
  }

  /* ── the frame ──────────────────────────────────────────────────────────── */

  G.update = function (dt) {
    if (!G.running || G.paused) return;
    G.time += dt;

    rebuildHash(G.hash, G.actors);

    for (const kd of G.kingdoms) {
      if (!kd.king || !kd.king.alive) continue;
      if (kd.isPlayer) updateKing(kd.king, dt);
      else if (kd.ai) { updateAI(G, kd.ai, dt); updateAIKing(G, kd.ai, dt); }
    }

    /* auras are recomputed from nothing each tick, so walking out of a bell's
       range simply stops helping — no buff bookkeeping anywhere */
    for (const a of G.actors) clearAuras(a);
    for (const b of G.buildings) {
      if (b.alive && b.built && b.def.aura) applyAura(G, b, b.def.aura, dt);
    }
    for (const a of G.actors) {
      if (a.alive && a.aura) applyAura(G, a, a.aura, dt);
    }

    for (const a of G.actors) {
      if (!a.alive) continue;
      if (a.courier) continue;                       // couriers run, they do not fight
      if (a.creep) updateCreep(a, dt);
      else if (a.cls === 'worker') updateWorker(G, a, dt, workerHooks);
      else if (a.kind === 'unit') updateFighter(G, a, dt);
    }

    for (const kd of G.kingdoms) pruneRetinue(kd);
    for (const b of G.buildings) updateBuilding(b, dt);
    updateMessengers(G, dt);
    updateDuties(G, dt);
    watchForEnemies(dt);
    updateProjectiles(dt);

    separate(G.actors, 0.45);
    updateFx(G.fx, dt);

    const k = G.player.king;
    if (k && k.alive) {
      updatePrompt(k);
      if (G.input.took('KeyE') || G.input.tookVirtual('interact')) {
        /* the same key talks and recruits: whoever is closest wins, and if that
           is nobody, it reaches out for soldiers instead */
        if (G.promptTarget?.kind === 'enlist' || !G.promptTarget) enlist(G, G.player);
        else hooks.onInteract?.(G.promptTarget);
      }
    }

    updateCamera(G.cam, k, dt);

    for (let i = G.actors.length - 1; i >= 0; i--) {
      const a = G.actors[i];
      if (a.alive) continue;
      if (a.kingdom) {
        const j = a.kingdom.units.indexOf(a);
        if (j >= 0) a.kingdom.units.splice(j, 1);
      }
      G.actors.splice(i, 1);
    }
    for (let i = G.buildings.length - 1; i >= 0; i--) {
      if (!G.buildings[i].alive) G.buildings.splice(i, 1);
    }

    G.input.endFrame();
  };

  /* ── drawing ────────────────────────────────────────────────────────────── */

  function drawBuilding(R, b) {
    const size = b.foot * TILE;
    const col = b.kingdom.color;

    /* territory glow — faint, but it is the only thing telling you whose ground
       you are standing on */
    R.circle(b.x, b.y, size * 0.62, col, 0, 0.06);
    R.rect(b.x - size / 2, b.y - size / 2, size, size, '#0d1a14', b.built ? 0.5 : 0.34);
    R.circle(b.x, b.y, size * 0.46, col, 2, b.built ? 0.5 : 0.25);

    if (b.built) {
      R.glyph(b.x, b.y - 4, b.def.glyph, size * 0.72);
    } else {
      R.glyph(b.x, b.y - 4, b.def.glyph, size * 0.6, 0.35);
      R.glyph(b.x, b.y + 2, '🚧', size * 0.42, 0.9);
      R.bar(b.x, b.y + size / 2 - 6, size * 0.8, 5, b.progress, '#ffc247');
      if (b.builders > 0) R.text(b.x, b.y - size / 2 - 12, `⚒ ${b.builders}`, 11, '#ffe08a');
    }

    if (b.hp < b.maxHp && b.built) {
      const f = b.hp / b.maxHp;
      R.bar(b.x, b.y - size / 2 - 10, size * 0.8, 4, f, f > 0.5 ? '#5ce07a' : f > 0.25 ? '#ffc247' : '#ff5470');
    }
    if (b.queue.length) {
      R.text(b.x, b.y + size / 2 + 8, `⏳ ${b.queue.length}`, 11, '#ffe08a');
    }
  }

  function drawActor(R, e) {
    const bob = Math.sin(e.bob) * 2;
    R.shadow(e.x, e.y + 10, e.radius * 0.85, 0.3);
    if (e.kingdom) R.circle(e.x, e.y + 10, e.radius * 0.95, e.kingdom.color, 2, 0.7);
    else R.circle(e.x, e.y + 10, e.radius * 0.95, '#8d99ae', 2, 0.45);

    const size = e.kind === 'king' ? 40 : e.kind === 'npc' ? 30 : e.radius * 2.3;
    R.glyph(e.x, e.y - 4 + bob, e.glyph, size);

    if (e.kind === 'king') {
      R.glyph(e.x, e.y - 26 + bob, '👑', 20);
      if (e.swing > 0) {
        const a = e.face;
        R.circle(e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30, 20, '#fff3c4', 3, e.swing / 0.18);
      }
    } else if (e.badge) {
      R.glyph(e.x + e.radius * 0.75, e.y - e.radius * 0.7 + bob, e.badge, 13);
    }

    /* what a worker is carrying, shown on the worker — no inventory panel */
    if (e.carry > 0 && e.carryKind) {
      R.glyph(e.x - e.radius * 0.8, e.y - e.radius - 4, RES_ICON[e.carryKind], 12, 0.95);
    }

    if (e.hp < e.maxHp) {
      const f = e.hp / e.maxHp;
      R.bar(e.x, e.y - e.radius - 16, e.radius * 2.4, 4, f,
        f > 0.5 ? '#5ce07a' : f > 0.22 ? '#ffc247' : '#ff5470');
    }
  }

  function drawGhost(R) {
    const g = G.ghost;
    if (!g) return;
    const def = g.def;
    const size = def.foot * TILE;
    const c = centerOf(def, g.tx, g.ty);
    const ok = g.error === null;
    const col = ok ? '#5ce07a' : '#ff5470';
    R.rect(c.x - size / 2, c.y - size / 2, size, size, col, 0.2);
    R.circle(c.x, c.y, size * 0.5, col, 2, 0.9);
    R.glyph(c.x, c.y - 4, def.glyph, size * 0.62, 0.75);
    if (!ok) R.text(c.x, c.y + size / 2 + 12, g.error, 12, col);
  }

  G.draw = function () {
    const R = G.R;
    R.begin(G.cam);
    R.clear('#0a1410');
    R.drawTerrain(world, G.time);

    /* build-range hint while placing: you can only creep outward from what you
       already own, so it needs to be visible at the moment it matters */
    if (G.ghost) {
      for (const b of G.player.buildings) {
        if (!b.alive) continue;
        R.circle(b.x, b.y, BUILD_RANGE, '#5ce07a', 1, 0.1);
      }
    }

    for (const b of G.buildings) drawBuilding(R, b);

    const drawList = [...G.actors, ...G.npcs].sort((a, b) => a.y - b.y);
    for (const a of drawList) drawActor(R, a);

    for (const p of G.projectiles) R.glyph(p.x, p.y, p.glyph, 15, 1, p.face || 0);

    drawGhost(R);
    R.drawFx(G.fx);
    R.drawDaylight(G.time);
    R.drawFlash(G.fx);

    /* what pressing Space would do, right under the crosshair */
    const k = G.player.king;
    if (k && k.alive && k.action) {
      const a = k.action;
      const label = a.type === 'harvest' ? ACTION_VERB.harvest[a.target.kind] : ACTION_VERB[a.type];
      R.text(k.x, k.y + 34, label, 12, '#ffe08a', 'center', 700, 0.85);
    }
  };

  /* Pull the nearest workers onto a fresh site. Nobody selects units in this
     game, so construction has to staff itself — the king can add his own hands
     by standing there and holding Space. */
  G.assignBuilders = function (b, n = 2) {
    const pool = b.kingdom.units
      .filter(u => u.alive && u.cls === 'worker' && (!u.site || !u.site.alive))
      .sort((p, q) => dist(p, b) - dist(q, b));
    for (const u of pool.slice(0, n)) { u.site = b; u.node = null; }
  };

  /* Used by the builder panel's rush option and by the AI. */
  G.addBuilder = function (b) {
    const pool = b.kingdom.units
      .filter(u => u.alive && u.cls === 'worker' && u.site !== b)
      .sort((p, q) => dist(p, b) - dist(q, b));
    if (pool[0]) { pool[0].site = b; pool[0].node = null; }
  };

  G.grantDutyReward = function (duty) {
    const kd = G.player, r = duty.reward;
    if (r.food) credit(kd, 'food', r.food);
    if (r.wood) credit(kd, 'wood', r.wood);
    if (r.gold) credit(kd, 'gold', r.gold);
    if (r.retinue) kd.retinueCap = Math.min(24, kd.retinueCap + 4);
    if (r.item) {
      const it = ITEMS[r.item];
      kd.items[r.item] = (kd.items[r.item] || 0) + 1;
      if (it && !it.consumable) it.apply(kd.king);
    }
    if (r.unit) {
      const k = kd.king;
      const u = makeUnit(kd, r.unit, k.x + rnd(-40, 40), k.y + 60);
      u.post = { x: u.x, y: u.y };
      G.actors.push(u);
    }
    confetti(G.fx, kd.king.x, kd.king.y - 20, ['✨', '👑', duty.icon], 14);
    Sound.done();
  };

  G.snapCameraToKing = function () { snapCamera(G.cam, G.player.king); };

  G.resize = function (w, h, dpr = 1) {
    G.R.dpr = dpr;
    resizeCamera(G.cam, w, h);
  };
  G.start = function () { G.running = true; };

  return G;
}
