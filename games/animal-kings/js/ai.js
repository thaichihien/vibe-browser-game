/* The enemy kingdom's brain.

   One instance per AI kingdom, thinking on its own clock. Difficulty is a table
   of behaviour knobs — how often it thinks, how well it spends, whether it
   scouts, how it micros, and what its king does with itself. **No level cheats
   on resources.** A harder opponent is not a richer one; it is one that wastes
   less time and takes more initiative. */

import { TILE, ORDERS, POP_MAX, clamp, dist, rnd, pick } from './config.js';
import { unitStats, CLASS_ORDER } from './factions.js';
import {
  BUILDINGS, defOf, canPlace, placeBuilding, canTrain, enqueue, bestProducer, centerOf
} from './buildings.js';
import { canAfford } from './entities.js';
import { moveToward, queryHash } from './units.js';
import { useAbility, marchTo, AGGRO } from './combat.js';
import { nearestNode, reachableTile } from './world.js';

export const PROFILES = [
  {
    name: 'Dễ', think: 2.8, initiative: 0.45, scout: 0, micro: 0,
    kingMode: 'home', harass: 0, pushAt: 15, workers: 6, expand: false
  },
  {
    name: 'Thường', think: 1.7, initiative: 0.75, scout: 0.3, micro: 1,
    kingMode: 'defend', harass: 0.12, pushAt: 11, workers: 9, expand: true
  },
  {
    name: 'Khó', think: 1.0, initiative: 0.95, scout: 0.7, micro: 2,
    kingMode: 'push', harass: 0.45, pushAt: 8, workers: 13, expand: true
  },
  {
    name: 'Bạo Chúa', think: 0.6, initiative: 1, scout: 1, micro: 3,
    kingMode: 'hunt', harass: 0.9, pushAt: 6, workers: 16, expand: true
  }
];

/* What to build next, asked fresh every time rather than read off a script.

   A fixed build order looked fine until the AI ran out of food halfway down it
   and sat on the same unaffordable entry for the rest of the match. Deciding
   from the current state instead means it can notice it is starving and put up
   another farm. */
function nextBuilding(kd, ai) {
  const has = key => kd.buildings.filter(b => b.alive && b.key === key).length;

  /* The barracks is the only thing that makes units — workers included — so
     until it exists the kingdom cannot grow at all. It comes first, always. */
  if (has('barracks') < 1) return 'barracks';
  if (has('farm') < 1) return 'farm';
  if (has('lumber') < 1) return 'lumber';
  /* Extra barracks are worth more than anything else once one queue is the
     bottleneck on both the economy and the army. The harder profiles open more
     of them, which is most of why their armies arrive sooner. */
  if (has('barracks') < 2 + Math.floor(ai.level / 2)) return 'barracks';
  if (kd.res.food < 170 && has('farm') < 4) return 'farm';        // starving
  if (ai.p.expand && has('outpost') < 1) return 'outpost';
  if (has('tower') < 1 + ai.level) return 'tower';
  if (has('shrine') < 1) return 'shrine';
  const own = kd.faction.building?.key;
  if (own && has(own) < 2) return own;
  if (has('farm') < 6) return 'farm';
  return 'tower';
}

export function makeAI(G, kd, level = 1) {
  const p = PROFILES[clamp(level, 0, 3)];
  return {
    kd, level, p,
    t: rnd(0, p.think),
    phase: 'open',
    orderIndex: 0,
    scoutT: 20,
    pushT: 0,
    kingGoal: null,
    kingHarvest: null,
    targetKingdom: null
  };
}

/* ── the tick ─────────────────────────────────────────────────────────────── */

export function updateAI(G, ai, dt) {
  const kd = ai.kd;
  if (!kd.alive || !kd.king || !kd.king.alive) return;

  ai.t -= dt;
  if (ai.t > 0) return;
  ai.t = ai.p.think;

  ai.targetKingdom = pickTarget(G, kd);

  const threat = threatAtHome(G, kd);
  ai.phase = threat ? 'defend' : ai.phase;

  /* Order matters now that workers and troops share one queue: construction
     first, then the army claims its slots, then the economy fills whatever is
     left. Run the economy first and a Bạo Chúa reaches ninety seconds with
     seventeen peasants and no soldiers. */
  construction(G, ai);
  military(G, ai, threat);
  economy(G, ai);
  scouting(G, ai);
}

