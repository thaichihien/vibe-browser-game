/* Particles, rings, floating text, flash and shake.
   Same shapes as games/grid-storm/js/fx.js: every effect is a plain object with
   an age `t` and a `life`, and the runner drops it when spent — nothing here
   needs cleanup anywhere else. */

import { rnd, pick } from './config.js';

export function makeFx() { return { items: [], flash: 0, flashColor: '#fff' }; }

export function updateFx(fx, dt) {
  const out = [];
  for (const p of fx.items) {
    p.t += dt;
    if (p.t >= p.life) continue;
    if (p.kind === 'spark') {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.93; p.vy = p.vy * 0.93 + (p.grav || 0) * dt;
    } else if (p.kind === 'text') {
      p.y -= dt * 26;
    }
    out.push(p);
  }
  fx.items = out;
  fx.flash = Math.max(0, fx.flash - dt * 3.5);
}

export function burst(fx, x, y, color, count = 12, power = 130, glyph = null) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = rnd(power * 0.3, power);
    fx.items.push({
      kind: 'spark', x, y, color,
      glyph: glyph && Math.random() < 0.3 ? glyph : null,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s, grav: rnd(40, 190),
      size: rnd(2, 5), t: 0, life: rnd(0.3, 0.75)
    });
  }
}

export function ring(fx, x, y, color, r0 = 6, r1 = 70, life = 0.45, width = 3) {
  fx.items.push({ kind: 'ring', x, y, color, r0, r1, width, t: 0, life });
}

export function dust(fx, x, y, color = '#d8c9a3', count = 4) {
  for (let i = 0; i < count; i++) {
    fx.items.push({
      kind: 'spark', x: x + rnd(-5, 5), y: y + rnd(-3, 3), color,
      vx: rnd(-22, 22), vy: rnd(-30, -6), grav: 60,
      size: rnd(2, 4), t: 0, life: rnd(0.25, 0.5)
    });
  }
}

export function floatText(fx, x, y, text, color = '#fff', life = 0.95, size = 15) {
  fx.items.push({ kind: 'text', x, y, text, color, size, t: 0, life });
}

export function confetti(fx, x, y, glyphs, count = 8) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    fx.items.push({
      kind: 'spark', x, y, color: '#fff', glyph: pick(glyphs),
      vx: Math.cos(a) * rnd(40, 150), vy: Math.sin(a) * rnd(40, 150) - 40, grav: rnd(120, 260),
      size: rnd(11, 19), t: 0, life: rnd(0.6, 1.2)
    });
  }
}

export function flash(fx, color = '#ffffff', amount = 0.5) {
  fx.flash = Math.max(fx.flash, amount);
  fx.flashColor = color;
}
