/* Builds an era's battlefield out of CSS gradients and emoji. No image files.
   Nine layers, back to front, and a formation that lays out any side from 1 to 8. */

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
/* Guarded so the pure layout maths in this file can be imported by the test
   suite, which has no window to ask. */
export const REDUCED = typeof matchMedia === 'function'
  ? matchMedia('(prefers-reduced-motion: reduce)').matches : false;

export function buildScenery(era, composition = 'ranks') {
  const stage = $('stage'), s = era.stage;
  stage.dataset.comp = composition;
  stage.querySelectorAll('.deco, .mote, .orb').forEach(n => n.remove());

  $('sky').style.background = `linear-gradient(180deg, ${s.sky[0]} 0%, ${s.sky[1]} 52%, ${s.sky[2]} 100%)`;
  // a face-to-face duel wants a higher horizon; an encirclement wants a lower one
  const horizon = composition === 'duel' ? 48 : composition === 'terrace' ? 52 : composition === 'arc' ? 60 : 56;
  $('ground').style.height = (100 - horizon) + '%';
  $('horizon').style.top = horizon + '%';
  $('ground').style.background = `linear-gradient(180deg, ${s.groundTop} 0%, ${s.groundBot} 100%)`;
  $('fog').style.background = `linear-gradient(180deg, transparent 40%, ${s.fog} 62%, transparent 78%)`;
  $('glow').style.background = `radial-gradient(ellipse 60% 40% at ${s.orb.x}% ${s.orb.y}%, ${s.orb.c}22, transparent 70%)`;
  $('horizon').style.background =
    `linear-gradient(90deg, transparent, ${s.orb.c}55 30%, ${s.orb.c}77 50%, ${s.orb.c}55 70%, transparent)`;

  const orb = document.createElement('div');
  orb.className = 'orb';
  orb.style.cssText = `left:${s.orb.x}%;top:${s.orb.y}%;width:${s.orb.r}px;height:${s.orb.r}px;
    margin:${-s.orb.r / 2}px 0 0 ${-s.orb.r / 2}px;background:${s.orb.c};
    box-shadow:0 0 60px 20px ${s.orb.c}55;z-index:1;`;
  stage.insertBefore(orb, $('fog'));

  const bands = [
    { list: s.hi,   y: [horizon - 34, horizon - 16], size: [13, 22], op: .34, blur: 1.2, z: 1 },
    { list: s.far,  y: [horizon - 9,  horizon - 4],  size: [19, 32], op: .50, blur: 1.0, z: 1 },
    { list: s.mid,  y: [horizon - 3,  horizon + 2],  size: [24, 36], op: .60, blur: .3,  z: 2 },
    // near props sit below the frame edge, so only their tops read as foreground
    { list: s.near, y: [106, 118], size: [54, 82], op: .95, blur: 0,   z: 130 }
  ];
  for (const b of bands) {
    b.list.forEach((ch, i) => {
      const d = document.createElement('div');
      d.className = 'deco';
      const span = (100 - 8) / b.list.length;
      d.textContent = ch;
      d.style.cssText = `left:${6 + span * i + rand(2, span - 2)}%;top:${rand(b.y[0], b.y[1])}%;
        font-size:${rand(b.size[0], b.size[1])}px;opacity:${b.op};filter:blur(${b.blur}px);z-index:${b.z};`;
      stage.insertBefore(d, $('fog'));
    });
  }

  if (!REDUCED) {
    for (let i = 0; i < s.mote.n; i++) {
      const m = document.createElement('div');
      m.className = 'mote' + (s.mote.fall ? ' fall' : '');
      m.textContent = s.mote.ch;
      const dur = rand(s.mote.dur[0], s.mote.dur[1]);
      m.style.cssText = `left:${rand(2, 98)}%;top:${s.mote.fall ? rand(10, 55) : rand(70, 105)}%;
        font-size:${s.mote.size}px;--dx:${rand(-30, 30)}px;animation-duration:${dur}s;
        animation-delay:${-rand(0, dur)}s;opacity:.7;z-index:3;`;
      stage.insertBefore(m, $('fog'));
    }
  }
}

