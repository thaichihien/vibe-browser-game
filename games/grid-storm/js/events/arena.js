/* Events that attack the floor itself rather than throwing things across it:
   holes punched in the grid, a numbered route you have to run, missiles too big
   to dodge sideways, and an arena that closes to 3×3. */

import { spawnBullet, addHazard } from '../bullets.js';
import { burst, ring, flash, shake, floatText, confetti } from '../fx.js';
import { Sound } from '../audio.js';
import { rnd, rndi, pick, clamp, BIG_SIZE } from '../config.js';

const key = (x, y) => x + ',' + y;

/* ── 🕳️ SINKHOLES — three 3×3 blocks drop out of the floor ─────────────── */

export const holes = {
  id: 'holes', name: 'SINKHOLES', emoji: '🕳️', tint: '#c026d3',
  blurb: 'Three 3×3 blocks fall away. Standing on one is standing on nothing.',
  duration: 16, weight: 3,

  start(g, e) {
    e.timer = 0.8;
    e.made = 0;
    e.open = new Set();
    e.pending = [];

    e.hz = addHazard(g, {
      life: this.duration + 0.4, under: true, ignoreTime: true,

      update: (h, gg) => {
        const [cx, cy] = gg.playerCell();
        if (e.open.has(key(cx, cy))) gg.kill('fell through the floor', '🕳️', true);
      },

      draw: (h, gg, ctx, R) => {
        // still cracking open
        for (const p of e.pending) {
          const k = clamp(p.warn / 1.6, 0, 1);
          for (const [cx, cy] of p.cells) {
            R.cellRect(cx, cy, '#2a0a33', 0.25 + 0.5 * k);
            R.cellStroke(cx, cy, '#c026d3', 0.4 + 0.5 * Math.abs(Math.sin(h.t * 10)), 2);
          }
          R.emoji(p.cx, p.cy, '⚠️', 0.85, 0.55 + 0.45 * Math.sin(h.t * 10));
        }
        // open, and fatal
        for (const k of e.open) {
          const [cx, cy] = k.split(',').map(Number);
          R.cellRect(cx, cy, '#05060c', 0.96, 1, 4);
        }
        for (const p of e.holes || []) R.emoji(p.cx, p.cy, '🕳️', 1.1, 0.9);
      }
    });

    e.holes = [];
  },

  update(g, e, dt) {
    for (const p of e.pending) p.warn += dt;

    // anything past its warning drops out
    const ready = e.pending.filter(p => p.warn >= 1.6);
    if (ready.length) {
      e.pending = e.pending.filter(p => p.warn < 1.6);
      for (const p of ready) {
        for (const c of p.cells) e.open.add(key(c[0], c[1]));
        e.holes.push(p);
        Sound.blast();
        shake(g.fx, 8);
        burst(g.fx, p.cx, p.cy, '#c026d3', 16, 5, '🕳️');
      }
    }

    e.timer -= dt;
    if (e.timer > 0 || e.made >= 3) return;
    e.timer = 1.6;

    const spot = findSpot(g, e);
    if (!spot) return;      // no room right now — try again next tick, still owed

    e.made++;
    e.pending.push(spot);
    Sound.warn();
  },

  end(g, e) { if (e.hz) e.hz.dead = true; }
};

/* A 3×3 block clear of every hole already open or opening. Every candidate is
   enumerated rather than sampled, so the third hole cannot be lost to bad luck
   on a board where a spot does exist. */
function findSpot(g, e) {
  const taken = new Set(e.open);
  for (const p of e.pending) for (const [x, y] of p.cells) taken.add(key(x, y));

  const spots = [];
  for (let cy = g.lo + 1; cy <= g.hi - 1; cy++) {
    for (let cx = g.lo + 1; cx <= g.hi - 1; cx++) {
      const cells = [];
      let clash = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx, y = cy + dy;
          if (taken.has(key(x, y))) clash = true;
          cells.push([x, y]);
        }
      }
      if (!clash) spots.push({ cx, cy, cells, warn: 0 });
    }
  }

  return spots.length ? spots[rndi(0, spots.length - 1)] : null;
}

/* ── 🔢 NUMBER RUN — step 1 to 5, in order ─────────────────────────────── */

const DIGITS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
const LIMIT = 12;          // seconds to finish the route
const PENALTY = [5, 6];    // +5 missiles, for 6 seconds

