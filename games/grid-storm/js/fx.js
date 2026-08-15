/* Particles, rings, floating text and screen shake.
   Every effect is a plain object with a `t` (age) and a `life`; the runner
   drops it when it is spent, so nothing here needs cleanup elsewhere. */

import { rnd, pick } from './config.js';

export function makeFx() {
  return { items: [], shake: 0, shakeT: 0, flash: 0, flashColor: '#fff' };
}

export function updateFx(fx, dt) {
  fx.items = fx.items.filter(p => {
    p.t += dt;
    if (p.kind === 'spark') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy = p.vy * 0.94 + (p.grav || 0) * dt;
    }
    if (p.kind === 'text') p.y -= dt * 0.9;
    return p.t < p.life;
  });

  fx.shake = Math.max(0, fx.shake - dt * (fx.shake > 2 ? 14 : 7));
  fx.flash = Math.max(0, fx.flash - dt * 3.5);
}

/* ── emitters ───────────────────────────────────────────────────────────── */

export function burst(fx, x, y, color, count = 14, power = 5, emoji = null) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = rnd(power * 0.3, power);
    fx.items.push({
      kind: 'spark', x, y, color, emoji: emoji && Math.random() < 0.25 ? emoji : null,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s, grav: rnd(1, 5),
      size: rnd(0.05, 0.14), t: 0, life: rnd(0.35, 0.8)
    });
  }
}

export function ring(fx, x, y, color, r0 = 0.2, r1 = 3, life = 0.5, width = 3) {
  fx.items.push({ kind: 'ring', x, y, color, r0, r1, width, t: 0, life });
}

export function trail(fx, x, y, color, size = 0.09) {
  fx.items.push({ kind: 'spark', x, y, color, vx: 0, vy: 0, size, t: 0, life: 0.35 });
}

export function floatText(fx, x, y, text, color = '#fff', life = 1.1, size = 0.5) {
  fx.items.push({ kind: 'text', x, y, text, color, size, t: 0, life });
}

export function shake(fx, amount) {
  fx.shake = Math.min(26, fx.shake + amount);
}

export function flash(fx, color = '#ffffff', amount = 0.6) {
  fx.flash = Math.max(fx.flash, amount);
  fx.flashColor = color;
}

export function confetti(fx, x, y, emojis, count = 8) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    fx.items.push({
      kind: 'spark', x, y, color: '#fff', emoji: pick(emojis),
      vx: Math.cos(a) * rnd(1, 4), vy: Math.sin(a) * rnd(1, 4), grav: rnd(2, 6),
      size: rnd(0.16, 0.26), t: 0, life: rnd(0.6, 1.2)
    });
  }
}

