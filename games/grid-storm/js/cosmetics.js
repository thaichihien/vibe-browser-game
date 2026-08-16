/* Cosmetics: the cube skins, the trail effects, and the wallet that owns them.

   Nothing in here touches gameplay. A skin only changes how the cube is
   painted; an effect only pushes particles into the same fx buffer the game
   already uses for explosions. Both are pure functions of (canvas, time), so
   the shop can preview them with a throwaway canvas and a throwaway fx buffer.

   Credits are earned by surviving: one per second, plus a bounty per storm you
   played through. See `runReward`. */

import { emit, ring, burst, confetti } from './fx.js';
import { rnd, pick, clamp } from './config.js';

/* ── the cubes ────────────────────────────────────────────────────────────

   a/b are the gradient stops, `glow` the shadow the cube throws.
   `trait` paints inside the body, `aura` outside it, `round` is the corner
   radius as a fraction of the cube. Tiers only drive the badge colour and the
   order things appear in the shop.                                          */

export const SKINS = [
  { id: 'starter',  name: 'STARTER LIME',  price: 0,    tier: 'free',
    a: '#7dff9f', b: '#17a34a', glow: '#3ff07a', trait: 'plain' },

  /* common */
  { id: 'cobalt',   name: 'COBALT',        price: 250,  tier: 'common',
    a: '#7cc4ff', b: '#1450b0', glow: '#59a8ff', trait: 'plain' },
  { id: 'ember',    name: 'EMBER',         price: 280,  tier: 'common',
    a: '#ffb46b', b: '#c93a10', glow: '#ff8a3d', trait: 'core' },
  { id: 'bubblegum',name: 'BUBBLEGUM',     price: 310,  tier: 'common',
    a: '#ffb3e6', b: '#d9268f', glow: '#ff4dd2', trait: 'dots' },
  { id: 'gunmetal', name: 'GUNMETAL',      price: 340,  tier: 'common',
    a: '#b8c6dc', b: '#46566f', glow: '#8fa5c4', trait: 'frame', round: 0.1 },
  { id: 'lemon',    name: 'LEMON DROP',    price: 370,  tier: 'common',
    a: '#fff29a', b: '#e0a800', glow: '#ffe14d', trait: 'plain', round: 0.42 },
  { id: 'grape',    name: 'GRAPE SODA',    price: 400,  tier: 'common',
    a: '#cbb0ff', b: '#6b34d6', glow: '#b388ff', trait: 'bars' },
  { id: 'mint',     name: 'MINT CHIP',     price: 440,  tier: 'common',
    a: '#b9ffe3', b: '#12a37a', glow: '#4dffc3', trait: 'checker' },
  { id: 'rust',     name: 'RUST BUCKET',   price: 480,  tier: 'common',
    a: '#d68f5b', b: '#6e3a1c', glow: '#b36a34', trait: 'shard', round: 0.08 },
  { id: 'rose',     name: 'ROSE QUARTZ',   price: 520,  tier: 'common',
    a: '#ffd9e0', b: '#e05a7d', glow: '#ff8fa8', trait: 'glass' },
  { id: 'tide',     name: 'TIDE POOL',     price: 560,  tier: 'common',
    a: '#7ff0e0', b: '#0f6f8f', glow: '#38e1d6', trait: 'bars' },
  { id: 'sunset',   name: 'SUNSET STRIP',  price: 600,  tier: 'common',
    a: '#ffd36b', b: '#ff3d7f', glow: '#ff7a4d', trait: 'plain' },
  { id: 'moss',     name: 'MOSS AGATE',    price: 650,  tier: 'common',
    a: '#b6d977', b: '#3d6b2a', glow: '#8fc44f', trait: 'dots' },

  /* rare */
  { id: 'voltage',  name: 'VOLTAGE',       price: 900,  tier: 'rare',
    a: '#fdff8f', b: '#ffb300', glow: '#ffe14d', trait: 'bolt' },
  { id: 'plasma',   name: 'PLASMA',        price: 1000, tier: 'rare',
    a: '#ff8fe0', b: '#7a1fd6', glow: '#d24dff', trait: 'core' },
  { id: 'glacier',  name: 'GLACIER',       price: 1100, tier: 'rare',
    a: '#d7f5ff', b: '#2a9df4', glow: '#7cf7ff', trait: 'glass' },
  { id: 'magma',    name: 'MAGMA CORE',    price: 1200, tier: 'rare',
    a: '#ffd36b', b: '#b3160f', glow: '#ff4a1f', trait: 'core', pulse: true },
  { id: 'toxic',    name: 'TOXIC WASTE',   price: 1300, tier: 'rare',
    a: '#d7ff4d', b: '#4a8f00', glow: '#b6ff2e', trait: 'ring' },
  { id: 'midnight', name: 'MIDNIGHT',      price: 1400, tier: 'rare',
    a: '#4a5fa0', b: '#0b1024', glow: '#3b57ff', trait: 'frame' },
  { id: 'carbon',   name: 'CARBON FIBRE',  price: 1500, tier: 'rare',
    a: '#6b7686', b: '#1b2028', glow: '#99a6b8', trait: 'checker', round: 0.1 },
  { id: 'koi',      name: 'KOI POND',      price: 1600, tier: 'rare',
    a: '#ffffff', b: '#ff5a1f', glow: '#ff8a3d', trait: 'shard', round: 0.45 },
  { id: 'aurora',   name: 'AURORA',        price: 1750, tier: 'rare',
    a: '#9dffd0', b: '#7a3dff', glow: '#4dffc3', trait: 'bars' },
  { id: 'inferno',  name: 'INFERNO',       price: 1900, tier: 'rare',
    a: '#ffe27a', b: '#ff1f3d', glow: '#ff2e5b', trait: 'bolt', pulse: true },

  /* epic */
  { id: 'hologram', name: 'HOLOGRAM',      price: 2400, tier: 'epic',
    a: '#b8fff5', b: '#4d7dff', glow: '#7cf7ff', trait: 'glass', aura: 'orbit' },
  { id: 'neonsign', name: 'NEON SIGN',     price: 2700, tier: 'epic',
    a: '#ff4dd2', b: '#10122b', glow: '#ff4dd2', trait: 'ring', aura: 'halo' },
  { id: 'circuit',  name: 'CIRCUIT',       price: 2900, tier: 'epic',
    a: '#6bffb3', b: '#063a2a', glow: '#3ff07a', trait: 'circuit', round: 0.1 },
  { id: 'obsidian', name: 'OBSIDIAN',      price: 3100, tier: 'epic',
    a: '#3a3f52', b: '#05060a', glow: '#b388ff', trait: 'shard', aura: 'halo' },
  { id: 'gold',     name: 'SOLID GOLD',    price: 3300, tier: 'epic',
    a: '#fff3b0', b: '#b8860b', glow: '#ffd700', trait: 'glass', aura: 'halo' },
  { id: 'prism',    name: 'PRISM',         price: 3600, tier: 'epic',
    a: '#ffffff', b: '#888888', glow: '#ffffff', trait: 'prism' },

  /* legend */
  { id: 'singularity', name: 'SINGULARITY', price: 5000, tier: 'legend',
    a: '#f2f4ff', b: '#05060a', glow: '#b388ff', trait: 'core',
    aura: 'orbit', pulse: true, round: 0.5 },
  { id: 'stormlord',   name: 'STORM LORD',  price: 6500, tier: 'legend',
    a: '#dff3ff', b: '#2b3c8f', glow: '#7cf7ff', trait: 'bolt',
    aura: 'orbit', pulse: true }
];

