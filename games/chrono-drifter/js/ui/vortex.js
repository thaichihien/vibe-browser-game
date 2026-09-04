/* The time vortex behind the menu.

   A tunnel seen from inside: rings of cloud rushing past, debris streaking out
   from the vanishing point, and clock faces tumbling through it — the thing you
   fall through between one era and the next.

   Everything is drawn, not loaded: one canvas, no assets, no dependencies. The
   loop only runs while the menu is on screen (start/stop), and honours
   prefers-reduced-motion by painting a single still frame. */

const REDUCED = typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

const RINGS = 22;          // depth layers of the tunnel wall
const MOTES = 150;         // debris streaking past
const LOBES = 5;           // how many bulges a ring has — the churn of the cloud
const NEAR = 0.06;         // recycle depth: past this a thing is behind you
const FAR = 1;
const FOCAL = 0.52;        // tunnel width, as a fraction of the smaller side

/* Roman numerals, because the vortex has always had clocks in it. */
const GLYPHS = ['Ⅻ', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ', 'Ⅺ'];

/* The vortex is not always blue. It drifts through a set of hues — you never see
   the same one twice running, and the change is a slow crossfade rather than a
   cut, so it reads as the tunnel turning rather than the page repainting.
   `warm` is the light at the mouth: always warmer than the wall, so the tunnel
   keeps its depth whatever colour it has taken. */
const PALETTES = [
  { h: 214, s: 62, warm: '248,206,132' },   // thiên thanh — the blue it starts in
  { h: 268, s: 58, warm: '236,182,255' },   // tử la lan
  { h: 322, s: 56, warm: '255,190,214' },   // đào
  { h: 352, s: 58, warm: '255,188,150' },   // huyết
  { h: 30,  s: 64, warm: '255,228,168' },   // hổ phách
  { h: 48,  s: 60, warm: '255,240,180' },   // kim
  { h: 148, s: 50, warm: '206,255,208' },   // lục
  { h: 184, s: 56, warm: '190,252,246' }    // thanh lục
];
/* More of the cycle is spent moving than standing still: the colour is almost
   always mid-drift, so you never catch the moment it changes. */
const HOLD_MIN = 7, HOLD_MAX = 13;          // seconds settled on one colour
const FADE = 13;                            // seconds to cross into the next

let canvas = null, ctx = null, raf = 0, t0 = 0, running = false;
let W = 0, H = 0, dpr = 1;
let rings = [], motes = [], marks = [];
let paint = null;                           // the colours this frame is drawn in
let from = PALETTES[0], to = PALETTES[0], turn = 0, hold = 0;
let cold = true;                            // true until a visit starts; see start()

const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, k) => a + (b - a) * k;

/** Hue is a circle: cross it the short way or a red→blue fade detours through green. */
function lerpHue(a, b, k) {
  let d = ((b - a + 540) % 360) - 180;
  return (a + d * k + 360) % 360;
}

function nextPalette(carry = 0) {
  let n = to;
  while (n === to) n = PALETTES[(Math.random() * PALETTES.length) | 0];
  from = to; to = n; turn = carry; hold = rand(HOLD_MIN, HOLD_MAX);
}

/** One eased step of the crossfade, then the colours this frame will use.
    The swap happens before the mix is read, and carries the leftover time with
    it — read after, it painted one frame of the new colour before the fade had
    started, which is a flash, not a fade. */
function tint(dt) {
  turn += dt;
  if (turn >= hold + FADE) nextPalette(turn - (hold + FADE));
  const k = Math.min(1, Math.max(0, (turn - hold) / FADE));
  const e = k * k * (3 - 2 * k);                        // smoothstep
  const h = lerpHue(from.h, to.h, e);
  const sat = lerp(from.s, to.s, e);
  const wf = from.warm.split(',').map(Number), wt = to.warm.split(',').map(Number);
  const warm = wf.map((v, i) => Math.round(lerp(v, wt[i], e))).join(',');
  paint = {
    h, sat, warm,
    wall: (k2, a) => `hsla(${h.toFixed(1)},${(sat - 6).toFixed(0)}%,${(26 + k2 * 26).toFixed(0)}%,${a})`,
    line: (k2, a) => `hsla(${h.toFixed(1)},${(sat + 16).toFixed(0)}%,${(60 + k2 * 24).toFixed(0)}%,${a})`,
    dust: (k2, a) => `hsla(${h.toFixed(1)},${(sat - 18).toFixed(0)}%,${(80 + k2 * 14).toFixed(0)}%,${a})`
  };
}

