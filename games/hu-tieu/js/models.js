/* Every 3D object in the stall, built from plain primitives with banded toon materials so the
   pixel pass reads them as cel-shaded sprites. Units: 1 ≈ 6 cm; the counter top is y = 0. */
import * as THREE from 'three';
import { rng } from './game.js';
import { tex } from './textures.js';

export const P = {
  ink: 0x2a1f3d,
  steel: 0xcfdbe8, steelD: 0x93a5bb, steelL: 0xf8fcff,
  wood: 0xe08a45, woodD: 0xa85a2a, woodL: 0xf7b46a,
  ceramic: 0xfffbf0, blue: 0x2f7be0,
  // food colours are sampled from the reference sheets in /reference (img/*.png are cut from them)
  broth: 0xdcb45e, brothD: 0xb8893a, water: 0xcdeaf2,
  hu: 0xfffcf2, mi: 0xf5c138, kho: 0xd9913a,
  thit: 0xc58774, thitL: 0xe3b8a4, thitD: 0xad6a5b,
  tom: 0xf66c2c, tomM: 0xfa9a59, tomL: 0xfbbe92, tomD: 0xbe320f,
  egg: 0xf8f0d6, eggD: 0xd8c8a0, yolk: 0xf2c84a,
  gan: 0x935141, ganD: 0x6e3a2e,
  bam: 0xd8a090, bamL: 0xecc0b0, bamD: 0xb07e72,   // a touch pinker: the post pass saturates
  muc: 0xf3ecea, mucP: 0xe6d4d2, mucT: 0xa8707e,
  top: 0xd57021, topL: 0xf1a94d, topD: 0xb64e14,
  hanh: 0x38780d, hanhL: 0x5ca214, hanhB: 0x95d02d, hanhW: 0xf4fbe6,
  gia: 0xf7f2eb, giaH: 0xe1c793,
  tieu: 0x2b2230, ot: 0xe0200c, otD: 0xa80a06, otS: 0xf5a843, phi: 0xc77a2e,
  tea: 0xd8722a, ice: 0xeefbff, glass: 0xdff5fb,
  red: 0xf0453a, redD: 0xb82a22, yellow: 0xffd23f, green: 0x3fc26a, cream: 0xfff6dc,
  teal: 0x22b5c4, tealD: 0x15899a,
  skin: 0xffcb98, skinD: 0xe8a878, hair: 0x33231f, grey: 0xd3cec9,
};

/* ------------------------------------------------------------------ materials */