/* ── the effects ──────────────────────────────────────────────────────────

   `step(fx, x, y, s)` fires on every move, `tick(fx, x, y, s, dt, t)` every
   frame. `s` is a scratch object owned by the run, so an effect can keep its
   own timer without any engine support. All of them are deliberately small:
   the board is a bullet-dodging game, and a cosmetic must never hide a shot. */

const grey = ['#9fb0cc', '#c6d4ea'];

export const EFFECTS = [
  { id: 'none', name: 'NO EFFECT', emoji: '⬜', price: 0, tier: 'free',
    desc: 'A clean cube. Nothing trailing behind you.' },

  /* common */
  { id: 'sparktrail', name: 'SPARK TRAIL', emoji: '✨', price: 300, tier: 'common',
    desc: 'A bright mote drops on every step.',
    step: (fx, x, y) => emit(fx, { x, y, color: '#ffe14d', size: 0.1, life: 0.45 }) },

  { id: 'dust', name: 'DUST PUFF', emoji: '💨', price: 350, tier: 'common',
    desc: 'Kicks up a little dust wherever you land.',
    step: (fx, x, y) => {
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        emit(fx, { x, y, color: pick(grey), size: rnd(0.05, 0.1),
          vx: Math.cos(a) * rnd(0.4, 1.2), vy: Math.sin(a) * rnd(0.4, 1.2), life: 0.4 });
      }
    } },

  { id: 'bubbles', name: 'BUBBLE STREAM', emoji: '🫧', price: 420, tier: 'common',
    desc: 'Bubbles drift up off the cube, forever.',
    tick: (fx, x, y, s, dt) => every(s, dt, 0.28, () =>
      emit(fx, { x: x + rnd(-0.35, 0.35), y, emoji: '🫧', size: rnd(0.1, 0.17),
        vy: rnd(-1.6, -0.9), life: rnd(0.7, 1.1) })) },

  { id: 'embers', name: 'EMBERS', emoji: '🔥', price: 480, tier: 'common',
    desc: 'Hot cinders rise off you like a spent match.',
    tick: (fx, x, y, s, dt) => every(s, dt, 0.1, () =>
      emit(fx, { x: x + rnd(-0.3, 0.3), y: y + rnd(-0.2, 0.2),
        color: pick(['#ff8a3d', '#ffd36b', '#ff4a1f']), size: rnd(0.04, 0.09),
        vy: rnd(-1.4, -0.6), grav: -0.6, life: rnd(0.4, 0.8) })) },

  { id: 'flurry', name: 'FLURRY', emoji: '❄️', price: 540, tier: 'common',
    desc: 'Your own small snowstorm, following you around.',
    tick: (fx, x, y, s, dt) => every(s, dt, 0.22, () =>
      emit(fx, { x: x + rnd(-0.7, 0.7), y: y - 0.7, emoji: '❄️', size: rnd(0.08, 0.14),
        vy: rnd(0.6, 1.3), vx: rnd(-0.4, 0.4), life: rnd(0.8, 1.2) })) },

  { id: 'pulse', name: 'PULSE RINGS', emoji: '🔵', price: 600, tier: 'common',
    desc: 'Each step sends out a clean shockring.',
    step: (fx, x, y) => ring(fx, x, y, '#7cf7ff', 0.15, 0.85, 0.4, 2) },

  { id: 'stardust', name: 'STARDUST', emoji: '🌟', price: 680, tier: 'common',
    desc: 'Sprays stars out from under your feet.',
    step: (fx, x, y) => confetti(fx, x, y, ['✨', '🌟', '⭐'], 3) },

  { id: 'petals', name: 'PETAL FALL', emoji: '🌸', price: 760, tier: 'common',
    desc: 'Blossom drifts down around the cube.',
    tick: (fx, x, y, s, dt) => every(s, dt, 0.3, () =>
      emit(fx, { x: x + rnd(-0.8, 0.8), y: y - 0.8, emoji: pick(['🌸', '🌺', '🍃']),
        size: rnd(0.1, 0.16), vy: rnd(0.5, 1.1), vx: rnd(-0.6, 0.6), life: 1.1 })) },

  /* rare */
  { id: 'echo', name: 'GHOST ECHO', emoji: '👻', price: 1000, tier: 'rare',
    desc: 'Leaves a fading after-image of where you were.',
    step: (fx, x, y) => ring(fx, x, y, '#b388ff', 0.42, 0.42, 0.45, 3) },

  { id: 'zap', name: 'STATIC CHARGE', emoji: '⚡', price: 1150, tier: 'rare',
    desc: 'Arcs of loose current pop off the shell.',
    tick: (fx, x, y, s, dt) => every(s, dt, 0.45, () => {
      const a = Math.random() * Math.PI * 2;
      emit(fx, { x: x + Math.cos(a) * 0.5, y: y + Math.sin(a) * 0.5, emoji: '⚡',
        size: 0.13, life: 0.3 });
    }) },

  { id: 'cloud', name: 'RAIN CLOUD', emoji: '🌧️', price: 1300, tier: 'rare',
    desc: 'A tiny cloud follows you, and it is raining.',
    tick: (fx, x, y, s, dt) => {
      every(s, dt, 0.12, () =>
        emit(fx, { x: x + rnd(-0.45, 0.45), y: y - 0.75, color: '#7cc4ff',
          size: 0.05, vy: rnd(1.6, 2.4), life: 0.4 }));
      every2(s, dt, 0.5, () =>
        emit(fx, { x, y: y - 1, emoji: '☁️', size: 0.2, life: 0.55 }));
    } },

  { id: 'notes', name: 'SOUNDTRACK', emoji: '🎵', price: 1450, tier: 'rare',
    desc: 'Every step plays a visible note.',
    step: (fx, x, y) =>
      emit(fx, { x, y, emoji: pick(['🎵', '🎶']), size: 0.16,
        vy: -1.6, vx: rnd(-0.8, 0.8), life: 0.8 }) },

  { id: 'flutter', name: 'FLUTTER', emoji: '🦋', price: 1600, tier: 'rare',
    desc: 'Butterflies circle the cube, unbothered by the storm.',
    tick: (fx, x, y, s, dt) => {
      s.a = (s.a || 0) + dt * 2.4;
      every(s, dt, 0.16, () =>
        emit(fx, { x: x + Math.cos(s.a) * 0.75, y: y + Math.sin(s.a) * 0.55,
          emoji: pick(['🦋', '🐝']), size: 0.14, life: 0.5 }));
    } },

  { id: 'ink', name: 'INK BLOT', emoji: '🖤', price: 1750, tier: 'rare',
    desc: 'Bleeds dark ink onto the cell you leave.',
    step: (fx, x, y) => {
      emit(fx, { x, y, color: '#1a1030', size: 0.3, life: 0.7 });
      emit(fx, { x, y, color: '#5b3bb5', size: 0.18, life: 0.5 });
    } },

  { id: 'jackpot', name: 'JACKPOT', emoji: '🪙', price: 1900, tier: 'rare',
    desc: 'Coins pop out with every move. They are not real.',
    step: (fx, x, y) => confetti(fx, x, y, ['🪙', '💰', '💎'], 3) },

  /* epic */
  { id: 'rainbow', name: 'RAINBOW ROAD', emoji: '🌈', price: 2600, tier: 'epic',
    desc: 'A hue-cycling ribbon that never repeats a colour.',
    step: (fx, x, y, s, t) =>
      emit(fx, { x, y, color: `hsl(${(t * 220) % 360} 100% 62%)`, size: 0.26, life: 0.6 }),
    tick: (fx, x, y, s, dt, t) => every(s, dt, 0.05, () =>
      emit(fx, { x: x + rnd(-0.2, 0.2), y: y + rnd(-0.2, 0.2),
        color: `hsl(${(t * 220) % 360} 100% 68%)`, size: 0.08, life: 0.35 })) },

  { id: 'phoenix', name: 'PHOENIX', emoji: '🔥', price: 2900, tier: 'epic',
    desc: 'Wings of fire flare open on every step.',
    step: (fx, x, y) => {
      burst(fx, x, y, '#ff6a1f', 8, 3.4, '🔥');
      ring(fx, x, y, '#ffb300', 0.2, 1.1, 0.45, 3);
    },
    tick: (fx, x, y, s, dt) => every(s, dt, 0.14, () =>
      emit(fx, { x: x + rnd(-0.4, 0.4), y, color: '#ff8a3d', size: rnd(0.05, 0.1),
        vy: rnd(-1.8, -1), life: 0.5 })) },

  { id: 'galaxy', name: 'GALAXY', emoji: '🌌', price: 3200, tier: 'epic',
    desc: 'A little solar system in orbit around you.',
    tick: (fx, x, y, s, dt) => {
      s.a = (s.a || 0) + dt * 1.9;
      every(s, dt, 0.09, () => {
        emit(fx, { x: x + Math.cos(s.a) * 0.85, y: y + Math.sin(s.a) * 0.85,
          emoji: pick(['✨', '⭐', '🌟']), size: 0.11, life: 0.45 });
        emit(fx, { x: x + Math.cos(-s.a * 1.6) * 0.55, y: y + Math.sin(-s.a * 1.6) * 0.55,
          color: '#b388ff', size: 0.07, life: 0.4 });
      });
      every2(s, dt, 1.1, () => ring(fx, x, y, '#7a3dff', 0.3, 1.3, 0.8, 2));
    } },

  { id: 'thunder', name: 'THUNDERHEAD', emoji: '🌩️', price: 3600, tier: 'epic',
    desc: 'You are the storm now. Lightning cracks off the shell.',
    step: (fx, x, y) => {
      ring(fx, x, y, '#dff3ff', 0.2, 1.2, 0.3, 2);
      emit(fx, { x, y: y - 0.5, emoji: '⚡', size: 0.2, life: 0.35 });
    },
    tick: (fx, x, y, s, dt) => every(s, dt, 0.3, () => {
      const a = Math.random() * Math.PI * 2;
      emit(fx, { x: x + Math.cos(a) * 0.6, y: y + Math.sin(a) * 0.6,
        color: '#7cf7ff', size: rnd(0.04, 0.11), life: 0.3 });
    }) },

  { id: 'void', name: 'EVENT HORIZON', emoji: '🕳️', price: 4000, tier: 'epic',
    desc: 'Light falls inward and never comes back out.',
    tick: (fx, x, y, s, dt) => every(s, dt, 0.06, () => {
      const a = Math.random() * Math.PI * 2, r = rnd(1.1, 1.6);
      emit(fx, { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
        color: pick(['#b388ff', '#7cf7ff', '#ffffff']), size: rnd(0.04, 0.09),
        vx: -Math.cos(a) * 3.4, vy: -Math.sin(a) * 3.4, life: 0.42 });
    }) }
];

