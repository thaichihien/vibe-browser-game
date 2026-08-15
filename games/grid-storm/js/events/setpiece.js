/* Set-piece events: the ones that own the whole board for a while.
   Anything marked `solo` pauses the plain missile spawner and refuses to share
   the stage with another event — they are already a full screen of danger. */

import { spawnBullet, addHazard, cellBlast } from '../bullets.js';
import { burst, ring, flash, shake, floatText, confetti } from '../fx.js';
import { Sound } from '../audio.js';
import { rnd, rndi, clamp } from '../config.js';

/* ── 🔲 GRID EXPANSION — always the first event, and it never ends ──────── */

export const expand = {
  id: 'expand', name: 'GRID EXPANSION', emoji: '🔲', tint: '#7cf7ff',
  blurb: 'The arena locks open at 9×9 — and every new edge shoots too.',
  duration: 4, weight: 0, permanent: true,

  start(g) {
    g.expandGrid();
    Sound.expand();
    flash(g.fx, '#7cf7ff', 0.5);
    shake(g.fx, 12);
    confetti(g.fx, g.center, g.center, ['🔲', '✨', '🟦'], 24);
    ring(g.fx, g.center, g.center, '#7cf7ff', 2, 7, 0.9, 6);
  }
};

/* ── 💠 CLOSING RINGS ───────────────────────────────────────────────────── */

export const rings = {
  id: 'rings', name: 'CLOSING RINGS', emoji: '💠', tint: '#00e5ff',
  blurb: 'Five rings collapse toward the middle. Each has one gap.',
  duration: 19, weight: 3, solo: true,

  start(g, e) { e.timer = 0.6; e.made = 0; },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0 || e.made >= 5) return;
    e.timer = 3;
    e.made++;
    spawnRing(g, 5.0);
  }
};

function spawnRing(g, span = 5) {
  const gap = rnd(0, Math.PI * 2);
  const half = 0.5;               // half-width of the escape gap, radians
  const r0 = (g.hi - g.lo + 1) / 2 + 2.5;   // just outside whatever grid is live

  Sound.warn();

  addHazard(g, {
    life: span + 0.4, under: false, r: r0,
    update(h, gg) {
      h.r = r0 * (1 - h.t / span);
      if (h.r <= 0.25) {
        if (!h.popped) {
          h.popped = true;
          burst(gg.fx, gg.center, gg.center, '#00e5ff', 20, 6, '💠');
          Sound.blast();
          shake(gg.fx, 6);
        }
        return;
      }
      const dx = gg.player.px - gg.center, dy = gg.player.py - gg.center;
      const d = Math.hypot(dx, dy);
      if (Math.abs(d - h.r) > 0.42) return;

      const a = Math.atan2(dy, dx);
      const da = Math.abs(((a - gap + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (da > half) gg.kill('crushed by a closing ring', '💠');
    },
    draw(h, gg, ctx, R) {
      if (h.r <= 0.25) return;
      const a0 = gap + half, a1 = gap - half + Math.PI * 2;
      R.arc(gg.center, gg.center, h.r, a0, a1, '#00e5ff', 9, 0.95);
      R.arc(gg.center, gg.center, h.r, a0, a1, '#ffffff', 3, 0.5);

      // sparkle the two lips of the gap so the exit reads at a glance
      R.emoji(gg.center + Math.cos(gap) * h.r, gg.center + Math.sin(gap) * h.r, '✨', 0.5, 0.9);
    }
  });
}

/* ── 🧱 WALL RUSH ───────────────────────────────────────────────────────── */

export const wallRush = {
  id: 'walls', name: 'WALL RUSH', emoji: '🧱', tint: '#ff9800',
  blurb: 'Ten walls from one side. Each leaves exactly one hole.',
  duration: 16, weight: 3, solo: true,

  start(g, e) {
    e.dir = rndi(0, 3);
    e.gap = rndi(g.lo, g.hi);
    e.timer = 0.8;
    e.made = 0;
    e.speed = g.speed * 0.8;
  },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0 || e.made >= 10) return;
    e.timer = 1.05;
    e.made++;

    e.gap = clamp(e.gap + rndi(-2, 2), g.lo, g.hi);
    Sound.fire();

    for (let lane = g.lo; lane <= g.hi; lane++) {
      if (lane === e.gap) continue;

      const s = e.speed;
      const spec = {
        emoji: '🧱', r: 0.3, color: '#ff9800', trailRate: 0, life: 20
      };
      if (e.dir === 0) { spec.x = lane; spec.y = g.lo - 1.5; spec.vy = s; }
      if (e.dir === 1) { spec.x = lane; spec.y = g.hi + 1.5; spec.vy = -s; }
      if (e.dir === 2) { spec.x = g.lo - 1.5; spec.y = lane; spec.vx = s; }
      if (e.dir === 3) { spec.x = g.hi + 1.5; spec.y = lane; spec.vx = -s; }

      spawnBullet(g, spec);
    }
  }
};

/* ── ☢️ MINEFIELD ──────────────────────────────────────────────────────── */

export const mines = {
  id: 'mines', name: 'MINEFIELD', emoji: '☢️', tint: '#ffeb3b',
  blurb: 'Cells arm themselves under your feet. Keep moving.',
  duration: 14, weight: 2,

  start(g, e) { e.timer = 0.3; },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0) return;
    e.timer = rnd(0.45, 0.8);

    // one mine is aimed where you are standing — the rest are luck
    const near = Math.random() < 0.45;
    const [pcx, pcy] = g.playerCell();
    const cell = near
      ? [clamp(pcx + rndi(-1, 1), g.lo, g.hi), clamp(pcy + rndi(-1, 1), g.lo, g.hi)]
      : g.randCell();

    cellBlast(g, [cell], {
      warn: 1.7, burn: 0.45, color: '#ffeb3b', emoji: '☢️',
      onBurn: (h, gg) => { burst(gg.fx, cell[0], cell[1], '#ffeb3b', 10, 4, '☢️'); Sound.blast(); }
    });
  }
};