const grad = (() => {
  const t = new THREE.DataTexture(new Uint8Array([120, 200, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
/** The three toon bands (shadow, mid, lit), 0–255 — the debug panel edits them live. */
export function setBands(bands) {
  grad.image.data.set(bands.map(v => Math.max(0, Math.min(255, Math.round(v)))));
  grad.needsUpdate = true;
}
const mats = new Map();
export function mat(color, opts = {}) {
  const k = `${color}|${opts.side ?? 0}|${opts.emissive ?? 0}`;
  if (!mats.has(k)) {
    mats.set(k, new THREE.MeshToonMaterial({
      color, gradientMap: grad, side: opts.side ?? THREE.FrontSide,
      emissive: opts.emissive ?? 0x000000,
    }));
  }
  return mats.get(k);
}

export function mesh(geo, color, opts) {
  const m = new THREE.Mesh(geo, mat(color, opts));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A toon material wearing a texture: spec = [name, args?, repeat?]. */
const tmats = new Map();
export function tmat(spec, opts = {}) {
  const [name, args = [], repeat = null] = spec;
  const k = `${name}|${args.join(',')}|${repeat}|${opts.side ?? 0}|${opts.cut ?? 0}`;
  if (!tmats.has(k)) {
    tmats.set(k, new THREE.MeshToonMaterial({
      map: tex(name, args, repeat), gradientMap: grad, side: opts.side ?? THREE.FrontSide,
      alphaTest: opts.cut ? 0.5 : 0,
    }));
  }
  return tmats.get(k);
}
/** Mesh with a material, a textured spec, or an array of either (per geometry group). */
export function tmesh(geo, look, opts) {
  const one = l => (typeof l === 'number' ? mat(l, opts) : tmat(l, opts));
  // a spec is [name, ...]; any other array is one look per geometry group
  const multi = Array.isArray(look) && typeof look[0] !== 'string';
  const m = new THREE.Mesh(geo, multi ? look.map(one) : one(look));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
export const at = (o, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); return o; };
export const box = (w, h, d, c, x, y, z) => at(mesh(new THREE.BoxGeometry(w, h, d), c), x, y, z);
export const cyl = (rt, rb, h, c, x, y, z, seg = 18, opts) =>
  at(mesh(new THREE.CylinderGeometry(rt, rb, h, seg), c, opts), x, y, z);
export const ball = (r, c, x, y, z, seg = 10) => at(mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)), c), x, y, z);
const torus = (r, t, c, arc = Math.PI * 2, seg = 16) => mesh(new THREE.TorusGeometry(r, t, 6, seg, arc), c);
const group = (...kids) => { const g = new THREE.Group(); kids.forEach(k => g.add(k)); return g; };
/** Textured box; `look` is a spec, or six of them in BoxGeometry order (+x −x +y −y +z −z). */
export const tbox = (w, h, d, look, x, y, z) => at(tmesh(new THREE.BoxGeometry(w, h, d), look), x, y, z);
/** Textured cylinder; `look` is one spec or [side, top, bottom]. */
export const tcyl = (rt, rb, h, look, x, y, z, seg = 18, opts) =>
  at(tmesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!opts?.open), look, opts), x, y, z);
const S = {                              // texture specs used across the models
  steel: ['steel', [], [1, 1]],
  meat: ['meat'], liver: ['liver'], shrimp: ['shrimp', [], [4, 1]], squid: ['squid', [], [3, 1]], crackle: ['crackling'],
};

/* ------------------------------------------------------------------ food pieces */

/** One serving of a topping as small pieces, roughly within radius 0.8 around the origin.
    Shapes and colours follow the reference sheets in /reference. */
export function toppingPiece(kind, seed = 1) {
  const r = rng(seed);
  const g = new THREE.Group();
  const jitter = s => (r() - 0.5) * s;
  switch (kind) {
    case 'thit':                     // thịt nạc luộc: long grey-pink slices fanned out
      for (let i = 0; i < 4; i++) {
        const s = tbox(1.25, 0.09, 0.34, S.meat, i * 0.12 - 0.18, 0.06 + i * 0.07, i * 0.27 - 0.4);
        s.rotation.y = 0.5 - i * 0.12 + jitter(0.1);
        s.rotation.x = 0.18;                      // each slice leans on the one below: the gaps show
        g.add(s);
      }
      break;
    case 'tom':                      // tôm luộc: a curled, segmented C with a tail fan
      {
        const t = shrimp();
        t.rotation.y = jitter(0.8);
        t.scale.setScalar(1.25);
        g.add(t);
      }
      break;
    case 'trung':                    // trứng cút: one whole, one halved to show the yolk
      {
        const whole = ball(0.3, P.egg, -0.26, 0.24, jitter(0.15), 10);
        whole.scale.set(1, 0.85, 1.25);
        whole.rotation.y = 0.5;
        const half = new THREE.Group();
        half.add(mesh(new THREE.SphereGeometry(0.3, 10, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), P.eggD));
        half.add(cyl(0.3, 0.3, 0.04, P.egg, 0, 0, 0, 12), cyl(0.16, 0.16, 0.06, P.yolk, 0, 0.02, 0, 10));
        half.scale.set(1, 1, 1.25);
        half.rotation.y = -0.4;
        half.position.set(0.32, 0.3, jitter(0.15));
        g.add(whole, half);
      }
      break;
    case 'gan':                      // gan heo: dark brown leaf-shaped wedges, overlapping
      for (let i = 0; i < 3; i++) {
        const s = tmesh(new THREE.SphereGeometry(0.5, 10, 4), S.liver);
        s.scale.set(1.25, 0.16, 0.6);            // a flat leaf, as the slices lie in the reference
        s.rotation.y = 0.3 - i * 0.3 + jitter(0.2);
        s.position.set(i * 0.2 - 0.2, 0.08 + i * 0.08, i * 0.22 - 0.22);
        g.add(s);
      }
      break;
    case 'bam':                      // thịt bằm: a bumpy pink heap of little lumps
      for (let i = 0; i < 16; i++) {
        const a = i * 2.4, d = Math.sqrt(i / 16) * 0.62;
        g.add(ball(0.15 + r() * 0.05, [P.bam, P.bamL, P.bamD][i % 3], Math.cos(a) * d, 0.12 + (0.62 - d) * 0.35 + r() * 0.05, Math.sin(a) * d, 6));
      }
      break;
    case 'muc':                      // mực: thick white rings with a purple tangle of tentacles
      for (let i = 0; i < 2; i++) {
        const t = tmesh(new THREE.TorusGeometry(0.25, 0.11, 6, 12), S.squid);
        t.rotation.x = -Math.PI / 2 + jitter(0.4);
        t.position.set(i * 0.5 - 0.35, 0.12 + i * 0.06, i * 0.3 - 0.2 + jitter(0.1));
        g.add(t);
      }
      {
        const legs = group(ball(0.17, P.mucP, 0, 0.14, 0, 7));
        for (let k = 0; k < 5; k++) {             // tentacles fanning out from the head
          const leg = box(0.55, 0.07, 0.08, P.mucT, 0, 0, 0);
          leg.geometry.translate(0.27, 0, 0);
          leg.rotation.set(0, -0.2 + k * 0.32, -0.25);
          leg.position.y = 0.12;
          legs.add(leg);
        }
        legs.position.set(0.5, 0.04, 0.35);
        g.add(legs);
      }
      break;
    case 'top':                      // tóp mỡ: golden fried nuggets
      for (let i = 0; i < 9; i++) {           // rough nuggets heaped in a little mound
        const a = i * 2.4, d = Math.sqrt(i / 9) * 0.6;
        const c = at(tmesh(new THREE.DodecahedronGeometry(0.17 + r() * 0.05), S.crackle), Math.cos(a) * d, 0.15 + (0.6 - d) * 0.3, Math.sin(a) * d);
        c.rotation.set(r() * 3, r() * 3, r() * 3);
        g.add(c);
      }
      break;
  }
  return g;
}

/** One boiled shrimp lying on its side: a fat striped C, a round head end and a tail fan. */
function shrimp() {
  const g = new THREE.Group();
  const body = tmesh(new THREE.TorusGeometry(0.32, 0.17, 6, 12, Math.PI * 1.45), S.shrimp);
  body.rotation.x = -Math.PI / 2;
  body.position.y = 0.17;
  const head = ball(0.21, P.tom, 0.32, 0.19, 0, 8);
  head.scale.y = 0.85;
  g.add(body, head, ball(0.1, P.tomL, 0.2, 0.3, 0.05, 6));
  const end = Math.PI * 1.45;                   // the torus arc ends here; the fan spreads past it
  for (const k of [-1, 1]) {
    const fin = box(0.3, 0.06, 0.13, P.tomD, Math.cos(end) * 0.34 + 0.05, 0.12, -Math.sin(end) * 0.34 + k * 0.07);
    fin.rotation.y = end - Math.PI / 2 + k * 0.45;
    g.add(fin);
  }
  return g;
}

/** A tangle of noodle strands as thin tori; `color` picks hủ tiếu white or mì yellow. */
function strands(color, radius, seed) {
  const r = rng(seed);
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const t = torus(radius * (0.35 + r() * 0.5), 0.06, color, Math.PI * (0.8 + r()), 12);
    t.rotation.x = -Math.PI / 2;
    t.rotation.z = r() * 6.28;
    t.position.set((r() - 0.5) * radius * 0.5, 0.02 * i, (r() - 0.5) * radius * 0.5);
    g.add(t);
  }
  return g;
}

