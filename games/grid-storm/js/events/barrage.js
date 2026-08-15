/* Events that throw things at you.

   Every event is `{ id, name, emoji, blurb, tint, duration, weight, start,
   update, end }`. `e` is the live instance (its own scratch space); `g` is the
   game. Nothing here touches the DOM or pixels — only cells and seconds. */

import { spawnBullet, addHazard, edgeShot } from '../bullets.js';
import { burst, ring, flash, shake } from '../fx.js';
import { Sound } from '../audio.js';
import { rnd, rndi, clamp } from '../config.js';

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

export const spiral = {
  id: 'spiral', name: 'SPIRAL', emoji: '🌀', tint: '#00e5ff',
  blurb: 'A turning fountain in the middle. Walk with the arms, not into them.',
  duration: 13, weight: 2,

  start(g, e) {
    e.angle = rnd(0, 6.28);
    e.timer = 1.8;        // it winds up in plain sight before it throws anything
    e.arms = rndi(3, 4);
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
    e.angle += dt * (0.6 + 0.9 * Math.min(1, e.t / 3)) * e.spinDir;
    e.timer -= dt;
    if (e.timer > 0) return;
    e.timer = e.t < 4 ? 0.22 : 0.14;   // eases into its full rate

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
    e.step = 0.24;
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

    // leave a body segment behind
    spawnBullet(g, {
      x: e.hx, y: e.hy, emoji: '🟢', r: 0.26, color: '#4caf50',
      life: 2.4, trailRate: 0, vx: 0, vy: 0
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

export const BARRAGE = [laser, bombRain, boomerang, flower, spiral, meteor, snake, turret, seekers, crossfire];
