/* Canvas renderer.

   `makeRenderer` returns an object that is both the frame painter and the
   little drawing toolkit (`cellRect`, `emoji`, `beam`, …) handed to every
   hazard/bullet draw callback — so events describe themselves in cell space
   and never touch pixels. */

import { CELL, PAD, BIG_SIZE, COLORS, clamp, lerp } from './config.js';

export function makeRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  /* cell space -> pixels */
  const S = v => (v + PAD + 0.5) * CELL;

  const R = {
    ctx,
    S,
    px: S,

    cellRect(cx, cy, color, alpha = 1, inset = 3, radius = 8) {
      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.fillStyle = color;
      round(ctx, S(cx) - CELL / 2 + inset, S(cy) - CELL / 2 + inset,
        CELL - inset * 2, CELL - inset * 2, radius);
      ctx.fill();
      ctx.restore();
    },

    cellStroke(cx, cy, color, alpha = 1, width = 2, inset = 3) {
      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      round(ctx, S(cx) - CELL / 2 + inset, S(cy) - CELL / 2 + inset,
        CELL - inset * 2, CELL - inset * 2, 8);
      ctx.stroke();
      ctx.restore();
    },

    emoji(x, y, glyph, size = 0.7, alpha = 1, rot = 0) {
      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.translate(S(x), S(y));
      if (rot) ctx.rotate(rot);
      ctx.font = `${size * CELL}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, 0, size * CELL * 0.06);
      ctx.restore();
    },

    text(x, y, str, size = 0.4, color = '#fff', alpha = 1, weight = 700) {
      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.fillStyle = color;
      ctx.font = `${weight} ${size * CELL}px "Segoe UI",system-ui,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(str, S(x), S(y));
      ctx.restore();
    },

    dot(x, y, r, color, alpha = 1, glow = 10) {
      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = glow;
      ctx.beginPath();
      ctx.arc(S(x), S(y), r * CELL, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    /* full-width band across the live grid — lasers and wall telegraphs */
    beam(g, axis, lane, color, alpha, thickness = 0.9) {
      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);
      const grad = ctx.createLinearGradient(
        axis === 'row' ? S(g.lo) : S(lane), axis === 'row' ? S(lane) : S(g.lo),
        axis === 'row' ? S(g.hi) : S(lane), axis === 'row' ? S(lane) : S(g.hi));
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.15, color);
      grad.addColorStop(0.85, color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.shadowColor = color;
      ctx.shadowBlur = 24;

      const t = thickness * CELL;
      if (axis === 'row') {
        ctx.fillRect(S(g.lo) - CELL / 2, S(lane) - t / 2, (g.hi - g.lo + 1) * CELL, t);
      } else {
        ctx.fillRect(S(lane) - t / 2, S(g.lo) - CELL / 2, t, (g.hi - g.lo + 1) * CELL);
      }
      ctx.restore();
    },

    arc(x, y, radius, from, to, color, width = 6, alpha = 1) {
      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(S(x), S(y), Math.max(0.01, radius * CELL), from, to);
      ctx.stroke();
      ctx.restore();
    }
  };

  /* ── the frame ────────────────────────────────────────────────────────── */

  R.frame = function (g) {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    /* backdrop */
    const bg = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.75);
    bg.addColorStop(0, '#111a2e');
    bg.addColorStop(1, COLORS.bg);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    /* screen shake */
    if (g.fx.shake > 0.2) {
      const s = g.fx.shake;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    /* Zoom so the live grid always fills the board: 5×5 plays at the same cell
       size the original Grid Survival had, and the expansion is a real zoom-out
       rather than a small square in a big frame. One transform does it, so no
       draw code below ever sees the scale. */
    const zoom = zoomFor(g);
    ctx.translate(w / 2, h / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-w / 2, -h / 2);

    drawGrid(g);
    for (const hz of g.hazards) if (hz.under && hz.draw) hz.draw(hz, g, ctx, R);
    drawBullets(g);
    drawPlayer(g);
    for (const hz of g.hazards) if (!hz.under && hz.draw) hz.draw(hz, g, ctx, R);
    drawFx(g);
    if (g.flags.fog) drawFog(g, w, h);

    ctx.restore();

    if (g.fx.flash > 0.01) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.75, g.fx.flash);
      ctx.fillStyle = g.fx.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  };

  /* how much to magnify so `size + 2·PAD` cells fill the fixed board */
  function zoomFor(g) {
    const full = BIG_SIZE + PAD * 2;
    const kOf = size => full / (size + PAD * 2);
    const target = kOf(g.size);

    if (!g.expand) return target;
    const old = g.expand.oldHi - g.expand.oldLo + 1;
    const t = clamp(g.expand.t / 0.9, 0, 1);
    return lerp(kOf(old), target, t * t * (3 - 2 * t));
  }

  function drawGrid(g) {
    const born = g.expand ? clamp(g.expand.t / 0.9, 0, 1) : 1;

    for (let cy = g.lo; cy <= g.hi; cy++) {
      for (let cx = g.lo; cx <= g.hi; cx++) {
        const fresh = g.expand && (cx < g.expand.oldLo || cx > g.expand.oldHi ||
          cy < g.expand.oldLo || cy > g.expand.oldHi);
        const a = fresh ? born : 1;
        const alt = (cx + cy) % 2 === 0;

        R.cellRect(cx, cy, alt ? COLORS.cell : COLORS.cellAlt, a);

        if (fresh && born < 1) R.cellStroke(cx, cy, '#7cf7ff', 1 - born, 2);
      }
    }

    /* live-area border */
    const x0 = S(g.lo) - CELL / 2 - 4, y0 = S(g.lo) - CELL / 2 - 4;
    const side = (g.hi - g.lo + 1) * CELL + 8;

    ctx.save();
    ctx.strokeStyle = g.flags.gravity ? '#ff8a3d' : g.flags.wrap ? '#b388ff' : COLORS.edge;
    ctx.lineWidth = 2;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 12;
    round(ctx, x0, y0, side, side, 14);
    ctx.stroke();
    ctx.restore();
  }

  function drawBullets(g) {
    for (const b of g.bullets) {
      if (b.draw) { b.draw(b, g, ctx, R); continue; }

      if (b.emoji) { R.emoji(b.x, b.y, b.emoji, b.r * 2.4 * b.scale, 1, b.rot); continue; }

      ctx.save();
      ctx.translate(S(b.x), S(b.y));
      ctx.rotate(b.rot);
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 14;

      const r = b.r * CELL * b.scale;
      if (b.shape === 'bar') {
        round(ctx, -r * 1.6, -r * 0.5, r * 3.2, r, 3);
        ctx.fill();
      } else if (b.shape === 'diamond') {
        ctx.rotate(Math.PI / 4);
        round(ctx, -r * 0.8, -r * 0.8, r * 1.6, r * 1.6, 3);
        ctx.fill();
      } else if (b.shape === 'star') {
        star(ctx, r * 1.35, r * 0.6, 5);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawPlayer(g) {
    const p = g.player;
    const x = S(p.px), y = S(p.py);
    const size = CELL * 0.74;
    const blink = p.iFrames > 0 && Math.floor(p.iFrames * 14) % 2 === 0;

    ctx.save();
    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.translate(x, y);

    if (!g.alive) ctx.rotate(Math.min(1.1, g.deadT * 2.2));

    const grad = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
    grad.addColorStop(0, g.flags.ice ? '#8be9ff' : '#7dff9f');
    grad.addColorStop(1, g.flags.ice ? '#2a9df4' : '#17a34a');

    ctx.fillStyle = grad;
    ctx.shadowColor = g.flags.ice ? '#7cf7ff' : COLORS.player;
    ctx.shadowBlur = 18 + Math.sin(g.time * 6) * 6;
    round(ctx, -size / 2, -size / 2, size, size, 10);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.font = `${size * 0.62}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.face, 0, size * 0.04);
    ctx.restore();

    if (p.shield > 0) {
      ctx.save();
      ctx.strokeStyle = '#7cf7ff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#7cf7ff';
      ctx.shadowBlur = 16;
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(g.time * 8);
      ctx.beginPath();
      ctx.arc(x, y, CELL * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFx(g) {
    for (const p of g.fx.items) {
      const k = 1 - p.t / p.life;

      if (p.kind === 'spark') {
        if (p.emoji) R.emoji(p.x, p.y, p.emoji, p.size * 2.6, k, p.t * 6);
        else R.dot(p.x, p.y, p.size, p.color, k * 0.9, 8);
      } else if (p.kind === 'ring') {
        const r = p.r0 + (p.r1 - p.r0) * (p.t / p.life);
        R.arc(p.x, p.y, r, 0, Math.PI * 2, p.color, p.width * k, k);
      } else if (p.kind === 'text') {
        R.text(p.x, p.y, p.text, p.size, p.color, k);
      }
    }
  }

  function drawFog(g, w, h) {
    const p = g.player;
    const hole = CELL * (2.4 + Math.sin(g.time * 2) * 0.15);

    ctx.save();
    const grad = ctx.createRadialGradient(S(p.px), S(p.py), hole * 0.35, S(p.px), S(p.py), hole);
    grad.addColorStop(0, 'rgba(2,4,10,0)');
    grad.addColorStop(1, `rgba(2,4,10,${0.94 * g.flags.fog})`);
    ctx.fillStyle = grad;
    ctx.fillRect(-w, -h, w * 3, h * 3);   // the canvas is zoomed — cover it all
    ctx.restore();
  }

  return R;
}

/* ── small canvas helpers ─────────────────────────────────────────────────── */

function round(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function star(ctx, outer, inner, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const fn = i ? 'lineTo' : 'moveTo';
    ctx[fn](Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

export function fitCanvas(canvas, cssSize) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = cssSize * dpr;
  canvas.height = cssSize * dpr;
  canvas.style.width = cssSize + 'px';
  canvas.style.height = cssSize + 'px';
  canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
}

export const BOARD_SIDE = (BIG_SIZE + PAD * 2) * CELL;