export const numbers = {
  id: 'numbers', name: 'NUMBER RUN', emoji: '🔢', tint: '#4ade80',
  blurb: 'Touch 1 to 5 in order before the clock runs out. Out of order and you start again.',
  duration: LIMIT + 1.2, weight: 3,

  start(g, e) {
    e.step = 0;
    e.done = false;

    // one distinct cell per digit, none of them under your feet
    const [pcx, pcy] = g.playerCell();
    const taken = new Set([key(pcx, pcy)]);
    e.cells = [];

    while (e.cells.length < DIGITS.length) {
      const [cx, cy] = g.randCell();
      if (taken.has(key(cx, cy))) continue;
      taken.add(key(cx, cy));
      e.cells.push([cx, cy]);
    }

    e.hz = addHazard(g, {
      life: this.duration, under: true, ignoreTime: true,

      update: (h, gg) => {
        if (e.done) return;
        const [cx, cy] = gg.playerCell();

        for (let i = 0; i < e.cells.length; i++) {
          if (e.cells[i][0] !== cx || e.cells[i][1] !== cy) continue;

          if (i === e.step) {
            e.step++;
            Sound.pickup();
            burst(gg.fx, cx, cy, '#4ade80', 12, 4, '✨');

            if (e.step >= DIGITS.length) {
              e.done = true;
              Sound.bloom();
              confetti(gg.fx, cx, cy, ['🎉', '✨', '🟩'], 18);
              floatText(gg.fx, gg.center, gg.center - 1, 'ROUTE CLEAR', '#4ade80', 1.5, 0.6);
            }
          } else if (i > e.step) {
            // stepped on a later number — back to the start of the route
            if (e.step > 0) {
              Sound.blast();
              shake(gg.fx, 6);
              burst(gg.fx, cx, cy, '#ff2e5b', 12, 4, '❌');
              floatText(gg.fx, cx, cy - 0.7, 'WRONG', '#ff2e5b', 0.9, 0.45);
            }
            e.step = 0;
          }
        }
      },

      draw: (h, gg, ctx, R) => {
        const left = Math.max(0, LIMIT - h.t);
        const panic = left < 4 ? 1 : 0;

        for (let i = 0; i < e.cells.length; i++) {
          const [cx, cy] = e.cells[i];
          const cleared = i < e.step;
          const next = i === e.step && !e.done;

          R.cellRect(cx, cy, cleared ? '#14532d' : '#0f2a1b', cleared ? 0.8 : 0.6);
          if (next) {
            const beat = 0.5 + 0.5 * Math.sin(h.t * (7 + panic * 9));
            R.cellStroke(cx, cy, '#4ade80', 0.55 + 0.45 * beat, 3);
          }
          R.emoji(cx, cy, DIGITS[i], 0.72, cleared ? 0.35 : 1);
          if (cleared) R.emoji(cx, cy, '✅', 0.5, 0.85);
        }
      }
    });
  },

  update(g, e, dt) {
    if (e.done || e.punished || e.t < LIMIT) return;

    e.punished = true;
    g.addMissiles(PENALTY[0], PENALTY[1]);
    Sound.event();
    shake(g.fx, 12);
    flash(g.fx, '#ff2e5b', 0.3);
    floatText(g.fx, g.center, g.center - 1, 'TOO SLOW', '#ff2e5b', 1.6, 0.62);
  },

  end(g, e) { if (e.hz) e.hz.dead = true; }
};

/* ── 🛸 GIANT MISSILES — 3×3, and they replace the normal fire ──────────── */

const HULKS = ['🛸', '👾', '🌑', '🪨', '🔮'];

