/* Canvas renderer. Reads state, never writes to it. */

import { TILE, DEBUG, ITEMS, MONSTER } from '../config.js';
import { HARD, SOFT, HAZARD } from '../engine/grid.js';

const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const PLAYER_ICON = ['🐰', '🐱'];
const PLAYER_TINT = ['#7cf7ff', '#ffb3d9'];
const MOODS = [null, '😠', '😡'];

function glyph(ctx, ch, x, y, size, alpha = 1) {
  ctx.font = `${size}px ${EMOJI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  /* Emoji are colour bitmaps — fillStyle does not tint them, but its *alpha*
   * still applies, so a leftover rgba() from a shadow silently renders the
   * whole glyph translucent. Always reset it. */
  ctx.fillStyle = alpha >= 1 ? '#fff' : `rgba(255,255,255,${alpha})`;
  ctx.fillText(ch, x, y);
}

export function render(ctx, state, now) {
  const { grid } = state;
  const W = grid.cols * TILE, H = grid.rows * TILE;

  ctx.save();
  if (state.shake > 0) {
    const s = state.shake * 8;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  drawFloor(ctx, state, W, H);
  drawTiles(ctx, state);
  vignette(ctx, W, H);
  drawWater(ctx, state, now);
  drawTelegraphs(ctx, state, now);
  drawItems(ctx, state, now);
  drawBombs(ctx, state, now);
  drawMonsters(ctx, state, now);
  drawBodies(ctx, state, now);
  drawPlayers(ctx, state, now);
  drawFx(ctx, state);
  ctx.restore();

  drawBanner(ctx, state, W, H);
  if (DEBUG) drawDebug(ctx, state);
}

function drawFloor(ctx, state, W, H) {
  const { grid, theme } = state;
  for (let r = 0; r < grid.rows; r++)
    for (let c = 0; c < grid.cols; c++) {
      ctx.fillStyle = (c + r) % 2 ? theme.floorB : theme.floorA;
      ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
    }
}

function vignette(ctx, W, H) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawTiles(ctx, state) {
  const { grid, theme } = state;
  for (let r = 0; r < grid.rows; r++)
    for (let c = 0; c < grid.cols; c++) {
      const t = grid.at(c, r);
      const x = c * TILE, y = r * TILE;
      /* "Can I blow this up?" is the most important read on the board: an
       * indestructible wall gets a raised plate, a breakable crate gets none. */
      if (t === HARD) {
        ctx.fillStyle = theme.wall;
        roundRect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.11)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        roundRect(ctx, x + 3, y + 3, TILE - 6, 5, 3);
        ctx.fill();
        glyph(ctx, theme.hard, x + TILE / 2, y + TILE / 2 + 2, TILE * 0.56);
      } else if (t === SOFT) {
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(x + TILE / 2, y + TILE - 7, TILE * 0.3, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        glyph(ctx, theme.soft, x + TILE / 2, y + TILE / 2, TILE * 0.7);
      }
    }
}

function drawWater(ctx, state, now) {
  const { grid, theme } = state;
  for (let r = 0; r < grid.rows; r++)
    for (let c = 0; c < grid.cols; c++) {
      if (grid.at(c, r) !== HAZARD) continue;
      ctx.fillStyle = 'rgba(80,140,200,0.4)';
      ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
      glyph(ctx, theme.hazard, c * TILE + TILE / 2,
        r * TILE + TILE / 2 + Math.sin(now * 2.4 + (c + r)) * 2, TILE * 0.58);
    }
  for (const [, w] of state.water) {
    const k = Math.min(1, w.life / 0.25);
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.35 * k;
    ctx.fillStyle = w.owner < 0 ? 'rgba(168,85,247,0.7)' : 'rgba(56,189,248,0.72)';
    roundRect(ctx, w.c * TILE + 1, w.r * TILE + 1, TILE - 2, TILE - 2, 8);
    ctx.fill();
    ctx.restore();
    glyph(ctx, '💦', w.c * TILE + TILE / 2, w.r * TILE + TILE / 2, TILE * 0.6, 0.95);
  }
}

/* Telegraphs fill up as their lead runs out, so "how long have I got" is
 * readable off the tile with no timer anywhere on screen. Amber, because two of
 * the three raids sit on a floor that is already blue or green. */
function drawTelegraphs(ctx, state, now) {
  for (const tel of state.telegraphs) {
    const k = Math.min(1, 1 - (tel.at - state.t) / tel.lead);
    const pulse = 0.35 + 0.3 * Math.sin(now * 15);
    ctx.save();
    /* Flat amber reads as sandy *floor* on a blue map. Hazard stripes read as
     * danger on any floor at all, which is the only thing that matters here. */
    ctx.fillStyle = `rgba(255,90,40,${0.20 + 0.34 * k})`;
    ctx.strokeStyle = `rgba(255,225,170,${0.6 + pulse * 0.4})`;
    ctx.lineWidth = 2.5;
    for (const t of tel.tiles) {
      const x = t.c * TILE, y = t.r * TILE;
      roundRect(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 6);
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = `rgba(255,225,140,${0.22 + 0.3 * k})`;
      ctx.lineWidth = 5;
      for (let d = -TILE; d < TILE * 2; d += 13) {
        ctx.beginPath();
        ctx.moveTo(x + d, y);
        ctx.lineTo(x + d - TILE, y + TILE);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = `rgba(255,225,170,${0.6 + pulse * 0.4})`;
      ctx.lineWidth = 2.5;
      roundRect(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 6);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawItems(ctx, state, now) {
  for (const [i, kind] of state.items) {
    const c = i % state.grid.cols, r = Math.floor(i / state.grid.cols);
    ctx.save();
    ctx.shadowColor = state.theme.glow;
    ctx.shadowBlur = 12;
    glyph(ctx, ITEMS[kind]?.icon || '❔', c * TILE + TILE / 2,
      r * TILE + TILE / 2 + Math.sin(now * 3.4 + i) * 2.5, TILE * 0.58);
    ctx.restore();
  }
}

function drawBombs(ctx, state, now) {
  for (const b of state.balloons) {
    /* The fuse is the squash — the closer to bursting, the harder it pulses. */
    const urgency = 1 - Math.max(0, Math.min(1, b.fuse / 2.3));
    const beat = 1 + Math.sin(now * (7 + urgency * 22)) * (0.05 + urgency * 0.14);
    ctx.save();
    ctx.translate(b.x, b.y - (b.flight ? Math.sin((b.flight.t / b.flight.dur) * Math.PI) * TILE * 1.5 : 0));
    ctx.scale(beat, 2 - beat);
    glyph(ctx, '💣', 0, 0, TILE * 0.76, b.flight ? 0.9 : 1);
    ctx.restore();
  }
}

function drawMonsters(ctx, state, now) {
  for (const m of state.monsters) {
    if (m.dead && m.reviveIn > 0) continue;
    const def = MONSTER[m.kind];
    ctx.save();
    if (m.dead) {
      ctx.globalAlpha = Math.max(0, 1 - m.reaped / 0.6);
      ctx.translate(m.x, m.y - m.reaped * 46);
    } else {
      ctx.translate(m.x, m.y);
    }

    if (m.state === 'shrivel') {
      ctx.scale(0.6, 0.6);
      glyph(ctx, def.icon, 0, 0, TILE * 0.7);
    } else if (m.state === 'frozen') {
      /* Frozen is a state you must follow up on, so it has to look inert and
       * touchable, not merely tinted. */
      ctx.fillStyle = 'rgba(150,225,255,0.42)';
      roundRect(ctx, -TILE * 0.36, -TILE * 0.36, TILE * 0.72, TILE * 0.72, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(220,250,255,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      glyph(ctx, def.icon, 0, 0, TILE * 0.6, 0.85);
      if (m.timer < 1.2 && Math.floor(now * 8) % 2) {
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.stroke();
      }
    } else {
      glyph(ctx, def.icon, 0, 0, TILE * 0.7);
      /* A monster on its feet kills on contact, so it wears a warning. */
      ctx.strokeStyle = `rgba(255,90,80,${0.30 + 0.16 * Math.sin(now * 6 + m.id)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, TILE * 0.42, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (m.hatch > 0 && m.hatch < 2) glyph(ctx, '❗', TILE * 0.3, -TILE * 0.34, TILE * 0.34);
    ctx.restore();
  }
}

/* The boss and any clones. */
function drawBodies(ctx, state, now) {
  const list = [];
  if (state.boss) list.push({ b: state.boss, real: true });
  for (const cl of state.clones) list.push({ b: cl, real: false });

  for (const { b, real } of list) {
    const span = b.size * TILE, half = span / 2;
    const fade = b.reaped ?? state.over;
    if (b.dead && fade > 1.0) continue;

    /* Footprint outline: the body kills on contact and a big emoji does not
     * fill its own tiles, so the danger zone is drawn rather than guessed. */
    if (!b.dead) {
      ctx.save();
      ctx.strokeStyle = b.mode === 'stagger'
        ? 'rgba(255,220,120,0.75)' : 'rgba(255,110,90,0.38)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -now * 14;
      roundRect(ctx, b.x - half + 2, b.y - half + 2, span - 4, span - 4, 10);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(b.x, b.y);
    if (b.dead) ctx.globalAlpha = Math.max(0, 1 - fade);
    if (b.mode === 'phasing') ctx.globalAlpha *= 0.5 + 0.5 * Math.sin(now * 18);
    if (b.flash > 0) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 26; }
    /* A clone is drawn faded so "which one is real" stays answerable. */
    glyph(ctx, b.def.icon, 0, 0, span * 0.8, real ? 1 : 0.62);
    ctx.shadowBlur = 0;

    if (real) {
      const mood = (b.def.moods || MOODS)[b.phase];
      if (mood) glyph(ctx, mood, half * 0.6, -half * 0.64, TILE * 0.5);
      if (b.mode === 'stagger') glyph(ctx, '💫', 0, -half - 10, TILE * 0.62);
      hpPips(ctx, b, half);
    } else {
      hpPips(ctx, b, half, 4, TILE * 0.3);
    }
    ctx.restore();
  }
}

/* HP as a row of 💧 that pop off. No bar anywhere in this game. */
function hpPips(ctx, b, half, count = 8, size = TILE * 0.4) {
  const left = Math.ceil((b.hp / b.hpMax) * count);
  for (let i = 0; i < count; i++) {
    const a = Math.PI * (-0.78 + (i / (count - 1)) * 0.56);
    glyph(ctx, i < left ? '💧' : '·', Math.cos(a) * (half + 18), Math.sin(a) * (half + 18),
      size, i < left ? 1 : 0.18);
  }
}

function drawPlayers(ctx, state, now) {
  for (const p of state.players) {
    if (p.down) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (!p.alive) {
      glyph(ctx, '💭', 0, -6, TILE * 0.58, 0.3);
      ctx.restore();
      continue;
    }
    const blink = p.invuln > 0 && Math.floor(now * 12) % 2 ? 0.4 : 1;
    if (p.anchor > 0) glyph(ctx, '⚓', 0, TILE * 0.42, TILE * 0.38);
    ctx.shadowColor = PLAYER_TINT[p.id];
    ctx.shadowBlur = 10;
    glyph(ctx, PLAYER_ICON[p.id], 0, 0, TILE * 0.74, blink);
    ctx.shadowBlur = 0;
    if (p.shield) {
      ctx.strokeStyle = 'rgba(180,240,255,0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, TILE * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (p.bubble) bubbleArt(ctx, TILE * 0.55, p.bubble.struggle, now);
    ctx.restore();

    if (p.pickedFor > 0) {
      glyph(ctx, ITEMS[p.picked]?.icon || '', p.x,
        p.y - TILE * 0.9 - (1.2 - p.pickedFor) * 12, TILE * 0.48, Math.min(1, p.pickedFor));
    }
  }
}

/* The struggle meter *is* the bubble: it wobbles harder and cracks spread as
 * you mash it down. */
function bubbleArt(ctx, r, struggle, now) {
  const stress = 1 - struggle;
  const wob = 1 + Math.sin(now * (6 + stress * 26)) * (0.03 + stress * 0.1);
  ctx.save();
  ctx.scale(wob, 2 - wob);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(150,225,255,${0.26 + stress * 0.1})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(220,250,255,${0.75 + stress * 0.25})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-r * 0.32, -r * 0.34, r * 0.19, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < Math.floor(stress * 5); i++) {
    const a = (i / 5) * Math.PI * 2 + 0.6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45);
    ctx.lineTo(Math.cos(a + 0.3) * r, Math.sin(a + 0.3) * r);
    ctx.stroke();
  }
  ctx.restore();
}