function seed() {
  rings = Array.from({ length: RINGS }, (_, i) => ({
    z: FAR - (i / RINGS) * (FAR - NEAR),
    spin: rand(0, Math.PI * 2),
    drift: rand(-.5, .5),
    warp: rand(.1, .3),
    hue: rand(0, 1)
  }));
  motes = Array.from({ length: MOTES }, () => ({
    a: rand(0, Math.PI * 2), r: rand(.15, 1.25), z: rand(NEAR, FAR),
    v: rand(.10, .34), gold: Math.random() < .3, len: rand(.4, 1.6)
  }));
  marks = Array.from({ length: 7 }, () => ({
    a: rand(0, Math.PI * 2), r: rand(.45, 1.05), z: rand(NEAR, FAR),
    v: rand(.05, .12), spin: rand(0, Math.PI * 2), turn: rand(-.6, .6),
    ch: GLYPHS[(Math.random() * GLYPHS.length) | 0]
  }));
}

function resize() {
  const box = canvas.getBoundingClientRect();
  if (!box.width || !box.height) return false;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = box.width; H = box.height;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return true;
}

/* The vanishing point wanders, so the tunnel never sits still even when nothing
   else moves. */
const eyeX = (t) => W / 2 + Math.sin(t * .21) * W * .045 + Math.sin(t * .07) * W * .02;
const eyeY = (t) => H / 2 + Math.cos(t * .17) * H * .05;

