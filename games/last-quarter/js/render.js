/* Canvas renderer for the arcade screen.
 *
 * Terrain is drawn; everything that acts — the character, enemies, pickups —
 * is an emoji. The CRT falls apart as SUS climbs, which is the suspicion meter
 * and the fiction being the same object: what the human is "noticing" is
 * literally what you can see going wrong.
 */
import { TILE, ROWS, VIEW_W, VIEW_H, METER, DEBUG } from './config.js';
import { isSolid, isOneWay, isHazard, conveyorDir } from './physics.js';

const FONT_EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

export function initRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const r = { canvas, ctx, dpr: 1, particles: [] };
  resize(r);
  addEventListener('resize', () => resize(r));
  return r;
}

function resize(r) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  r.dpr = dpr;
  r.canvas.width = Math.round(VIEW_W * dpr);
  r.canvas.height = Math.round(VIEW_H * dpr);
  r.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  r.ctx.imageSmoothingEnabled = true;
}

function emoji(ctx, ch, x, y, size, rot = 0, flip = 1) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (flip !== 1) ctx.scale(flip, 1);
  ctx.font = `${size}px ${FONT_EMOJI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, 0, 0);
  ctx.restore();
}

export function burst(r, x, y, color, n = 8, spread = 120) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    r.particles.push({
      x, y, vx: Math.cos(a) * spread * (0.4 + Math.random()),
      vy: Math.sin(a) * spread * (0.4 + Math.random()) - 60,
      life: 0.5 + Math.random() * 0.3, t: 0, color,
    });
  }
}

/* Deterministic scenery so the parallax does not shimmer between frames. */
function scenery(world) {
  if (world._scenery) return world._scenery;
  let seed = world.cols * 9301 + 49297;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const deco = [];
  for (let x = 40; x < world.w; x += 90 + rnd() * 120) {
    deco.push({ x, y: (ROWS - 2) * TILE + 6, ch: world.theme.deco[(rnd() * world.theme.deco.length) | 0], s: 16 + rnd() * 10 });
  }
  const sky = [];
  for (let x = 0; x < world.w; x += 150 + rnd() * 180) {
    sky.push({ x, y: 30 + rnd() * 110, ch: world.theme.sky[(rnd() * world.theme.sky.length) | 0], s: 18 + rnd() * 16 });
  }
  world._scenery = { deco, sky };
  return world._scenery;
}

export function drawFrame(r, world, d, human, dt) {
  const { ctx } = r;
  const th = world.theme;
  const cam = Math.round(world.camX);
  const susN = d ? d.sus / METER.susMax : 0;

  ctx.save();
  if (world.shake > 0) {
    ctx.translate((Math.random() - 0.5) * 6 * world.shake, (Math.random() - 0.5) * 6 * world.shake);
  }

  /* ── sky ── */
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, th.skyTop);
  sky.addColorStop(1, th.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(-8, -8, VIEW_W + 16, VIEW_H + 16);

  const sc = scenery(world);
  ctx.globalAlpha = 0.5;
  for (const s of sc.sky) {
    const x = s.x - cam * 0.25;
    if (x < -40 || x > VIEW_W + 40) continue;
    emoji(ctx, s.ch, x, s.y, s.s);
  }
  ctx.globalAlpha = 1;

  hills(ctx, th.hillFar, cam * 0.18, 96, 34);
  hills(ctx, th.hillNear, cam * 0.4, 66, 22);

  ctx.globalAlpha = 0.75;
  for (const s of sc.deco) {
    const x = s.x - cam * 0.8;
    if (x < -40 || x > VIEW_W + 40) continue;
    emoji(ctx, s.ch, x, s.y, s.s);
  }
  ctx.globalAlpha = 1;

  /* ── tiles ── */
  const c0 = Math.max(0, Math.floor(cam / TILE) - 1);
  const c1 = Math.min(world.cols - 1, Math.ceil((cam + VIEW_W) / TILE));

  drawPits(ctx, world, c0, c1, cam);

  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = c0; cx <= c1; cx++) {
      const ch = world.grid[cy][cx];
      if (ch === '.') continue;
      const x = cx * TILE - cam, y = cy * TILE;
      if (ch === '~') drawLava(ctx, x, y, world.time, cx);
      else if (ch === '^') drawSpike(ctx, x, y, world.time);
      else if (isOneWay(ch)) drawPlatform(ctx, x, y, th);
      else if (isSolid(ch)) drawBlock(ctx, world, cx, cy, x, y, th);
    }
  }

  /* ── entities ── */
  for (const e of world.entities) {
    const x = e.x - cam;
    if (x < -60 || x > VIEW_W + 60) continue;
    switch (e.type) {
      case 'coin':
        if (e.taken) break;
        ctx.save();
        ctx.shadowColor = th.coinGlow; ctx.shadowBlur = 12;
        emoji(ctx, '🪙', x + e.w / 2, e.y + e.h / 2 + Math.sin(e.bob) * 3, 20);
        ctx.restore();
        break;
      case 'enemy': {
        if (e.dead) {
          ctx.globalAlpha = Math.max(0, 1 - e.dead * 3);
          emoji(ctx, e.emoji, x + e.w / 2, e.y + e.h / 2 + e.dead * 40, 24 * (1 - e.dead));
          ctx.globalAlpha = 1;
          break;
        }
        const wob = Math.sin(world.time * 8 + e.x) * 0.12;
        emoji(ctx, e.emoji, x + e.w / 2, e.y + e.h / 2, 24, wob, e.dir > 0 ? -1 : 1);
        break;
      }
      case 'spring':
        ctx.save();
        ctx.translate(0, e.t * 6);
        emoji(ctx, '🌀', x + e.w / 2, e.y + e.h / 2 - e.t * 4, 26 + e.t * 6);
        ctx.restore();
        break;
      case 'mplat':
        drawMovingPlatform(ctx, x, e.y, e.w, e.h, th);
        break;
      case 'checkpoint':
        emoji(ctx, e.done ? '🚩' : '🏳️', x + e.w / 2, e.y + e.h / 2, 26,
              e.done ? Math.sin(world.time * 4) * 0.08 : 0);
        break;
      case 'flag':
        ctx.save();
        ctx.shadowColor = '#fff'; ctx.shadowBlur = 14;
        emoji(ctx, '🏁', x + e.w / 2, e.y + e.h / 2 + Math.sin(world.time * 3) * 2, 28);
        ctx.restore();
        break;
      default: break;
    }
  }

  /* ── the character ── */
  drawPlayer(ctx, world, d, cam);

  /* ── particles ── */
  for (let i = r.particles.length - 1; i >= 0; i--) {
    const p = r.particles[i];
    p.t += dt;
    if (p.t > p.life) { r.particles.splice(i, 1); continue; }
    p.vy += 700 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    ctx.globalAlpha = 1 - p.t / p.life;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - cam - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  drawCabinetHud(ctx, world, d);
  crtDamage(r, susN, world.time);
  if (DEBUG.hitboxes || DEBUG.tileGrid) debugBoxes(ctx, world, cam);
  if (DEBUG.meters || DEBUG.humanIntent) debugMeters(ctx, world, d, human);
}

/* A hole has to look like a hole. Without this, a gap in the floor is just a
 * patch of hill showing through and the one thing that kills you reads as
 * scenery. Drawn under the tiles so the ground edges stay crisp. */
function drawPits(ctx, world, c0, c1, cam) {
  const y = (ROWS - 2) * TILE;
  const h = 2 * TILE;
  for (let cx = c0; cx <= c1; cx++) {
    const a = world.grid[ROWS - 2][cx], b = world.grid[ROWS - 1][cx];
    if (isSolid(a) || isSolid(b) || isHazard(a) || isHazard(b)) continue;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(0,0,0,.12)');
    g.addColorStop(0.45, 'rgba(0,0,0,.62)');
    g.addColorStop(1, 'rgba(0,0,0,.86)');
    ctx.fillStyle = g;
    ctx.fillRect(cx * TILE - cam, y, TILE + 1, h);
  }
}

function hills(ctx, color, off, amp, base) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, VIEW_H);
  for (let x = 0; x <= VIEW_W; x += 16) {
    const wx = x + off;
    const y = VIEW_H - base - amp * (0.5 + 0.5 * Math.sin(wx / 190) * Math.cos(wx / 90));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(VIEW_W, VIEW_H);
  ctx.closePath();
  ctx.fill();
}

function drawBlock(ctx, world, cx, cy, x, y, th) {
  const ch = world.grid[cy][cx];
  const above = cy > 0 ? world.grid[cy - 1][cx] : '.';
  const open = !isSolid(above);
  ctx.fillStyle = th.groundBody;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = th.groundLine;
  ctx.fillRect(x, y + TILE - 3, TILE, 3);
  if (open) {
    ctx.fillStyle = th.groundTop;
    ctx.fillRect(x, y, TILE, 6);
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.fillRect(x, y, TILE, 2);
  }
  const cd = conveyorDir(ch);
  if (cd !== 0 && open) {
    const shift = (world.time * 60 * cd) % TILE;
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = -1; i < 2; i++) {
      const ax = x + ((shift + i * TILE + TILE) % TILE);
      ctx.beginPath();
      ctx.moveTo(ax + (cd > 0 ? 0 : 10), y + 1);
      ctx.lineTo(ax + (cd > 0 ? 10 : 0), y + 3.5);
      ctx.lineTo(ax + (cd > 0 ? 0 : 10), y + 6);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawPlatform(ctx, x, y, th) {
  ctx.fillStyle = th.groundTop;
  ctx.fillRect(x, y, TILE, 8);
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.fillRect(x, y + 8, TILE, 3);
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.fillRect(x, y, TILE, 2);
}

function drawMovingPlatform(ctx, x, y, w, h, th) {
  ctx.fillStyle = th.groundBody;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = th.accent;
  ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  for (let i = 6; i < w - 4; i += 10) ctx.fillRect(x + i, y + 7, 5, 3);
}

/* Spikes are drawn rather than emoji'd, and always in the same danger red
 * regardless of theme. A 🔺 glyph is small, dark and sits on dark ground, which
 * made the one thing that costs you a heart the hardest thing to see. Terrain
 * is canvas-drawn everywhere else in this renderer, so this is consistent —
 * emoji stay for the things that act. */
const SPIKE_TIP = '#fff1f2';
const SPIKE_BODY = '#ef4444';
const SPIKE_ROOT = '#7f1020';

function drawSpike(ctx, x, y, time) {
  const base = y + TILE;          // the teeth stand on the floor line
  const h = 25;
  const teeth = 3;
  const w = TILE / teeth;

  ctx.save();
  ctx.shadowColor = 'rgba(239,68,68,.95)';
  ctx.shadowBlur = 9 + Math.sin(time * 3 + x * 0.05) * 3;
  for (let i = 0; i < teeth; i++) {
    const cx = x + w * i;
    const g = ctx.createLinearGradient(0, base - h, 0, base);
    g.addColorStop(0, SPIKE_TIP);
    g.addColorStop(0.3, SPIKE_BODY);
    g.addColorStop(1, SPIKE_ROOT);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx + w / 2, base - h);
    ctx.lineTo(cx + w + 0.5, base);
    ctx.lineTo(cx - 0.5, base);
    ctx.closePath();
    ctx.fill();
    /* outline so the teeth stay separated even on the magma theme, where the
     * ground behind them is itself orange */
    ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();

  /* dark plinth with a hot edge, so the teeth separate from whatever they
   * happen to be standing on */
  ctx.fillStyle = 'rgba(8,3,6,.9)';
  ctx.fillRect(x, base - 5, TILE, 5);
  ctx.fillStyle = SPIKE_BODY;
  ctx.fillRect(x, base - 5, TILE, 1.5);
}

function drawLava(ctx, x, y, time, cx) {
  const g = ctx.createLinearGradient(0, y, 0, y + TILE);
  g.addColorStop(0, '#fb923c');
  g.addColorStop(0.35, '#ea580c');
  g.addColorStop(1, '#7c2d12');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = 'rgba(255,237,160,.85)';
  const wave = Math.sin(time * 3 + cx * 0.9) * 2;
  ctx.fillRect(x, y + wave, TILE, 3);
  if ((cx & 1) === 0) emoji(ctx, '🔥', x + TILE / 2, y + 6 + Math.sin(time * 4 + cx) * 2, 16);
}

function drawPlayer(ctx, world, d, cam) {
  const p = world.player;
  const x = p.x + p.w / 2 - cam;
  const y = p.y + p.h / 2;
  const s = p.squash;

  /* Rings only appear when something is actually happening — the default
   * state is a clean picture, so an aura always means something. */
  if (world.cover > 0) ring(ctx, x, y + 6, 22, 'rgba(103,232,249,.75)', world.time * 6);
  else if (d && d.mismatchKind) ring(ctx, x, y + 6, 20, 'rgba(248,113,113,.85)', world.time * 14);

  if (p.dead) {
    emoji(ctx, '💥', x, y, 34);
    return;
  }
  if (p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0) return;

  /* contact shadow — without it the character floats over the ground */
  ctx.save();
  ctx.globalAlpha = p.onGround ? 0.35 : 0.16;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, p.y + p.h + 2, 13, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y + 4);
  ctx.scale((1 + s) * (p.facing < 0 ? -1 : 1), 1 - s);
  ctx.font = `30px ${FONT_EMOJI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🦖', 0, 0);
  ctx.restore();
}