const FX_GLYPH = {
  pop: '💥', splat: '💀', hit: '✨', rescue: '🤝', escape: '💨', guard: '🛡️',
  wake: '❗', stun: '💫', pickup: '⭐', burn: '🔥',
};

function drawFx(ctx, state) {
  for (const f of state.fx) {
    const k = f.life / f.max;
    if (f.kind === 'crumble') {
      ctx.fillStyle = `rgba(255,220,170,${k * 0.5})`;
      ctx.fillRect(f.c * TILE + 4, f.r * TILE + 4, TILE - 8, TILE - 8);
    } else if (f.kind === 'active') {
      glyph(ctx, f.icon, f.x, f.y - (1 - k) * 26, TILE * 0.55, k);
    } else {
      glyph(ctx, FX_GLYPH[f.kind] || '✳️', f.x, f.y - (1 - k) * 22, TILE * (0.5 + k * 0.3), k);
    }
  }
}

function drawBanner(ctx, state, W, H) {
  if (!state.banner) return;
  const k = Math.min(1, state.banner.life / 0.4);
  ctx.save();
  ctx.globalAlpha = k;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(TILE * 0.6)}px "Segoe UI", system-ui, sans-serif`;
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(state.banner.text, W / 2, H * 0.3);
  ctx.fillStyle = '#ffd166';
  ctx.fillText(state.banner.text, W / 2, H * 0.3);
  ctx.restore();
}

function drawDebug(ctx, state) {
  const b = state.boss;
  ctx.save();
  ctx.font = '11px ui-monospace,monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(4, 4, 250, b ? 74 : 46);
  ctx.fillStyle = '#9ef';
  let y = 8;
  const line = (s) => { ctx.fillText(s, 10, y); y += 13; };
  line(`t=${state.t.toFixed(1)} kills=${state.kills} deaths=${state.deaths}`);
  line(`mon=${state.monsters.filter(m => !m.dead).length} bombs=${state.balloons.length} tel=${state.telegraphs.length}`);
  line(state.players.map(p => `P${p.id + 1} ♥${p.lives} b${p.stats.balloons} p${p.stats.power}`).join('  '));
  if (b) {
    line(`boss ${b.hp}/${b.hpMax} ph${b.phase} ${b.mode} clones=${state.clones.length}`);
    line(`cds ${JSON.stringify(Object.fromEntries(Object.entries(b.cds).map(([k, v]) => [k, +v.toFixed(1)])))}`);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