function frame(t) {
  const f = Math.min(W, H) * FOCAL;
  const cx = eyeX(t), cy = eyeY(t);

  // the ground: a deep well of colour, brightest at the mouth of the tunnel
  const { h, sat } = paint;
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * .78);
  bg.addColorStop(0, `hsl(${h},${sat}%,29%)`);
  bg.addColorStop(.16, `hsl(${h},${sat - 4}%,16%)`);
  bg.addColorStop(.46, `hsl(${h},${sat - 12}%,7%)`);
  bg.addColorStop(1, '#03040a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = 'lighter';

  /* The tunnel wall. Each ring is drawn twice — a wide, faint band that builds up
     into cloud where the rings overlap, then a thin filament along its spine. The
     wall stays in the blue family the whole way down; the only warm light in the
     picture comes from the mouth of the tunnel, which is what gives it depth. */
  for (const R of rings) {
    const k = 1 - (R.z - NEAR) / (FAR - NEAR);     // 0 far … 1 near
    const rad = f / R.z * .5;
    const spin = R.spin + t * (.14 + R.drift * .12);
    // the near rings are enormous, and a fixed segment count facets them
    const seg = Math.max(44, Math.min(180, (rad * .5) | 0));
    ctx.beginPath();
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const wob = 1 + Math.sin(a * LOBES + spin) * R.warp
                    + Math.sin(a * 2 - spin * 1.7) * R.warp * .5
                    + Math.sin(a * 9 + spin * .6) * R.warp * .16;
      const x = cx + Math.cos(a) * rad * wob;
      const y = cy + Math.sin(a) * rad * wob * .82;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    const lit = R.hue > .84;                       // one ring in six carries the warm light
    ctx.strokeStyle = lit ? `rgba(${paint.warm},${(.014 + k * .05).toFixed(3)})`
                          : paint.wall(k, (.012 + k * .055).toFixed(3));
    ctx.lineWidth = Math.max(6, rad * .34);
    ctx.stroke();
    ctx.strokeStyle = lit ? `rgba(${paint.warm},${(.06 + k * .3).toFixed(3)})`
                          : paint.line(k, (.05 + k * .30).toFixed(3));
    ctx.lineWidth = .7 + k * 2.4;
    ctx.stroke();
  }

  // debris, drawn as the streak it left rather than the point it is
  for (const m of motes) {
    const s1 = f / m.z, s2 = f / Math.min(FAR, m.z + m.v * .09 * m.len);
    const ca = Math.cos(m.a), sa = Math.sin(m.a) * .82;
    const k = 1 - (m.z - NEAR) / (FAR - NEAR);
    ctx.beginPath();
    ctx.moveTo(cx + ca * m.r * s2, cy + sa * m.r * s2);
    ctx.lineTo(cx + ca * m.r * s1, cy + sa * m.r * s1);
    ctx.strokeStyle = m.gold
      ? `rgba(${paint.warm},${(.12 + k * .74).toFixed(3)})`
      : paint.dust(k, (.10 + k * .66).toFixed(3));
    ctx.lineWidth = .5 + k * 2.1;
    ctx.stroke();
  }

  // clock faces tumbling out of the depth
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const g of marks) {
    const s = f / g.z, k = 1 - (g.z - NEAR) / (FAR - NEAR);
    const size = Math.max(9, s * .07);
    const x = cx + Math.cos(g.a) * g.r * s, y = cy + Math.sin(g.a) * g.r * s * .82;
    if (x < -size * 3 || x > W + size * 3 || y < -size * 3 || y > H + size * 3) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(g.spin + t * g.turn);
    ctx.globalAlpha = Math.min(.5, .05 + k * .4);
    ctx.strokeStyle = `rgba(${paint.warm},.85)`;
    ctx.lineWidth = Math.max(.6, size * .05);
    ctx.beginPath(); ctx.arc(0, 0, size * .95, 0, Math.PI * 2); ctx.stroke();
    ctx.font = `${size.toFixed(1)}px 'Chivo', Georgia, serif`;
    ctx.fillStyle = 'rgba(232,236,247,.9)';
    ctx.fillText(g.ch, 0, size * .04);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // the mouth of the tunnel: the one warm light in the picture, breathing
  const pulse = 1 + Math.sin(t * .8) * .07;
  const eye = ctx.createRadialGradient(cx, cy, 0, cx, cy, f * .62 * pulse);
  eye.addColorStop(0, 'rgba(255,250,238,.92)');
  eye.addColorStop(.14, `rgba(${paint.warm},.52)`);
  eye.addColorStop(.42, `hsla(${h},${sat}%,58%,.16)`);
  eye.addColorStop(1, `hsla(${h},${sat}%,60%,0)`);
  ctx.fillStyle = eye;
  ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = 'source-over';

  // vignette, so the copy in the middle keeps its contrast
  const vg = ctx.createRadialGradient(cx, cy, Math.min(W, H) * .12, cx, cy, Math.max(W, H) * .62);
  vg.addColorStop(0, 'rgba(3,4,10,0)');
  vg.addColorStop(.55, 'rgba(3,4,10,.34)');
  vg.addColorStop(1, 'rgba(3,4,10,.95)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

function advance(dt) {
  for (const R of rings) {
    R.z -= dt * .115;
    if (R.z <= NEAR) { R.z = FAR; R.spin = rand(0, Math.PI * 2); R.hue = rand(0, 1); }
  }
  for (const m of motes) {
    m.z -= dt * m.v;
    if (m.z <= NEAR) { m.z = FAR; m.a = rand(0, Math.PI * 2); m.r = rand(.15, 1.25); }
  }
  for (const g of marks) {
    g.z -= dt * g.v;
    if (g.z <= NEAR) {
      g.z = FAR; g.a = rand(0, Math.PI * 2); g.r = rand(.45, 1.05);
      g.ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
  }
}

function loop(now) {
  if (!running) return;
  const t = (now - t0) / 1000;
  const dt = Math.min(.05, t - loop.last || .016);
  advance(dt);
  tint(dt);
  loop.last = t;
  frame(t);
  raf = requestAnimationFrame(loop);
}

const onResize = () => { if (resize() && REDUCED) { tint(0); frame(2.4); } };

export function start(el) {
  canvas = el || canvas;
  if (!canvas) return;
  ctx = ctx || canvas.getContext('2d');
  if (!rings.length) seed();
  // A fresh colour each time you come back to the vortex, never the one just left —
  // but menu → roll is one visit, not two, so the colour carries across it.
  if (cold) { nextPalette(); from = to; turn = 0; tint(0); cold = false; }
  if (!resize()) return;                  // hidden: nothing to paint on yet
  window.addEventListener('resize', onResize);
  if (REDUCED) { frame(2.4); return; }    // one still frame, in one colour, no loop
  if (running) return;
  running = true;
  t0 = performance.now();
  loop.last = 0;
  raf = requestAnimationFrame(loop);
}

/** The colour the tunnel is currently painted in — for eyeballing the drift. */
export const hueNow = () => paint ? paint.h : null;

export function stop() {
  running = false;
  cold = true;
  cancelAnimationFrame(raf);
  window.removeEventListener('resize', onResize);
}
