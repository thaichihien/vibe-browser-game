/* Events that change the rules instead of adding bullets.
   They set a flag on `g.flags` in start() and must clear it in end() — the
   engine never guesses. */

import { spawnBullet, addHazard } from '../bullets.js';
import { floatText, confetti } from '../fx.js';
import { Sound } from '../audio.js';
import { rnd, pick, clamp } from '../config.js';

/* ── 🧲 GRAVITY ────────────────────────────────────────────────────────── */

export const gravity = {
  id: 'gravity', name: 'GRAVITY', emoji: '🧲', tint: '#ff8a3d',
  blurb: 'Something heavy pulls you down a cell at a time. The bottom edge is not a wall.',
  duration: 14, weight: 3,

  start(g, e) {
    g.flags.gravity = true;
    e.timer = 1.2;
    e.hz = addHazard(g, {
      life: this.duration + 0.4, under: true, ignoreTime: true,
      draw: (h, gg, ctx, R) => {
        for (let i = 0; i < 10; i++) {
          const x = gg.lo + ((i * 1.7 + h.t * 0.6) % (gg.hi - gg.lo + 1));
          const y = gg.lo + ((i * 3.1 + h.t * 3.4) % (gg.hi - gg.lo + 1));
          R.emoji(x, y, '⬇️', 0.4, 0.16);
        }
        for (let cx = gg.lo; cx <= gg.hi; cx++) R.cellRect(cx, gg.hi, '#ff8a3d', 0.10);
      }
    });
  },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0) return;
    e.timer = clamp(1.05 - e.t * 0.02, 0.6, 1.05);

    g.shove(0, 1, 'dragged off the bottom edge', '🧲');
    floatText(g.fx, g.player.px, g.player.py - 0.7, '⬇', '#ff8a3d', 0.6, 0.5);
  },

  end(g, e) { g.flags.gravity = false; if (e.hz) e.hz.dead = true; }
};

/* ── 🌑 BLACKOUT ───────────────────────────────────────────────────────── */

export const fog = {
  id: 'fog', name: 'BLACKOUT', emoji: '🌑', tint: '#5a6478',
  blurb: 'The lights go out. You only see what is near you.',
  duration: 12, weight: 2,

  start(g) { g.flags.fog = 0; },
  update(g, e, dt) {
    const fadeIn = Math.min(1, e.t / 1.0);
    const fadeOut = Math.min(1, (e.duration - e.t) / 1.0);
    g.flags.fog = Math.min(fadeIn, fadeOut);
  },
  end(g) { g.flags.fog = 0; }
};

/* ── 🌀 WRAP PORTALS ───────────────────────────────────────────────────── */

export const warp = {
  id: 'warp', name: 'WRAP PORTALS', emoji: '🌀', tint: '#b388ff',
  blurb: 'Edges connect. You cannot fall off — but neither can the bullets.',
  duration: 15, weight: 2,

  start(g, e) {
    g.flags.wrap = true;
    e.hz = addHazard(g, {
      life: this.duration + 0.4, under: true, ignoreTime: true,
      draw: (h, gg, ctx, R) => {
        for (let i = gg.lo; i <= gg.hi; i += 2) {
          const a = 0.35 + 0.25 * Math.sin(h.t * 3 + i);
          R.emoji(i, gg.lo - 0.9, '🌀', 0.45, a, h.t * 2);
          R.emoji(i, gg.hi + 0.9, '🌀', 0.45, a, -h.t * 2);
          R.emoji(gg.lo - 0.9, i, '🌀', 0.45, a, h.t * 2);
          R.emoji(gg.hi + 0.9, i, '🌀', 0.45, a, -h.t * 2);
        }
      }
    });
  },
  end(g, e) { g.flags.wrap = false; if (e.hz) e.hz.dead = true; }
};

/* ── ⏩ OVERCLOCK ──────────────────────────────────────────────────────── */

export const haste = {
  id: 'haste', name: 'OVERCLOCK', emoji: '⏩', tint: '#ffeb3b',
  blurb: 'Everything on the board runs faster. Everything except you.',
  duration: 10, weight: 2,

  start(g) { Sound.charge(); },
  update(g, e, dt) {
    const ramp = Math.min(1, e.t / 0.8, (e.duration - e.t) / 0.8);
    g.timeScale = 1 + 0.6 * Math.max(0, ramp);
  },
  end(g) { g.timeScale = 1; }
};

/* ── ❄️ BLACK ICE ──────────────────────────────────────────────────────── */