/* two independent timers, because a couple of effects want both a fast
   emitter and a slow one */
function every(s, dt, gap, fn) {
  s.t = (s.t || 0) - dt;
  if (s.t > 0) return;
  s.t = gap;
  fn();
}

function every2(s, dt, gap, fn) {
  s.t2 = (s.t2 || 0) - dt;
  if (s.t2 > 0) return;
  s.t2 = gap;
  fn();
}

/* ── the wallet ───────────────────────────────────────────────────────────── */

const KEY = {
  credits: 'gridStorm.credits',
  skins:   'gridStorm.skinsOwned',
  fx:      'gridStorm.fxOwned',
  skin:    'gridStorm.skin',
  effect:  'gridStorm.effect'
};

const readSet = k => {
  try { return new Set(JSON.parse(localStorage.getItem(k) || '[]')); }
  catch { return new Set(); }
};

export const REWARD = {
  perSecond: 1,
  perStorm:  15,     // surviving into the events is the point, so pay for it
  bestBonus: 0.5     // +50% on a run that beats your record
};

export function runReward(seconds, storms, isBest) {
  const time  = Math.floor(Math.max(0, seconds) * REWARD.perSecond);
  const storm = Math.max(0, storms) * REWARD.perStorm;
  const bonus = isBest ? Math.round((time + storm) * REWARD.bestBonus) : 0;
  return { time, storm, bonus, total: time + storm + bonus };
}

