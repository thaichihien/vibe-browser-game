/* Balloon → water. The only verb in the game.
 *
 * The burst is resolved all at once as a graph walk (so a chain of ten balloons
 * is one deterministic result) and then *spawned* outward on a per-tile delay,
 * which is what makes a chain read as a chain. Nothing here waits on the
 * renderer — the delay lives in state.pending and ticks with the simulation.
 */

import {
  FUSE_TIME, WATER_LINGER, WAVE_STAGGER, KICK_SPEED, THROW_TILES, THROW_TIME,
} from '../config.js';
import { EMPTY, HARD, SOFT, DIRS, rollDrop } from './grid.js';
import { balloonAt, solidFor, tileUnder, emit } from './state.js';

export function placeBalloon(state, p) {
  if (p.bubble || !p.alive) return null;
  if (countFor(state, p) >= p.stats.balloons) return null;
  const { c, r } = tileUnder(state, p);
  if (state.grid.at(c, r) !== EMPTY) return null;
  if (balloonAt(state, c, r)) return null;

  const b = {
    c, r,
    x: state.grid.centerX(c), y: state.grid.centerY(r),
    owner: p.id,
    power: p.stats.power,
    fuse: FUSE_TIME,
    /* Seeded with the placer: you may walk off the tile you just bombed, but
     * once you're clear the balloon turns solid to you too (§2.2). This is the
     * rule that makes every balloon you place a wall you can trap yourself
     * behind — remove it and the game loses its whole risk model. */
    phasing: new Set([p.id]),
    kick: null,      // { dx, dy } while sliding
    flight: null,    // { fromX, fromY, toC, toR, t, dur } while thrown
  };
  state.balloons.push(b);
  emit(state, 'place');
  return b;
}

export function countFor(state, p) {
  let n = 0;
  for (const b of state.balloons) if (b.owner === p.id) n++;
  return n;
}

function remove(state, b) {
  const i = state.balloons.indexOf(b);
  if (i >= 0) state.balloons.splice(i, 1);
}

/* Resolve a burst and everything it chains into.
 *
 * Returns a flat list of { c, r, wave, owner }. `wave` is the tile's distance
 * from the balloon that started it, counted through the chain, so scheduling by
 * wave × WAVE_STAGGER gives an outward ripple for free.
 *
 * Deliberately a queue rather than recursion: a 30-balloon chain is a routine
 * late-game occurrence and would blow the stack, and a queue also guarantees no
 * balloon is resolved twice.
 */
export function detonate(state, first) {
  const queue = [{ b: first, wave: 0 }];
  const gone = new Set();
  const out = [];

  while (queue.length) {
    const { b, wave } = queue.shift();
    if (gone.has(b)) continue;
    gone.add(b);
    remove(state, b);
    out.push({ c: b.c, r: b.r, wave, owner: b.owner });

    for (const [dc, dr] of DIRS) {
      for (let k = 1; k <= b.power; k++) {
        const c = b.c + dc * k, r = b.r + dr * k;
        if (!state.grid.inBounds(c, r)) break;
        const t = state.grid.at(c, r);
        if (t === HARD) break;

        out.push({ c, r, wave: wave + k, owner: b.owner });

        /* Chain: the water reaches another balloon, so that balloon's own fuse
         * is cancelled and it bursts as part of this wave. Water stops there —
         * the chained burst carries it onward. */
        const other = balloonAt(state, c, r);
        if (other && !gone.has(other)) {
          queue.push({ b: other, wave: wave + k });
          break;
        }
        /* Destroys the *first* SOFT tile it meets, then stops (§2.2.4). */
        if (t === SOFT) break;
      }
    }
  }
  return out;
}

/* Detonate and schedule the water. This is what everything outside this module
 * should call. */
export function fire(state, b) {
  for (const e of detonate(state, b)) {
    state.pending.push({ c: e.c, r: e.r, owner: e.owner, at: state.t + e.wave * WAVE_STAGGER });
  }
  state.shake = Math.max(state.shake, 0.18);
  emit(state, 'burst');
}

/* Detonate every balloon a player has out — the Shockwave active. */
export function shockwave(state, p) {
  const mine = state.balloons.filter(b => b.owner === p.id && !b.flight);
  for (const b of mine) if (state.balloons.includes(b)) fire(state, b);
  return mine.length;
}

