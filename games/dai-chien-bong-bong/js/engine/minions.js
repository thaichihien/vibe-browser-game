/* Monsters.
 *
 * Two rules carry the whole feel of Crazy Arcade's monster mode, and both are
 * here:
 *
 * 1. **Touching one costs you a life outright.** No bubble, no struggle, no
 *    rescue. A monster is not damage, it is a wall that moves, and a stage is a
 *    routing problem before it is a shooting problem.
 *
 * 2. **They do not avoid water.** Luring a monster into a blast you already
 *    placed is *the* way you kill things in this mode — 버럭이를 잘 유인해서
 *    잡는 것이 좋다, "the trick is to bait the rusher in". An AI that sidestepped
 *    puddles would delete the entire skill.
 *
 * Movement comes from the stage script, not from an AI deciding what to do:
 * 'h'/'v' patrol one axis and reverse at anything solid, 'chase' comes for you,
 * 'still' waits. Because a balloon counts as solid, walling a patroller into a
 * dead end with your own bombs is a legitimate — and intended — way to pin it.
 *
 * Reactions to water, one per raid:
 *   🎱 🧨 🥚  die on the first hit
 *   ⛄        freezes; a player must *touch* it to shatter it, and it thaws
 *   🐊        shrivels; needs a second hit before it recovers
 */

import { TILE, MONSTER, CONTACT_RANGE, HURRY_AT, HURRY_MUL } from '../config.js';
import { DIRS } from './grid.js';
import { solidFor, emit } from './state.js';
import { killPlayer } from './players.js';
import { flood } from './balloons.js';

let nextId = 1;

export function createMonster(spec) {
  const def = MONSTER[spec.kind];
  return {
    id: nextId++,
    kind: spec.kind,
    spec,
    home: { c: spec.c, r: spec.r },
    c: spec.c, r: spec.r,
    x: spec.c * TILE + TILE / 2,
    y: spec.r * TILE + TILE / 2,
    move: spec.move || 'still',
    speedMul: spec.speed || 1,
    dir: null,
    state: 'walk',            // walk | frozen | shrivel
    timer: 0,
    hatch: def.hatchAt || 0,
    revive: spec.revive || 0,
    reviveIn: 0,
    dead: false,
    hitCd: 0,
    reaped: 0,
  };
}

export function spawnMonster(state, spec) {
  const m = createMonster(spec);
  state.monsters.push(m);
  return m;
}

export const aliveMonsters = (state) => state.monsters.filter(m => !m.dead);

/* A wake trigger from the stage: 'kill' when the first monster dies, or 'time'
 * on a tick. Half a CA stage stands frozen until you commit to the first kill. */
export function wakeMonsters(state, trigger, t = 0) {
  for (const m of state.monsters) {
    const w = m.spec.wake;
    if (!w || m.woke || m.dead) continue;
    const due = (trigger === 'kill' && w.onKill) || (trigger === 'time' && w.at != null && t >= w.at);
    if (!due) continue;
    m.woke = true;
    if (w.move) m.move = w.move;
    if (w.speed) m.speedMul *= w.speed;
    state.fx.push({ kind: 'wake', x: m.x, y: m.y, life: 0.5, max: 0.5 });
  }
}

function speedOf(state, m) {
  let s = MONSTER[m.kind].speed * m.speedMul;
  /* Everything speeds up once the stage drags — CA's way of saying "stop
   * farming and finish it". */
  if (state.t >= HURRY_AT) s *= HURRY_MUL;
  return s;
}

const open = (state, c, r) =>
  state.grid.inBounds(c, r) && !solidFor(state, null, c, r);

function chaseDir(state, m) {
  let best = null, bestD = Infinity;
  for (const p of state.players) {
    if (!p.alive || p.down) continue;
    const d = Math.abs(p.x - m.x) + Math.abs(p.y - m.y);
    if (d < bestD) { bestD = d; best = p; }
  }
  const opts = [];
  for (const [dx, dy] of DIRS) {
    if (!open(state, m.c + dx, m.r + dy)) continue;
    let score = state.rand() * 0.8;
    if (best) {
      const before = Math.abs((m.c + 0.5) * TILE - best.x) + Math.abs((m.r + 0.5) * TILE - best.y);
      const after = Math.abs((m.c + dx + 0.5) * TILE - best.x) + Math.abs((m.r + dy + 0.5) * TILE - best.y);
      score += (before - after) / TILE * 2;
    }
    /* Deliberately no penalty for water: walking into your blast is how these
     * things are supposed to die. */
    if (m.dir && dx === -m.dir[0] && dy === -m.dir[1]) score -= 1.5;
    opts.push({ dir: [dx, dy], score });
  }
  if (!opts.length) return null;
  opts.sort((a, b) => b.score - a.score);
  return opts[0].dir;
}

function patrolDir(state, m) {
  const axis = m.move === 'h' ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
  const onAxis = m.dir && axis.some(([dx, dy]) => dx === m.dir[0] && dy === m.dir[1]);
  const cur = onAxis ? m.dir : axis[Math.floor(state.rand() * 2)];
  if (open(state, m.c + cur[0], m.r + cur[1])) return cur;
  const back = [-cur[0], -cur[1]];
  if (open(state, m.c + back[0], m.r + back[1])) return back;
  return null;                     // pinned — walled in, which is a valid play
}