/* ── 🔥 FLOOR IS LAVA ───────────────────────────────────────────────────── */

export const lava = {
  id: 'lava', name: 'FLOOR IS LAVA', emoji: '🔥', tint: '#ff4d1a',
  blurb: 'Only the marked tiles survive the flood. Stand on one.',
  duration: 15, weight: 3, solo: true,

  start(g, e) { e.timer = 0.8; e.rounds = 0; },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0 || e.rounds >= 3) return;
    e.rounds++;
    e.timer = 5.0;

    const safe = [];
    const n = Math.max(4, 8 - e.rounds);
    for (let i = 0; i < n; i++) safe.push(g.randCell());
    const key = ([x, y]) => x + ',' + y;
    const safeSet = new Set(safe.map(key));

    const warn = 3.0, burn = 1.3;
    Sound.charge();

    addHazard(g, {
      life: warn + burn, under: true,
      draw(h, gg, ctx, R) {
        const armed = h.t >= warn;
        const p = armed ? 1 - (h.t - warn) / burn : h.t / warn;

        for (let cy = gg.lo; cy <= gg.hi; cy++) {
          for (let cx = gg.lo; cx <= gg.hi; cx++) {
            if (safeSet.has(cx + ',' + cy)) {
              R.cellRect(cx, cy, '#1c7c3a', 0.85);
              R.cellStroke(cx, cy, '#7dff9f', 0.9, 2);
              continue;
            }
            R.cellRect(cx, cy, armed ? '#ff4d1a' : '#5c1f0a', armed ? 0.55 + 0.35 * p : 0.25 + 0.35 * (h.t / warn));
          }
        }
        for (const [sx, sy] of safe) R.emoji(sx, sy, '🟩', 0.55, 0.85);
        if (armed) {
          for (let i = 0; i < 6; i++) {
            const [cx, cy] = [rndi(gg.lo, gg.hi), rndi(gg.lo, gg.hi)];
            if (!safeSet.has(cx + ',' + cy)) R.emoji(cx, cy, '🔥', 0.6, 0.5 + 0.5 * p);
          }
        }
      },
      update(h, gg) {
        if (h.t < warn) return;
        if (!h.fired) {
          h.fired = true;
          Sound.blast();
          shake(gg.fx, 10);
          flash(gg.fx, '#ff4d1a', 0.25);
        }
        const [pcx, pcy] = gg.playerCell();
        if (!safeSet.has(pcx + ',' + pcy)) gg.kill('burned by the floor', '🔥');
      }
    });
  }
};

