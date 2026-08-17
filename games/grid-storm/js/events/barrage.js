/* Events that throw things at you.

   Every event is `{ id, name, emoji, blurb, tint, duration, weight, start,
   update, end }`. `e` is the live instance (its own scratch space); `g` is the
   game. Nothing here touches the DOM or pixels — only cells and seconds. */

import { spawnBullet, addHazard, edgeShot } from '../bullets.js';
import { burst, ring, flash, shake } from '../fx.js';
import { Sound } from '../audio.js';
import { rnd, rndi, clamp, lerp } from '../config.js';

const plusCells = (cx, cy) => [[cx, cy], [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];

function aim(g, x, y) {
  const dx = g.player.px - x, dy = g.player.py - y;
  const d = Math.hypot(dx, dy) || 1;
  return [dx / d, dy / d];
}

/* ── ⚡ LASER GRID ───────────────────────────────────────────────────────── */

export const laser = {
  id: 'laser', name: 'LASER GRID', emoji: '⚡', tint: '#ff2e5b',
  blurb: 'A row or column charges up, then fires. Get off the line.',
  duration: 14, weight: 3,

  start(g, e) { e.timer = 0.5; },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0) return;

    const lanes = e.t > 7 ? 2 : 1;
    e.timer = rnd(1.9, 2.6);

    for (let i = 0; i < lanes; i++) {
      const axis = Math.random() < 0.5 ? 'row' : 'col';
      const lane = rndi(g.lo, g.hi);
      fireLaser(g, axis, lane);
    }
  }
};

function fireLaser(g, axis, lane, warn = 1.25, burn = 0.5) {
  Sound.charge();

  addHazard(g, {
    life: warn + burn, under: true,
    draw(h, gg, ctx, R) {
      if (h.t < warn) {
        const p = h.t / warn;
        R.beam(gg, axis, lane, '#ff2e5b', 0.10 + 0.30 * p * Math.abs(Math.sin(h.t * 12)), 0.85);
        const a = 0.6 + 0.4 * Math.sin(h.t * 12);
        if (axis === 'row') {
          R.emoji(gg.lo - 1, lane, '🔺', 0.6, a, -Math.PI / 2);
          R.emoji(gg.hi + 1, lane, '🔺', 0.6, a, Math.PI / 2);
        } else {
          R.emoji(lane, gg.lo - 1, '🔺', 0.6, a, Math.PI);
          R.emoji(lane, gg.hi + 1, '🔺', 0.6, a, 0);
        }
      } else {
        const p = 1 - (h.t - warn) / burn;
        R.beam(gg, axis, lane, '#ff2e5b', 0.85 * p, 1.0);
        R.beam(gg, axis, lane, '#ffffff', p, 0.34 * p);
      }
    },
    update(h, gg) {
      if (h.t < warn) return;
      if (!h.fired) {
        h.fired = true;
        Sound.blast();
        shake(gg.fx, 9);
        flash(gg.fx, '#ff2e5b', 0.28);
        for (let i = gg.lo; i <= gg.hi; i += 2) {
          burst(gg.fx, axis === 'row' ? i : lane, axis === 'row' ? lane : i, '#ff2e5b', 4, 3);
        }
      }
      const [cx, cy] = gg.playerCell();
      if (axis === 'row' ? cy === lane : cx === lane) gg.kill('vaporised by a laser', '⚡');
    }
  });
}

/* ── 💣 BOMB RAIN ───────────────────────────────────────────────────────── */

export const bombRain = {
  id: 'bomb', name: 'BOMB RAIN', emoji: '💣', tint: '#ff9800',
  blurb: 'Shadows fall on the grid — each one bursts in a plus shape.',
  duration: 13, weight: 3,

  start(g, e) { e.timer = 0.3; },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0) return;
    e.timer = rnd(0.55, 0.9);

    const [cx, cy] = g.randCell();
    dropBomb(g, cx, cy);
  }
};

