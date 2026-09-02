/* Builds an era's battlefield out of CSS gradients and emoji. No image files.
   Nine layers, back to front, and a formation that lays out any side from 1 to 8. */

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function buildScenery(era) {
  const stage = $('stage'), s = era.stage;
  stage.querySelectorAll('.deco, .mote, .orb').forEach(n => n.remove());

  $('sky').style.background = `linear-gradient(180deg, ${s.sky[0]} 0%, ${s.sky[1]} 52%, ${s.sky[2]} 100%)`;
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
    { list: s.hi,   y: [22, 40],   size: [13, 22], op: .34, blur: 1.2, z: 1 },
    { list: s.far,  y: [47, 52],   size: [19, 32], op: .50, blur: 1.0, z: 1 },
    { list: s.mid,  y: [53, 58],   size: [24, 36], op: .60, blur: .3,  z: 2 },
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

/* Ranks, not fixed seats. Front rank is lowest and largest; each rank behind steps
   up, shrinks, and pulls toward the outer edge so nobody is hidden. */
function ranksFor(n) {
  if (n <= 2) return [n];
  if (n <= 4) return [Math.ceil(n / 2), n - Math.ceil(n / 2)];
  if (n <= 6) return [3, n - 3];
  return [3, 3, n - 6];
}

export function formation(n, isAlly, hasBoss) {
  if (hasBoss) {
    const out = [{ x: isAlly ? 25 : 75, y: 97, s: 1 }];
    for (let i = 0; i < n - 1; i++) {
      const t = n === 2 ? .16 : (i + .5) / (n - 1);
      const x = 5 + t * 30;
      out.push({ x: isAlly ? x : 100 - x, y: 73, s: .74 });
    }
    return out;
  }
  // an army reads as smaller figures than a duel does — most of the depth lives here
  const crowd = n <= 2 ? 1.16 : n <= 4 ? 1.0 : n <= 6 ? .86 : .76;
  const out = [];
  ranksFor(n).forEach((k, r) => {
    const y = 96 - r * 17;
    const s = (1 - r * .12) * crowd;
    const lo = 8 - r * 1.5, hi = 42 - r * 9;
    for (let i = 0; i < k; i++) {
      const t = k === 1 ? .5 : (i + .5) / k;
      const x = lo + t * (hi - lo);
      out.push({ x: isAlly ? x : 100 - x, y, s });
    }
  });
  return out;
}
