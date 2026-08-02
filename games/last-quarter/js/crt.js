/* The cabinet's screen — everything that is true no matter which game is
 * running on it.
 *
 * The bezel, the HUD strip, the particle layer and the picture falling apart
 * under a run of misses belong to the *machine*, not to any one game. Each game
 * supplies only the contents of the screen; this module frames them.
 */
import { VIEW_W, VIEW_H, METER, DEBUG } from './config.js';

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

export function emoji(ctx, ch, x, y, size, rot = 0, flip = 1) {
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
      life: 0.5 + Math.random() * 0.3, t: 0, color, gravity: 700,
    });
  }
}

/* Sparks that drift rather than fall — for games with no down. */
export function spark(r, x, y, color, n = 8, spread = 120) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    r.particles.push({
      x, y, vx: Math.cos(a) * spread * (0.4 + Math.random()),
      vy: Math.sin(a) * spread * (0.4 + Math.random()),
      life: 0.35 + Math.random() * 0.3, t: 0, color, gravity: 0,
    });
  }
}

function drawParticles(r, world, dt) {
  const { ctx } = r;
  const camX = world.camX || 0, camY = world.camY || 0;
  for (let i = r.particles.length - 1; i >= 0; i--) {
    const p = r.particles[i];
    p.t += dt;
    if (p.t > p.life) { r.particles.splice(i, 1); continue; }
    p.vy += (p.gravity ?? 700) * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    ctx.globalAlpha = 1 - p.t / p.life;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - camX - 2, p.y - camY - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

/* ── one frame ────────────────────────────────────────────────────────────
 * The cabinet game draws its own world; the machine draws everything around
 * and on top of it.
 */
export function drawFrame(r, cabinet, world, d, human, dt) {
  const { ctx } = r;
  /* How wrecked the picture looks tracks *recent* misses, not the meter — the
   * cabinet glitches when you have just been caught out and settles when you
   * stop, which is what makes it readable as a separate instrument from the
   * face even though one number sits under both. */
  const heat = d ? d.heat : 0;

  ctx.save();
  if (world.shake > 0) {
    ctx.translate((Math.random() - 0.5) * 6 * world.shake, (Math.random() - 0.5) * 6 * world.shake);
  }
  cabinet.draw(r, world, d, dt);
  drawParticles(r, world, dt);
  ctx.restore();

  drawCabinetHud(ctx, world, d);
  crtDamage(r, heat, world.time);
  if ((DEBUG.hitboxes || DEBUG.tileGrid) && cabinet.debugDraw) cabinet.debugDraw(ctx, world);
  if (DEBUG.meters || DEBUG.humanIntent) debugMeters(ctx, world, d, human);
}

/* The cabinet's own HUD — hearts, stage code, pickups, and how far along the
 * game the character is. The only literal readout in the game. */
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
  emoji(ctx, world.pickupIcon || '🪙', VIEW_W - 62, 13, 14);
  ctx.fillText(`${world.coins}/${world.coinsTotal}`, VIEW_W - 12, 13);

  /* course bar — every cabinet reports its own 0..1 progress */
  const barX = VIEW_W / 2 - 70, barW = 140;
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  ctx.fillRect(barX, 20, barW, 3);
  ctx.fillStyle = world.theme.accent;
  ctx.fillRect(barX, 20, barW * Math.max(0, Math.min(1, world.progress01 || 0)), 3);
  ctx.restore();
}

/* ── CRT decay ────────────────────────────────────────────────────────────
 * Driven by `heat` — recent misses, decaying — not by the meter itself. A clean
 * picture means you have not been caught out lately.
 */
function crtDamage(r, heat, time) {
  if (heat <= 0.02) return;
  const { ctx, canvas } = r;
  const g = heat;

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
    line(`PAT  ${d.patience.toFixed(1).padStart(5)}  ${'█'.repeat(Math.round(d.patience / 8))}`, '#4ade80');
    line(`heat ${d.heat.toFixed(2).padStart(5)}  ${'█'.repeat(Math.round(d.heat * 12))}`, '#f87171');
    line(`hit/miss ${d.hits}/${d.misses}   hearts ${d.hearts}`, '#fbbf24');
    line(`cover ${world.cover.toFixed(2)}  mism ${d.mismatchKind || '-'}`, '#e2e8f0');
  }
  if (DEBUG.humanIntent && human) {
    line(`intent ${human.intent}`, '#fbbf24');
    line(`held  ${human.held.left ? '◀' : '·'}${human.held.jump ? '⤒' : '·'}${human.held.right ? '▶' : '·'}` +
         `  tele ${human.telegraph.left ? '◀' : '·'}${human.telegraph.jump ? '⤒' : '·'}${human.telegraph.right ? '▶' : '·'}`, '#fbbf24');
  }
  ctx.restore();
}