export function dropBomb(g, cx, cy, fall = 1.35, burn = 0.4) {
  addHazard(g, {
    life: fall + burn, under: true,
    draw(h, gg, ctx, R) {
      if (h.t < fall) {
        const p = h.t / fall;
        R.cellRect(cx, cy, '#000000', 0.15 + 0.4 * p, 3 + 10 * (1 - p), 10);
        R.cellStroke(cx, cy, '#ff9800', 0.3 + 0.5 * p, 2);
        R.emoji(cx, cy - 5.5 * (1 - p) * (1 - p), '💣', 0.62, 1, p * 6);
      } else {
        const p = 1 - (h.t - fall) / burn;
        for (const [bx, by] of plusCells(cx, cy)) {
          if (bx < gg.lo || bx > gg.hi || by < gg.lo || by > gg.hi) continue;
          R.cellRect(bx, by, '#ff6b2e', 0.85 * p);
          R.emoji(bx, by, '💥', 0.8 * (0.55 + 0.45 * p), p);
        }
      }
    },
    update(h, gg) {
      if (h.t < fall) return;
      if (!h.fired) {
        h.fired = true;
        Sound.blast();
        shake(gg.fx, 7);
        burst(gg.fx, cx, cy, '#ff9800', 18, 6, '🔥');
        ring(gg.fx, cx, cy, '#ffcc66', 0.3, 2.2, 0.4, 5);
      }
      const [pcx, pcy] = gg.playerCell();
      for (const [bx, by] of plusCells(cx, cy)) {
        if (bx === pcx && by === pcy) gg.kill('bombed', '💣');
      }
    }
  });
}

/* ── 🪃 BOOMERANG ───────────────────────────────────────────────────────── */

export const boomerang = {
  id: 'boomerang', name: 'BOOMERANGS', emoji: '🪃', tint: '#ffd166',
  blurb: 'They stop, hang there, then come straight back down the same line.',
  duration: 14, weight: 3,

  start(g, e) { e.timer = 0.4; },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0) return;
    e.timer = rnd(1.1, 1.9);

    const dir = rndi(0, 3);
    const lane = rndi(g.lo, g.hi);
    const speed = g.speed * 1.25;
    const reach = rnd(0.35, 0.85);   // how deep into the grid it flies

    const b = edgeShot(g, dir, lane, speed, {
      emoji: '🪃', r: 0.3, spin: 14, color: '#ffd166', trailRate: 0.03, life: 14
    });

    b.phase = 'out';
    b.travel = 0;
    b.limit = (g.hi - g.lo + 1) * reach;
    b.hover = 0;

    b.update = (bb, gg, d) => {
      if (bb.phase === 'hover') {
        bb.hover += d;
        bb.spin = 26;
        if (bb.hover > 0.45) { bb.phase = 'back'; bb.vx *= -1; bb.vy *= -1; Sound.fire(); }
        return;
      }
      bb.x += bb.vx * d;
      bb.y += bb.vy * d;
      if (bb.phase === 'out') {
        bb.travel += Math.hypot(bb.vx, bb.vy) * d;
        if (bb.travel >= bb.limit) { bb.phase = 'hover'; }
      }
    };
  }
};

/* ── 🌸 FLOWER MINE ─────────────────────────────────────────────────────── */

export const flower = {
  id: 'flower', name: 'FLOWER MINES', emoji: '🌸', tint: '#ff4dd2',
  blurb: 'It parks on a cell, blooms, and fires a petal up, down, left and right.',
  duration: 14, weight: 3,

  start(g, e) { e.timer = 0.4; },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0) return;
    e.timer = rnd(1.6, 2.4);

    const [tx, ty] = g.randCell();
    const dir = rndi(0, 3);
    const b = edgeShot(g, dir, dir < 2 ? tx : ty, g.speed, {
      emoji: '🌸', r: 0.3, spin: 4, color: '#ff4dd2', trailRate: 0.04, life: 14
    });

    b.tx = tx; b.ty = ty;
    b.bloom = 0;

    b.update = (bb, gg, d) => {
      if (bb.armed) {
        bb.bloom += d;
        bb.scale = 1 + Math.sin(bb.bloom * 18) * 0.28;
        if (bb.bloom > 0.7) bb.life = -1;
        return;
      }
      const before = Math.hypot(bb.x - bb.tx, bb.y - bb.ty);
      bb.x += bb.vx * d;
      bb.y += bb.vy * d;
      const after = Math.hypot(bb.x - bb.tx, bb.y - bb.ty);
      if (after > before || after < 0.12) {
        bb.armed = true;
        bb.x = bb.tx; bb.y = bb.ty;
        bb.vx = bb.vy = 0;
        Sound.warn();
      }
    };

    b.onExpire = (bb, gg) => {
      if (!bb.armed) return;
      Sound.bloom();
      burst(gg.fx, bb.x, bb.y, '#ff4dd2', 16, 5, '🌺');
      ring(gg.fx, bb.x, bb.y, '#ff4dd2', 0.2, 1.8, 0.4, 4);

      // four petals, straight along the grid lines
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const s = gg.speed * 0.95;
        spawnBullet(gg, {
          x: bb.x, y: bb.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          emoji: '🌺', r: 0.24, spin: 8, color: '#ff4dd2', life: 12
        });
      }
    };
  }
};

/* ── 🌀 SPIRAL ──────────────────────────────────────────────────────────── */

