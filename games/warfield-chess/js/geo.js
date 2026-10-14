/* Low-poly building blocks shared by units.js and world.js: a part kit that merges primitives
   into one vertex-coloured geometry, value noise, the terrain height function, and a seeded RNG.
   World scale is metres; one chess square is SQ metres wide. */
import * as THREE from 'three';

export const SQ = 10;                         // square size in metres
export const HALF = SQ * 4;                   // board half-width

/** World position of a square's centre. Rank 0 (the player's back rank) is at +z. */
export const squareCenter = sq => ({ x: ((sq & 7) - 3.5) * SQ, z: (3.5 - (sq >> 3)) * SQ });

// ---------- part kit ----------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

/** Merges primitives into one vertex-coloured geometry. Each primitive keeps its own normals, so
    spheres and cylinders shade smoothly while boxes stay crisp. Optional per-part settings:
      limb: [amp, pivotY]  — the part swings about the x axis at pivotY while walking (see units.js)
      arm: [amp, pivotY]   — the same, driven by the attack cycle instead (weapon arms)
      metal: 1             — shaded glossy and metallic (aMetal)
      grain: 0..1          — random per-face brightness, so wood, cloth and hide are not flat fills */
export class Kit {
  constructor(seed = 7) { this.parts = []; this.seed = seed; }
  add(geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], opts = {}) {
    _m.compose(_p.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...scale));
    this.parts.push({ geo, color, matrix: _m.clone(), ...opts });
    return this;
  }
  /** Add every part of another kit, transformed (for reusing sub-assemblies such as a wheel). */
  merge(kit, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
    const m = new THREE.Matrix4().compose(_p.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...scale));
    for (const part of kit.parts) this.parts.push({ ...part, matrix: m.clone().multiply(part.matrix) });
    return this;
  }
  build() {
    const pos = [], nrm = [], col = [], limb = [], mtl = [];
    let anyLimb = false, anyMetal = false, s = this.seed;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (const part of this.parts) {
      const g = part.geo.index ? part.geo.toNonIndexed() : part.geo.clone();
      if (!g.attributes.normal) g.computeVertexNormals();
      g.applyMatrix4(part.matrix);                 // also carries the normals along
      const a = g.attributes.position.array, n = g.attributes.normal.array;
      _c.set(part.color);
      const grain = part.grain || 0;
      let shade = 1;
      for (let i = 0; i < a.length; i += 3) {
        if (grain && (i / 3) % 3 === 0) shade = 1 + (rand() * 2 - 1) * grain;
        pos.push(a[i], a[i + 1], a[i + 2]);
        nrm.push(n[i], n[i + 1], n[i + 2]);
        col.push(_c.r * shade, _c.g * shade, _c.b * shade);
        limb.push(part.limb ? part.limb[0] : 0, part.limb ? part.limb[1] : 0, part.arm ? part.arm[0] : 0, part.arm ? part.arm[1] : 0);
        mtl.push(part.metal ? 1 : 0);
      }
      if (part.limb || part.arm) anyLimb = true;
      if (part.metal) anyMetal = true;
      g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    if (anyLimb) out.setAttribute('aLimb', new THREE.Float32BufferAttribute(limb, 4));
    if (anyMetal) out.setAttribute('aMetal', new THREE.Float32BufferAttribute(mtl, 1));
    out.computeBoundingSphere();
    return out;
  }
}

// short constructors for the primitives the models use
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt, rb, h, n = 8) => new THREE.CylinderGeometry(rt, rb, h, n);
export const cone = (r, h, n = 8) => new THREE.ConeGeometry(r, h, n);
export const ball = (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);
export const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
export const dome = (r, w = 8) => new THREE.SphereGeometry(r, w, 4, 0, Math.PI * 2, 0, Math.PI / 2);
/** A box whose top face sits at y = 0, so rotating it swings it from the top (legs). */
export const hangBox = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, -h / 2, 0);

export const flatMat = () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0.02 });

// ---------- noise ----------
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const smooth = t => t * t * (3 - 2 * t);
export function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
export function fbm(x, y, oct = 4) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += amp * noise(x * f, y * f); amp *= 0.5; f *= 2.03; }
  return v;
}
export const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Ground height. The board is a gently rolling meadow; hills rise past its edges. */
export function H(x, z) {
  const d = Math.max(Math.abs(x), Math.abs(z));
  const meadow = (fbm(x * 0.035 + 11, z * 0.035 + 7, 3) - 0.5) * 1.4;
  const rise = smoothstep(HALF + 8, HALF + 90, d);
  const hills = (fbm(x * 0.012 + 3, z * 0.012 - 4, 4) * 34 + 4) * rise;
  return meadow + hills;
}

// ---------- seeded RNG ----------
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