export const ice = {
  id: 'ice', name: 'BLACK ICE', emoji: '❄️', tint: '#7cf7ff',
  blurb: 'Every step slides one extra cell. Aim before you move.',
  duration: 13, weight: 3,

  start(g, e) {
    g.flags.ice = true;
    e.hz = addHazard(g, {
      life: this.duration + 0.4, under: true, ignoreTime: true,
      draw: (h, gg, ctx, R) => {
        for (let cy = gg.lo; cy <= gg.hi; cy++)
          for (let cx = gg.lo; cx <= gg.hi; cx++)
            if ((cx * 7 + cy * 13) % 5 === 0) R.cellRect(cx, cy, '#7cf7ff', 0.07);
        for (let i = 0; i < 8; i++) {
          const x = gg.lo + ((i * 2.3 + h.t * 1.1) % (gg.hi - gg.lo + 1));
          R.emoji(x, gg.lo + ((i * 3.7 + h.t * 0.9) % (gg.hi - gg.lo + 1)), '❄️', 0.4, 0.2);
        }
      }
    });
  },
  end(g, e) { g.flags.ice = false; if (e.hz) e.hz.dead = true; }
};

/* ── 🔃 SCRAMBLED CONTROLS ─────────────────────────────────────────────── */

export const invert = {
  id: 'invert', name: 'SCRAMBLE', emoji: '🔃', tint: '#ff4dd2',
  blurb: 'Your inputs come out rotated. Trust the arrows, not your hands.',
  duration: 11, weight: 2,

  start(g, e) {
    e.turn = pick([1, 2, 3]);          // quarter-turns applied to your input
    g.flags.invert = e.turn;
    floatText(g.fx, g.center, g.center - 1, e.turn === 2 ? 'REVERSED' : 'ROTATED', '#ff4dd2', 1.6, 0.7);
  },
  end(g) { g.flags.invert = 0; }
};

/* ── 👻 MIRROR GHOST ───────────────────────────────────────────────────── */

export const ghost = {
  id: 'ghost', name: 'MIRROR GHOST', emoji: '👻', tint: '#9fb3c8',
  blurb: 'Your reflection copies you across the board — and shoots back.',
  duration: 14, weight: 2,

  start(g, e) {
    e.timer = 1.4;
    e.hz = addHazard(g, {
      life: this.duration + 0.4, under: false, ignoreTime: true,
      draw: (h, gg, ctx, R) => {
        const [x, y] = mirror(gg);
        R.emoji(x, y, '👻', 0.85, 0.85, Math.sin(h.t * 3) * 0.2);
      }
    });
  },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0) return;
    e.timer = rnd(1.3, 2.0);

    const [x, y] = mirror(g);
    const dx = g.player.px - x, dy = g.player.py - y;
    const d = Math.hypot(dx, dy) || 1;
    const s = g.speed * 1.15;

    spawnBullet(g, {
      x, y, vx: (dx / d) * s, vy: (dy / d) * s,
      emoji: '💀', r: 0.24, color: '#9fb3c8', trailRate: 0.04
    });
    Sound.fire();
  },

  end(g, e) { if (e.hz) e.hz.dead = true; }
};

const mirror = g => [2 * g.center - g.player.px, 2 * g.center - g.player.py];

/* ── 💠 SHIELD DROP — the one kind thing in the storm ──────────────────── */

export const shieldDrop = {
  id: 'shield', name: 'SHIELD DROP', emoji: '💠', tint: '#7cf7ff',
  blurb: 'Grab it. It eats one hit for you.',
  duration: 9, weight: 2, relief: true,

  start(g, e) {
    [e.cx, e.cy] = g.randCell();
    e.hz = addHazard(g, {
      life: this.duration, under: false, ignoreTime: true,
      update: (h, gg) => {
        const [cx, cy] = gg.playerCell();
        if (cx !== e.cx || cy !== e.cy) return;
        h.dead = true;
        gg.player.shield = 1;
        Sound.pickup();
        confetti(gg.fx, e.cx, e.cy, ['💠', '✨', '🛡️'], 12);
        floatText(gg.fx, e.cx, e.cy - 0.6, 'SHIELD UP', '#7cf7ff', 1.2, 0.5);
      },
      draw: (h, gg, ctx, R) => {
        const bob = Math.sin(h.t * 4) * 0.12;
        R.cellStroke(e.cx, e.cy, '#7cf7ff', 0.5 + 0.4 * Math.sin(h.t * 6), 2);
        R.emoji(e.cx, e.cy + bob, '💠', 0.8, 1, Math.sin(h.t * 2) * 0.3);
      }
    });
  },
  end(g, e) { if (e.hz) e.hz.dead = true; }
};

export const MODIFIER = [gravity, fog, warp, haste, ice, invert, ghost, shieldDrop];