/* The arms are a solid wall of shots, so there is no crossing them — this event
   is a *walk*, not a dodge. The arms leave one lane each, and they sweep slowly
   enough that circling the centre at a steady pace keeps you in yours. Which way
   they sweep is drawn each time, and nothing on the board announces it: the 🌀 at
   the centre turns with the sweep for a second and a half before the first shot
   leaves, so the wind-up is where you read it.

   It owns the board (`solo`) for that reason and not for spectacle: you are shut
   inside one lane for the duration, so a plain missile or a laser arriving across
   it would be unavoidable rather than difficult. */
export const spiral = {
  id: 'spiral', name: 'SPIRAL', emoji: '🌀', tint: '#00e5ff',
  blurb: 'A fountain picks a direction and sweeps. Walk that way with it — you cannot cross an arm.',
  duration: 13, weight: 2, solo: true,

  /* rad/s, wind-up -> full rate, keyed by how many arms were drawn. More arms
     means narrower lanes, so the sweep eases off; three wide ones can afford to
     move. A lap runs 5.7s at three arms, 7.5s at four and 11.2s at five — five
     drops away faster than the geometry alone would ask, because a 72° lane
     leaves no room to correct once you are behind it. */
  spin: {
    3: [0.67, 1.10],
    4: [0.52, 0.84],
    5: [0.35, 0.56]
  },

  start(g, e) {
    e.angle = rnd(0, 6.28);
    e.timer = 1.8;        // it winds up in plain sight before it throws anything
    e.arms = rndi(3, 5);
    e.spin = this.spin[e.arms];
    e.spinDir = Math.random() < 0.5 ? 1 : -1;
    e.hz = addHazard(g, {
      life: this.duration + 0.5, under: false, ignoreTime: true,
      draw: (h, gg, ctx, R) => {
        // grows while it spins up, so the wind-up reads as a warning
        const wind = Math.min(1, h.t / 1.8);
        R.emoji(gg.center, gg.center, '🌀', 0.4 + 0.6 * wind, 0.5 + 0.4 * wind, e.angle);
        if (wind < 1) R.arc(gg.center, gg.center, 0.8 + wind * 0.7, 0, Math.PI * 2 * wind, '#00e5ff', 3, 0.7);
      }
    });
  },

  update(g, e, dt) {
    // y grows downward, so +1 sweeps clockwise on screen and -1 the other way
    e.angle += dt * lerp(e.spin[0], e.spin[1], Math.min(1, e.t / 3)) * e.spinDir;

    e.timer -= dt;
    if (e.timer > 0) return;
    if (e.t > e.duration - 1.2) return;   // let the board drain before it ends
    e.timer = e.t < 4 ? 0.22 : 0.14;      // eases into its full rate

    for (let i = 0; i < e.arms; i++) {
      const a = e.angle + (i / e.arms) * Math.PI * 2;
      const s = g.speed * 0.85;
      spawnBullet(g, {
        x: g.center, y: g.center, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        r: 0.2, color: '#00e5ff', shape: 'diamond', spin: 6, trailRate: 0.05
      });
    }
  },

  end(g, e) { if (e.hz) e.hz.dead = true; }
};

/* ── ☄️ METEOR SHOWER ───────────────────────────────────────────────────── */

export const meteor = {
  id: 'meteor', name: 'METEOR SHOWER', emoji: '☄️', tint: '#ff9800',
  blurb: 'Diagonal rocks sweeping across the board.',
  duration: 12, weight: 2,

  start(g, e) {
    e.dx = Math.random() < 0.5 ? 1 : -1;
    e.dy = Math.random() < 0.5 ? 1 : -1;
    e.timer = 0.3;
    e.lane = e.dx > 0 ? g.lo - 1 : g.hi + 1;
  },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0) return;
    e.timer = rnd(0.22, 0.4);

    const s = g.speed * 0.85;
    // enter on a side edge, high or low depending on which way it falls, but
    // never so far outside that the culler eats it on the first frame
    const y0 = e.dy > 0 ? rnd(g.lo - 2.5, g.hi - 1) : rnd(g.lo + 1, g.hi + 2.5);

    spawnBullet(g, {
      x: e.dx > 0 ? g.lo - 1.5 : g.hi + 1.5,
      y: y0,
      vx: s * e.dx, vy: s * e.dy,
      emoji: '☄️', r: 0.28, color: '#ff9800', trailRate: 0.025,
      rot: Math.atan2(s * e.dy, s * e.dx) + Math.PI * 0.75
    });
  }
};

/* ── 🐍 GRID SNAKE ──────────────────────────────────────────────────────── */