/* ── staging ────────────────────────────────────────────────────
   Every battle used to look the same: two mirrored rows facing each other. These
   compositions stage the same fight differently — a Pokémon-style diagonal for a
   duel, a curved encirclement for a mob, a stepped ridge where one side holds the
   high ground — and the era's own scenery is laid out to suit whichever is chosen.

   Layout packs by ACTUAL sprite width rather than dividing a band evenly, because
   a dragon and a rat are not the same size and an evenly-spaced row hides the rat
   behind the dragon. Nothing you can be asked to click may be covered. */

export const BASE_PX = 56;
const bodyPx = (u, scale) => BASE_PX * scale * (u.sz || 1);
/* A fighter occupies more than its glyph: the name plate under it is what actually
   collides in a crowd, so spacing is packed against whichever is wider. */
const plateWidth = (n) => n >= 7 ? 84 : n >= 5 ? 100 : 132;
const footprint = (u, scale, n) => Math.max(bodyPx(u, scale), plateWidth(n) * 0.82);

/** Where each rank sits for a given composition. `lo`/`hi` are the ally-side band. */
const COMPOSITIONS = {
  ranks: {
    name: 'Hàng ngũ',
    ally: [{ y: 94, s: 1.00, lo: 6, hi: 46 }, { y: 78, s: .88, lo: 5, hi: 36 }, { y: 63, s: .78, lo: 4, hi: 28 }],
    foe:  [{ y: 94, s: 1.00, lo: 6, hi: 46 }, { y: 78, s: .88, lo: 5, hi: 36 }, { y: 63, s: .78, lo: 4, hi: 28 }]
  },
  // the classic: you low and close, them high and far, each on their own ground
  duel: {
    name: 'Đối mặt',
    pads: true,
    ally: [{ y: 94, s: 1.22, lo: 8, hi: 42 }, { y: 79, s: .92, lo: 3, hi: 28 }, { y: 67, s: .80, lo: 2, hi: 22 }],
    foe:  [{ y: 74, s: .94, lo: 10, hi: 42 }, { y: 63, s: .80, lo: 8, hi: 32 }, { y: 55, s: .70, lo: 6, hi: 26 }]
  },
  // a mob curls around whoever it outnumbers
  arc: {
    name: 'Vây bọc',
    ally: [{ y: 94, s: 1.02, lo: 10, hi: 42 }, { y: 82, s: .90, lo: 4, hi: 32 }, { y: 69, s: .80, lo: 3, hi: 26 }],
    foe:  [{ y: 92, s: .96, lo: 4, hi: 30 }, { y: 76, s: .86, lo: 10, hi: 42 }, { y: 61, s: .76, lo: 16, hi: 44 }]
  },
  // one side holds the ridge and looks down on the other
  terrace: {
    name: 'Chiếm cao điểm',
    ally: [{ y: 94, s: 1.06, lo: 8, hi: 44 }, { y: 84, s: .92, lo: 4, hi: 34 }, { y: 73, s: .82, lo: 3, hi: 26 }],
    foe:  [{ y: 80, s: .92, lo: 8, hi: 40 }, { y: 68, s: .82, lo: 6, hi: 32 }, { y: 58, s: .74, lo: 4, hi: 26 }]
  }
};

export const COMPOSITION_KEYS = Object.keys(COMPOSITIONS);

/** Which staging suits this battle. Duels and boss hunts read best face to face. */
export function pickComposition(rng, formatKey, sizes) {
  const big = Math.max(sizes.ally, sizes.foe);
  if (formatKey === 'duel' || formatKey === 'boss') return rng() < .8 ? 'duel' : 'terrace';
  if (formatKey === 'horde') return rng() < .7 ? 'arc' : 'ranks';
  if (big >= 6) return rng() < .65 ? 'ranks' : 'arc';
  const pool = ['ranks', 'duel', 'terrace', 'arc'];
  return pool[Math.floor(rng() * pool.length)];
}

function ranksFor(n) {
  if (n <= 2) return [n];
  if (n <= 4) return [Math.ceil(n / 2), n - Math.ceil(n / 2)];
  if (n <= 6) return [3, n - 3];
  return [3, 3, n - 6];
}