function ring(ctx, x, y, rad, color, phase) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.lineDashOffset = -phase * 4;
  ctx.beginPath();
  ctx.ellipse(x, y, rad, rad * 0.8, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/* The cabinet's own HUD — hearts, stage code, coins, and how far along the
 * course the character is. The only literal readout in the game. */
function drawCabinetHud(ctx, world, d) {
  ctx.save();
  ctx.fillStyle = 'rgba(2,6,18,.55)';
  ctx.fillRect(0, 0, VIEW_W, 26);
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  ctx.fillRect(0, 26, VIEW_W, 1);

  const hearts = d ? d.hearts : 3;
  for (let i = 0; i < METER.hearts; i++) {
    ctx.globalAlpha = i < hearts ? 1 : 0.25;
    emoji(ctx, i < hearts ? '❤️' : '🖤', 16 + i * 20, 13, 15);
  }
  ctx.globalAlpha = 1;

  ctx.font = '700 12px ui-monospace,Menlo,Consolas,monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = world.theme.accent;
  ctx.fillText(world.level.code + '  ' + world.level.name, 88, 13);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#fde047';
  emoji(ctx, '🪙', VIEW_W - 62, 13, 14);
  ctx.fillText(`${world.coins}/${world.coinsTotal}`, VIEW_W - 12, 13);

  /* course bar */
  const barX = VIEW_W / 2 - 70, barW = 140;
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  ctx.fillRect(barX, 20, barW, 3);
  const prog = Math.max(0, Math.min(1, world.player.x / (world.w - 80)));
  ctx.fillStyle = world.theme.accent;
  ctx.fillRect(barX, 20, barW * prog, 3);
  ctx.restore();
}

/* ── CRT decay ────────────────────────────────────────────────────────────
 * All of this is driven by SUS. A clean picture means they are not suspicious.
 */
function crtDamage(r, susN, time) {
  if (susN <= 0.02) return;
  const { ctx, canvas } = r;
  const g = susN;

  /* ghosting */
  ctx.save();
  ctx.globalAlpha = 0.10 * g;
  ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 2 + g * 3, 0, VIEW_W, VIEW_H);
  ctx.globalAlpha = 0.08 * g;
  ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, -(2 + g * 3), 0, VIEW_W, VIEW_H);
  ctx.restore();

  /* tearing */
  if (Math.random() < g * 0.35) {
    const bandY = Math.random() * (VIEW_H - 30);
    const bandH = 8 + Math.random() * 26;
    const shift = (Math.random() - 0.5) * 40 * g;
    ctx.drawImage(canvas,
      0, bandY * r.dpr, canvas.width, bandH * r.dpr,
      shift, bandY, VIEW_W, bandH);
  }

  /* static */
  const dots = (g * g * 220) | 0;
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  for (let i = 0; i < dots; i++) {
    ctx.fillRect((Math.random() * VIEW_W) | 0, (Math.random() * VIEW_H) | 0, 2, 1);
  }

  /* rolling bar */
  if (g > 0.45) {
    const y = ((time * 90) % (VIEW_H + 60)) - 60;
    const grad = ctx.createLinearGradient(0, y, 0, y + 60);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, `rgba(255,255,255,${0.06 * g})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, VIEW_W, 60);
  }
}

/* ── debug ────────────────────────────────────────────────────────────── */
function debugBoxes(ctx, world, cam) {
  ctx.save();
  ctx.lineWidth = 1;
  if (DEBUG.tileGrid) {
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    for (let x = -cam % TILE; x < VIEW_W; x += TILE) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, VIEW_H); ctx.stroke(); }
    for (let y = 0; y < VIEW_H; y += TILE) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VIEW_W, y); ctx.stroke(); }
  }
  if (DEBUG.hitboxes) {
    const p = world.player;
    ctx.strokeStyle = '#22d3ee';
    ctx.strokeRect(p.x - cam, p.y, p.w, p.h);
    ctx.strokeStyle = '#f43f5e';
    for (const e of world.entities) {
      if (e.type === 'coin' && e.taken) continue;
      ctx.strokeRect(e.x - cam, e.y, e.w, e.h);
    }
    for (let cy = 0; cy < ROWS; cy++)
      for (let cx = 0; cx < world.cols; cx++)
        if (isHazard(world.grid[cy][cx])) {
          ctx.strokeStyle = '#f97316';
          ctx.strokeRect(cx * TILE - cam, cy * TILE, TILE, TILE);
        }
  }
  ctx.restore();
}

function debugMeters(ctx, world, d, human) {
  ctx.save();
  ctx.font = '700 11px ui-monospace,Menlo,Consolas,monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let y = 34;
  const line = (txt, color) => { ctx.fillStyle = color; ctx.fillText(txt, 10, y); y += 14; };
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(4, 30, 210, DEBUG.humanIntent ? 96 : 68);
  if (DEBUG.meters && d) {
    line(`FUN  ${d.fun.toFixed(1).padStart(5)}  ${'█'.repeat(Math.round(d.fun / 8))}`, '#4ade80');
    line(`SUS  ${d.sus.toFixed(1).padStart(5)}  ${'█'.repeat(Math.round(d.sus / 8))}`, '#f87171');
    line(`cover ${world.cover.toFixed(2)}  mism ${d.mismatchKind || '-'}`, '#e2e8f0');
    line(`bored ${d.sinceThrill.toFixed(1)}s  hearts ${d.hearts}`, '#e2e8f0');
  }
  if (DEBUG.humanIntent && human) {
    line(`intent ${human.intent}`, '#fbbf24');
    line(`held  ${human.held.left ? '◀' : '·'}${human.held.jump ? '⤒' : '·'}${human.held.right ? '▶' : '·'}` +
         `  tele ${human.telegraph.left ? '◀' : '·'}${human.telegraph.jump ? '⤒' : '·'}${human.telegraph.right ? '▶' : '·'}`, '#fbbf24');
  }
  ctx.restore();
}