/** Hành phi (fried shallots): every finished bowl gets a sprinkle, as at the stall. */
function friedShallots(seed) {
  const r = rng(seed);
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) g.add(box(0.15, 0.08, 0.15, P.phi, (r() - 0.5) * 1.8, 0.05, (r() - 0.5) * 1.8));
  return g;
}

/** Chopped hành lá: little green rings. */
export function scallionRings(n, spread, seed) {
  const r = rng(seed);
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const ring = cyl(0.17, 0.17, 0.1, [P.hanh, P.hanhL, P.hanh, P.hanhB][i % 4], (r() - 0.5) * spread, 0.05 + r() * 0.1, (r() - 0.5) * spread, 6);
    ring.rotation.set((r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6);
    g.add(ring);
  }
  return g;
}

/** Giá: a tangle of bean sprouts — white stems with yellow heads. */
export function sprouts(n, spread, seed) {
  const r = rng(seed);
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const s = group(cyl(0.06, 0.06, 0.9, P.gia, 0, 0, 0, 4), ball(0.1, P.giaH, 0, 0.45, 0, 5));
    s.position.set((r() - 0.5) * spread, 0.1 + r() * 0.15, (r() - 0.5) * spread);
    s.rotation.set(Math.PI / 2 + (r() - 0.5) * 0.5, 0, r() * 6.28);
    g.add(s);
  }
  return g;
}

/** Ớt: thin red chili rings with their yellow seeds. */
export function chiliSlices(n, spread, seed) {
  const r = rng(seed);
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * spread, z = (r() - 0.5) * spread;
    const slice = group(cyl(0.17, 0.17, 0.08, i % 3 ? P.ot : P.otD, 0, 0, 0, 8), cyl(0.1, 0.1, 0.09, 0xf9c27a, 0, 0.01, 0, 6),
      box(0.05, 0.1, 0.05, P.otS, 0.03, 0.03, 0), box(0.05, 0.1, 0.05, P.otS, -0.04, 0.03, 0.03));
    slice.scale.z = 0.75;
    slice.rotation.y = r() * 3;
    slice.position.set(x, 0.05, z);
    g.add(slice);
  }
  return g;
}

/** What finishes a bowl on top: hành, giá, tiêu, ớt — each only if it was added. */
function extras(b, seed) {
  const g = new THREE.Group();
  if (b.gia) { const s = sprouts(9, 1.0, seed); s.position.set(-0.2, 0, -0.9); g.add(s); }
  if (b.hanh) g.add(scallionRings(10, 1.9, seed + 1));
  if (b.ot) { const s = chiliSlices(3, 0.8, seed + 2); s.position.set(0.9, 0.05, 0.2); g.add(s); }
  if (b.tieu) {                         // a dusting of black pepper over the middle
    const r = rng(seed + 3);
    for (let i = 0; i < 12; i++) g.add(box(0.09, 0.05, 0.09, P.tieu, (r() - 0.5) * 1.4, 0.2, (r() - 0.5) * 1.4));
  }
  return g;
}

/* ------------------------------------------------------------------ bowls */

const BOWL_PROFILE = [
  [0, 0.05], [0.95, 0], [1.0, 0.2], [1.6, 0.85], [1.95, 1.45], [2.02, 1.55],
  [1.86, 1.55], [1.5, 0.95], [0.9, 0.38], [0, 0.32],
].map(([x, y]) => new THREE.Vector2(x, y));

/** A white Vietnamese ceramic tô with the blue rim band. */
export function makeBowl() {
  const g = new THREE.Group();
  g.add(tmesh(new THREE.LatheGeometry(BOWL_PROFILE, 24), ['bowl', [], [2, 1]], { side: THREE.DoubleSide }));
  const rim = torus(1.97, 0.07, P.ceramic, Math.PI * 2, 24);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 1.53;
  g.add(rim);
  return g;
}

const TOP_SPOTS = [[-0.75, -0.45], [0.75, -0.45], [-0.7, 0.55], [0.7, 0.55]];

/** What sits inside a bowl for a given {noodle, style, tops}. Rebuilt only when it changes. */
export function bowlContents(b, seed = 3) {
  const g = new THREE.Group();
  if (!b.noodle) return g;
  const col = b.style === 'kho' ? (b.noodle === 'mi' ? 0xe0a43c : P.kho) : P[b.noodle];
  const mound = at(tmesh(new THREE.SphereGeometry(1.25, 12, 10), ['noodle', [col], [3, 2]]), 0, 0.95, 0);
  mound.scale.set(1, 0.36, 1);
  g.add(mound);
  const s = strands(col === P.hu ? 0xffffff : col, 1.3, seed);
  s.position.y = 1.32;
  g.add(s);
  if (b.style === 'nuoc') {
    g.add(tcyl(1.78, 1.78, 0.06, [P.broth, ['broth'], P.broth], 0, 1.2, 0, 20));
  }
  b.tops.forEach((t, i) => {
    const p = toppingPiece(t, seed + i * 17);
    const [x, z] = TOP_SPOTS[i % 4];
    p.position.set(x, 1.32, z);
    p.scale.setScalar(0.85);
    g.add(p);
  });
  const top = new THREE.Group();
  top.position.y = 1.4;
  if (b.style) top.add(friedShallots(seed + 5));
  top.add(extras(b, seed + 9));
  g.add(top);
  if (b.style === 'kho') {             // khô comes with its broth in a chén: a small tô, filled
    const chen = makeBowl();
    chen.scale.setScalar(0.42);
    const side = group(chen, tcyl(0.72, 0.72, 0.05, [P.broth, ['broth'], P.broth], 0, 0.5, 0, 16));
    side.position.set(2.3, -0.02, 1.4);
    g.add(side);
  }
  return g;
}

