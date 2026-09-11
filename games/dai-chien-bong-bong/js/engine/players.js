/* The player: movement with corner-slip, the bubble state, lives.
 *
 * Water traps a player; a *monster* kills them. Both routes end in
 * killPlayer(), but only one of them gives you a chance to get out — see the
 * comment there, because that asymmetry is the mode's whole character.
 */

import {
  TILE, HITBOX, SLIP_PX, SLIP_SPEED, SPEED_TIERS, BASE, BUBBLE_DURATION,
  STRUGGLE_MASHES, BUBBLE_SPEED, ESCAPE_INVULN, RESPAWN_DELAY, SPAWN_INVULN,
} from '../config.js';
import { solidFor, balloonAt, tileUnder, wetAt, overlapsTile, emit } from './state.js';
import { placeBalloon, kickBalloon, throwBalloon } from './balloons.js';
import { applyItem, tickActives, useActive } from './items.js';

export function createPlayer(id, spawn, carried) {
  return {
    id,
    spawn,
    x: spawn.c * TILE + TILE / 2,
    y: spawn.r * TILE + TILE / 2,
    dx: 0, dy: 0,
    facing: id === 0 ? 'down' : 'down',
    stats: carried?.stats
      ? { ...carried.stats }
      : { balloons: BASE.balloons, power: BASE.power, speedTier: BASE.speedTier, kick: false, throw: false },
    actives: (carried?.actives || []).map(a => ({ ...a })),
    lives: carried?.lives ?? BASE.lives,
    alive: true,
    /* `down` is out of lives: sits out the rest of the stage, comes back with a
     * fresh life count at the next one. */
    down: false,
    bubble: null,          // { left, max }
    invuln: SPAWN_INVULN,
    respawn: 0,
    shield: false,
    anchor: 0,
    picked: null,          // last pickup, for the HUD flash
    pickedFor: 0,
  };
}

export function speedOf(p) {
  return SPEED_TIERS[Math.max(1, Math.min(SPEED_TIERS.length - 1, p.stats.speedTier))];
}

/* ── movement ─────────────────────────────────────────────────────────── */

function rectBlocked(state, p, x, y) {
  const h = HITBOX / 2;
  const g = state.grid;
  const c0 = g.colOf(x - h + 0.01), c1 = g.colOf(x + h - 0.01);
  const r0 = g.rowOf(y - h + 0.01), r1 = g.rowOf(y + h - 0.01);
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++)
      if (solidFor(state, p, c, r)) return true;
  return false;
}

/* Walks the axis in ≤1px steps so a fast player can never tunnel a wall. Max
 * speed is under 3px per fixed step, so this is at most three iterations. */
function stepAxis(state, p, axis, dist) {
  const sign = Math.sign(dist);
  let left = Math.abs(dist), moved = 0;
  while (left > 1e-6) {
    const d = Math.min(1, left);
    const nx = axis === 'x' ? p.x + sign * d : p.x;
    const ny = axis === 'y' ? p.y + sign * d : p.y;
    if (rectBlocked(state, p, nx, ny)) break;
    p.x = nx; p.y = ny;
    moved += d; left -= d;
  }
  return moved;
}

/* Corner-slip assist (§2.1).
 *
 * You are pushing into a wall. Your hitbox straddles two lanes: one of them is
 * open ahead and the other is not. If you are poking no more than SLIP_PX into
 * the blocked one, you get nudged perpendicular into the open lane instead of
 * stopping — so brushing a corner rounds it rather than catching on it.
 *
 * Both halves are the same routine with the axes swapped; the duplication is
 * cheaper to read than a generalised version with index math.
 */
function cornerSlip(state, p, dx, dy, step) {
  const g = state.grid, h = HITBOX / 2;

  if (dx) {
    const col = g.colOf(p.x + Math.sign(dx) * (h + 1));
    const rTop = g.rowOf(p.y - h + 0.01), rBot = g.rowOf(p.y + h - 0.01);
    if (rTop === rBot) return 0;
    const topFree = !solidFor(state, p, col, rTop);
    const botFree = !solidFor(state, p, col, rBot);
    if (topFree === botFree) return 0;

    if (topFree) {
      const poke = (p.y + h) - rBot * TILE;           // how far into the blocked lane
      if (poke > SLIP_PX) return 0;
      return stepAxis(state, p, 'y', -Math.min(step, poke));
    }
    const poke = (rTop + 1) * TILE - (p.y - h);
    if (poke > SLIP_PX) return 0;
    return stepAxis(state, p, 'y', Math.min(step, poke));
  }

  const row = g.rowOf(p.y + Math.sign(dy) * (h + 1));
  const cLeft = g.colOf(p.x - h + 0.01), cRight = g.colOf(p.x + h - 0.01);
  if (cLeft === cRight) return 0;
  const leftFree = !solidFor(state, p, cLeft, row);
  const rightFree = !solidFor(state, p, cRight, row);
  if (leftFree === rightFree) return 0;

  if (leftFree) {
    const poke = (p.x + h) - cRight * TILE;
    if (poke > SLIP_PX) return 0;
    return stepAxis(state, p, 'x', -Math.min(step, poke));
  }
  const poke = (cLeft + 1) * TILE - (p.x - h);
  if (poke > SLIP_PX) return 0;
  return stepAxis(state, p, 'x', Math.min(step, poke));
}

