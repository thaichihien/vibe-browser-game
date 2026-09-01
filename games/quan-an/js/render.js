/* Top-down canvas renderer. Everything is emoji or flat shapes — no assets.

   The whole floor always fits on screen, so there is no camera: one scale
   factor maps tiles to pixels and every draw call goes through it. */

import {
  GRID_W, GRID_H, T, COUNTER_Y, WINDOW_TILES, PASS_TILES, STOVE_SPOTS, BIN_TILE, clamp
} from './config.js';
import { DISH, SHOP_BY_ID, FACADE_BY_ID } from './data.js';
import { moodOf } from './sim.js';
import { ROW, ST_H, ST_W } from './street.js';
import { derived } from './state.js';

const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const UI_FONT = '"Be Vietnam Pro",system-ui,-apple-system,"Segoe UI",sans-serif';

/* Where bought decorations hang. Wall tiles, so they never sit under a walker. */
const DECOR_SPOTS = [
  { x: 0.5, y: 5.6 }, { x: 18.5, y: 5.6 }, { x: 0.5, y: 6.9 }, { x: 18.5, y: 6.9 },
  { x: 0.5, y: 8.2 }, { x: 18.5, y: 8.2 }, { x: 0.5, y: 9.5 }, { x: 18.5, y: 9.5 },
  { x: 0.5, y: 10.8 }, { x: 18.5, y: 10.8 }, { x: 2.5, y: 0.5 }, { x: 16.5, y: 0.5 },
  { x: 6.5, y: 0.5 }, { x: 12.5, y: 0.5 }, { x: 0.5, y: 11.9 }, { x: 18.5, y: 11.9 }
];