/* ------------------------------------------------------------------ stations */

export function makeTray(w, d, color = P.steel) {
  const g = new THREE.Group();
  const look = ['steel', [color], [w / 4, d / 4]];
  g.add(tbox(w, 0.15, d, look, 0, 0.08, 0));
  g.add(tbox(w, 0.45, 0.14, look, 0, 0.3, d / 2 - 0.07), tbox(w, 0.45, 0.14, look, 0, 0.3, -d / 2 + 0.07));
  g.add(tbox(0.14, 0.45, d, look, w / 2 - 0.07, 0.3, 0), tbox(0.14, 0.45, d, look, -w / 2 + 0.07, 0.3, 0));
  // a bright lip along the front edge
  g.add(box(w, 0.08, 0.16, P.steelL, 0, 0.56, d / 2 - 0.07));
  return g;
}

/** A steel tray heaped with one topping. */
export function makeToppingTray(kind) {
  const g = makeTray(3.1, 2.8);
  const r = rng(kind.length * 97);
  for (let i = 0; i < 5; i++) {
    const p = toppingPiece(kind, 50 + i * 13);
    p.scale.setScalar(1.25);
    p.position.set((i % 3 - 1) * 0.85 + (r() - 0.5) * 0.2, 0.15 + (i > 2 ? 0.25 : 0), (i > 2 ? 0.45 : -0.45));
    g.add(p);
  }
  return g;
}

/** Raw noodles waiting by the pot: a heap of hủ tiếu strands, or nests (vắt) of egg mì. */
export function makeNoodleTray(kind) {
  const g = makeTray(3.8, 3.0, P.steelL);
  const r = rng(kind === 'mi' ? 5 : 9);
  for (let i = 0; i < 4; i++) {
    const n = group();
    if (kind === 'mi') {
      const nest = tmesh(new THREE.TorusGeometry(0.5, 0.28, 6, 12), ['noodle', [P.mi], [3, 1]]);
      nest.rotation.x = -Math.PI / 2;
      n.add(nest, ball(0.35, 0xe19c1a, 0, 0.1, 0, 8), strands(0xfcdc5c, 1.1, 40 + i));
    } else {
      n.add(strands(P.hu, 1.2, 20 + i));
      const heap = tmesh(new THREE.SphereGeometry(0.6, 8, 6), ['noodle', [P.hu], [2, 1]]);
      heap.scale.y = 0.4;
      n.add(heap);
    }
    n.position.set((i % 2 - 0.5) * 1.6 + (r() - 0.5) * 0.2, 0.4 + (i > 1 ? 0.12 : 0), (i > 1 ? 0.6 : -0.6));
    g.add(n);
  }
  return g;
}

function burner() {
  const g = group(cyl(2.9, 3.2, 0.7, 0x3a3540, 0, 0.35, 0, 16));
  const flame = torus(2.2, 0.16, 0x58b8ff, Math.PI * 2, 18);
  flame.material = mat(0x58b8ff, { emissive: 0x2050a0 });
  flame.rotation.x = Math.PI / 2;
  flame.position.y = 0.75;
  g.add(flame);
  return g;
}

/** The big nồi nước lèo: steel stockpot of pork-bone broth, daikon and a ladle on the rim. */
export function makeBrothPot() {
  const g = group(burner());
  const pot = tmesh(new THREE.CylinderGeometry(3.4, 3.2, 4.6, 22, 1, true), ['potSide', [], [2, 1]], { side: THREE.DoubleSide });
  pot.position.y = 3.0;
  const rim = torus(3.4, 0.16, P.steelL, Math.PI * 2, 24);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 5.3;
  const soup = tcyl(3.3, 3.3, 0.1, [P.broth, ['broth', [], [2, 2]], P.broth], 0, 4.7, 0, 22);
  g.add(pot, rim, soup, cyl(3.2, 3.2, 0.2, P.steelD, 0, 0.8, 0, 22));
  // xương heo and củ cải trắng bobbing in the stock
  const r = rng(77);
  for (let i = 0; i < 5; i++) {
    const bone = box(1.3, 0.35, 0.45, 0xf1e3c8, (r() - 0.5) * 3.6, 4.8, (r() - 0.5) * 3.6);
    bone.rotation.y = r() * 3;
    g.add(bone);
  }
  for (let i = 0; i < 3; i++) g.add(box(0.6, 0.4, 0.6, 0xf7f7ef, (r() - 0.5) * 3, 4.8, (r() - 0.5) * 3));
  // handles
  g.add(box(0.5, 0.3, 1.2, P.steelD, -3.6, 4.6, 0), box(0.5, 0.3, 1.2, P.steelD, 3.6, 4.6, 0));
  // the vá (ladle), resting with its bowl in the stock and handle toward the cook
  const ladle = group(ball(0.75, P.steelL, 0, 0, 0, 10), box(0.22, 0.22, 4.6, P.steelL, 0, 1.1, 2.1));
  ladle.children[1].rotation.x = -0.45;
  ladle.position.set(1.2, 4.9, 1.0);
  ladle.name = 'ladle';
  g.add(ladle);
  return g;
}

