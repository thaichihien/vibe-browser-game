/* The boss.
 *
 * Plain HP, counted in hits. You bomb it until it dies — that is what Crazy
 * Arcade does, and the difficulty is meant to live in its patterns and in the
 * shape of the room, not in a meter you have to decode. What HP buys you here
 * is legibility: eight 💧 pips over its head, each one worth a few bombs.
 *
 * Movement is deliberately dumb — most CA bosses slide along a single axis, and
 * that is precisely what makes them killable: a boss whose next position you
 * can predict is a boss you can 걸치기 against, standing with your centre on a
 * dry tile and your body over its edge, feeding it bombs while its spray goes
 * past you. Water contact and body contact are both judged on your centre tile
 * alone, which is what makes that stance work at all.
 *
 * Touching the boss costs a life outright, exactly like touching a monster.
 */

import {
  TILE, BOSS_HIT_COOLDOWN, BOSS_STAGGER, STAGGER_AT_HITS, STAGGER_WINDOW,
  PHASE_AT, PHASE_INVULN, SOLO_HP, CONTACT_RANGE,
} from '../config.js';
import { HARD, SOFT, EMPTY } from './grid.js';
import { cast, covers, bossCenter } from './abilities.js';
import { killPlayer } from './players.js';
import { emit } from './state.js';

export function createBoss(def, marks, state, solo) {
  const size = def.size;
  const hp = Math.max(6, Math.round(def.hp * (solo ? SOLO_HP : 1)));
  return {
    def, size,
    c: marks.boss.c, r: marks.boss.r,
    x: (marks.boss.c + size / 2) * TILE,
    y: (marks.boss.r + size / 2) * TILE,
    hpMax: hp, hp,
    phase: 0,
    mode: 'move',             // move | stagger | dash | phasing
    modeT: 0,
    invuln: 1.0,
    dead: false,
    unlocked: def.patterns.filter(p => (p.phase || 0) === 0).map(p => p.kind),
    cds: {},
    gcd: 2.0,
    step: null,
    dash: null,
    dir: def.move === 'v' ? [0, 1] : [1, 0],
    hitCd: new Map(),
    recent: [],               // timestamps of recent hits, for the stagger check
    flash: 0,
    cloned: false,
  };
}

const speedOf = (b) => b.def.speed * (1 + b.phase * 0.12);

function canStand(state, b, c, r) {
  for (let rr = r; rr < r + b.size; rr++)
    for (let cc = c; cc < c + b.size; cc++) {
      if (!state.grid.inBounds(cc, rr)) return false;
      if (state.grid.at(cc, rr) === HARD) return false;
    }
  return true;
}

/* The boss grinds SOFT cover to nothing as it moves. Your cover is spent by the
 * fight whether or not you spend it yourself. */
function crush(state, b) {
  for (let rr = b.r; rr < b.r + b.size; rr++)
    for (let cc = b.c; cc < b.c + b.size; cc++)
      if (state.grid.at(cc, rr) === SOFT) {
        state.grid.set(cc, rr, EMPTY);
        state.fx.push({ kind: 'crumble', c: cc, r: rr, life: 0.35, max: 0.35 });
      }
}

/* ── damage ───────────────────────────────────────────────────────────── */

function applyWater(state, b, dt) {
  for (const [i, cd] of b.hitCd) {
    const left = cd - dt;
    if (left <= 0 || !state.water.has(i)) b.hitCd.delete(i);
    else b.hitCd.set(i, left);
  }
  if (b.invuln > 0 || b.mode === 'phasing') return;

  for (const [i, w] of state.water) {
    if (w.owner < 0) continue;                  // its own water cannot hurt it
    if (!covers(b, w.c, w.r)) continue;
    if (b.hitCd.has(i)) continue;
    b.hitCd.set(i, BOSS_HIT_COOLDOWN);
    b.hp -= 1;
    b.flash = 0.14;
    b.recent.push(state.t);
    emit(state, 'hurtBoss');
    state.fx.push({ kind: 'hit', x: w.c * TILE + TILE / 2, y: w.r * TILE + TILE / 2, life: 0.4, max: 0.4 });
  }

  /* Land enough hits close together and it reels — a short, readable opening
   * that rewards having bombs already in place rather than trickling them in. */
  b.recent = b.recent.filter(t => state.t - t <= STAGGER_WINDOW);
  if (b.mode !== 'stagger' && b.recent.length >= STAGGER_AT_HITS) {
    b.recent.length = 0;
    b.mode = 'stagger';
    b.modeT = BOSS_STAGGER;
    b.step = null;
    b.dash = null;
    state.telegraphs = state.telegraphs.filter(t => t.boss !== b);
    state.fx.push({ kind: 'stun', x: b.x, y: b.y, life: 0.9, max: 0.9 });
    emit(state, 'stagger');
  }
}