/* ── 🕳️ BLACK HOLE ─────────────────────────────────────────────────────── */

export const blackhole = {
  id: 'blackhole', name: 'BLACK HOLE', emoji: '🕳️', tint: '#b388ff',
  blurb: 'It drags you a cell at a time. Bullets bend toward it too.',
  duration: 13, weight: 2,

  start(g, e) {
    [e.cx, e.cy] = g.randCell();
    e.pull = 1.0;
    e.hz = addHazard(g, {
      life: this.duration + 0.4, under: true, ignoreTime: true,
      draw: (h, gg, ctx, R) => {
        R.cellRect(e.cx, e.cy, '#0a0616', 0.9);
        for (let i = 1; i <= 3; i++) {
          R.arc(e.cx, e.cy, i * 0.7 + Math.sin(h.t * 2 + i) * 0.1, 0, Math.PI * 2, '#b388ff', 2, 0.25);
        }
        R.emoji(e.cx, e.cy, '🕳️', 0.9, 1, h.t * 1.6);
      }
    });
  },

  update(g, e, dt) {
    // bend every bullet a little
    for (const b of g.bullets) {
      const dx = e.cx - b.x, dy = e.cy - b.y;
      const d = Math.max(0.6, Math.hypot(dx, dy));
      b.vx += (dx / d) * dt * 2.2;
      b.vy += (dy / d) * dt * 2.2;
    }

    e.pull -= dt;
    if (e.pull > 0) return;
    e.pull = 1.05;

    const dx = e.cx - g.player.gx, dy = e.cy - g.player.gy;
    if (!dx && !dy) return;
    const step = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
    g.shove(step[0], step[1], 'swallowed by the black hole', '🕳️');
    floatText(g.fx, g.player.px, g.player.py - 0.7, 'PULL', '#b388ff', 0.7, 0.42);
  },

  end(g, e) { if (e.hz) e.hz.dead = true; }
};

/* ── 🧊 CRUMBLING EDGES ────────────────────────────────────────────────── */

export const crumble = {
  id: 'crumble', name: 'CRUMBLING EDGES', emoji: '🧊', tint: '#ff2e5b',
  blurb: 'The outer rings fall away. The middle is the only floor left.',
  duration: 16, weight: 2,

  start(g, e) {
    e.rings = 0;
    e.timer = 2.5;
    e.gone = new Set();
    e.hz = addHazard(g, {
      life: this.duration + 0.4, under: true, ignoreTime: true,
      update: (h, gg) => {
        const [cx, cy] = gg.playerCell();
        if (e.gone.has(cx + ',' + cy)) gg.kill('stood on nothing', '🧊');
      },
      draw: (h, gg, ctx, R) => {
        for (const k of e.gone) {
          const [cx, cy] = k.split(',').map(Number);
          R.cellRect(cx, cy, '#05070d', 0.92);
          R.cellStroke(cx, cy, '#ff2e5b', 0.35, 1);
        }
      }
    });
  },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0 || e.rings >= 2) return;
    e.timer = 4.2;

    const r = e.rings++;
    const lo = g.lo + r, hi = g.hi - r;
    if (hi - lo < 3) return;      // never crumble down past a 4×4 core

    Sound.blast();
    shake(g.fx, 8);

    for (let i = lo; i <= hi; i++) {
      for (const [cx, cy] of [[i, lo], [i, hi], [lo, i], [hi, i]]) {
        e.gone.add(cx + ',' + cy);
        if (Math.random() < 0.25) burst(g.fx, cx, cy, '#ff2e5b', 3, 3);
      }
    }
    floatText(g.fx, g.center, g.lo + 0.5, 'THE EDGE IS GONE', '#ff2e5b', 1.4, 0.55);
  },

  end(g, e) { if (e.hz) e.hz.dead = true; }
};

export const SETPIECE = [rings, wallRush, mines, lava, blackhole, crumble];