export const snake = {
  id: 'snake', name: 'GRID SNAKE', emoji: '🐍', tint: '#4caf50',
  blurb: 'It hunts along the cells and its body stays deadly for a while.',
  duration: 15, weight: 2,

  start(g, e) {
    e.hx = rndi(g.lo, g.hi);
    e.hy = g.lo;
    e.dir = [0, 1];
    e.timer = 0;
    // seconds per cell. It homes in a straight line, so anything close to the
    // player's own step rate is unshakeable — this has to be a chase you can win.
    e.step = 0.40;
    e.body = spawnBullet(g, {
      x: e.hx, y: e.hy, emoji: '🐍', r: 0.3, color: '#4caf50', life: this.duration + 1, trailRate: 0
    });
    e.body.update = (bb, gg, d) => { /* driven by the event */ };
  },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0) {
      const p = 1 - e.timer / e.step;
      e.body.x = e.px + (e.hx - e.px) * p;
      e.body.y = e.py + (e.hy - e.py) * p;
      return;
    }
    e.timer = e.step;
    e.px = e.hx; e.py = e.hy;

    /* Leave a body segment behind. Measured in steps rather than seconds, so
       the tail is always the same *length* whatever pace the head is set to —
       it lags about twelve cells behind, and the cells it has closed off read
       as one shape instead of a few scattered dots. */
    spawnBullet(g, {
      x: e.hx, y: e.hy, emoji: '🟢', r: 0.26, color: '#4caf50',
      life: e.step * 12, trailRate: 0, vx: 0, vy: 0
    });

    // steer toward the player, but only ever turn one axis at a time
    const dx = Math.sign(g.player.px - e.hx);
    const dy = Math.sign(g.player.py - e.hy);
    if (Math.random() < 0.75) {
      e.dir = Math.abs(g.player.px - e.hx) > Math.abs(g.player.py - e.hy)
        ? [dx || 1, 0] : [0, dy || 1];
    }

    e.hx = clamp(e.hx + e.dir[0], g.lo, g.hi);
    e.hy = clamp(e.hy + e.dir[1], g.lo, g.hi);
    e.body.rot = Math.atan2(e.dir[1], e.dir[0]);
  },

  end(g, e) { if (e.body) e.body.life = -1; }
};

/* ── 🔫 SENTRIES ────────────────────────────────────────────────────────── */

export const turret = {
  id: 'turret', name: 'SENTRIES', emoji: '🔫', tint: '#b388ff',
  blurb: 'Guns lock onto your row and column. Do not stand still.',
  duration: 15, weight: 2,

  start(g, e) {
    e.guns = [];
    const n = rndi(2, 3);
    for (let i = 0; i < n; i++) {
      const side = rndi(0, 3);
      const lane = rndi(g.lo, g.hi);
      const gun = { side, lane, cool: rnd(0.6, 1.8), locked: null };
      gun.hz = addHazard(g, {
        life: this.duration + 0.5, under: false, ignoreTime: true,
        draw: (h, gg, ctx, R) => {
          const [x, y] = gunPos(gg, gun);
          R.emoji(x, y, '🔫', 0.7, 1, gunAngle(gun));
          if (gun.locked !== null) {
            const axis = gun.side < 2 ? 'col' : 'row';
            R.beam(gg, axis, gun.locked, '#b388ff', 0.25 + 0.25 * Math.sin(h.t * 18), 0.18);
          }
        }
      });
      e.guns.push(gun);
    }
  },

  update(g, e, dt) {
    for (const gun of e.guns) {
      gun.cool -= dt;

      if (gun.locked === null && gun.cool < 0.7) {
        const [pcx, pcy] = g.playerCell();
        gun.locked = gun.side < 2 ? pcx : pcy;
        Sound.warn();
      }
      if (gun.cool > 0) continue;

      gun.lane = gun.locked;
      const [x, y] = gunPos(g, gun);
      const s = g.speed * 1.7;
      const v = gun.side === 0 ? [0, s] : gun.side === 1 ? [0, -s] : gun.side === 2 ? [s, 0] : [-s, 0];

      spawnBullet(g, {
        x, y, vx: v[0], vy: v[1], r: 0.2, color: '#b388ff',
        shape: 'bar', rot: Math.atan2(v[1], v[0]), trailRate: 0.02
      });

      Sound.fire();
      burst(g.fx, x, y, '#b388ff', 5, 3);
      gun.locked = null;
      gun.cool = rnd(1.6, 2.6);
    }
  },

  end(g, e) { e.guns.forEach(gun => { gun.hz.dead = true; }); }
};