function pickTarget(G, kd) {
  let best = null, bd = Infinity;
  for (const other of G.kingdoms) {
    if (other === kd || !other.alive || !other.king) continue;
    const d = dist(kd.king, other.king);
    if (d < bd) { bd = d; best = other; }
  }
  return best;
}

/* Anything hostile standing among our own buildings. This is the only thing that
   overrides whatever the AI was doing. */
function threatAtHome(G, kd) {
  for (const b of kd.buildings) {
    if (!b.alive) continue;
    const near = queryHash(G.hash, b.x, b.y, 340, G.scratch);
    for (const e of near) {
      if (!e.alive || e.kd === kd.id || e.kind === 'npc') continue;
      if (e.kd === -1) continue;                   // wildlife is not an invasion
      if (dist(b, e) < 340) return { x: e.x, y: e.y, who: e };
    }
  }
  return null;
}

/* ── economy ──────────────────────────────────────────────────────────────── */

function economy(G, ai) {
  const kd = ai.kd;
  if (Math.random() > ai.p.initiative) return;

  const workers = kd.units.filter(u => u.alive && u.cls === 'worker');

  /* Workers eat the same food the army does. Past the opening six, only hire
     when there is a surplus — otherwise the AI drowns its own barracks in
     peasants and never fields an army. */
  const affordable = workers.length < 6 || kd.res.food > 150;
  if (workers.length < ai.p.workers && affordable) {
    const b = bestProducer(kd, 'worker');
    const s = unitStats(kd.faction.id, 'worker');
    /* During the opening six, workers may share a busy queue — an AI that puts
       soldiers ahead of every peasant fields ten troops and four workers and
       then starves. After that, workers only get an idle queue. */
    const opening = workers.length < 6;
    if (b && b.queue.length <= (opening ? 1 : 0) && !canTrain(kd, b, 'worker', s)) {
      enqueue(kd, b, 'worker', s);
    }
  }

  /* keep the two safe resources balanced by retasking idle hands rather than by
     any global bookkeeping */
  const wantWood = kd.res.wood < kd.res.food * 0.75;
  for (const w of workers) {
    if (w.site) continue;
    const want = wantWood ? 'wood' : 'food';
    if (w.want !== want && (!w.node || w.node.spent)) { w.want = want; w.node = null; }
  }

  /* gold only flows once something can bank it, so a claimed seam needs workers
     told to go and use it */
  const goldDrop = kd.buildings.find(b => b.alive && b.built && b.def.dropoff === true && b.key === 'outpost');
  if (goldDrop && kd.res.gold < 260) {
    const diggers = workers.filter(w => w.want === 'gold').length;
    if (diggers < 3) {
      const spare = workers.find(w => w.want !== 'gold' && !w.site);
      if (spare) { spare.want = 'gold'; spare.node = null; }
    }
  }
}

/* ── construction ─────────────────────────────────────────────────────────── */

function construction(G, ai) {
  const kd = ai.kd;
  if (Math.random() > ai.p.initiative) return;
  if (kd.buildings.some(b => b.alive && !b.built)) return;   // one site at a time

  const key = nextBuilding(kd, ai);
  const def = defOf(kd, key);
  if (!def || !canAfford(kd, def.cost)) return;

  /* an outpost is only worth it next to gold nobody has claimed */
  const anchor = key === 'outpost' ? goldAnchor(G, kd) : kd.castle;
  if (!anchor) return;

  const spot = findSpot(G, kd, def, anchor, key === 'outpost' ? 4 : 3);
  if (!spot) return;

  const b = placeBuilding(G, kd, def, spot.tx, spot.ty);
  if (b) {
    G.assignBuilders(b, ai.level >= 2 ? 3 : 2);
    ai.built = key;
  }
}

/* the nearest gold seam we have not already parked on */
function goldAnchor(G, kd) {
  const home = kd.castle || kd.king;
  const n = nearestNode(G.world, home.x, home.y, 'gold', 60);
  if (!n) return null;
  if (kd.buildings.some(b => b.alive && dist(b, n) < 300)) return null;
  return n;
}

