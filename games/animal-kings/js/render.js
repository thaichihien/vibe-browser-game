/* Canvas painter and the little drawing toolkit every other module draws through.

   Emoji are expensive to fillText — a busy frame wants several hundred of them —
   so every glyph is rasterised once into its own small canvas and blitted after
   that. That single cache is the difference between 20 fps and 60. */

import {
  TILE, MAP_TILES, T, TERRAIN_COLOR, TERRAIN_PROPS, GRASS_DECALS, DAY_LENGTH, clamp, lerp
} from './config.js';
import { tileIndex } from './world.js';

const N = MAP_TILES;

/* ── glyph raster cache ───────────────────────────────────────────────────── */
const glyphCache = new Map();

function glyphCanvas(ch, px) {
  const key = ch + '|' + px;
  let c = glyphCache.get(key);
  if (c) return c;
  const pad = Math.ceil(px * 0.22);
  const size = Math.ceil(px + pad * 2);
  c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.font = `${px}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(ch, size / 2, size / 2 + px * 0.04);
  glyphCache.set(key, c);
  return c;
}

/* five shades per terrain, baked once, so tiles are not a flat field of colour */
const SHADES = TERRAIN_COLOR.map(hex => {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return [-5, -2, 0, 2, 5].map(d => {
    const f = v => clamp(Math.round(v + d), 0, 255);
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  });
});

export function makeRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });

  const R = {
    ctx, canvas,
    cam: null,
    dpr: 1,

    /* world → screen */
    sx(x) { return (x - this.cam.x) * this.cam.zoom + this.cam.w / 2 + this.cam.sx; },
    sy(y) { return (y - this.cam.y) * this.cam.zoom + this.cam.h / 2 + this.cam.sy; },
    /* screen → world */
    wx(x) { return (x - this.cam.w / 2 - this.cam.sx) / this.cam.zoom + this.cam.x; },
    wy(y) { return (y - this.cam.h / 2 - this.cam.sy) / this.cam.zoom + this.cam.y; },

    /* Everything below draws in CSS pixels, so the frame starts by restoring the
       device-pixel scale. Resetting to identity here instead — which is what this
       used to do — renders the whole world at 1/dpr into the top-left corner of
       the canvas, and on a 2× display that is exactly a quarter of the screen. */
    begin(cam) {
      this.cam = cam;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
    },

    glyph(x, y, ch, px = 26, alpha = 1, rot = 0) {
      if (alpha <= 0.01) return;
      const c = glyphCanvas(ch, px);
      const X = this.sx(x), Y = this.sy(y), z = this.cam.zoom;
      const w = c.width * z, h = c.height * z;
      ctx.globalAlpha = alpha;
      if (rot) {
        ctx.save(); ctx.translate(X, Y); ctx.rotate(rot);
        ctx.drawImage(c, -w / 2, -h / 2, w, h);
        ctx.restore();
      } else {
        ctx.drawImage(c, X - w / 2, Y - h / 2, w, h);
      }
      ctx.globalAlpha = 1;
    },

    text(x, y, str, size = 13, color = '#fff', align = 'center', weight = 700, alpha = 1) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.font = `${weight} ${size * this.cam.zoom}px "Segoe UI",system-ui,sans-serif`;
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      ctx.fillText(str, this.sx(x), this.sy(y));
      ctx.globalAlpha = 1;
    },

    shadow(x, y, rx, alpha = 0.28) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(this.sx(x), this.sy(y + rx * 0.42), rx * this.cam.zoom, rx * 0.42 * this.cam.zoom, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    },

    circle(x, y, r, color, width = 0, alpha = 1) {
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(this.sx(x), this.sy(y), r * this.cam.zoom, 0, Math.PI * 2);
      if (width) { ctx.strokeStyle = color; ctx.lineWidth = width * this.cam.zoom; ctx.stroke(); }
      else { ctx.fillStyle = color; ctx.fill(); }
      ctx.globalAlpha = 1;
    },

    rect(x, y, w, h, color, alpha = 1) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(this.sx(x), this.sy(y), w * this.cam.zoom, h * this.cam.zoom);
      ctx.globalAlpha = 1;
    },

    /* a health / progress bar in world space */
    bar(x, y, w, h, frac, color, back = 'rgba(0,0,0,.62)') {
      const z = this.cam.zoom, X = this.sx(x) - (w * z) / 2, Y = this.sy(y);
      ctx.fillStyle = back;
      ctx.fillRect(X - z, Y - z, w * z + z * 2, h * z + z * 2);
      ctx.fillStyle = color;
      ctx.fillRect(X, Y, w * z * clamp(frac, 0, 1), h * z);
    }
  };

  /* ── terrain ────────────────────────────────────────────────────────────── */

  R.drawTerrain = function (world, time) {
    const cam = this.cam, z = cam.zoom;
    const halfW = cam.w / (2 * z), halfH = cam.h / (2 * z);
    const x0 = Math.max(0, Math.floor((cam.x - halfW) / TILE) - 1);
    const x1 = Math.min(N - 1, Math.ceil((cam.x + halfW) / TILE) + 1);
    const y0 = Math.max(0, Math.floor((cam.y - halfH) / TILE) - 1);
    const y1 = Math.min(N - 1, Math.ceil((cam.y + halfH) / TILE) + 1);

    const size = TILE * z + 1;

    /* pass 1: the ground itself — a couple of hundred rects, cheap */
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const i = tileIndex(tx, ty);
        const t = world.tiles[i];
        ctx.fillStyle = SHADES[t][world.shade[i]];
        ctx.fillRect(this.sx(tx * TILE), this.sy(ty * TILE), size, size);
      }
    }

    /* pass 2: water shimmer */
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#8fd8ff';
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const i = tileIndex(tx, ty);
        if (world.tiles[i] !== T.WATER) continue;
        const p = world.prop[i];
        const wob = Math.sin(time * 1.4 + p * 0.11);
        if (wob < 0.62) continue;
        ctx.fillRect(this.sx(tx * TILE + 4 + (p % 9)),
                     this.sy(ty * TILE + 8 + ((p >> 4) % 18) + wob * 3),
                     size * (0.3 + (p % 5) * 0.09), 2.5 * z);
      }
    }
    ctx.globalAlpha = 1;

    /* pass 3: ground dressing — sparse tufts so bare grass is not a flat field */
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const i = tileIndex(tx, ty);
        const t = world.tiles[i];
        if (t !== T.GRASS && t !== T.SAND) continue;
        const p = world.prop[i];
        if (p > 26) continue;                       // ~10% of tiles get anything
        const ch = GRASS_DECALS[p % GRASS_DECALS.length];
        this.glyph(tx * TILE + TILE / 2 + ((p >> 3) % 5 - 2) * 6,
                   ty * TILE + TILE / 2 + ((p >> 5) % 5 - 2) * 6,
                   ch, 13, 0.75);
      }
    }

    /* pass 4: the props. Variant, offset, size and sway all key off the tile's
       own byte, so a forest looks grown rather than tiled — and a node that has
       been worked shrinks as it goes. */
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const i = tileIndex(tx, ty);
        const t = world.tiles[i];
        const table = TERRAIN_PROPS[t];
        if (!table) continue;
        const p = world.prop[i];
        const node = world.nodeAt.get(i);
        const frac = node ? 0.5 + 0.5 * (node.amount / node.max) : 1;

        const ox = ((p % 7) - 3) * 2.6;
        const oy = (((p >> 3) % 7) - 3) * 2.2;
        const scale = 0.82 + ((p >> 6) & 3) * 0.11;
        const sway = t === T.FOREST
          ? Math.sin(time * 1.05 + tx * 1.3 + ty * 0.9) * (0.03 + (p % 3) * 0.012)
          : 0;

        this.glyph(tx * TILE + TILE / 2 + ox,
                   ty * TILE + TILE / 2 + oy - 4 * frac,
                   table[p % table.length],
                   Math.round(31 * frac * scale), 1, sway);
      }
    }
  };

  /* ── effects ────────────────────────────────────────────────────────────── */

  R.drawFx = function (fx) {
    for (const p of fx.items) {
      const k = 1 - p.t / p.life;
      if (p.kind === 'spark') {
        if (p.glyph) this.glyph(p.x, p.y, p.glyph, p.size * 1.6, k);
        else this.circle(p.x, p.y, p.size * k, p.color, 0, k);
      } else if (p.kind === 'ring') {
        this.circle(p.x, p.y, lerp(p.r0, p.r1, 1 - k), p.color, p.width, k * 0.9);
      } else if (p.kind === 'text') {
        this.text(p.x, p.y, p.text, p.size, p.color, 'center', 800, Math.min(1, k * 2.2));
      }
    }
  };

  /* ── day / night ────────────────────────────────────────────────────────── */

  R.drawDaylight = function (time) {
    const phase = (time % DAY_LENGTH) / DAY_LENGTH;         // 0 dawn .. 0.5 dusk .. 1 dawn
    const night = clamp(Math.cos(phase * Math.PI * 2) * -1, 0, 1);   // 0 by day, 1 at midnight
    if (night < 0.02) return;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(96,124,196,${0.10 + night * 0.34})`;
    ctx.fillRect(0, 0, this.cam.w, this.cam.h);
    ctx.restore();
    /* a warm cast just after dusk keeps the night from reading as a grey filter */
    const dusk = clamp(1 - Math.abs(phase - 0.5) * 7, 0, 1);
    if (dusk > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = `rgba(255,138,60,${dusk * 0.2})`;
      ctx.fillRect(0, 0, this.cam.w, this.cam.h);
      ctx.restore();
    }
  };

  R.drawFlash = function (fx) {
    if (fx.flash <= 0.01) return;
    ctx.globalAlpha = Math.min(0.7, fx.flash);
    ctx.fillStyle = fx.flashColor;
    ctx.fillRect(0, 0, this.cam.w, this.cam.h);
    ctx.globalAlpha = 1;
  };

  R.clear = function (color = '#0a0f14') {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width / this.dpr, canvas.height / this.dpr);
  };

  return R;
}