function gunPos(g, gun) {
  if (gun.side === 0) return [gun.lane, g.lo - 1.1];
  if (gun.side === 1) return [gun.lane, g.hi + 1.1];
  if (gun.side === 2) return [g.lo - 1.1, gun.lane];
  return [g.hi + 1.1, gun.lane];
}
const gunAngle = gun => [Math.PI / 2, -Math.PI / 2, 0, Math.PI][gun.side];

/* ── 🛰️ SEEKERS ────────────────────────────────────────────────────────── */

export const seekers = {
  id: 'seekers', name: 'SEEKERS', emoji: '🛰️', tint: '#ff5252',
  blurb: 'Slow homing drones. Outmanoeuvre them — you cannot outrun them.',
  duration: 14, weight: 2,

  start(g, e) { e.timer = 0.2; e.made = 0; },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0 || e.made >= 4) return;
    e.timer = rnd(3, 4.5);
    e.made++;

    const corner = rndi(0, 3);
    const b = spawnBullet(g, {
      x: corner % 2 ? g.hi + 1 : g.lo - 1,
      y: corner < 2 ? g.lo - 1 : g.hi + 1,
      emoji: '🛰️', r: 0.28, color: '#ff5252', life: 9, trailRate: 0.05
    });

    b.vx = 0; b.vy = 0;
    b.update = (bb, gg, d) => {
      const [ax, ay] = aim(gg, bb.x, bb.y);
      const spd = gg.speed * 0.55;
      bb.vx += (ax * spd - bb.vx) * Math.min(1, d * 2.2);
      bb.vy += (ay * spd - bb.vy) * Math.min(1, d * 2.2);
      bb.x += bb.vx * d;
      bb.y += bb.vy * d;
      bb.rot = Math.atan2(bb.vy, bb.vx);
    };
    b.onExpire = (bb, gg) => {
      burst(gg.fx, bb.x, bb.y, '#ff5252', 12, 5, '💥');
      Sound.blast();
    };
  }
};

/* ── ⭕ CROSSFIRE ───────────────────────────────────────────────────────── */

export const crossfire = {
  id: 'crossfire', name: 'CROSSFIRE', emoji: '✳️', tint: '#00bcd4',
  blurb: 'Both edges of one lane fire at once, over and over.',
  duration: 12, weight: 2,

  start(g, e) { e.timer = 0.3; },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0) return;
    e.timer = rnd(0.5, 0.8);

    const axis = Math.random() < 0.5 ? 0 : 2;
    const lane = rndi(g.lo, g.hi);
    const s = g.speed * 1.15;

    edgeShot(g, axis, lane, s, { emoji: '✳️', r: 0.24, spin: 7, color: '#00bcd4' });
    edgeShot(g, axis + 1, lane, s, { emoji: '✳️', r: 0.24, spin: -7, color: '#00bcd4' });
  }
};

/* ── 🍥 CORKSCREW — shots winding in from the corners to the middle ─────── */

export const corkscrew = {
  id: 'corkscrew', name: 'CORKSCREW', emoji: '🍥', tint: '#38bdf8',
  blurb: 'Shots wind in from the corners, lap by lap, all the way to the centre.',
  duration: 18, weight: 3, suppressBase: true,

  start(g, e) {
    // both windings, built once — every shot picks one of them at random
    const turns = rndi(0, 3);
    e.paths = [spiralPath(g, turns, false), spiralPath(g, turns, true)];
    e.speed = g.speed * 1.6;
    e.timer = 0.3;
  },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0) return;

    /* Nothing new in the last 1.5s. Whatever is already winding keeps winding —
       those you have been reading since they launched. It is a *fresh* shot
       arriving as the plain missiles come back that made the handover unfair. */
    if (e.t > e.duration - 1.5) return;

    e.timer = rnd(1.8, 2.5);

    const path = e.paths[Math.random() < 0.5 ? 0 : 1];
    const b = spawnBullet(g, {
      x: path[0][0], y: path[0][1],
      emoji: '💫', r: 0.32, color: '#38bdf8',
      trailRate: 0.05, life: 40, spin: 5
    });

    b.pos = 0;
    b.update = (bb, gg, d) => {
      bb.pos += e.speed * d;

      const i = Math.floor(bb.pos);
      if (i >= path.length - 1) { bb.life = -1; return; }

      const t = bb.pos - i;
      const [ax, ay] = path[i], [bx, by] = path[i + 1];
      bb.x = ax + (bx - ax) * t;
      bb.y = ay + (by - ay) * t;
    };

    b.onExpire = (bb, gg) => {
      burst(gg.fx, bb.x, bb.y, '#38bdf8', 8, 3, '✨');
    };

    Sound.fire();
  }
};