/* spiral out from an anchor for the first legal footprint */
function findSpot(G, kd, def, anchor, minRing = 3) {
  const atx = Math.floor(anchor.x / TILE), aty = Math.floor(anchor.y / TILE);
  for (let r = minRing; r <= 14; r++) {
    const ring = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        ring.push([atx + dx, aty + dy]);
      }
    }
    /* shuffled so an AI town does not grow in a perfect spiral */
    for (let i = ring.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ring[i], ring[j]] = [ring[j], ring[i]];
    }
    for (const [tx, ty] of ring) {
      if (canPlace(G, kd, def, tx, ty)) return { tx, ty };
    }
  }
  return null;
}

/* ── military ─────────────────────────────────────────────────────────────── */

function military(G, ai, threat) {
  const kd = ai.kd;
  const army = kd.units.filter(u => u.alive && u.cls !== 'worker');

  /* keep the barracks busy — composition leans on the faction's own roster */
  if (Math.random() <= ai.p.initiative) {
    for (const cls of composition(kd, army, ai)) {
      const b = bestProducer(kd, cls);
      if (!b || b.queue.length >= 2) continue;
      const s = unitStats(kd.faction.id, cls);
      if (canTrain(kd, b, cls, s)) continue;
      enqueue(kd, b, cls, s);
      break;
    }
  }

  if (threat) {
    /* everything comes home, including anything already marching out */
    for (const u of army) {
      u.inRetinue = false;
      u.order = ORDERS.ATTACK;
      u.goal = { x: threat.x + rnd(-50, 50), y: threat.y + rnd(-50, 50) };
      u.post = null;
    }
    kd.retinue.length = 0;
    ai.phase = 'defend';
  } else if (army.length >= ai.p.pushAt) {
    const target = ai.targetKingdom;
    if (target) {
      const aim = target.castle && target.castle.alive ? target.castle : target.king;
      for (const u of army) {
        if (u.order === ORDERS.ATTACK && u.goal) continue;
        u.order = ORDERS.ATTACK;
        u.goal = { x: aim.x + rnd(-90, 90), y: aim.y + rnd(-90, 90) };
        u.post = null;
      }
      ai.phase = 'push';
    }
  } else if (ai.p.harass > 0 && Math.random() < ai.p.harass * 0.25 && army.length >= 3) {
    /* a small raid at the enemy's workers, which is worse for them than a fight */
    const target = ai.targetKingdom;
    if (target && target.castle) {
      const raiders = army.filter(u => u.order !== ORDERS.ATTACK).slice(0, 2);
      for (const u of raiders) {
        u.order = ORDERS.ATTACK;
        u.goal = { x: target.castle.x + rnd(-200, 200), y: target.castle.y + rnd(-200, 200) };
      }
    }
  } else {
    ai.phase = army.length ? 'mass' : 'econ';
  }

  /* higher levels pull wounded units out rather than feeding them in */
  if (ai.p.micro >= 2) {
    for (const u of army) {
      if (u.hp / u.maxHp < 0.28 && kd.castle) {
        u.order = ORDERS.HOME;
        u.goal = { x: kd.castle.x + rnd(-60, 60), y: kd.castle.y + 100 };
        u.target = null;
      }
    }
  }
}

function composition(kd, army, ai) {
  const has = cls => army.filter(u => u.cls === cls).length;
  const wants = [];
  /* nothing else matters until there is *an* army */
  if (army.length < 3) return ['warrior'];
  const shrine = kd.buildings.some(b => b.alive && b.built && b.key === 'shrine');
  if (shrine && has('champion') < 2 + ai.level) wants.push('champion');
  if (has('warrior') < 4 + ai.level * 2) wants.push('warrior');
  if (has('ranged') < 2 + ai.level) wants.push('ranged');
  if (has('scout') < 2) wants.push('scout');
  wants.push('warrior');
  return wants;
}

/* ── scouting ─────────────────────────────────────────────────────────────── */