/** Nồi trụng: boiling water with two wire baskets (vợt) hanging inside. */
export function makeBlanchPot() {
  const g = group(burner());
  const pot = tmesh(new THREE.CylinderGeometry(3.4, 3.2, 3.6, 22, 1, true), ['potSide', [], [2, 1]], { side: THREE.DoubleSide });
  pot.position.y = 2.5;
  const rim = torus(3.4, 0.16, P.steelL, Math.PI * 2, 24);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 4.3;
  g.add(pot, rim, tcyl(3.3, 3.3, 0.1, [P.water, ['water', [], [2, 2]], P.water], 0, 3.7, 0, 22), cyl(3.2, 3.2, 0.2, P.steelD, 0, 0.8, 0, 22));
  return g;
}

/** One vợt trụng mì: a wire cone with a long wooden handle reaching toward the cook. */
export function makeBasket() {
  const g = new THREE.Group();
  const net = tmesh(new THREE.CylinderGeometry(1.25, 0.8, 1.6, 12, 1, true), ['net', [], [4, 1]], { side: THREE.DoubleSide, cut: true });
  net.position.y = 0;
  const rim = torus(1.25, 0.1, P.steelL, Math.PI * 2, 14);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.8;
  const handle = box(0.25, 0.2, 3.6, P.steelD, 0, 1.0, 2.8);
  handle.rotation.x = -0.25;
  const grip = tbox(0.42, 0.42, 1.6, ['wood', [P.woodD]], 0, 1.55, 4.9);
  grip.rotation.x = -0.25;
  g.add(net, rim, handle, grip);
  const fill = new THREE.Group();
  fill.name = 'fill';
  g.add(fill);
  return g;
}

export function basketFill(kind, state) {
  const g = new THREE.Group();
  if (!kind) return g;
  const col = state === 'mushy' ? 0xa79a7c : P[kind];
  const heap = at(tmesh(new THREE.SphereGeometry(1.05, 10, 8), ['noodle', [col], [2, 2]]), 0, 0.55, 0);
  heap.scale.y = 0.45;
  g.add(heap);
  const s = strands(state === 'mushy' ? 0x8f8468 : kind === 'hu' ? 0xffffff : P.mi, 1.1, kind === 'mi' ? 3 : 4);
  s.position.y = 0.85;
  g.add(s);
  return g;
}

/** Chai sốt for hủ tiếu khô: a squeeze bottle of dark soy-oyster sauce. */
export function makeSauce() {
  const g = group(cyl(0.7, 0.75, 2.6, 0x5a2e1a, 0, 1.3, 0, 12), cyl(0.72, 0.72, 0.9, P.yellow, 0, 1.4, 0, 12),
    cyl(0.4, 0.6, 0.5, P.red, 0, 2.85, 0, 10), cyl(0.06, 0.25, 0.8, P.red, 0, 3.5, 0, 6));
  return g;
}

/** Bình trà đá: a big plastic jug with a lid and handle. */
export function makeTeaJug() {
  const g = group(tcyl(1.5, 1.6, 3.8, [['jug'], 0xe8682e, 0xe8682e], 0, 1.9, 0, 16),
    cyl(1.35, 1.5, 0.45, 0xc54d1c, 0, 4.0, 0, 16), cyl(0.3, 0.3, 0.6, P.yellow, 0, 4.4, 0, 8));
  const h = torus(1.0, 0.22, 0xc54d1c, Math.PI, 10);
  h.rotation.y = Math.PI / 2;
  h.rotation.z = -Math.PI / 2;
  h.position.set(1.55, 2.2, 0);
  g.add(h, cyl(0.25, 0.25, 0.9, 0xc54d1c, -1.5, 2.6, 0, 6));
  g.children.at(-1).rotation.z = Math.PI / 2;
  return g;
}

/** A plain ly thủy tinh; `fill` is 0..1 of amber trà đá with ice. */
export function makeGlass() {
  const g = new THREE.Group();
  const shell = mesh(new THREE.CylinderGeometry(0.85, 0.68, 2.6, 12, 1, true), P.glass, { side: THREE.DoubleSide });
  shell.position.y = 1.3;
  g.add(shell, cyl(0.68, 0.68, 0.12, P.glass, 0, 0.06, 0, 12));
  const tea = group(cyl(0.8, 0.66, 1, P.tea, 0, 0.5, 0, 12));
  for (let i = 0; i < 3; i++) tea.add(box(0.42, 0.38, 0.42, P.ice, (i - 1) * 0.42, 1.0, (i % 2 - 0.5) * 0.4));
  tea.name = 'tea';
  tea.position.y = 0.12;
  g.add(tea);
  return g;
}

export function makeTrash() {
  return group(tcyl(1.6, 1.3, 3.6, [['trash'], 0x3f8f5a, 0x3f8f5a], 0, 1.8, 0, 14), cyl(1.75, 1.75, 0.45, 0x2f6e44, 0, 3.75, 0, 14),
    box(0.9, 0.25, 0.4, 0x2f6e44, 0, 4.1, 0));
}

/** A stack of Vietnamese polymer notes; more money, taller stack. */
export function makeMoney(amount) {
  const g = new THREE.Group();
  const notes = [[0x3e9a6a, '100'], [0xd56a9a, '50'], [0x3f7bc4, '20'], [0xc9a24a, '10']];   // nghìn đồng
  const n = Math.min(6, 1 + Math.floor(amount / 25000));
  for (let i = 0; i < n; i++) {
    const [c, d] = notes[i % 4];
    const face = ['note', [c, d]];
    const note = tbox(2.4, 0.16, 1.2, [c, c, face, c, c, c], (i % 2) * 0.15, 0.08 + i * 0.17, 0);
    note.rotation.y = (i % 3 - 1) * 0.18;
    g.add(note);
  }
  g.add(cyl(0.45, 0.45, 0.14, P.yellow, 1.3, 0.07, 0.6, 10));
  return g;
}

/** Thớt gỗ tròn: the round wooden board with a bunch of hành lá and a cleaver. The bunch lies
    along x, green tips at −x and white roots at +x; setChop() poses the knife and the cut. */