/* Every cell of the grid in spiral order, outermost lap first, ending dead
   centre. Built clockwise from the top-left, then rotated a quarter turn at a
   time to move the start corner, and mirrored to wind the other way. */
function spiralPath(g, turns, ccw) {
  let top = g.lo, bottom = g.hi, left = g.lo, right = g.hi;
  let path = [];

  while (left <= right && top <= bottom) {
    for (let x = left; x <= right; x++) path.push([x, top]);
    top++;
    for (let y = top; y <= bottom; y++) path.push([right, y]);
    right--;
    if (top <= bottom) { for (let x = right; x >= left; x--) path.push([x, bottom]); bottom--; }
    if (left <= right) { for (let y = bottom; y >= top; y--) path.push([left, y]); left++; }
  }

  const c = g.center;
  for (let i = 0; i < turns; i++) path = path.map(([x, y]) => [c - (y - c), c + (x - c)]);
  if (ccw) path = path.map(([x, y]) => [2 * c - x, y]);

  return path;
}

/* ── curved shots ───────────────────────────────────────────────────────── */

/* Where a shot comes in, and which way it is pointed when it gets there.
   `aim` swings the heading off the straight-across line toward wherever you are
   standing: 0 leaves the old four lanes alone, 1 points it right at you.
   `spread` is the slop either side of that, in radians. */
function entry(g, aim = 0, spread = 0) {
  const lane = rnd(g.lo - 0.4, g.hi + 0.4);
  const off = 1.2;
  let ox, oy, ux, uy;

  switch (rndi(0, 3)) {
    case 0: ox = lane; oy = g.lo - off; ux = 0; uy = 1; break;
    case 1: ox = lane; oy = g.hi + off; ux = 0; uy = -1; break;
    case 2: ox = g.lo - off; oy = lane; ux = 1; uy = 0; break;
    default: ox = g.hi + off; oy = lane; ux = -1; uy = 0;
  }

  if (aim > 0 || spread > 0) {
    const from = Math.atan2(uy, ux);
    const to = Math.atan2(g.player.py - oy, g.player.px - ox);
    const turn = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;   // the short way round
    const a = from + turn * aim + rnd(-spread, spread);
    ux = Math.cos(a); uy = Math.sin(a);
  }

  return [ox, oy, ux, uy];
}

/* A shot that flies a heading but refuses to fly straight along it.
   `offset(t)` is how far it has slid sideways off that line and `slope(t)` is
   the rate of the slide — which is all the sprite needs to face where it is
   actually going.

   Everything is solved from the shot's own age rather than integrated frame to
   frame, so the curve is exactly the same shape whatever the frame rate, and a
   shot cannot drift off its path over a long flight. */
function curvedShot(g, [ox, oy, ux, uy], spd, spec, offset, slope, face = true) {
  const nx = -uy, ny = ux;                  // the heading's left normal

  const b = spawnBullet(g, { ...spec, x: ox, y: oy, vx: ux * spd, vy: uy * spd });

  b.update = (bb, gg, d) => {
    const off = offset(bb.t);
    bb.x = ox + ux * spd * bb.t + nx * off;
    bb.y = oy + uy * spd * bb.t + ny * off;

    if (!face) return;
    const s = slope(bb.t);
    bb.rot = Math.atan2(uy * spd + ny * s, ux * spd + nx * s);
  };

  return b;
}

/* ── 🐝 HORNETS — shots that weave ──────────────────────────────────────── */

/* Each one carries its own amplitude, frequency and phase, so no two weave the
   same line and none of them is where a straight read says it is. A random
   phase covers sine and cosine both — they are the same curve started at a
   different point in the swing.

   The volley is the plain fire's own: `spawnCount` shots every `spawnEvery`
   seconds, read live off the engine. So this replaces the normal missiles one
   for one — same weight of fire, none of it travelling in a straight line — and
   it keeps scaling with the run instead of freezing at whatever felt right. */

const HORNET = { amp: [0.7, 1.8], freq: [2.2, 4.0] };

export const hornets = {
  id: 'hornets', name: 'HORNETS', emoji: '🐝', tint: '#f59e0b',
  blurb: 'They do not fly straight. Every one weaves its own line across the board.',
  duration: 14, weight: 3, suppressBase: true,

  start(g, e) { e.timer = 0.35; },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0) return;
    e.timer = g.spawnEvery;

    for (let i = 0; i < g.spawnCount; i++) {
      const amp = rnd(HORNET.amp[0], HORNET.amp[1]) * (Math.random() < 0.5 ? 1 : -1);
      const freq = rnd(HORNET.freq[0], HORNET.freq[1]);
      const phase = rnd(0, Math.PI * 2);

      curvedShot(g, entry(g), g.speed * 0.95, {
        emoji: '🐝', r: 0.24, color: '#f59e0b', trailRate: 0.03, life: 16, spin: 0
      },
        t => amp * Math.sin(freq * t + phase),
        t => amp * freq * Math.cos(freq * t + phase));
    }

    Sound.fire();
  }
};