/* Once you step off a balloon you placed, it becomes solid to you as well. */
function updatePhasing(state) {
  for (const b of state.balloons) {
    if (!b.phasing.size) continue;
    for (const id of [...b.phasing]) {
      const p = state.players.find(q => q.id === id);
      if (!p || !p.alive || p.down || !overlapsTile(p, b.c, b.r)) b.phasing.delete(id);
    }
  }
}

/* ── the bubble ───────────────────────────────────────────────────────── */

export function bubblePlayer(state, p) {
  if (p.bubble || p.invuln > 0 || !p.alive || p.down) return false;
  if (p.shield) {
    p.shield = false;
    p.invuln = ESCAPE_INVULN;
    state.fx.push({ kind: 'guard', x: p.x, y: p.y, life: 0.5, max: 0.5 });
    return false;
  }
  emit(state, 'bubble');
  p.bubble = { left: BUBBLE_DURATION, max: BUBBLE_DURATION, struggle: 1 };
  p.dx = p.dy = 0;
  return true;
}

/* Mashing a direction chips the struggle meter. Empty it and you are out, with
 * no life lost — the reward for panicking productively. */
export function struggle(p) {
  if (!p.bubble) return false;
  p.bubble.struggle -= 1 / STRUGGLE_MASHES;
  return p.bubble.struggle <= 0;
}

/* An ally walking into a bubbled player frees them instantly (§2.3). It is the
 * same input as popping a bubbled Bóng Ma, which is why chapter 1 stage 1
 * teaches co-op rescue without a word of tutorial. */
function tryRescue(state, p) {
  for (const q of state.players) {
    if (q === p || !q.alive || q.down || q.bubble) continue;
    if (Math.abs(q.x - p.x) < HITBOX && Math.abs(q.y - p.y) < HITBOX) {
      p.bubble = null;
      p.invuln = ESCAPE_INVULN;
      state.fx.push({ kind: 'rescue', x: p.x, y: p.y, life: 0.6, max: 0.6 });
      emit(state, 'escape');
      return true;
    }
  }
  return false;
}

/* Losing a life. `cause` is 'bubble' when a water trap popped, or 'monster'
 * when something touched you.
 *
 * Those two are deliberately not the same event. Water *traps* you and a
 * partner can pull you out; a monster kills you where you stand, with no
 * bubble, no struggle bar and nothing anyone can do about it. That asymmetry is
 * the whole reason Crazy Arcade's monster stages feel like routing puzzles
 * rather than shootouts. */
export function killPlayer(state, p, cause = 'bubble') {
  if (!p.alive || p.down) return;
  p.bubble = null;
  p.lives -= 1;
  state.deaths = (state.deaths || 0) + 1;
  state.fx.push({ kind: cause === 'monster' ? 'splat' : 'pop', x: p.x, y: p.y, life: 0.7, max: 0.7 });
  emit(state, cause === 'monster' ? 'splat' : 'pop');
  state.shake = Math.max(state.shake, 0.35);
  p.alive = false;
  if (p.lives <= 0) p.down = true;          // sits out; returns fresh next stage
  else p.respawn = RESPAWN_DELAY;
}

function popBubble(state, p) {
  killPlayer(state, p, 'bubble');
}