function checkPhase(state, b) {
  if (b.phase >= PHASE_AT.length || b.dead) return;
  if (b.hp / b.hpMax > PHASE_AT[b.phase]) return;
  b.phase += 1;
  b.mode = 'phasing';
  b.modeT = PHASE_INVULN;
  b.invuln = PHASE_INVULN;
  b.step = null;
  b.dash = null;
  state.telegraphs = state.telegraphs.filter(t => t.boss !== b);
  for (const p of b.def.patterns)
    if ((p.phase || 0) === b.phase && !b.unlocked.includes(p.kind)) b.unlocked.push(p.kind);
  emit(state, 'phase');
  state.shake = Math.max(state.shake, 0.5);
  state.banner = { text: `${b.def.name.toUpperCase()} NỔI GIẬN`, life: 1.5, max: 1.5 };
}

/* ── per-frame ────────────────────────────────────────────────────────── */

export function updateBoss(state, dt) {
  updateClones(state, dt);

  const b = state.boss;
  if (!b || b.dead) return;

  if (b.invuln > 0) b.invuln -= dt;
  if (b.flash > 0) b.flash -= dt;
  b.modeT -= dt;

  applyWater(state, b, dt);

  if (b.hp <= 0) {
    b.hp = 0;
    b.dead = true;
    state.telegraphs = state.telegraphs.filter(t => t.boss !== b);
    state.clones.forEach(cl => { cl.dead = true; });
    state.shake = 0.9;
    return;
  }
  checkPhase(state, b);

  switch (b.mode) {
    case 'phasing':
      if (b.modeT <= 0) { b.mode = 'move'; b.gcd = 0.5; }
      break;
    case 'stagger':
      if (b.modeT <= 0) { b.mode = 'move'; b.gcd = 0.4; }
      break;
    case 'dash':
      updateDash(state, b, dt);
      break;
    default:
      walk(state, b, dt);
      schedule(state, b, dt);
      break;
  }

  place(b);
  touch(state, b, b.size);
}

function place(b) {
  let px = (b.c + b.size / 2) * TILE;
  let py = (b.r + b.size / 2) * TILE;
  if (b.step) {
    const k = Math.min(1, b.step.t / b.step.dur);
    px += b.step.dx * TILE * k;
    py += b.step.dy * TILE * k;
  }
  b.x = px; b.y = py;
}

/* Fixed-axis shuffle for 'h'/'v', a lumbering pursuit for 'chase'. */
function walk(state, b, dt) {
  if (!b.step) {
    let dir = b.dir;
    if (b.def.move === 'chase') {
      const mid = bossCenter(b);
      let best = null, bestD = Infinity;
      for (const p of state.players) {
        if (!p.alive || p.down) continue;
        const d = Math.abs(p.x / TILE - mid.c) + Math.abs(p.y / TILE - mid.r);
        if (d < bestD) { bestD = d; best = p; }
      }
      if (best) {
        const dc = best.x / TILE - mid.c, dr = best.y / TILE - mid.r;
        dir = Math.abs(dc) >= Math.abs(dr) ? [Math.sign(dc), 0] : [0, Math.sign(dr)];
      }
    }
    if (!dir || !canStand(state, b, b.c + dir[0], b.r + dir[1])) {
      dir = [-((b.dir || [1, 0])[0]), -((b.dir || [1, 0])[1])];
      if (!canStand(state, b, b.c + dir[0], b.r + dir[1])) return;
    }
    b.dir = dir;
    b.step = { dx: dir[0], dy: dir[1], t: 0, dur: 1 / Math.max(0.1, speedOf(b)) };
  }
  b.step.t += dt;
  if (b.step.t >= b.step.dur) {
    b.c += b.step.dx; b.r += b.step.dy;
    b.step = null;
    crush(state, b);
  }
}

