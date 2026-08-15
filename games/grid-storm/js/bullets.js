/* Bullets and hazards.

   A bullet is a moving thing that kills on contact with the player box.
   A hazard is a cell/area telegraph (laser lines, bomb shadows, mines) that
   draws itself and decides for itself when it hurts.

   Both carry their own optional update/draw closures so an event can invent a
   new behaviour without the engine learning about it. */

import { PALETTE, pick, rnd } from './config.js';
import { trail } from './fx.js';

/* ── bullets ────────────────────────────────────────────────────────────── */

export function spawnBullet(g, spec) {
  const b = Object.assign({
    x: 0, y: 0, vx: 0, vy: 0,
    r: 0.24,               // radius, in cells
    round: false,          // true = circular hitbox instead of a box
    color: pick(PALETTE),
    emoji: null,
    shape: 'circle',       // circle | diamond | bar | star
    rot: 0, spin: 0,
    t: 0, life: 30,
    trailRate: 0.04, trailT: 0,
    deadly: true,
    scale: 1,
    ignoreTime: false,     // true = unaffected by the OVERCLOCK multiplier
    update: null, draw: null, onExpire: null
  }, spec);

  g.bullets.push(b);
  return b;
}

export function updateBullets(g, dt) {
  const keep = [];

  for (const b of g.bullets) {
    const d = b.ignoreTime ? dt : dt * g.timeScale;
    b.t += d;
    b.life -= d;

    if (b.update) b.update(b, g, d);
    else { b.x += b.vx * d; b.y += b.vy * d; }

    b.rot += b.spin * d;

    if (g.flags.wrap) {
      const span = g.hi - g.lo + 1;
      if (b.x < g.lo - 0.5) b.x += span;
      if (b.x > g.hi + 0.5) b.x -= span;
      if (b.y < g.lo - 0.5) b.y += span;
      if (b.y > g.hi + 0.5) b.y -= span;
    }

    if (b.trailRate > 0) {
      b.trailT += d;
      if (b.trailT >= b.trailRate) {
        b.trailT = 0;
        trail(g.fx, b.x, b.y, b.color, b.r * 0.55);
      }
    }

    const far = 3.2;
    const gone = b.life <= 0 ||
      b.x < g.lo - far || b.x > g.hi + far ||
      b.y < g.lo - far || b.y > g.hi + far;

    if (gone) { if (b.onExpire) b.onExpire(b, g); }
    else keep.push(b);
  }

  g.bullets = keep;
}

/* Straight shot from just outside an edge of the live grid.
   dir: 0 = down, 1 = up, 2 = right, 3 = left. */
export function edgeShot(g, dir, lane, speed, extra = {}) {
  const s = { ...extra, x: 0, y: 0, vx: 0, vy: 0 };

  if (dir === 0) { s.x = lane; s.y = g.lo - 1.2; s.vy = speed; }
  if (dir === 1) { s.x = lane; s.y = g.hi + 1.2; s.vy = -speed; }
  if (dir === 2) { s.x = g.lo - 1.2; s.y = lane; s.vx = speed; }
  if (dir === 3) { s.x = g.hi + 1.2; s.y = lane; s.vx = -speed; }

  return spawnBullet(g, s);
}

/* ── hazards ────────────────────────────────────────────────────────────── */

export function addHazard(g, spec) {
  const h = Object.assign({
    t: 0, life: 2,
    under: true,        // drawn beneath bullets (cell telegraphs) or above
    update: null, draw: null, onEnd: null
  }, spec);

  g.hazards.push(h);
  return h;
}

export function updateHazards(g, dt) {
  const keep = [];

  for (const h of g.hazards) {
    h.t += dt * (h.ignoreTime ? 1 : g.timeScale);
    if (h.update) h.update(h, g, dt * (h.ignoreTime ? 1 : g.timeScale));
    if (h.t < h.life && !h.dead) keep.push(h);
    else if (h.onEnd) h.onEnd(h, g);
  }

  g.hazards = keep;
}

/* A plain cell-blast: paints the cells, kills anyone standing on one. */
export function cellBlast(g, cells, opts = {}) {
  const { warn = 1.4, burn = 0.35, color = '#ff2e5b', emoji = '💥', onBurn = null } = opts;

  return addHazard(g, {
    life: warn + burn,
    cells,
    draw(h, gg, ctx, R) {
      const armed = h.t >= warn;
      const p = armed ? 1 - (h.t - warn) / burn : h.t / warn;

      for (const [cx, cy] of h.cells) {
        if (cx < gg.lo || cx > gg.hi || cy < gg.lo || cy > gg.hi) continue;
        R.cellRect(cx, cy, armed ? color : color, armed ? 0.75 * p : 0.10 + 0.22 * Math.abs(Math.sin(h.t * 9)));
      }
      if (!armed) {
        for (const [cx, cy] of h.cells) R.emoji(cx, cy, '⚠️', 0.4, 0.5 + 0.4 * Math.sin(h.t * 9));
      } else {
        for (const [cx, cy] of h.cells) R.emoji(cx, cy, emoji, 0.75 * (0.6 + 0.4 * p), p);
      }
    },
    update(h, gg) {
      if (h.t < warn) return;
      if (!h.fired) { h.fired = true; if (onBurn) onBurn(h, gg); }

      // deadly for the whole burn window, not just the frame it goes off
      const [pcx, pcy] = gg.playerCell();
      for (const [cx, cy] of h.cells) {
        if (cx === pcx && cy === pcy) gg.kill('caught in the blast', emoji);
      }
    }
  });
}

export const randColor = () => pick(PALETTE);
export const spread = (n, spr) => Array.from({ length: n }, (_, i) => (i / n) * Math.PI * 2 + rnd(0, spr));