export const Shop = {
  credits: 0,
  skins: new Set(['starter']),
  fx: new Set(['none']),
  skinId: 'starter',
  effectId: 'none',

  init() {
    this.credits = Math.max(0, Number(localStorage.getItem(KEY.credits) || 0));
    this.skins = readSet(KEY.skins).add('starter');
    this.fx = readSet(KEY.fx).add('none');

    // a stored id that no longer exists (or was never bought) falls back
    const sk = localStorage.getItem(KEY.skin);
    const ef = localStorage.getItem(KEY.effect);
    if (sk && this.skins.has(sk) && SKINS.some(s => s.id === sk)) this.skinId = sk;
    if (ef && this.fx.has(ef) && EFFECTS.some(e => e.id === ef)) this.effectId = ef;
  },

  save() {
    localStorage.setItem(KEY.credits, String(Math.round(this.credits)));
    localStorage.setItem(KEY.skins, JSON.stringify([...this.skins]));
    localStorage.setItem(KEY.fx, JSON.stringify([...this.fx]));
    localStorage.setItem(KEY.skin, this.skinId);
    localStorage.setItem(KEY.effect, this.effectId);
  },

  earn(n) {
    this.credits = Math.max(0, this.credits + Math.round(n));
    this.save();
    return this.credits;
  },

  owned(kind, id) { return (kind === 'skin' ? this.skins : this.fx).has(id); },

  find(kind, id) {
    return (kind === 'skin' ? SKINS : EFFECTS).find(d => d.id === id) || null;
  },

  buy(kind, id) {
    const def = this.find(kind, id);
    if (!def || this.owned(kind, id) || this.credits < def.price) return false;
    this.credits -= def.price;
    (kind === 'skin' ? this.skins : this.fx).add(id);
    this.equip(kind, id);
    return true;
  },

  equip(kind, id) {
    if (!this.owned(kind, id)) return false;
    if (kind === 'skin') this.skinId = id; else this.effectId = id;
    this.save();
    return true;
  },

  /* resolved definitions — the renderer and the engine call these every frame,
     so they must stay a plain lookup with no allocation */
  skin()   { return this.find('skin', this.skinId) || SKINS[0]; },
  effect() { return this.find('effect', this.effectId) || EFFECTS[0]; },

  counts() {
    return {
      skin:   { owned: this.skins.size, total: SKINS.length },
      effect: { owned: this.fx.size,    total: EFFECTS.length }
    };
  }
};