/* Somewhere dry, unbombed, and not right next to a balloon about to go off. */
function safeSpawn(state, p) {
  const { grid } = state;
  const score = (c, r) => {
    if (grid.blocks(c, r) || balloonAt(state, c, r) || wetAt(state, c, r)) return -1;
    let d = 99;
    for (const b of state.balloons) d = Math.min(d, Math.abs(b.c - c) + Math.abs(b.r - r));
    for (const [, w] of state.water) d = Math.min(d, Math.abs(w.c - c) + Math.abs(w.r - r));
    if (state.boss && !state.boss.dead) {
      d = Math.min(d, Math.abs(state.boss.c + state.boss.size / 2 - c) +
                      Math.abs(state.boss.r + state.boss.size / 2 - r));
    }
    return d;
  };
  let best = null, bestScore = -1;
  const home = score(p.spawn.c, p.spawn.r);
  if (home >= 3) return p.spawn;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const s = score(c, r);
      if (s > bestScore) { bestScore = s; best = { c, r }; }
    }
  }
  return best || p.spawn;
}

/* ── per-frame ────────────────────────────────────────────────────────── */

export function updatePlayers(state, dt, intents) {
  updatePhasing(state);

  for (const p of state.players) {
    const it = intents[p.id] || { dx: 0, dy: 0 };

    if (p.pickedFor > 0) p.pickedFor -= dt;
    tickActives(p, dt);
    if (p.invuln > 0) p.invuln -= dt;
    if (p.anchor > 0) p.anchor -= dt;

    if (!p.alive) {
      if (p.down) continue;
      p.respawn -= dt;
      if (p.respawn <= 0) {
        const s = safeSpawn(state, p);
        p.x = state.grid.centerX(s.c);
        p.y = state.grid.centerY(s.r);
        p.alive = true;
        p.invuln = SPAWN_INVULN;
      }
      continue;
    }

    /* Actives run before the bubble check on purpose: Needle exists precisely
     * to be usable while bubbled, and it is the only thing you can press. */
    if (it.act0) useActive(state, p, 0);
    if (it.act1) useActive(state, p, 1);

    /* bubbled: barely mobile, mash to break out, an ally frees you outright */
    if (p.bubble) {
      if (it.mashed && struggle(p)) {
        p.bubble = null;
        p.invuln = ESCAPE_INVULN;
        state.fx.push({ kind: 'escape', x: p.x, y: p.y, life: 0.5, max: 0.5 });
        emit(state, 'escape');
        continue;
      }
      p.bubble.left -= dt;
      if (tryRescue(state, p)) continue;
      if (p.bubble.left <= 0) { popBubble(state, p); continue; }
      moveBy(state, p, it, speedOf(p) * BUBBLE_SPEED * dt);
      continue;
    }

    moveBy(state, p, it, speedOf(p) * dt);
    if (it.place) tryPlace(state, p, it);

    /* water / flood contact */
    const { c, r } = tileUnder(state, p);
    if (wetAt(state, c, r)) bubblePlayer(state, p);

    /* pickups */
    const i = state.grid.idx(c, r);
    if (state.items.has(i)) {
      const kind = state.items.get(i);
      if (applyItem(p, kind)) {
        state.items.delete(i);
        p.picked = kind;
        p.pickedFor = 1.2;
        state.fx.push({ kind: 'pickup', x: p.x, y: p.y, life: 0.5, max: 0.5 });
        emit(state, 'pickup');
      }
    }
  }
}

function moveBy(state, p, it, step) {
  if (p.anchor > 0) return;            // immovable while anchored
  const { dx, dy } = it;
  if (!dx && !dy) { p.dx = p.dy = 0; return; }
  p.dx = dx; p.dy = dy;
  if (dx) p.facing = dx > 0 ? 'right' : 'left';
  else if (dy) p.facing = dy > 0 ? 'down' : 'up';

  const moved = dx ? stepAxis(state, p, 'x', dx * step) : stepAxis(state, p, 'y', dy * step);
  if (moved < step * 0.5) {
    /* Blocked. Either round the corner, or — with Kick — shove the balloon. */
    const slid = cornerSlip(state, p, dx, dy, step * SLIP_SPEED);
    if (!slid && p.stats.kick) {
      const ahead = balloonAt(state, state.grid.colOf(p.x) + dx, state.grid.rowOf(p.y) + dy);
      if (ahead) kickBalloon(state, p, ahead, dx, dy);
    }
  }
}

function tryPlace(state, p, it) {
  /* With Throw, pressing Place while standing on your own balloon lobs it. */
  if (p.stats.throw) {
    const { c, r } = tileUnder(state, p);
    const here = balloonAt(state, c, r);
    if (here && here.owner === p.id && here.phasing.has(p.id)) {
      const dx = p.facing === 'right' ? 1 : p.facing === 'left' ? -1 : 0;
      const dy = p.facing === 'down' ? 1 : p.facing === 'up' ? -1 : 0;
      if (throwBalloon(state, p, here, dx, dy)) return;
    }
  }
  placeBalloon(state, p);
}