function updateDash(state, b, dt) {
  const { dx, dy, rolling } = b.dash;
  const mul = rolling ? (b.def.rollSpeed || 7) : 4.5;
  if (!b.step) b.step = { dx, dy, t: 0, dur: 1 / (speedOf(b) * mul) };
  b.step.t += dt;
  if (b.step.t < b.step.dur) return;

  b.c += dx; b.r += dy;
  b.step = null;
  crush(state, b);
  b.dash.left -= 1;

  if (b.dash.left <= 0 || !canStand(state, b, b.c + dx, b.r + dy)) {
    b.dash = null;
    b.mode = 'move';
    b.gcd = 0.6;
    state.shake = Math.max(state.shake, 0.3);
  }
}

function schedule(state, b, dt) {
  b.gcd -= dt;
  for (const k in b.cds) b.cds[k] = Math.max(0, b.cds[k] - dt);
  if (b.gcd > 0) return;

  const ready = b.unlocked.filter(k => !b.cds[k]);
  if (!ready.length) return;
  const kind = ready[Math.floor(state.rand() * ready.length)];
  if (!cast(state, b, kind)) { b.gcd = 0.4; return; }

  const spec = b.def.patterns.find(p => p.kind === kind);
  const cd = spec?.cd ?? 8;
  b.cds[kind] = Array.isArray(cd) ? cd[Math.min(cd.length - 1, b.phase)] : cd;
  b.gcd = (b.def.gcd ?? 2.6) * (1 - b.phase * 0.15);
}

/* A body this size kills on contact, same as any monster. Judged on the
 * player's centre tile, which is exactly what leaves room to edge it. */
function touch(state, b, size) {
  if (b.mode === 'phasing') return;
  for (const p of state.players) {
    if (!p.alive || p.down || p.invuln > 0) continue;
    const c = state.grid.colOf(p.x), r = state.grid.rowOf(p.y);
    if (covers(b, c, r)) killPlayer(state, p, 'monster');
  }
}

/* ── clones ───────────────────────────────────────────────────────────── */

function updateClones(state, dt) {
  if (!state.clones.length) return;
  for (const cl of state.clones) {
    if (cl.dead) { cl.reaped += dt; continue; }
    if (cl.flash > 0) cl.flash -= dt;

    for (const [i, cd] of cl.hitCd) {
      const left = cd - dt;
      if (left <= 0 || !state.water.has(i)) cl.hitCd.delete(i);
      else cl.hitCd.set(i, left);
    }
    for (const [i, w] of state.water) {
      if (w.owner < 0 || !covers(cl, w.c, w.r) || cl.hitCd.has(i)) continue;
      cl.hitCd.set(i, BOSS_HIT_COOLDOWN);
      cl.hp -= 1;
      cl.flash = 0.14;
      emit(state, 'hurtBoss');
    }
    if (cl.hp <= 0) {
      cl.dead = true;
      cl.reaped = 0;
      state.fx.push({ kind: 'pop', x: cl.x, y: cl.y, life: 0.6, max: 0.6 });
      emit(state, 'pop');
      continue;
    }

    /* Fakes come straight for you — they are the pressure that stops you
     * camping one corner of the real one. */
    if (!cl.step) {
      const mid = bossCenter(cl);
      let best = null, bestD = Infinity;
      for (const p of state.players) {
        if (!p.alive || p.down) continue;
        const d = Math.abs(p.x / TILE - mid.c) + Math.abs(p.y / TILE - mid.r);
        if (d < bestD) { bestD = d; best = p; }
      }
      if (best) {
        const dc = best.x / TILE - mid.c, dr = best.y / TILE - mid.r;
        let dir = Math.abs(dc) >= Math.abs(dr) ? [Math.sign(dc), 0] : [0, Math.sign(dr)];
        if (!canStand(state, cl, cl.c + dir[0], cl.r + dir[1])) {
          dir = Math.abs(dc) >= Math.abs(dr) ? [0, Math.sign(dr) || 1] : [Math.sign(dc) || 1, 0];
        }
        if (canStand(state, cl, cl.c + dir[0], cl.r + dir[1])) {
          cl.step = { dx: dir[0], dy: dir[1], t: 0, dur: 1 / (cl.def.speed * 0.9) };
        }
      }
    }
    if (cl.step) {
      cl.step.t += dt;
      if (cl.step.t >= cl.step.dur) {
        cl.c += cl.step.dx; cl.r += cl.step.dy;
        cl.step = null;
        crush(state, cl);
      }
    }
    place(cl);
    touch(state, cl, cl.size);
  }
  state.clones = state.clones.filter(cl => !cl.dead || cl.reaped <= 0.6);
}