/**
 * Place one side. Returns a slot per unit: { x, y, s, px } with x/y as stage
 * percentages. Widths are real, so a rank never overlaps itself; ranks are spaced
 * by the tallest sprite in front of them so heads stay clear.
 */
export function layout(units, side, compKey, stageW, stageH) {
  const comp = COMPOSITIONS[compKey] || COMPOSITIONS.ranks;
  const spec = comp[side];
  const isAlly = side === 'ally';
  const n = units.length;
  const crowd = n <= 2 ? 1.12 : n <= 4 ? 1 : n <= 6 ? .88 : .78;

  // a boss owns its front rank alone
  const bossFirst = units[0] && units[0].tier === 'boss';
  const rows = bossFirst ? [1, Math.max(0, n - 1)].filter(Boolean) : ranksFor(n);

  const slots = [];
  let idx = 0;
  let prevY = null, prevH = 0;
  rows.forEach((k, r) => {
    const row = spec[Math.min(r, spec.length - 1)];
    const members = units.slice(idx, idx + k);
    idx += k;
    let scale = row.s * crowd;

    // shrink the rank until its sprites genuinely fit the band, then tile them
    const bandPx = ((row.hi - row.lo) / 100) * stageW;
    const gapPx = 10;
    const widthAt = (sc) => members.reduce((t, u) => t + footprint(u, sc, n), 0) + gapPx * (members.length - 1);
    let guard = 0;
    while (widthAt(scale) > bandPx && scale > .34 && guard++ < 40) scale *= 0.94;

    // a rank sits far enough behind the one in front to clear its tallest sprite,
    // so a dragon can never swallow the rat standing behind it
    const rankH = Math.max(...members.map(u => bodyPx(u, scale)));
    let y = row.y;
    if (prevY !== null) {
      const need = ((prevH * 0.62 + 12) / stageH) * 100;
      y = Math.min(row.y, prevY - need);
    }
    prevY = y; prevH = rankH;

    const total = widthAt(scale);
    let cursor = row.lo + ((bandPx - total) / 2 / stageW) * 100;
    for (const u of members) {
      const w = footprint(u, scale, n);
      const centre = cursor + (w / 2 / stageW) * 100;
      slots.push({ unit: u, s: scale, px: Math.round(bodyPx(u, scale)), x: isAlly ? centre : 100 - centre, y });
      cursor += ((w + gapPx) / stageW) * 100;
    }
  });

  return slots;   // separation runs across BOTH sides once they are both placed
}

/**
 * Last-resort guarantee: no sprite's centre may sit under another sprite. A big
 * unit in front would otherwise swallow a small one behind it, and you cannot
 * click what you cannot see.
 */
export function separate(slots, stageW, stageH) {
  const box = (sl) => {
    const w = sl.px, h = sl.px;
    const cx = (sl.x / 100) * stageW;
    const cy = (sl.y / 100) * stageH - h / 2;      // anchored at the feet
    return { l: cx - w / 2, r: cx + w / 2, t: cy - h / 2, b: cy + h / 2, cx, cy, w, h };
  };
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = box(slots[i]), b = box(slots[j]);
        const covers = (p, q) => p.cx > q.l && p.cx < q.r && p.cy > q.t && p.cy < q.b;
        if (!covers(a, b) && !covers(b, a)) continue;
        // push apart along x; if either has run out of room, lift the smaller one
        const dir = a.cx <= b.cx ? -1 : 1;
        const step = ((Math.min(a.w, b.w) * 0.34) / stageW) * 100;
        const xi = Math.max(3, Math.min(97, slots[i].x + dir * step));
        const xj = Math.max(3, Math.min(97, slots[j].x - dir * step));
        const stuck = xi === slots[i].x && xj === slots[j].x;
        slots[i].x = xi; slots[j].x = xj;
        if (stuck) {
          const small = a.w <= b.w ? i : j;
          slots[small].y = Math.max(38, slots[small].y - ((Math.min(a.h, b.h) * 0.4) / stageH) * 100);
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
  return slots;
}