/* ── painting a cube ──────────────────────────────────────────────────────

   Used by the board renderer at cell scale and by the shop at thumbnail
   scale, so everything here is expressed as a fraction of `size`.           */

export function drawCube(ctx, x, y, size, skin, o = {}) {
  const sk = skin || SKINS[0];
  const t = o.t || 0;

  let a = sk.a, b = sk.b, glow = sk.glow;
  if (sk.trait === 'prism') {
    const h = (t * 80) % 360;
    a = `hsl(${h} 100% 76%)`;
    b = `hsl(${(h + 70) % 360} 90% 44%)`;
    glow = `hsl(${(h + 35) % 360} 100% 62%)`;
  }

  const s = size * (sk.pulse ? 1 + Math.sin(t * 5) * 0.045 : 1);
  const r = s * (sk.round ?? 0.18);
  const half = s / 2;

  ctx.save();
  ctx.globalAlpha = clamp(o.alpha ?? 1, 0, 1);
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);

  if (sk.aura === 'halo') {
    ctx.save();
    ctx.globalAlpha *= 0.35 + 0.2 * Math.sin(t * 3);
    ctx.strokeStyle = glow;
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.78, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /* body */
  const grad = ctx.createLinearGradient(-half, -half, half, half);
  grad.addColorStop(0, a);
  grad.addColorStop(1, b);

  ctx.save();
  if (sk.trait === 'glass') ctx.globalAlpha *= 0.66;
  ctx.fillStyle = grad;
  ctx.shadowColor = glow;
  ctx.shadowBlur = (o.glowPx ?? s * 0.25) + Math.sin(t * 6) * s * 0.08;
  roundPath(ctx, -half, -half, s, s, r);
  ctx.fill();
  ctx.restore();

  /* trait, clipped to the body so nothing bleeds past the corners */
  ctx.save();
  roundPath(ctx, -half, -half, s, s, r);
  ctx.clip();
  paintTrait(ctx, sk.trait, s, t, a, b, glow);
  /* frozen: the ice event has to read at a glance, so it frosts over whatever
     skin is equipped rather than replacing it */
  if (o.frost) {
    ctx.fillStyle = 'rgba(124, 247, 255, 0.42)';
    ctx.fillRect(-half, -half, s, s);
  }
  ctx.restore();

  if (sk.aura === 'orbit') {
    const ang = t * 2.6;
    ctx.save();
    ctx.fillStyle = glow;
    ctx.shadowColor = glow;
    ctx.shadowBlur = s * 0.3;
    ctx.beginPath();
    ctx.arc(Math.cos(ang) * s * 0.82, Math.sin(ang) * s * 0.82, s * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (o.face) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0b1020';
    ctx.font = `${s * 0.6}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(o.face, 0, s * 0.04);
  }

  ctx.restore();
}

function paintTrait(ctx, trait, s, t, a, b, glow) {
  const half = s / 2;

  switch (trait) {
    case 'core': {
      ctx.save();
      ctx.globalAlpha *= 0.55 + 0.35 * Math.sin(t * 4);
      ctx.fillStyle = glow;
      ctx.shadowColor = glow;
      ctx.shadowBlur = s * 0.4;
      ctx.translate(0, 0);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-s * 0.17, -s * 0.17, s * 0.34, s * 0.34);
      ctx.restore();
      break;
    }
    case 'ring': {
      ctx.save();
      ctx.globalAlpha *= 0.9;
      ctx.strokeStyle = glow;
      ctx.lineWidth = Math.max(1, s * 0.07);
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'bars': {
      ctx.save();
      ctx.globalAlpha *= 0.42;
      ctx.fillStyle = a;
      for (let i = -1; i <= 1; i++) ctx.fillRect(-half, i * s * 0.26 - s * 0.06, s, s * 0.12);
      ctx.restore();
      break;
    }
    case 'checker': {
      ctx.save();
      ctx.globalAlpha *= 0.38;
      ctx.fillStyle = a;
      ctx.fillRect(-half, -half, half, half);
      ctx.fillRect(0, 0, half, half);
      ctx.restore();
      break;
    }
    case 'dots': {
      ctx.save();
      ctx.globalAlpha *= 0.85;
      ctx.fillStyle = glow;
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.beginPath();
        ctx.arc(dx * s * 0.28, dy * s * 0.28, s * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case 'frame': {
      ctx.save();
      ctx.strokeStyle = glow;
      ctx.lineWidth = Math.max(2, s * 0.11);
      ctx.strokeRect(-half, -half, s, s);
      ctx.restore();
      break;
    }
    case 'bolt': {
      ctx.save();
      ctx.globalAlpha *= 0.9;
      ctx.fillStyle = glow;
      ctx.shadowColor = glow;
      ctx.shadowBlur = s * 0.3;
      ctx.beginPath();
      ctx.moveTo(s * 0.08, -half);
      ctx.lineTo(-s * 0.22, s * 0.06);
      ctx.lineTo(-s * 0.02, s * 0.06);
      ctx.lineTo(-s * 0.1, half);
      ctx.lineTo(s * 0.24, -s * 0.04);
      ctx.lineTo(s * 0.04, -s * 0.04);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'shard': {
      ctx.save();
      ctx.globalAlpha *= 0.5;
      ctx.fillStyle = a;
      ctx.beginPath();
      ctx.moveTo(-half, -half);
      ctx.lineTo(half, -half);
      ctx.lineTo(-half, half);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'glass': {
      ctx.save();
      ctx.globalAlpha *= 0.55;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-half, half * 0.1);
      ctx.lineTo(half * 0.2, -half);
      ctx.lineTo(half * 0.62, -half);
      ctx.lineTo(-half, half * 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'circuit': {
      ctx.save();
      ctx.globalAlpha *= 0.75;
      ctx.strokeStyle = glow;
      ctx.lineWidth = Math.max(1, s * 0.045);
      ctx.beginPath();
      ctx.moveTo(-half, -s * 0.2); ctx.lineTo(-s * 0.1, -s * 0.2); ctx.lineTo(-s * 0.1, s * 0.28);
      ctx.moveTo(half, s * 0.06); ctx.lineTo(s * 0.16, s * 0.06); ctx.lineTo(s * 0.16, -s * 0.3);
      ctx.stroke();
      ctx.fillStyle = glow;
      for (const [dx, dy] of [[-0.1, 0.28], [0.16, -0.3]]) {
        ctx.beginPath();
        ctx.arc(dx * s, dy * s, s * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case 'prism': {
      ctx.save();
      ctx.globalAlpha *= 0.4;
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = `hsl(${(t * 80 + i * 90) % 360} 100% 62%)`;
        ctx.fillRect(-half + (i * s) / 4, -half, s / 4, s);
      }
      ctx.restore();
      break;
    }
  }
}

export function roundPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export const TIER_COLOR = {
  free:   '#8496b5',
  common: '#4dffc3',
  rare:   '#59a8ff',
  epic:   '#d24dff',
  legend: '#ffd700'
};