/* ── water ────────────────────────────────────────────────────────────── */

export function soakMonster(state, m, owner) {
  if (m.dead || m.hitCd > 0) return;
  const def = MONSTER[m.kind];
  m.hitCd = 0.3;

  if (def.die === 'instant') { killMonster(state, m, owner); return; }

  if (def.die === 'freeze') {
    if (m.state === 'walk') {
      m.state = 'frozen';
      m.timer = def.freeze;
      m.dir = null;
    }
    return;
  }

  if (def.die === 'shrivel') {
    if (m.state === 'walk') {
      m.state = 'shrivel';
      m.timer = def.shrivel;
      m.dir = null;
    } else if (m.state === 'shrivel') {
      killMonster(state, m, owner);
    }
  }
}

export function killMonster(state, m, by = -1) {
  if (m.dead) return;
  m.dead = true;
  m.reaped = 0;
  state.kills += 1;
  state.fx.push({ kind: 'pop', x: m.x, y: m.y, life: 0.5, max: 0.5 });
  emit(state, 'pop');

  /* A dying rusher takes a small cross with it, the way CA's cannonballs do. */
  if (m.kind === 'rusher') {
    const c = state.grid.colOf(m.x), r = state.grid.rowOf(m.y);
    flood(state, c, r, by, false);
    for (const [dx, dy] of DIRS) flood(state, c + dx, r + dy, by, false);
  }

  if (m.revive > 0) {
    m.revive -= 1;
    m.reviveIn = 2.5;
  }
  /* The first kill in a stage is a trigger the level design leans on. */
  if (!state.firstKill) {
    state.firstKill = true;
    wakeMonsters(state, 'kill');
  }
}

/* ── per-frame ────────────────────────────────────────────────────────── */

export function updateMonsters(state, dt) {
  for (const m of state.monsters) {
    if (m.dead) {
      m.reaped += dt;
      if (m.reviveIn > 0) {
        m.reviveIn -= dt;
        if (m.reviveIn <= 0) respawn(state, m);
      }
      continue;
    }
    if (m.hitCd > 0) m.hitCd -= dt;

    /* water underfoot */
    const c = state.grid.colOf(m.x), r = state.grid.rowOf(m.y);
    const w = state.water.get(state.grid.idx(c, r));
    if (w && w.owner >= 0) soakMonster(state, m, w.owner);

    /* eggs hatch into the raid's real monster if you leave them alone */
    if (m.hatch > 0) {
      m.hatch -= dt;
      if (m.hatch <= 0) {
        m.kind = MONSTER[m.kind].hatch;
        m.move = 'chase';
        m.state = 'walk';
        state.fx.push({ kind: 'wake', x: m.x, y: m.y, life: 0.6, max: 0.6 });
      }
    }

    /* frozen / shrivelled: helpless, and harmless to touch */
    if (m.state !== 'walk') {
      m.timer -= dt;
      if (m.state === 'frozen') {
        for (const p of state.players) {
          if (!p.alive || p.down || p.bubble) continue;
          if (near(p, m)) { killMonster(state, m, p.id); break; }
        }
      }
      if (!m.dead && m.timer <= 0) { m.state = 'walk'; m.hitCd = 0.35; }
      continue;
    }

    stepMonster(state, m, dt);

    /* Contact. A monster on its feet costs you a life, full stop. */
    for (const p of state.players) {
      if (!p.alive || p.down || p.invuln > 0) continue;
      if (!near(p, m)) continue;
      killPlayer(state, p, 'monster');
      break;
    }
  }

  state.monsters = state.monsters.filter(m => !m.dead || m.reaped <= 0.6 || m.reviveIn > 0);
}

function near(p, m) {
  return Math.abs(p.x - m.x) < TILE * CONTACT_RANGE &&
         Math.abs(p.y - m.y) < TILE * CONTACT_RANGE;
}

function stepMonster(state, m, dt) {
  if (m.move === 'still') return;
  if (!m.dir) {
    const dir = m.move === 'chase' ? chaseDir(state, m) : patrolDir(state, m);
    if (!dir) return;
    m.dir = dir;
    m.c += dir[0];
    m.r += dir[1];
  }
  const tx = m.c * TILE + TILE / 2, ty = m.r * TILE + TILE / 2;
  const step = speedOf(state, m) * dt;
  const dx = tx - m.x, dy = ty - m.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= step) {
    m.x = tx; m.y = ty;
    /* Arrived. Patrollers keep their heading so they read as marching; chasers
     * re-decide from scratch. */
    if (m.move === 'chase') m.dir = null;
    else if (!open(state, m.c + m.dir[0], m.r + m.dir[1])) m.dir = null;
    else { m.c += m.dir[0]; m.r += m.dir[1]; }
  } else {
    m.x += (dx / dist) * step;
    m.y += (dy / dist) * step;
  }
}

function respawn(state, m) {
  m.dead = false;
  m.state = 'walk';
  m.c = m.home.c; m.r = m.home.r;
  m.x = m.c * TILE + TILE / 2;
  m.y = m.r * TILE + TILE / 2;
  m.dir = null;
  m.hitCd = 0.4;
  state.fx.push({ kind: 'wake', x: m.x, y: m.y, life: 0.6, max: 0.6 });
}