/* Put water on a tile. `owner` is the player id, or -1 for water the boss made.
 *
 * Boss water never drops items: the arena is a resource the *player* spends, and
 * letting a Stomp hand out balloons would undo §3.6's whole trap.
 */
export function flood(state, c, r, owner, drops = true) {
  if (!state.grid.inBounds(c, r)) return;
  if (state.grid.at(c, r) === HARD) return;
  const i = state.grid.idx(c, r);

  if (state.grid.at(c, r) === SOFT) {
    state.grid.set(c, r, EMPTY);
    const drop = drops ? rollDrop(state.rand) : null;
    if (drop) state.items.set(i, drop);
    state.fx.push({ kind: 'crumble', c, r, life: 0.35, max: 0.35 });
  } else if (state.items.has(i)) {
    /* A loose item caught in a blast is destroyed. Farming has a cost. */
    state.items.delete(i);
    state.fx.push({ kind: 'burn', c, r, life: 0.3, max: 0.3 });
  }

  const prev = state.water.get(i);
  if (prev) { prev.life = WATER_LINGER; return; }
  state.water.set(i, { c, r, owner, life: WATER_LINGER, born: state.t });
}

export function updateBalloons(state, dt) {
  /* thrown balloons: in the air, harmless, uncollidable, fuse resets on landing */
  for (const b of state.balloons) {
    if (!b.flight) continue;
    const f = b.flight;
    f.t += dt;
    const k = Math.min(1, f.t / f.dur);
    b.x = f.fromX + (state.grid.centerX(f.toC) - f.fromX) * k;
    b.y = f.fromY + (state.grid.centerY(f.toR) - f.fromY) * k;
    if (k >= 1) {
      b.c = f.toC; b.r = f.toR;
      b.flight = null;
      b.fuse = FUSE_TIME;
      b.phasing.clear();
    }
  }

  /* kicked balloons slide until something stops them */
  for (const b of state.balloons) {
    if (b.flight || !b.kick) continue;
    const { dx, dy } = b.kick;
    b.x += dx * KICK_SPEED * dt;
    b.y += dy * KICK_SPEED * dt;
    const nc = state.grid.colOf(b.x), nr = state.grid.rowOf(b.y);
    if (nc !== b.c || nr !== b.r) {
      const ahead = { c: b.c + dx, r: b.r + dy };
      const blocked = solidFor(state, null, ahead.c, ahead.r) &&
                      !(balloonAt(state, ahead.c, ahead.r) === b);
      if (blocked || !state.grid.inBounds(nc, nr)) {
        b.x = state.grid.centerX(b.c);
        b.y = state.grid.centerY(b.r);
        b.kick = null;
      } else {
        b.c = nc; b.r = nr;
        b.phasing.clear();       // a moving balloon is solid to everyone
      }
    }
  }

  /* fuses */
  for (const b of [...state.balloons]) {
    if (b.flight) continue;
    b.fuse -= dt;
    if (b.fuse <= 0 && state.balloons.includes(b)) fire(state, b);
  }

  /* scheduled water */
  if (state.pending.length) {
    const due = [];
    state.pending = state.pending.filter(w => {
      if (w.at <= state.t) { due.push(w); return false; }
      return true;
    });
    for (const w of due) flood(state, w.c, w.r, w.owner);
  }

  /* linger */
  for (const [i, w] of state.water) {
    w.life -= dt;
    if (w.life <= 0) state.water.delete(i);
  }
}

/* Kick — walk into your own balloon and it slides until it hits something. */
export function kickBalloon(state, p, b, dx, dy) {
  if (b.kick || b.flight) return false;
  if (solidFor(state, null, b.c + dx, b.r + dy)) return false;
  b.kick = { dx, dy };
  b.phasing.clear();
  return true;
}

/* Throw — lob a balloon over obstacles; it lands on the first free tile at or
 * before THROW_TILES, and its fuse restarts there. */
export function throwBalloon(state, p, b, dx, dy) {
  if (b.flight) return false;
  let toC = b.c, toR = b.r;
  for (let k = 1; k <= THROW_TILES; k++) {
    const c = b.c + dx * k, r = b.r + dy * k;
    if (!state.grid.inBounds(c, r)) break;
    if (state.grid.blocks(c, r) || balloonAt(state, c, r)) continue;
    toC = c; toR = r;
  }
  if (toC === b.c && toR === b.r) return false;
  b.flight = { fromX: b.x, fromY: b.y, toC, toR, t: 0, dur: THROW_TIME };
  b.kick = null;
  return true;
}