/* ── ⚾ CURVEBALLS — shots that arc ─────────────────────────────────────── */

/* Every ball is pitched *at* you rather than down a lane — it comes off the rim
   on a heading straight for where you are standing, give or take twenty degrees.
   Then it breaks: it swings off that heading, and the arc is solved so it
   arrives back on the line exactly at your range. It spends the whole flight
   looking like it is going wide and is not.

   That is the difference between this and a shot that crosses a lane. A lane
   shot only ever threatens the lane, so you leave the lane; this one has picked
   you, and the curve is the only reason it looks like it hasn't.

   The bulge stays shallow on purpose. A wide arc is one you can read from the
   far side of the board and stroll away from. Volume matches the plain fire
   exactly, the same way HORNETS does. */

const CURVE = { peak: [0.55, 1.35], spread: 0.35 };

export const curveballs = {
  id: 'curveballs', name: 'CURVEBALLS', emoji: '⚾', tint: '#2dd4bf',
  blurb: 'Pitched at you, breaking late. Read the curve, not the aim.',
  duration: 14, weight: 3, suppressBase: true,

  start(g, e) { e.timer = 0.35; },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0) return;
    e.timer = g.spawnEvery;

    const spd = g.speed * 1.05;

    for (let i = 0; i < g.spawnCount; i++) {
      const from = entry(g, 1, CURVE.spread);
      const peak = rnd(CURVE.peak[0], CURVE.peak[1]) * (Math.random() < 0.5 ? 1 : -1);

      // the break closes over the distance to you, not the width of the board,
      // so the ball is back on its heading at the moment it reaches your range
      const reach = Math.hypot(g.player.px - from[0], g.player.py - from[1]);
      const cross = Math.max(1.2, reach / spd);

      const u = 4 * peak / cross;
      const k = 2 * u / cross;

      curvedShot(g, from, spd, {
        emoji: '⚾', r: 0.26, color: '#2dd4bf', trailRate: 0.03, life: 16,
        spin: rnd(-9, 9)
      },
        t => u * t - 0.5 * k * t * t,
        null, false);                                // a ball has no front
    }

    Sound.fire();
  }
};

/* ── 🐴 KNIGHTS ─────────────────────────────────────────────────────────── */

/* Six horses off the rim — one on each corner, two more on the middle of one
   pair of edges, drawn each time — moving only as a chess knight moves. Each one
   waits, leaps, and comes down on a square it picked before it left the ground.
   Nothing marks that square: the horse rises off its shadow and the shadow keeps
   crossing the board underneath it, so the arc is the whole tell — read where it
   is going, or be somewhere else.

   They hunt properly: the square each one picks is the legal L that lowers its
   *knight distance* to you, breadth-first over the board, not the one that looks
   closest in a straight line. Two knights never claim the same square in the
   same beat, so six of them spread into a net instead of piling onto one cell.

   A horse's square kills while it stands there, which is what makes the net
   mean anything — but only once it has taken off for the first time, so the
   corner it arrives on can never catch you before you have seen it move. */

const KNIGHT_MOVES = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KNIGHT = {
  arrive: [1.0, 2.0],   // the opening beat, drawn per horse
  wait:   [0.9, 1.5],   // between landing and the next leap
  flight: 0.78          // time in the air, which is also your notice
};