const BOARD_TOP = 0.7;
const ROOT_X = 1.1, GREEN_LEN = 2.9;           // greens run from ROOT_X back to ROOT_X − GREEN_LEN
const STROKES = 8;                              // knife strikes per bunch
export function makeBoard() {
  const g = new THREE.Group();
  g.add(tcyl(2.7, 2.7, 0.7, [['wood', [P.woodD], [3, 0.4]], ['boardTop'], P.woodD], 0, 0.35, 0, 24));
  const bunch = new THREE.Group();
  bunch.name = 'bunch';
  bunch.rotation.y = 0.5;                       // diagonal: from the camera the upright blade then shows its face, not its edge
  // the greens hang off the root end, so scaling this group in x shortens them from the tips
  const greens = new THREE.Group();
  greens.name = 'greens';
  greens.position.x = ROOT_X;
  const lay = m => { m.rotation.z = Math.PI / 2; return m; };
  for (let i = 0; i < 7; i++) {
    const y = BOARD_TOP + 0.14 + (i % 2) * 0.1, z = -0.7 + i * 0.2;
    greens.add(lay(cyl(0.12, 0.12, GREEN_LEN, i % 2 ? P.hanh : P.hanhL, -GREEN_LEN / 2, y, z, 6)));
    bunch.add(lay(cyl(0.16, 0.16, 0.8, P.hanhW, ROOT_X + 0.4, y, z, 6)), box(0.1, 0.12, 0.2, 0xd8c8a0, ROOT_X + 0.84, y, z));
  }
  bunch.add(greens);
  // slices already cut, lying where the greens were; setChop() shows those behind the knife
  const cut = new THREE.Group();
  cut.name = 'cut';
  const r = rng(61);
  for (let i = 0; i < 30; i++) {
    const x = ROOT_X - GREEN_LEN * ((i + 0.5) / 30) + (r() - 0.5) * 0.2;
    const ring = cyl(0.12, 0.12, 0.08, [P.hanh, P.hanhL, P.hanhB][i % 3], x, BOARD_TOP + 0.04 + r() * 0.05, (r() - 0.5) * 1.5, 6);
    ring.rotation.set((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5);
    ring.userData.x = x;
    ring.visible = false;
    cut.add(ring);
  }
  bunch.add(cut);
  g.add(bunch);
  // dao phay: a tall thin blade standing on its edge (origin), the wooden handle toward the cook
  const knife = group(
    tbox(0.06, 0.75, 1.5, S.steel, 0, 0.375, 0),
    box(0.08, 0.06, 1.5, 0x6f7883, 0, 0.75, 0),               // the spine
    box(0.065, 0.06, 1.5, P.steelL, 0, 0.03, 0),               // the honed edge
    tbox(0.22, 0.24, 1.0, ['wood', [P.woodD]], 0, 0.6, 1.2),
  );
  knife.name = 'knife';
  g.add(knife);
  setChop(g, null);
  return g;
}

/** Pose the board for chop time `t` (seconds into CHOP_TIME `total`), or the resting state for null:
    the knife strikes STROKES times, each strike taking one slice off the tips of the bunch. */
export function setChop(board, t, total = 1.3) {
  const bunch = board.getObjectByName('bunch');
  const greens = board.getObjectByName('greens');
  const cut = board.getObjectByName('cut');
  const knife = board.getObjectByName('knife');
  if (t == null) {
    greens.scale.x = 1;
    cut.children.forEach(c => { c.visible = false; });
    knife.position.set(0.2, BOARD_TOP + 0.03, 1.75);         // lying flat at the front of the board
    knife.rotation.set(0, -0.35, Math.PI / 2);
    return;
  }
  const strokes = Math.min(STROKES - 1e-6, (t / total) * (STROKES + 0.4));
  const n = Math.floor(strokes), u = strokes - n;             // stroke index, and how far through it
  const done = Math.min(STROKES, u >= 0.2 ? n + 1 : n);      // the slice falls the moment the edge lands
  const at = k => ROOT_X - GREEN_LEN * (1 - k / STROKES);     // cut line after k slices
  greens.scale.x = Math.max(0.001, 1 - done / STROKES);   // never 0: a singular matrix
  const tip = at(done);
  cut.children.forEach(c => { c.visible = c.userData.x < tip; });
  // down fast, rest on the board, lift back up while sliding to the next cut line
  const lift = u < 0.2 ? 0.75 * (1 - (u / 0.2) ** 2) : u < 0.35 ? 0 : 0.75 * ((u - 0.35) / 0.65);
  const x = u < 0.35 ? at(n + 1) : at(n + 1) + (at(n + 2) - at(n + 1)) * ((u - 0.35) / 0.65);
  const p = new THREE.Vector3(Math.min(x, at(STROKES)), BOARD_TOP + lift, -0.05).applyEuler(bunch.rotation);
  knife.position.copy(p);
  knife.rotation.set(-lift * 0.25, bunch.rotation.y, 0);       // the handle end rises on the backswing
}

/** A small steel dish of chopped hành; its 'fill' group holds the rings. */
export function makeHanhDish() {
  const g = group(tcyl(1.6, 1.3, 0.6, ['potSide', [], [1, 0.5]], 0, 0.3, 0, 16), cyl(1.45, 1.45, 0.05, P.steelD, 0, 0.6, 0, 16));
  const fill = new THREE.Group();
  fill.name = 'fill';
  fill.position.y = 0.6;
  g.add(fill);
  return g;
}

/** Rổ giá: a green plastic basket heaped with bean sprouts. */
export function makeGiaBasket() {
  const g = new THREE.Group();
  const shell = tmesh(new THREE.CylinderGeometry(2.0, 1.6, 1.4, 16, 1, true), ['weave', [], [5, 1]], { side: THREE.DoubleSide, cut: true });
  shell.position.y = 0.7;
  const rim = torus(2.0, 0.14, 0x2e9a52, Math.PI * 2, 18);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 1.4;
  const mound = ball(1.6, P.gia, 0, 0.9, 0, 10);
  mound.scale.y = 0.4;
  const heap = sprouts(40, 3.0, 31);
  heap.position.y = 1.2;
  g.add(shell, rim, cyl(1.6, 1.6, 0.1, 0x2e9a52, 0, 0.05, 0, 14), mound, heap);
  return g;
}

/** Lọ tiêu: a glass shaker of ground black pepper with a red cap. */
export function makePepper() {
  return group(cyl(0.65, 0.7, 1.9, P.glass, 0, 0.95, 0, 12), cyl(0.58, 0.62, 1.4, 0x4a3a40, 0, 0.75, 0, 12),
    cyl(0.68, 0.68, 0.5, P.red, 0, 2.1, 0, 12), cyl(0.4, 0.4, 0.1, P.steelL, 0, 2.38, 0, 10));
}

/** Chén ớt: a little white dish of fresh chili rings. */
export function makeChiliDish() {
  const g = group(tcyl(1.3, 0.9, 0.55, ['bowl', [], [1, 1]], 0, 0.28, 0, 14), cyl(1.18, 1.18, 0.05, P.ceramic, 0, 0.55, 0, 14));
  const s = chiliSlices(9, 1.6, 41);
  s.position.y = 0.55;
  g.add(s);
  return g;
}

/** Decor: a tray of soup spoons and chopsticks, and a dish of lime wedges. */
export function makeCutleryTray() {
  const g = makeTray(3.6, 2.4, P.steelL);
  for (let i = 0; i < 4; i++) {
    const sp = group(ball(0.35, P.ceramic, 0, 0, 0, 8), box(0.18, 0.12, 1.4, P.ceramic, 0, 0.1, 0.8));
    sp.position.set(-1.1 + i * 0.5, 0.45, -0.3);
    g.add(sp);
  }
  for (let i = 0; i < 6; i++) g.add(box(0.12, 0.12, 2.0, 0xe9c98a, 0.5 + i * 0.16, 0.5, 0));
  return g;
}
export function makeLimeDish() {
  const g = group(cyl(1.3, 0.9, 0.5, 0xeaf3ff, 0, 0.25, 0, 14));
  for (let i = 0; i < 4; i++) {
    const w = mesh(new THREE.SphereGeometry(0.55, 8, 6, 0, Math.PI), i % 2 ? 0x7ccc3a : 0x9ee05a);
    w.position.set((i % 2 - 0.5) * 0.9, 0.6, (i > 1 ? 0.4 : -0.4));
    w.rotation.set(-Math.PI / 2, 0, i * 1.3);
    g.add(w);
  }
  return g;
}

/* ------------------------------------------------------------------ people */

/* Saigon regulars. Only the waist up shows above the counter, so legs are skipped. */
const LOOKS = [
  { shirt: 0x4f8a3a, print: 'jacket', hat: 'helmet', hatC: 0x3fa34d, hair: P.hair },                 // chú xe ôm
  { shirt: 0xf8f8f2, print: 'school', scarf: 0xd8402f, hair: P.hair, short: true },                 // học sinh
  { shirt: 0xf59ac0, print: 'blouse', hair: P.hair, long: true },                                   // chị văn phòng
  { shirt: 0x8a63b8, print: 'floral', hat: 'nonla', hair: P.grey, skin: 0xe8b585 },                 // bà áo bà ba
  { shirt: 0x3f6fb0, print: 'work', hat: 'cap', hatC: 0xd8402f, hair: P.hair },                     // anh thợ
  { shirt: 0x2d2a36, print: 'tee', hair: 0x4a2c20, glasses: true },                                 // anh sinh viên
  { shirt: 0xf4f4ec, print: 'tank', tank: true, hair: P.grey, bald: true, skin: 0xe0a676 },         // ông ba lỗ
  { shirt: 0xfdfdf8, print: 'aodai', hat: 'nonla', hair: P.hair, long: true, aodai: true },         // cô áo dài
];

export function makePerson(lookIdx) {
  const L = LOOKS[lookIdx % LOOKS.length];
  const skin = L.skin ?? P.skin;
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const cloth = ['shirt', [L.print, false]], front = ['shirt', [L.print, true]];
  body.add(tbox(4.2, 6.5, 2.4, [cloth, cloth, cloth, cloth, front, cloth], 0, 3.25, 0));
  if (L.tank) body.add(box(2.4, 2.2, 2.42, skin, 0, 5.4, 0));              // bare shoulders
  if (L.scarf) body.add(box(1.4, 1.2, 0.3, L.scarf, 0, 5.4, 1.25));
  if (L.aodai) body.add(box(1.4, 0.8, 2.5, L.shirt, 0, 6.8, 0));           // high collar
  const armL = group(L.tank ? box(1.1, 5.0, 1.3, skin, 0, -2.2, 0) : tbox(1.1, 5.0, 1.3, cloth, 0, -2.2, 0), box(1.0, 1.0, 1.1, skin, 0, -5.0, 0));
  const armR = armL.clone();
  armL.position.set(-2.7, 6.2, 0);
  armR.position.set(2.7, 6.2, 0);
  body.add(armL, armR);
  const head = new THREE.Group();
  head.position.y = 6.6;
  body.add(head);
  const sk = ['skin', [skin]], face = ['face', [skin, L.hair === P.grey ? 0x9a948e : 0x33231f]];
  head.add(tbox(3.4, 3.6, 3.0, [sk, sk, sk, sk, face, sk], 0, 1.9, 0));
  head.add(box(0.4, 0.8, 0.5, skin, -1.85, 1.9, 0), box(0.4, 0.8, 0.5, skin, 1.85, 1.9, 0));   // ears
  const mouth = box(1.0, 0.3, 0.2, 0x7a2a2a, 0, 1.0, 1.51);
  mouth.name = 'mouth';
  head.add(mouth);
  if (L.glasses) head.add(box(2.8, 0.2, 0.2, P.ink, 0, 2.45, 1.6), box(0.9, 0.8, 0.12, 0x9fd0e0, -0.75, 2.1, 1.62), box(0.9, 0.8, 0.12, 0x9fd0e0, 0.75, 2.1, 1.62));
  if (!L.bald) {
    const hr = ['hair', [L.hair]];
    head.add(tbox(3.6, 1.0, 3.2, hr, 0, 3.9, -0.05));
    head.add(tbox(3.6, 2.6, 0.6, hr, 0, 2.6, -1.4));
    head.add(tbox(1.6, 0.6, 0.3, hr, -0.8, 3.3, 1.45));                 // a fringe
    if (!L.short) head.add(tbox(0.4, 1.4, 2.8, hr, -1.8, 2.9, -0.1), tbox(0.4, 1.4, 2.8, hr, 1.8, 2.9, -0.1));
    if (L.long) head.add(tbox(3.6, 4.6, 0.6, hr, 0, 1.0, -1.5));
  } else {
    head.add(box(0.4, 1.0, 2.0, L.hair, -1.8, 2.4, -0.3), box(0.4, 1.0, 2.0, L.hair, 1.8, 2.4, -0.3));
  }
  if (L.hat === 'nonla') {
    const hat = tmesh(new THREE.ConeGeometry(3.6, 2.0, 16), ['nonla', [], [3, 1]]);
    hat.position.y = 4.9;
    head.add(hat, box(0.15, 2.6, 0.15, 0xffffff, -1.6, 2.6, 1.0), box(0.15, 2.6, 0.15, 0xffffff, 1.6, 2.6, 1.0));   // chin strap
  } else if (L.hat === 'helmet') {
    const hel = mesh(new THREE.SphereGeometry(2.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), L.hatC);
    hel.position.y = 3.2;
    hel.scale.set(1, 0.9, 1);
    head.add(hel, box(3.8, 0.3, 1.2, L.hatC, 0, 3.15, 1.4), box(0.5, 1.6, 4.3, 0xffffff, 0, 3.9, 0), box(2.8, 0.7, 0.2, 0x8fdcff, 0, 3.6, 1.75));
  } else if (L.hat === 'cap') {
    head.add(box(3.7, 1.0, 3.3, L.hatC, 0, 4.1, 0), box(3.0, 0.25, 1.6, L.hatC, 0, 3.7, 2.1));
  }
  g.userData = { body, head, armL, armR, mouth };
  return g;
}

/* ------------------------------------------------------------------ the street */

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

export function texturedPlane(w, h, tex) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshToonMaterial({ map: tex, gradientMap: grad }));
  m.receiveShadow = true;
  return m;
}