function scouting(G, ai) {
  if (ai.p.scout <= 0) return;
  ai.scoutT -= ai.p.think;
  if (ai.scoutT > 0) return;
  ai.scoutT = 55 / ai.p.scout;

  const kd = ai.kd;
  const target = ai.targetKingdom;
  if (!target) return;
  const scout = kd.units.find(u => u.alive && u.cls === 'scout' && u.order !== ORDERS.SCOUT);
  if (!scout) return;
  scout.order = ORDERS.SCOUT;
  scout.goal = { x: target.king.x + rnd(-300, 300), y: target.king.y + rnd(-300, 300) };
  scout.post = null;
}

/* ── the AI's own king ────────────────────────────────────────────────────── */

/* Called every frame, not on the think clock — a king that stutters reads as
   broken in a way a slow build order does not. */
export function updateAIKing(G, ai, dt) {
  const kd = ai.kd, k = kd.king;
  if (!k || !k.alive) return;

  if (k.atkCd > 0) k.atkCd -= dt;
  if (k.abilityCd > 0) k.abilityCd -= dt;
  if (k.swing > 0) k.swing -= dt;
  k.staminaIdle += dt;
  if (k.staminaIdle >= 0.55) k.stamina = Math.min(100, k.stamina + 13 * dt);

  /* something adjacent always outranks the plan */
  const near = queryHash(G.hash, k.x, k.y, AGGRO, G.scratch);
  let foe = null, fd = Infinity;
  for (const e of near) {
    if (!e.alive || e.kd === kd.id || e.kind === 'npc') continue;
    const d = dist(k, e);
    if (d < fd) { fd = d; foe = e; }
  }

  if (foe && fd < AGGRO) {
    k.face = Math.atan2(foe.y - k.y, foe.x - k.x);
    if (fd > k.range) moveToward(G.world, k, foe.x, foe.y, dt);
    else if (k.atkCd <= 0 && k.stamina > 4) {
      k.atkCd = k.atkEvery;
      k.swing = 0.18;
      k.stamina -= 3; k.staminaIdle = 0;
      G.kingSwing(k);
    }
    /* the higher levels actually use their signature move in a fight */
    if (ai.p.micro >= 2 && k.abilityCd <= 0) useAbility(G, kd);
    return;
  }

  const goal = kingGoal(G, ai);
  if (!goal) { aiKingHarvest(G, ai, k, dt); return; }
  if (dist(k, goal) > 90) {
    marchTo(G, k, goal, dt);
  } else {
    aiKingHarvest(G, ai, k, dt);
  }
}

function kingGoal(G, ai) {
  const kd = ai.kd;
  const mode = ai.p.kingMode;
  const castle = kd.castle;

  if (mode === 'hunt' && ai.phase === 'push') {
    /* Bạo Chúa sends the win condition after yours — but only behind an army.
       A king who walks across the map alone at minute one is not the hardest
       opponent, he is a free kill. */
    const t = ai.targetKingdom;
    if (t && t.king && t.king.alive) return { x: t.king.x, y: t.king.y };
  }
  if (mode === 'push' && ai.phase === 'push') {
    const t = ai.targetKingdom;
    if (t && t.castle) return { x: t.castle.x, y: t.castle.y + 120 };
  }
  if (mode === 'defend' || mode === 'push' || mode === 'hunt') {
    if (ai.phase === 'defend') {
      const threat = threatAtHome(G, kd);
      if (threat) return threat;
    }
  }
  return castle ? { x: castle.x, y: castle.y + 110 } : null;
}

/* An idle AI king does what a player's king does early: picks up an axe. */
function aiKingHarvest(G, ai, k, dt) {
  if (k.stamina < 25) { ai.kingHarvest = null; return; }
  if (!ai.kingHarvest || ai.kingHarvest.spent) {
    ai.kingHarvest = nearestNode(G.world, k.x, k.y, ai.kd.faction.affinity, 12);
  }
  const n = ai.kingHarvest;
  if (!n) return;
  if (dist(k, n) > 46) { moveToward(G.world, k, n.x, n.y, dt); return; }
  k.face = Math.atan2(n.y - k.y, n.x - k.x);
  G.kingHarvest(k, n, dt);
}