export const knights = {
  id: 'knights', name: 'KNIGHTS', emoji: '🐴', tint: '#e2e8f0',
  blurb: 'Six horses come in off the rim. They move in L-shapes only — and they are hunting you.',
  duration: 16, weight: 2,

  start(g, e) {
    const mid = g.center;
    const squares = [
      [g.lo, g.lo], [g.hi, g.lo], [g.lo, g.hi], [g.hi, g.hi],
      // and two off the middle of one pair of edges, so the six never arrive
      // in the same shape twice running
      ...(Math.random() < 0.5
        ? [[g.lo, mid], [g.hi, mid]]
        : [[mid, g.lo], [mid, g.hi]])
    ];

    e.knights = squares.map(([cx, cy], i) => ({
      cx, cy, tx: cx, ty: cy, p: 0,
      phase: 'wait',
      timer: rnd(KNIGHT.arrive[0], KNIGHT.arrive[1]),
      armed: false,
      seed: i * 1.7
    }));

    for (const k of e.knights) {
      burst(g.fx, k.cx, k.cy, '#e2e8f0', 8, 3, '✨');
      ring(g.fx, k.cx, k.cy, '#e2e8f0', 0.2, 1.2, 0.4, 3);
    }
    Sound.warn();

    e.hz = addHazard(g, {
      life: this.duration + 0.5, under: false, ignoreTime: true,
      draw: (h, gg, ctx, R) => {
        for (const k of e.knights) {
          if (k.phase === 'flight') {
            const x = k.cx + (k.tx - k.cx) * k.p;
            const y = k.cy + (k.ty - k.cy) * k.p;
            const hop = Math.sin(Math.PI * k.p);

            R.dot(x, y, 0.17 - 0.06 * hop, '#000000', 0.3, 0);       // shadow stays on the board
            R.emoji(x, y - hop * 1.15, '🐴', 0.7 + 0.16 * hop, 1);
          } else {
            const bob = Math.sin(gg.time * 5 + k.seed) * 0.05;
            R.cellStroke(k.cx, k.cy, '#e2e8f0', k.armed ? 0.45 : 0.2, 2);
            R.emoji(k.cx, k.cy + bob, '🐴', 0.7, k.armed ? 1 : 0.75);
          }
        }
      }
    });
  },

  update(g, e, dt) {
    // squares already spoken for this beat, so two horses never share a landing
    const claimed = new Set(
      e.knights.filter(k => k.phase === 'flight').map(k => k.tx + ',' + k.ty));

    for (const k of e.knights) {
      if (k.phase === 'flight') {
        k.p += dt / KNIGHT.flight;
        if (k.p < 1) continue;

        k.cx = k.tx; k.cy = k.ty;
        k.p = 0;
        k.phase = 'wait';
        k.timer = rnd(KNIGHT.wait[0], KNIGHT.wait[1]);

        Sound.hoof();
        shake(g.fx, 3);
        burst(g.fx, k.cx, k.cy, '#e2e8f0', 7, 3);
      } else {
        k.timer -= dt;
        if (k.timer <= 0) {
          const square = chooseSquare(g, k, claimed);
          if (square) {
            [k.tx, k.ty] = square;
            claimed.add(k.tx + ',' + k.ty);
            k.phase = 'flight';
            k.p = 0;
            k.armed = true;
            Sound.step();
          } else {
            k.timer = 0.4;         // boxed in — try again shortly
          }
        }
      }

      if (k.armed && k.phase === 'wait') {
        const [pcx, pcy] = g.playerCell();
        if (pcx === k.cx && pcy === k.cy) g.kill('captured by a knight', '🐴');
      }
    }
  },

  end(g, e) { if (e.hz) e.hz.dead = true; }
};

/* The L that gets this horse closest to you, counted in knight moves rather
   than in cells — the two disagree constantly, and only the first is what a
   knight actually has to travel. Ties are broken evenly. */
function chooseSquare(g, k, claimed) {
  const [px, py] = g.playerCell();
  const at = knightField(g, px, py);

  let best = null, bestD = Infinity, ties = 0;

  for (const [dx, dy] of KNIGHT_MOVES) {
    const nx = k.cx + dx, ny = k.cy + dy;
    if (!g.inside(nx, ny)) continue;

    const d = at(nx, ny) + (claimed.has(nx + ',' + ny) ? 8 : 0);
    if (d < bestD) { bestD = d; best = [nx, ny]; ties = 1; }
    else if (d === bestD && Math.random() < 1 / ++ties) best = [nx, ny];
  }

  return best;
}

/* Breadth-first over knight moves from where you are standing: how many leaps
   each square of the board is from you. */
function knightField(g, sx, sy) {
  const n = g.hi - g.lo + 1;
  const idx = (x, y) => (y - g.lo) * n + (x - g.lo);
  const dist = new Array(n * n).fill(-1);
  const queue = [[sx, sy]];

  dist[idx(sx, sy)] = 0;

  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    const d = dist[idx(x, y)];
    for (const [dx, dy] of KNIGHT_MOVES) {
      const nx = x + dx, ny = y + dy;
      if (!g.inside(nx, ny) || dist[idx(nx, ny)] !== -1) continue;
      dist[idx(nx, ny)] = d + 1;
      queue.push([nx, ny]);
    }
  }

  return (x, y) => {
    if (!g.inside(x, y)) return 99;
    const d = dist[idx(x, y)];
    return d < 0 ? 99 : d;
  };
}

export const BARRAGE = [laser, bombRain, boomerang, flower, spiral, meteor, snake, turret, seekers,
  crossfire, corkscrew, knights, hornets, curveballs];