export function makeStool(color) {
  const g = group(tbox(2.4, 0.4, 2.4, ['plastic', [color]], 0, 4.2, 0));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.35, 4.0, 0.35, color, x * 0.95, 2.0, z * 0.95));
  g.add(box(2.0, 0.3, 0.2, color, 0, 1.2, 0.95), box(2.0, 0.3, 0.2, color, 0, 1.2, -0.95));
  return g;
}

export function makeTable() {
  const g = group(tbox(7, 0.4, 4.6, ['steel', [], [2, 1]], 0, 7.0, 0));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.35, 6.8, 0.35, P.steelD, x * 3.1, 3.4, z * 2));
  // ống đũa, chai nước mắm, hũ ớt, chanh
  g.add(cyl(0.45, 0.45, 1.4, 0x8a5a2b, -2, 7.9, 0, 8));
  for (let i = 0; i < 5; i++) g.add(box(0.12, 1.4, 0.12, 0xe9d7a8, -2.2 + i * 0.1, 8.9, (i % 2) * 0.15));
  g.add(cyl(0.3, 0.35, 1.5, 0xc76a2a, -0.8, 7.95, 0.2, 8), cyl(0.35, 0.35, 0.7, P.red, 0.1, 7.55, -0.3, 8));
  g.add(ball(0.32, 0x7fc24a, 1.0, 7.5, 0.4, 8), ball(0.32, 0x7fc24a, 1.5, 7.5, 0.1, 8));
  return g;
}