const MOOD_COLOR = { green: '#3ddc84', yellow: '#ffcc3d', red: '#ff5a52' };

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let S = 40, ox = 0, oy = 0, dpr = 1;
  const floaters = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    S = Math.min(r.width / GRID_W, r.height / GRID_H);
    ox = (r.width - S * GRID_W) / 2;
    oy = (r.height - S * GRID_H) / 2;
  }

  const px = x => ox + x * S;
  const py = y => oy + y * S;

  /* Always fully opaque. A faded emoji does not read as "inactive", it reads as
     a rendering fault — anything that needs de-emphasising gets a smaller size
     or a darker plate behind it instead.

     The explicit opaque fillStyle is the load-bearing line: a colour-emoji glyph
     is composited with the fill paint's ALPHA, so any translucent fillStyle left
     behind by an earlier label (the bin's caption, a table number) silently
     washed out every sprite drawn after it — chefs, guests and the player
     included. Setting it here means emoji cannot inherit that state. */
  function emoji(ch, x, y, size) {
    ctx.fillStyle = '#3a2f22';
    ctx.font = `${size}px ${EMOJI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, px(x), py(y));
  }

  function rect(x, y, w, h, fill, stroke) {
    ctx.fillStyle = fill;
    roundRect(px(x), py(y), S * w, S * h, S * 0.12);
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }

  /* Just the dish. There is no table number on a plate because there is no
     table it has to go to — whoever ordered that dish will take it. Rubbish
     gets a red disc and a cross so a dead plate is still unmistakable. */
  function plate(dishId, x, y, size, dead) {
    if (!dead) { emoji(DISH[dishId].emoji, x, y, size); return; }
    ctx.fillStyle = 'rgba(255,90,82,.9)';
    ctx.beginPath();
    ctx.arc(px(x), py(y), size * 0.62, 0, Math.PI * 2);
    ctx.fill();
    emoji(DISH[dishId].emoji, x, y, size);
    const r = size * 0.30;
    ctx.beginPath();
    ctx.fillStyle = '#7a1c18';
    ctx.arc(px(x) + size * 0.42, py(y) + size * 0.36, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff8a80';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffd5d2';
    ctx.font = `800 ${r * 1.35}px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✕', px(x) + size * 0.42, py(y) + size * 0.36);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ── the room ───────────────────────────────────────────────────────────*/
  function drawFloor(sim) {
    const L = sim.d.level;
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const t = sim.world.tileAt(x, y);
        let c;
        switch (t) {
          case T.PAVEMENT: c = '#6f7378'; break;
          case T.WALL:     c = L.wall; break;
          case T.KITCHEN:  c = '#8e9199'; break;
          case T.COUNTER:  c = '#5d5348'; break;
          case T.WINDOW:   c = '#4a6f8a'; break;
          case T.PASS:     c = '#8a6a3a'; break;
          case T.DOOR:     c = '#3f3227'; break;
          default:         c = ((x + y) & 1) ? L.floor : shade(L.floor, -8);
        }
        ctx.fillStyle = c;
        ctx.fillRect(px(x), py(y), S + 1, S + 1);
      }
    }

    /* grout on both floors, so neither room reads as a flat slab */
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,.07)';
    for (let y = COUNTER_Y + 1; y < 12; y++) {
      for (let x = 1; x < GRID_W - 1; x++) ctx.strokeRect(px(x), py(y), S, S);
    }
    ctx.strokeStyle = 'rgba(0,0,0,.12)';
    for (let y = 1; y < COUNTER_Y; y++) {
      for (let x = 1; x < GRID_W - 1; x++) ctx.strokeRect(px(x), py(y), S, S);
    }

    /* hatch labels, so nobody has to guess which half of the counter is which */
    ctx.font = `600 ${Math.max(9, S * 0.24)}px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#dbe7f2';
    ctx.fillText('ĐẶT MÓN', px(WINDOW_TILES[0] + 1), py(COUNTER_Y + 0.5));
    ctx.fillStyle = '#ffe2b0';
    ctx.fillText('LẤY MÓN', px(PASS_TILES[0] + 1), py(COUNTER_Y + 0.5));

    emoji('🚪', 9.5, 12.5, S * 0.8);
    emoji('🛵', 3.5, 13.6, S * 0.85);
    emoji('🛵', 5.0, 13.6, S * 0.85);
    emoji('🏍️', 14.5, 13.6, S * 0.85);
  }

  /* ── the kitchen ────────────────────────────────────────────────────────
     Built out of furniture rather than loose emoji: a back counter with the
     cold store and the sink at its ends, a prep run down the middle, and the
     stove line pushed up against the hatch where the chefs actually work. */
  function drawKitchen(sim) {
    rect(1, 0.95, 16.6, 0.8, '#b6b9c1', 'rgba(0,0,0,.28)');   // back counter
    rect(1, 1.62, 16.6, 0.16, 'rgba(0,0,0,.18)');             // its front edge

    rect(1.05, 0.95, 1.6, 0.8, '#7f8894', 'rgba(0,0,0,.32)');   // cold store
    emoji('🧊', 1.85, 1.35, S * 0.55);
    rect(15.95, 0.95, 1.65, 0.8, '#7f8894', 'rgba(0,0,0,.32)'); // wash-up
    emoji('🚰', 16.75, 1.35, S * 0.55);

    /* the prep run: board, greens, rice, seasoning — sitting on the counter */
    emoji('🔪', 4.4, 1.35, S * 0.44);
    emoji('🥬', 6.6, 1.35, S * 0.44);
    emoji('🍚', 9.4, 1.35, S * 0.44);
    emoji('🧅', 11.6, 1.35, S * 0.44);
    emoji('🧂', 13.8, 1.35, S * 0.44);

    /* stove line — a burner glows only while something is actually on it */
    STOVE_SPOTS.forEach((s, i) => {
      const on = !!sim.kitchen.stoves[i];
      rect(s.x + 0.05, s.y + 0.05, 1.9, 0.9, '#4a4d55', 'rgba(0,0,0,.35)');
      for (let b = 0; b < 2; b++) {
        ctx.beginPath();
        ctx.fillStyle = on ? '#ff9a3c' : '#33363c';
        ctx.arc(px(s.x + 0.55 + b * 0.9), py(s.y + 0.5), S * 0.24, 0, Math.PI * 2);
        ctx.fill();
      }
      if (on) emoji('🔥', s.x + 1, s.y + 0.5, S * 0.55);
    });
  }

  /* ── the bin ────────────────────────────────────────────────────────────*/
  function drawBin(sim) {
    const x = BIN_TILE.x + 0.5, y = BIN_TILE.y + 0.5;
    rect(BIN_TILE.x + 0.15, BIN_TILE.y + 0.2, 0.7, 0.7, '#3a3f36', 'rgba(0,0,0,.4)');
    emoji('🗑️', x, y, S * 0.66);
    ctx.fillStyle = 'rgba(244,234,217,.55)';
    ctx.font = `700 ${Math.max(8, S * 0.19)}px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ĐỒ BỎ', px(x), py(y + 0.62));
  }

  function drawDecor(save) {
    const owned = Object.keys(save.owned)
      .map(id => SHOP_BY_ID[id])
      .filter(it => it && it.cat === 'decor');
    owned.forEach((it, i) => {
      const s = DECOR_SPOTS[i % DECOR_SPOTS.length];
      emoji(it.emoji, s.x, s.y, S * 0.72);
    });
  }

  function drawTables(sim) {
    for (const t of sim.world.tables) {
      const x = px(t.x - 1) + S * 0.12, y = py(t.y - 1) + S * 0.12;
      const w = S * 1.76;
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      roundRect(x + 3, y + 6, w, w, S * 0.18); ctx.fill();
      ctx.fillStyle = '#6d4520';
      roundRect(x, y, w, w, S * 0.18); ctx.fill();
      ctx.fillStyle = '#95612c';
      roundRect(x + S * 0.1, y + S * 0.1, w - S * 0.2, w - S * 0.2, S * 0.13); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.lineWidth = 2;
      roundRect(x, y, w, w, S * 0.18); ctx.stroke();
      /* table number, so "thu tiền bàn 3" points somewhere */
      ctx.fillStyle = 'rgba(255,255,255,.34)';
      ctx.font = `800 ${S * 0.52}px ${UI_FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(t.id + 1), px(t.x), py(t.y));

      /* plates already on the table, one per guest that has been served */
      const p = t.party;
      if (!p) continue;
      p.members.forEach((m, i) => {
        if (!m.servedCount || m.done) return;
        const a = (i / Math.max(1, p.members.length)) * Math.PI * 2;
        emoji(DISH[m.dishes[0]].emoji, t.x + Math.cos(a) * 0.42, t.y + Math.sin(a) * 0.42, S * 0.5);
      });
    }
  }

  function drawPass(sim) {
    sim.kitchen.pass.forEach((pl, i) => {
      const x = PASS_TILES[0] + 0.3 + (i % 4) * 0.5;
      plate(pl.dishId, x, COUNTER_Y + 0.68, S * 0.46, false);
    });
  }

  function drawChefs(sim) {
    sim.chefs.forEach((c, i) => {
      emoji(c.emoji, c.x, c.y, S * 0.85);
      if (c.holding) plate(c.holding.dishId, c.x + 0.05, c.y - 0.72, S * 0.42, false);
      const job = sim.kitchen.stoves[i];
      if (!job) return;
      const done = clamp(1 - job.left / job.total, 0, 1);
      const s = STOVE_SPOTS[i];
      bar(s.x + 0.2, s.y + 1.02, 1.6, 0.13, done, '#ffb347');
      if (!c.holding) plate(job.dishId, c.x, c.y - 0.75, S * 0.4, false);
    });
  }

  function bar(x, y, w, h, pct, color) {
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    roundRect(px(x), py(y), S * w, S * h, S * h / 2); ctx.fill();
    ctx.fillStyle = color;
    roundRect(px(x), py(y), S * w * pct, S * h, S * h / 2); ctx.fill();
  }

  /* ── people ─────────────────────────────────────────────────────────────*/
  function drawGuests(sim) {
    for (const g of sim.queue) {
      g.members.forEach((m, i) => emoji(m.face, 8.4 + i * 0.5, 13.5, S * 0.8));
      emoji('⏳', 8.4, 12.9, S * 0.4);
    }
    for (const p of sim.parties) {
      for (const m of p.members) {
        const bob = p.state === 'EATING' && !m.done ? Math.sin(sim.t * 8 + m.x) * 0.04 : 0;
        emoji(m.face, m.x, m.y + bob, S * 0.82);
        if (m.done && p.state !== 'LEAVING') emoji('😋', m.x + 0.3, m.y - 0.35, S * 0.34);
      }
      drawBubble(sim, p);
    }
  }

  function drawBubble(sim, p) {
    if (p.state === 'WALK_IN' || !p.table) {
      if (p.state === 'LEAVING' && p.mad) emoji('😡', p.members[0].x, p.members[0].y - 0.75, S * 0.5);
      return;
    }
    const bx = p.table.bubble.x, by = p.table.bubble.y;
    let icon = null, sub = null, mood = null;

    /* Once they have decided, the bubble IS the dish — one table, one meal, and
       you can read the whole order from across the room. */
    const meal = p.meal ? DISH[p.meal].emoji : null;
    switch (p.state) {
      case 'WANT_MENU':   icon = '🙋'; sub = '📋'; mood = moodOf(p); break;
      case 'READING':     icon = '🤔'; break;
      case 'ORDER_READY': icon = meal; sub = '🎫'; mood = moodOf(p); break;
      case 'WAIT_FOOD':   icon = meal; sub = '⏳'; mood = moodOf(p); break;
      case 'EATING':      icon = '😋'; break;
      case 'WANT_BILL':   icon = '💵'; mood = moodOf(p); break;
      default: return;
    }
    if (!icon) return;

    const w = S * 1.05;
    ctx.strokeStyle = 'rgba(18,16,14,.55)';
    ctx.lineWidth = Math.max(2, S * 0.06);
    ctx.beginPath();
    ctx.moveTo(px(p.table.x), py(p.table.y));
    ctx.lineTo(px(bx), py(by));
    ctx.stroke();
    ctx.fillStyle = 'rgba(18,16,14,.88)';
    roundRect(px(bx) - w / 2, py(by) - w / 2, w, w, S * 0.2); ctx.fill();
    emoji(icon, bx, by, S * 0.55);
    if (sub) emoji(sub, bx + 0.42, by + 0.34, S * 0.34);

    /* the patience ring — the only place the shift mode's timer is visible */
    if (mood && sim.mode === 'shift' && p.waitMax) {
      const left = clamp(1 - p.wait / p.waitMax, 0, 1);
      ctx.beginPath();
      ctx.strokeStyle = MOOD_COLOR[mood];
      ctx.lineWidth = Math.max(3, S * 0.11);
      ctx.lineCap = 'round';
      ctx.arc(px(bx), py(by), w * 0.62, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2);
      ctx.stroke();
    } else if (mood && p.waitMax) {
      const left = clamp(1 - p.wait / p.waitMax, 0, 1);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,.4)';
      ctx.lineWidth = Math.max(2, S * 0.07);
      ctx.arc(px(bx), py(by), w * 0.62, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawWaiter(sim, w, isPlayer) {
    if (isPlayer) {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,194,71,.28)';
      ctx.ellipse(px(w.x), py(w.y + 0.34), S * 0.46, S * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,194,71,.9)';
      ctx.lineWidth = Math.max(2, S * 0.07);
      ctx.ellipse(px(w.x), py(w.y + 0.34), S * 0.46, S * 0.2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    emoji(isPlayer ? '🤵' : w.emoji, w.x, w.y, S * (isPlayer ? 0.95 : 0.85));

    /* the tray reads left to right above their head, each plate tagged with the
       table it is going to — and rubbish tagged with a cross instead */
    w.carry.forEach((pl, i) => {
      plate(pl.dishId, w.x - (w.carry.length - 1) * 0.24 + i * 0.48, w.y - 0.82, S * 0.44, pl.dead);
    });
    if (w.tickets.length) emoji('🎫', w.x + 0.42, w.y - 0.45, S * 0.42);

    if (w.busy > 0 && w.busyMax) {
      bar(w.x - 0.42, w.y - 1.1, 0.84, 0.13, 1 - w.busy / w.busyMax, '#7cf7ff');
    }
  }

  /* ── highlight for whatever the player is standing next to ──────────────*/
  function drawHighlight(sim, target) {
    if (!target) return;
    let x, y;
    if (target.kind === 'handoff') { x = WINDOW_TILES[0] + 1; y = COUNTER_Y + 0.5; }
    else if (target.kind === 'pickup') { x = PASS_TILES[0] + 1; y = COUNTER_Y + 0.5; }
    else if (target.kind === 'trash') { x = BIN_TILE.x + 0.5; y = BIN_TILE.y + 0.5; }
    else { x = target.table.x; y = target.table.y; }

    ctx.save();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = Math.max(2, S * 0.08);
    ctx.setLineDash([S * 0.22, S * 0.16]);
    ctx.lineDashOffset = -(sim.t * S * 0.9) % 1000;
    roundRect(px(x - 1.05), py(y - 1.05), S * 2.1, S * 2.1, S * 0.22);
    ctx.stroke();
    ctx.restore();
  }

  /* ── floating numbers ───────────────────────────────────────────────────*/
  function floater(x, y, text, color = '#8ef7a8') {
    floaters.push({ x, y, text, color, t: 0 });
  }

  function drawFloaters(dt) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of floaters) {
      f.t += dt;
      const a = clamp(1 - f.t / 1.5, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `700 ${Math.max(11, S * 0.36)}px ${UI_FONT}`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.strokeText(f.text, px(f.x), py(f.y - f.t * 0.9));
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, px(f.x), py(f.y - f.t * 0.9));
      ctx.restore();
    }
    for (let i = floaters.length - 1; i >= 0; i--) if (floaters[i].t > 1.5) floaters.splice(i, 1);
  }

  /* ── the street ─────────────────────────────────────────────────────────
     Its own scale: the block is wider and shorter than the dining room, so it
     gets its own fit rather than borrowing the restaurant's. */
  function streetScale() {
    const r = canvas.getBoundingClientRect();
    const s = Math.min(r.width / ST_W, r.height / ST_H);
    return { s, ox: (r.width - s * ST_W) / 2, oy: (r.height - s * ST_H) / 2 };
  }

  function drawStreet(street, save, target, dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const g = streetScale();
    const X = v => g.ox + v * g.s, Y = v => g.oy + v * g.s;
    const em = (ch, x, y, size) => {
      ctx.fillStyle = '#3a2f22';
      ctx.font = `${size}px ${EMOJI}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ch, X(x), Y(y));
    };
    const box = (x, y, w, h, fill, stroke, r = 0.12) => {
      ctx.fillStyle = fill;
      roundRect(X(x), Y(y), w * g.s, h * g.s, r * g.s);
      ctx.fill();
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
    };
    const L = derived(save).level;

    /* Dusk over the whole canvas, not just the grid — otherwise the block sits
       in a black letterbox and reads as a bug rather than a street. */
    const r = canvas.getBoundingClientRect();
    const sky = ctx.createLinearGradient(0, 0, 0, r.height);
    sky.addColorStop(0, '#14161f');
    sky.addColorStop(0.55, '#2a2233');
    sky.addColorStop(1, '#3a2d2a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, r.width, r.height);

    /* a skyline behind the block, so the top of the frame is a city and not a void */
    ctx.fillStyle = 'rgba(10,12,20,.72)';
    for (let i = 0; i < 22; i++) {
      const bw = 1.1 + ((i * 37) % 13) / 9;
      const bh = 1.4 + ((i * 53) % 17) / 6;
      const bx = -1 + i * 1.6;
      ctx.fillRect(X(bx), Y(0.35 - bh), bw * g.s, bh * g.s + g.s * 0.4);
    }
    ctx.fillStyle = 'rgba(255,214,140,.5)';
    for (let i = 0; i < 60; i++) {
      const wx = -1 + ((i * 71) % 340) / 10;
      const wy = 0.35 - 0.3 - ((i * 29) % 22) / 12;
      ctx.fillRect(X(wx), Y(wy), g.s * 0.12, g.s * 0.16);
    }
    box(0, ROW.WALK_TOP - 0.55, ST_W, ROW.KERB - ROW.WALK_TOP + 0.55, '#8e8b84', null, 0);
    box(0, ROW.KERB, ST_W, 0.35, '#c9c4b8', null, 0);
    box(0, ROW.ROAD_TOP - 0.25, ST_W, ROW.ROAD_BOTTOM - ROW.ROAD_TOP + 0.6, '#3b3d42', null, 0);
    ctx.strokeStyle = 'rgba(255,255,255,.45)';
    ctx.lineWidth = Math.max(2, g.s * 0.06);
    ctx.setLineDash([g.s * 0.7, g.s * 0.6]);
    ctx.beginPath();
    ctx.moveTo(g.ox, Y((ROW.ROAD_TOP + ROW.ROAD_BOTTOM) / 2));
    ctx.lineTo(g.ox + g.s * ST_W, Y((ROW.ROAD_TOP + ROW.ROAD_BOTTOM) / 2));
    ctx.stroke();
    ctx.setLineDash([]);

    /* pavement seams, so the strip is not a flat slab */
    ctx.strokeStyle = 'rgba(0,0,0,.10)';
    ctx.lineWidth = 1;
    for (let x = 0; x < ST_W; x += 1.5) {
      ctx.beginPath();
      ctx.moveTo(X(x), Y(ROW.WALK_TOP - 0.55));
      ctx.lineTo(X(x), Y(ROW.KERB));
      ctx.stroke();
    }

    for (const b of street.buildings) {
      const home = b.kind === 'home';
      const wall = home ? L.wall : b.color;
      const accent = home ? L.accent : 'rgba(255,255,255,.35)';

      box(b.x, 0.2, b.w, ROW.DOOR + 0.2, wall, 'rgba(0,0,0,.4)', 0.18);
      /* signboard */
      box(b.x + 0.25, ROW.SIGN - 0.55, b.w - 0.5, 1.0, 'rgba(12,10,8,.72)', accent, 0.14);
      ctx.fillStyle = home ? L.accent : '#f0ece2';
      const label = b.sign || b.name || '';
      const size = Math.max(9, Math.min(g.s * 0.34, (b.w - 0.7) * g.s * 1.7 / Math.max(6, label.length)));
      ctx.font = `800 ${size}px ${UI_FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, X(b.x + b.w / 2), Y(ROW.SIGN));

      /* shutters and doorway */
      box(b.x + 0.35, 2.15, b.w - 0.7, 1.5, 'rgba(0,0,0,.22)', null, 0.1);
      const dw = Math.min(1.7, b.w - 1.4);
      box(b.x + b.w / 2 - dw / 2, ROW.DOOR - 0.7, dw, 1.5, '#2c231a', accent, 0.1);
      em(b.emoji, b.x + b.w / 2, ROW.DOOR + 0.02, g.s * 0.62);

      if (home) drawFacade(save, b, em, box, g);
    }

    /* traffic behind, walkers in front */
    for (const v of street.traffic) {
      ctx.save();
      ctx.translate(X(v.x), Y(v.y));
      if (v.dir < 0) ctx.scale(-1, 1);
      ctx.fillStyle = '#3a2f22';
      ctx.font = `${g.s * 0.85}px ${EMOJI}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(v.emoji, 0, 0);
      ctx.restore();
    }
    for (const w of street.walkers) em(w.face, w.x, w.y, g.s * 0.72);

    /* the doorway you are standing at */
    if (target) {
      const d = street.doorOf(target);
      ctx.save();
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = Math.max(2, g.s * 0.08);
      ctx.setLineDash([g.s * 0.22, g.s * 0.16]);
      ctx.lineDashOffset = -(street.t * g.s * 0.9) % 1000;
      roundRect(X(d.x - 1.1), Y(d.y - 1.5), g.s * 2.2, g.s * 2.4, g.s * 0.2);
      ctx.stroke();
      ctx.restore();
    }

    /* the player, with the same gold ring they wear inside */
    const p = street.player;
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255,194,71,.28)';
    ctx.ellipse(X(p.x), Y(p.y + 0.34), g.s * 0.46, g.s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,194,71,.9)';
    ctx.lineWidth = Math.max(2, g.s * 0.07);
    ctx.ellipse(X(p.x), Y(p.y + 0.34), g.s * 0.46, g.s * 0.2, 0, 0, Math.PI * 2);
    ctx.stroke();
    em('🤵', p.x, p.y, g.s * 0.95);
  }

  /* whatever the owner has hung on their own shopfront */
  function drawFacade(save, b, em, box, g) {
    const owned = Object.keys(save.facade || {}).filter(id => FACADE_BY_ID[id] && save.facade[id]);
    const mid = b.x + b.w / 2;
    if (owned.includes('mai-hien')) box(b.x + 0.1, ROW.DOOR - 1.5, b.w - 0.2, 0.5, '#c1543f', 'rgba(0,0,0,.35)', 0.1);
    if (owned.includes('cua-kinh')) box(mid - 0.9, ROW.DOOR - 0.7, 1.8, 1.5, 'rgba(150,205,225,.45)', '#cfd8dc', 0.08);
    if (owned.includes('den-neon')) {
      ctx.strokeStyle = '#7cf7ff';
      ctx.lineWidth = Math.max(2, g.s * 0.09);
      roundRect(g.ox + (b.x + 0.15) * g.s, g.oy + 0.3 * g.s, (b.w - 0.3) * g.s, (ROW.DOOR - 0.1) * g.s, g.s * 0.16);
      ctx.stroke();
    }
    if (owned.includes('den-long')) { em('🏮', b.x + 0.55, ROW.SIGN + 0.95, g.s * 0.62); em('🏮', b.x + b.w - 0.55, ROW.SIGN + 0.95, g.s * 0.62); }
    if (owned.includes('bien-go')) em('🪧', b.x + 0.6, ROW.DOOR - 0.15, g.s * 0.5);
    if (owned.includes('bang-menu')) em('📋', b.x + b.w - 0.6, ROW.DOOR - 0.05, g.s * 0.55);
    if (owned.includes('chau-cay')) { em('🪴', b.x + 0.5, ROW.DOOR + 1.0, g.s * 0.6); em('🪴', b.x + b.w - 0.5, ROW.DOOR + 1.0, g.s * 0.6); }
    if (owned.includes('ghe-via-he')) { em('🪑', b.x + 1.4, ROW.DOOR + 1.25, g.s * 0.55); em('🪑', b.x + b.w - 1.4, ROW.DOOR + 1.25, g.s * 0.55); }
    if (owned.includes('tuong-hoa')) { em('🌸', b.x + 0.35, 1.0, g.s * 0.5); em('🌸', b.x + b.w - 0.35, 1.0, g.s * 0.5); }
    if (owned.includes('bien-led')) em('🪟', mid, ROW.SIGN - 1.0, g.s * 0.5);
  }

  function draw(sim, save, target, dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawFloor(sim);
    drawKitchen(sim);
    drawBin(sim);
    drawDecor(save);
    drawHighlight(sim, target);
    drawTables(sim);
    drawPass(sim);
    drawChefs(sim);
    drawGuests(sim);
    for (const n of sim.npcs) drawWaiter(sim, n, false);
    drawWaiter(sim, sim.player, true);
    drawFloaters(dt);
  }

  return { resize, draw, drawStreet, floater, get scale() { return S; } };
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255);
  const g = clamp(((n >> 8) & 255) + amt, 0, 255);
  const b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}