export const giants = {
  id: 'giants', name: 'GIANT MISSILES', emoji: '🛸', tint: '#f472b6',
  blurb: 'Huge, and the only thing firing. Up to four of them at once.',
  duration: 16, weight: 3, suppressBase: true,

  start(g, e) { e.timer = 0.4; e.cap = rndi(2, 4); },

  update(g, e, dt) {
    const live = g.bullets.filter(b => b.giant).length;

    e.timer -= dt;
    if (e.timer > 0 || live >= e.cap) return;

    e.timer = 0.2;
    e.cap = rndi(2, 4);                         // how crowded it gets, re-rolled

    const dir = rndi(0, 3);
    const lane = rndi(g.lo + 1, g.hi - 1);      // keep the whole body on the grid
    const s = g.speed * 0.98;

    const spec = {
      giant: true, round: true, r: 1.05,        // circle, sized to the sprite
      emoji: pick(HULKS), color: '#f472b6',
      // no trail: it is sized from the radius, and at this radius it would
      // paint a dot big enough to hide the sprite
      trailRate: 0, life: 24, spin: rnd(-1.1, 1.1)
    };
    if (dir === 0) { spec.x = lane; spec.y = g.lo - 2.2; spec.vy = s; }
    if (dir === 1) { spec.x = lane; spec.y = g.hi + 2.2; spec.vy = -s; }
    if (dir === 2) { spec.x = g.lo - 2.2; spec.y = lane; spec.vx = s; }
    if (dir === 3) { spec.x = g.hi + 2.2; spec.y = lane; spec.vx = -s; }

    // no footprint drawing: the sprite is the hitbox now, so the default
    // emoji renderer (size = r × 2.4) is exactly what you have to dodge
    spawnBullet(g, spec);

    Sound.charge();
    shake(g.fx, 4);
  }
};

/* ── 🔻 CLOSING ARENA — one warning, then straight to 3×3 ──────────────── */

const CLOSED = 3;
const WARN = 1.0;      // all the notice you get
const SETTLE = 1.5;    // quiet beat after the slam, before the fire resumes
const HOLD = 8;        // seconds trapped in the middle

export const shrink = {
  id: 'shrink', name: 'CLOSING ARENA', emoji: '🔻', tint: '#ff2e5b',
  blurb: 'One second of warning, then the grid slams shut to 3×3 — with the missiles still coming.',
  duration: WARN + HOLD + 3, weight: 3,
  solo: true, keepBase: true,   // no other event, but the normal fire continues

  start(g, e) {
    e.stage = 0;
    e.timer = 0.25;
    e.doomed = null;

    e.hz = addHazard(g, {
      life: this.duration + 0.4, under: true, ignoreTime: true,
      draw: (h, gg, ctx, R) => {
        if (e.doomed === null) return;
        const lo = (BIG_SIZE - e.doomed) / 2, hi = lo + e.doomed - 1;
        const beat = 0.35 + 0.4 * Math.abs(Math.sin(h.t * 9));

        for (let cy = gg.lo; cy <= gg.hi; cy++) {
          for (let cx = gg.lo; cx <= gg.hi; cx++) {
            if (cx >= lo && cx <= hi && cy >= lo && cy <= hi) continue;
            R.cellRect(cx, cy, '#ff2e5b', beat * 0.55);
            R.cellStroke(cx, cy, '#ff2e5b', beat, 2);
          }
        }
        R.text(gg.center, lo - 0.75, `${e.doomed}×${e.doomed}`, 0.5, '#ff2e5b', 0.9);
      }
    });
  },

  update(g, e, dt) {
    e.timer -= dt;
    if (e.timer > 0) return;

    // the warning has run out — the walls slam all the way in at once
    if (e.doomed !== null) {
      const size = e.doomed;
      e.doomed = null;

      g.setGrid(size);
      g.spawnT = SETTLE;      // let the player find the middle before firing again

      Sound.blast();
      shake(g.fx, 16);
      flash(g.fx, '#ff2e5b', 0.35);
      ring(g.fx, g.center, g.center, '#ff2e5b', BIG_SIZE / 2, size / 2, 0.5, 7);

      e.timer = HOLD;
      return;
    }

    if (e.stage === 0) {
      e.stage = 1;
      e.doomed = CLOSED;
      e.timer = WARN;
      Sound.charge();
      return;
    }

    if (!e.opened) {
      e.opened = true;
      g.setGrid(BIG_SIZE);
      Sound.expand();
      flash(g.fx, '#7cf7ff', 0.3);
      confetti(g.fx, g.center, g.center, ['🔲', '✨'], 16);
      e.timer = 99;
    }
  },

  end(g, e) {
    if (e.hz) e.hz.dead = true;
    if (g.size !== BIG_SIZE) g.setGrid(BIG_SIZE);   // never leave the arena small
  }
};

export const ARENA = [holes, numbers, giants, shrink];