export function makeMotorbike(color) {
  const g = new THREE.Group();
  for (const x of [-4, 4]) {
    const w = torus(1.6, 0.55, 0x23202a, Math.PI * 2, 14);
    w.position.set(x, 1.9, 0);
    g.add(w);
  }
  g.add(box(6, 1.2, 1.4, color, 0, 3.8, 0), box(3.2, 0.8, 1.6, 0x2a2430, -0.6, 5.0, 0));
  g.add(box(1.2, 4.2, 1.2, color, 3.6, 4.0, 0), box(0.3, 0.3, 3.6, 0x777777, 3.9, 6.1, 0));
  g.add(box(2.0, 1.8, 1.8, color, -3.4, 4.0, 0), box(0.6, 0.6, 0.5, P.yellow, 4.4, 5.2, 0));
  return g;
}

export function makePlant() {
  const g = group(tcyl(1.6, 1.2, 2.8, [['wood', [0xc8643a], [2, 0.5]], 0x5a3a24, 0xb5532c], 0, 1.4, 0, 12));
  const r = rng(12);
  for (let i = 0; i < 9; i++) {
    const leaf = box(0.7, 3.8, 0.25, i % 2 ? P.green : 0x5dbb5a, (r() - 0.5) * 1.6, 4.2, (r() - 0.5) * 1.6);
    leaf.rotation.z = (r() - 0.5) * 1.1;
    leaf.rotation.x = (r() - 0.5) * 0.8;
    g.add(leaf);
  }
  return g;
}
