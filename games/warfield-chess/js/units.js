/* Warfield Chess — every chess piece is a small army unit built from merged primitives:
     pawn   → a block of spearmen                 knight → three mounted knights and five men-at-arms
     bishop → the royal advisor's war cart         rook   → a siege tower pushed by its crew
     queen  → the queen in a war elephant's howdah king   → the king on a white horse amid his guard
   Banners ride on the vehicles (rook, queen); every other unit has a standard bearer carrying one.
   Foot soldiers of a unit share one InstancedMesh per kind and variant. Their legs swing with the
   walk cycle and their weapon arms with the attack cycle, both in the vertex shader: `aLimb` tags
   each vertex as leg or arm, `aAnim` gives each soldier its phase, walk and attack amounts.
   Horses, the cart, the tower and the elephant are separate meshes so legs and wheels can move.
   Models face -z; a unit's yaw turns them. Metal parts are flagged per vertex and shade glossier.
   Nothing here knows about chess rules — main.js sets `walking`, `attack` and calls kill(). */
import * as THREE from 'three';
import { Kit, box, cyl, cone, ball, dome, H } from './geo.js';
import { Arrows, Spell } from './unitfx.js';

export const TEAMS = {
  w: { name: 'Red', main: '#a3241c', dark: '#5a1611', trim: '#d9ad45', flag: '#a8261d', glyph: '#f5d77e', cloth: '#7e1d16' },
  b: { name: 'Blue', main: '#1f4f9e', dark: '#122a52', trim: '#d4dae3', flag: '#1d4b97', glyph: '#eef3fb', cloth: '#183f7e' },
};

export const UNIT_INFO = {
  p: { name: 'Pawn', glyph: '♟', eye: 2.1, cam: 6, sight: 48,
    rule: 'Marches one square forward — two from the starting line. Attacks one square diagonally forward. Reaching the far edge, it becomes a Queen.' },
  n: { name: 'Knight', glyph: '♞', eye: 3.0, cam: 6.5, sight: 58,
    rule: 'Rides in an L — two squares one way, then one aside. Leaps over anything in between.' },
  b: { name: 'Bishop', glyph: '♝', eye: 3.3, cam: 6.5, sight: 56,
    rule: 'Travels any distance diagonally, while the path is clear.' },
  r: { name: 'Rook', glyph: '♜', eye: 9.4, cam: 3.5, sight: 88,
    rule: 'Rolls any distance straight along a rank or file. Its height lets it see far over the mist.' },
  q: { name: 'Queen', glyph: '♛', eye: 6.0, cam: 6, sight: 72,
    rule: 'Charges any distance straight or diagonally.' },
  k: { name: 'King', glyph: '♚', eye: 3.3, cam: 6.5, sight: 58,
    rule: 'Moves one square in any direction, never into danger. Can castle with a Rook that has not moved.' },
};

// ---------- palette ----------
const SKINS = ['#d6a27a', '#b9835b', '#e2b691', '#9c6a46'];
const HAIR = ['#3b2516', '#6b4424', '#1f1712', '#8a6a48', '#a8a29a'];
const STEEL = '#767d86', IRON = '#4b5057', GOLD = '#d8a93a', BRASS = '#b88a3a';
const WOOD = '#6e4a2a', WOOD_D = '#4a311b', WOOD_L = '#8a6238', LEATHER = '#4a3020', LEATHER_L = '#6b4a2e';
const LINEN = '#cdbf9f', WOOL = '#7d6a4d', IVORY = '#efe4cc';
const metal = { metal: 1 };

// ---------- materials ----------
// One shared material: vertex colours, smooth or crisp normals per primitive, metal flag per
// vertex, and the soldiers' limb animation. aLimb = (leg amp, hip y, arm amp, shoulder y);
// aAnim = (phase, walk 0..1, attack 0..1). Legs swing with the stride; weapon arms are raised and
// struck forward in a repeating blow while attacking. Meshes without these attributes get zeros.
const unitClock = { value: 0 };
// shared by the model material and the outline material, so outlines follow the limbs exactly
const LIMB_GLSL = `
  uniform float uTime; attribute vec4 aLimb;
  #ifdef USE_INSTANCING
    attribute vec3 aAnim;
  #endif
  vec2 limbSwingPivot() {
    float swing = 0.0, pivot = 0.0;
    #ifdef USE_INSTANCING
      float stride = sin(uTime * 8.5 + aAnim.x) * aAnim.y;
      float blow = sin(uTime * 7.0 + aAnim.x * 1.7);
      float strike = -aAnim.z * (0.62 + 0.38 * blow * blow * sign(blow));
      swing = aLimb.x * stride + aLimb.z * strike;
      pivot = aLimb.x != 0.0 ? aLimb.y : aLimb.w;
    #endif
    return vec2(swing, pivot);
  }
  vec3 rotX(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x, v.y * c - v.z * s, v.y * s + v.z * c); }
  vec3 limbPose(vec3 p, vec2 sp) { return rotX(p - vec3(0.0, sp.y, 0.0), sp.x) + vec3(0.0, sp.y, 0.0); }`;
const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
material.onBeforeCompile = sh => {
  sh.uniforms.uTime = unitClock;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>
      ${LIMB_GLSL}
      attribute float aMetal; varying float vMetal;`)
    .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      vec2 sp = limbSwingPivot();
      objectNormal = rotX(objectNormal, sp.x);`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed = limbPose(transformed, sp);
      vMetal = aMetal;`);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vMetal;')
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.42, vMetal);')
    .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.75, vMetal);');
};

/** A soft sky reflection so steel, gold and helmets catch light. Called once by main.js. */
export function setEnvironment(tex) { material.envMap = tex; material.envMapIntensity = 0.45; material.needsUpdate = true; }

// Ink outlines ("inverted hull"): each unit mesh gets a twin drawn with only its back faces,
// pushed out along the normals and filled with dark ink, so a rim shows around the silhouette.
// The push grows a little with distance so the line stays about the same width on screen, and the
// material takes fog, so outlines fade into the mist with the model instead of betraying it.
const outlineMaterial = new THREE.MeshBasicMaterial({ color: '#1b130d', side: THREE.BackSide, fog: true });
outlineMaterial.onBeforeCompile = sh => {
  sh.uniforms.uTime = unitClock;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>\n${LIMB_GLSL}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      vec2 sp = limbSwingPivot();
      transformed = limbPose(transformed, sp);
      vec4 wp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        wp = instanceMatrix * wp;
      #endif
      float depth = -(modelViewMatrix * wp).z;
      transformed += normalize(rotX(normal, sp.x)) * clamp(0.015 + depth * 0.0016, 0.015, 0.09);`);
};
/** Turn the ink outlines on or off (they are drawn only when this material is visible). */
export function setOutlines(on) { outlineMaterial.visible = on; }

/** Give every unit mesh under `root` its outline twin. */
function addOutlines(root) {
  const meshes = [];
  root.traverse(o => { if (o.isMesh && o.material === material) meshes.push(o); });
  for (const m of meshes) {
    let hull;
    if (m.isInstancedMesh) {
      hull = new THREE.InstancedMesh(m.geometry, outlineMaterial, m.count);
      hull.instanceMatrix = m.instanceMatrix;             // the same soldiers, same poses
      hull.frustumCulled = false;
    } else {
      hull = new THREE.Mesh(m.geometry, outlineMaterial);
    }
    hull.castShadow = false;
    hull.userData.outline = true;
    m.add(hull);                                          // inherits the mesh's transform and motion
  }
}

// ---------- posing helpers ----------
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const _qq = new THREE.Quaternion(), _ee = new THREE.Euler();
/** A tapered cylinder from point a to point b (radius r0 at a, r1 at b). */
function seg(k, a, b, r0, r1, color, opts = {}, sides = 7) {
  _a.set(...a); _b.set(...b);
  _d.subVectors(_b, _a);
  const len = _d.length();
  _qq.setFromUnitVectors(_up, _d.normalize());
  _ee.setFromQuaternion(_qq);
  k.add(cyl(r1, r0, len, sides), color, [(_a.x + _b.x) / 2, (_a.y + _b.y) / 2, (_a.z + _b.z) / 2], [_ee.x, _ee.y, _ee.z], [1, 1, 1], opts);
}
/** A chain of tapering segments following a list of points (trunks, tusks, tails, plumes). */
function chain(k, pts, r0, r1, color, opts = {}, sides = 8) {
  for (let i = 0; i < pts.length - 1; i++) {
    const t0 = i / (pts.length - 1), t1 = (i + 1) / (pts.length - 1);
    seg(k, pts[i], pts[i + 1], r0 + (r1 - r0) * t0, r0 + (r1 - r0) * t1, color, opts, sides);
    if (i > 0) k.add(ball(r0 + (r1 - r0) * t0, sides, 5), color, pts[i], [0, 0, 0], [1, 1, 1], opts);
  }
}
/** Points along a curve in the y/z plane: start point, then [length, angle] steps where angle 0
    points straight down and π/2 points forward (-z). */
function curve(start, steps, x = start[0]) {
  const pts = [start];
  let [, y, z] = start;
  for (const [len, ang] of steps) { y -= Math.cos(ang) * len; z -= Math.sin(ang) * len; pts.push([x, y, z]); }
  return pts;
}

const SHAPES = {
  heater: (() => {
    const s = new THREE.Shape();
    s.moveTo(-0.22, 0.26); s.lineTo(0.22, 0.26); s.lineTo(0.22, 0.02);
    s.quadraticCurveTo(0.2, -0.24, 0, -0.38); s.quadraticCurveTo(-0.2, -0.24, -0.22, 0.02); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.014, bevelSegments: 1, curveSegments: 6 });
  })(),
  kite: (() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.42); s.quadraticCurveTo(0.26, 0.4, 0.25, 0.12); s.quadraticCurveTo(0.2, -0.3, 0, -0.62);
    s.quadraticCurveTo(-0.2, -0.3, -0.25, 0.12); s.quadraticCurveTo(-0.26, 0.4, 0, 0.42);
    return new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.014, bevelSegments: 1, curveSegments: 8 });
  })(),
  axe: (() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.12); s.quadraticCurveTo(0.12, 0.2, 0.26, 0.24); s.quadraticCurveTo(0.2, 0, 0.26, -0.22);
    s.quadraticCurveTo(0.12, -0.16, 0, -0.08); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -0.01);
  })(),
  pennant: (() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(0, -0.34); s.lineTo(0.7, -0.12); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.01, bevelEnabled: false });
  })(),
  mitre: (() => {
    const s = new THREE.Shape();
    s.moveTo(-0.14, 0); s.lineTo(0.14, 0); s.quadraticCurveTo(0.16, 0.25, 0, 0.5); s.quadraticCurveTo(-0.16, 0.25, -0.14, 0);
    return new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 8 }).translate(0, 0, -0.08);
  })(),
};

/** Shield face with the team's cross, at the given place/rotation. */
function shield(k, T, shape, pos, rot, scale = [1, 1, 1], tag = null) {
  const s = new Kit();
  if (shape === 'round') {
    s.add(cyl(0.3, 0.3, 0.035, 18), T.main, [0, 0, 0], [Math.PI / 2, 0, 0]);
    s.add(new THREE.TorusGeometry(0.3, 0.022, 5, 20), IRON, [0, 0, 0], [0, 0, 0], [1, 1, 1], metal);
    s.add(box(0.07, 0.56, 0.01), T.trim, [0, 0, -0.022]).add(box(0.56, 0.07, 0.01), T.trim, [0, 0, -0.022]);
    s.add(dome(0.08, 10), STEEL, [0, 0, -0.02], [-Math.PI / 2, 0, 0], [1, 1, 0.8], metal);
  } else {
    const geo = SHAPES[shape];
    s.add(geo, T.main, [0, 0, -0.02]);
    const h = shape === 'kite' ? 0.9 : 0.56, cy = shape === 'kite' ? -0.06 : -0.04;
    s.add(box(0.065, h, 0.012), T.trim, [0, cy, -0.04]).add(box(shape === 'kite' ? 0.44 : 0.4, 0.065, 0.012), T.trim, [0, 0.1, -0.04]);
    s.add(ball(0.045, 8, 6), STEEL, [0, 0.1, -0.05], [0, 0, 0], [1, 1, 0.6], metal);
  }
  k.merge(tagAll(s, tag), pos, rot, scale);
}

// ---------- foot soldiers ----------
// limb tags: legs swing opposite each other about the hip
const LEG_L = { limb: [0.45, 0.9] }, LEG_R = { limb: [-0.45, 0.9] };
// arm tags: the weapon arm (and what it holds) swings about the shoulder line during an attack;
// the amplitude is how far the blow travels (negative lifts things in front, for archers)
const ARM = amp => ({ arm: [amp, 1.4] });
// tag every part of a sub-kit, e.g. a shield or sword that moves with the arm holding it
const tagAll = (kit, tag) => { if (tag) for (const p of kit.parts) Object.assign(p, tag); return kit; };

/** Legs, skirt, torso, head and arms; `hands` are [left, right] positions, `elbows` optional,
    `arms` optional [left, right] attack tags. */
function body(k, o) {
  const { T, skin, coat, skirt, armor, hands, elbows, beard, hair } = o;
  // legs & boots
  for (const [s, tag] of [[-1, LEG_L], [1, LEG_R]]) {
    seg(k, [s * 0.1, 0.9, 0], [s * 0.115, 0.48, -0.01], 0.072, 0.058, o.hose || '#3d3428', tag);
    seg(k, [s * 0.115, 0.48, -0.01], [s * 0.12, 0.12, 0.0], 0.056, 0.048, o.hose || '#3d3428', tag);
    k.add(box(0.12, 0.13, 0.25), LEATHER, [s * 0.12, 0.065, -0.035], [0, 0, 0], [1, 1, 1], tag);
    k.add(cyl(0.065, 0.06, 0.14, 7), LEATHER, [s * 0.12, 0.2, 0], [0, 0, 0], [1, 1, 1], tag);
  }
  // skirt of the coat, torso, belt
  k.add(cyl(0.2, 0.29, 0.42, 12), skirt || coat, [0, 0.76, 0], [0, 0, 0], [1, 1, 0.78], { grain: 0.05 });
  k.add(cyl(0.225, 0.19, 0.52, 12), coat, [0, 1.21, 0], [0, 0, 0], [1, 1, 0.72], { grain: 0.04 });
  if (armor === 'mail') {
    k.add(cyl(0.232, 0.2, 0.46, 12), STEEL, [0, 1.24, 0], [0, 0, 0], [1, 1, 0.74], { metal: 1, grain: 0.12 });
    k.add(cyl(0.21, 0.27, 0.12, 12), STEEL, [0, 0.93, 0], [0, 0, 0], [1, 1, 0.78], { metal: 1, grain: 0.12 });
  }
  if (o.tabard) {
    for (const z of [-0.158, 0.158]) k.add(box(0.3, 0.62, 0.03), T.main, [0, 1.12, z]);
    k.add(box(0.32, 0.05, 0.035), T.trim, [0, 1.36, -0.16]);
    k.add(box(0.31, 0.04, 0.035), T.trim, [0, 0.82, -0.16]);
  }
  k.add(cyl(0.2, 0.2, 0.06, 12), LEATHER, [0, 0.99, 0], [0, 0, 0], [1, 1, 0.76]).add(box(0.06, 0.06, 0.03), BRASS, [0, 0.99, -0.155], [0, 0, 0], [1, 1, 1], metal);
  // shoulders, neck, head
  const pauldron = armor === 'mail' ? STEEL : coat;
  for (const s of [-1, 1]) k.add(ball(0.095, 9, 7), pauldron, [s * 0.215, 1.43, 0], [0, 0, 0], [1, 0.8, 1], armor === 'mail' ? metal : {});
  k.add(cyl(0.05, 0.06, 0.12, 7), skin, [0, 1.5, 0]);
  k.add(ball(0.105, 12, 9), skin, [0, 1.62, 0], [0, 0, 0], [0.92, 1.1, 1]);
  k.add(box(0.03, 0.05, 0.04), skin, [0, 1.605, -0.105]);
  k.add(box(0.11, 0.018, 0.02), '#2a1d15', [0, 1.655, -0.098]);
  if (hair) k.add(ball(0.11, 10, 7), hair, [0, 1.65, 0.015], [0, 0, 0], [0.95, 1, 1.02]);
  if (beard) k.add(ball(0.07, 8, 6), beard, [0, 1.555, -0.07], [0, 0, 0], [1, 1.2, 0.8]);
  // arms: shoulder → elbow → hand
  [[-1, hands[0]], [1, hands[1]]].forEach(([s, hand], i) => {
    const sh = [s * 0.235, 1.4, 0];
    const el = elbows?.[i] || [s * 0.27, 1.16, 0.04];
    const sleeve = armor === 'mail' ? STEEL : o.sleeve || coat, tag = o.arms?.[i] || {};
    seg(k, sh, el, 0.06, 0.05, sleeve, armor === 'mail' ? { ...metal, ...tag } : tag);
    seg(k, el, hand, 0.05, 0.042, o.glove || sleeve, armor === 'mail' && !o.glove ? { ...metal, ...tag } : tag);
    k.add(ball(0.045, 7, 6), o.glove || skin, hand, [0, 0, 0], [1, 1, 1], tag);
  });
}

function helmet(k, kind, T) {
  switch (kind) {
    case 'nasal':
      k.add(cone(0.127, 0.21, 12), STEEL, [0, 1.8, 0], [0, 0, 0], [1, 1, 1], metal);
      k.add(cyl(0.13, 0.13, 0.05, 12), IRON, [0, 1.7, 0], [0, 0, 0], [1, 1, 1], metal);
      k.add(box(0.025, 0.11, 0.02), IRON, [0, 1.63, -0.125], [0, 0, 0], [1, 1, 1], metal);
      break;
    case 'kettle':
      k.add(dome(0.128, 12), STEEL, [0, 1.68, 0], [0, 0, 0], [1, 1.1, 1], metal);
      k.add(cyl(0.21, 0.23, 0.02, 16), STEEL, [0, 1.685, 0], [0.08, 0, 0], [1, 1, 1], metal);
      k.add(cyl(0.025, 0.025, 0.05, 6), IRON, [0, 1.83, 0], [0, 0, 0], [1, 1, 1], metal);
      break;
    case 'morion':
      k.add(dome(0.128, 12), STEEL, [0, 1.68, 0], [0, 0, 0], [1, 1.15, 1.05], metal);
      k.add(box(0.025, 0.12, 0.3), GOLD, [0, 1.79, 0], [0, 0, 0], [1, 1, 1], metal);
      k.add(cyl(0.2, 0.22, 0.02, 16), STEEL, [0, 1.69, 0], [0, 0, 0], [1, 1, 1.15], metal);
      k.add(cone(0.04, 0.32, 6), T.main, [0, 1.98, 0.06], [0.5, 0, 0]);
      break;
    case 'hood':
      k.add(dome(0.135, 12), T.cloth, [0, 1.66, 0.01], [0, 0, 0], [1, 1.1, 1.05]);
      k.add(cone(0.06, 0.28, 7), T.cloth, [0, 1.62, 0.18], [1.9, 0, 0]);
      k.add(cyl(0.2, 0.17, 0.12, 12), T.cloth, [0, 1.45, 0], [0, 0, 0], [1, 1, 0.85]);
      break;
    case 'cap':
      k.add(dome(0.12, 10), WOOL, [0, 1.69, 0], [-0.15, 0, 0], [1, 0.8, 1.1]);
      break;
    case 'turban':
      k.add(ball(0.14, 12, 8), '#e9dcc0', [0, 1.72, 0], [0, 0, 0], [1, 0.75, 1]);
      k.add(ball(0.04, 6, 5), GOLD, [0, 1.74, -0.13], [0, 0, 0], [1, 1, 1], metal);
      break;
  }
}

const SOLDIER_KINDS = {
  // spearman: mail under a team tabard, heater shield, long spear held upright
  // attack: the spear drops level and jabs, the shield arm braces forward
  spear(k, T, v) {
    const R = ARM(1.2), L = ARM(0.3);
    body(k, { T, skin: SKINS[v % 4], coat: T.cloth, armor: 'mail', tabard: true, hands: [[-0.24, 1.14, -0.26], [0.25, 1.08, -0.22]],
      elbows: [[-0.29, 1.18, -0.02], [0.28, 1.13, 0.02]], beard: v % 3 === 1 ? HAIR[v % 5] : null, glove: LEATHER, hair: HAIR[(v + 1) % 5], arms: [L, R] });
    helmet(k, v % 2 ? 'kettle' : 'nasal', T);
    seg(k, [0.25, 0.12, -0.22], [0.25, 2.72, -0.22], 0.019, 0.017, WOOD, { grain: 0.1, ...R }, 6);
    k.add(cyl(0.024, 0.026, 0.1, 6), IRON, [0.25, 2.74, -0.22], [0, 0, 0], [1, 1, 1], { ...metal, ...R });
    k.add(cone(0.045, 0.3, 4), STEEL, [0.25, 2.94, -0.22], [0, Math.PI / 4, 0], [1, 1, 0.45], { ...metal, ...R });
    shield(k, T, 'heater', [-0.3, 1.12, -0.31], [0, 0.25, 0], [1, 1, 1], L);
  },
  // man-at-arms following a knight: mail, round shield, sword on the shoulder; attack: chopping blows
  sword(k, T, v) {
    const R = ARM(1.7), L = ARM(0.35);
    body(k, { T, skin: SKINS[(v + 1) % 4], coat: T.main, armor: 'mail', hands: [[-0.25, 1.14, -0.27], [0.25, 1.2, -0.24]],
      elbows: [[-0.3, 1.18, -0.03], [0.3, 1.18, 0.02]], beard: v % 2 ? HAIR[(v + 2) % 5] : null, glove: LEATHER, hair: HAIR[(v + 2) % 5], arms: [L, R] });
    k.add(box(0.3, 0.6, 0.03), T.dark, [0, 1.12, -0.16]).add(box(0.32, 0.045, 0.035), T.trim, [0, 1.38, -0.162]);
    helmet(k, 'nasal', T);
    const blade = new Kit();
    blade.add(box(0.05, 0.78, 0.012), STEEL, [0, 0.47, 0], [0, 0, 0], [1, 1, 1], metal).add(cone(0.025, 0.08, 4), STEEL, [0, 0.9, 0], [0, Math.PI / 4, 0], [1, 1, 0.3], metal);
    blade.add(box(0.22, 0.035, 0.04), GOLD, [0, 0.07, 0], [0, 0, 0], [1, 1, 1], metal).add(cyl(0.02, 0.02, 0.13, 6), LEATHER, [0, -0.02, 0]).add(ball(0.03, 6, 5), GOLD, [0, -0.1, 0], [0, 0, 0], [1, 1, 1], metal);
    k.merge(tagAll(blade, R), [0.25, 1.2, -0.24], [-0.35, 0, 0.1]);
    shield(k, T, 'round', [-0.31, 1.14, -0.33], [0, 0.3, 0], [1, 1, 1], L);
  },
  // king's guard: tabard over mail, morion with plume, halberd held in both hands; attack: swings it down
  halberd(k, T, v) {
    const A = ARM(1.1);
    body(k, { T, skin: SKINS[(v + 2) % 4], coat: T.dark, armor: 'mail', tabard: true, hands: [[0.22, 1.42, -0.22], [0.25, 1.08, -0.2]],
      elbows: [[-0.08, 1.24, -0.18], [0.29, 1.14, 0.03]], beard: v % 2 ? null : HAIR[v % 5], glove: LEATHER, hair: HAIR[(v + 3) % 5], arms: [A, A] });
    helmet(k, 'morion', T);
    seg(k, [0.25, 0.1, -0.2], [0.25, 2.35, -0.2], 0.02, 0.018, WOOD_D, { grain: 0.1, ...A }, 6);
    k.add(SHAPES.axe, STEEL, [0.27, 2.2, -0.2], [0, Math.PI / 2, 0], [1, 1, 1], { ...metal, ...A });
    k.add(cone(0.035, 0.36, 4), STEEL, [0.25, 2.52, -0.2], [0, 0, 0], [1, 1, 1], { ...metal, ...A });
    k.add(cone(0.025, 0.16, 4), STEEL, [0.25, 2.22, -0.08], [Math.PI / 2 + 0.3, 0, 0], [1, 1, 1], { ...metal, ...A });
    k.add(box(0.012, 0.18, 0.12), T.main, [0.26, 2.0, -0.2], [0, 0, 0], [1, 1, 1], A);
  },
  // standard bearer: both hands on the pole (the banner itself is a separate, waving mesh)
  bearer(k, T, v) {
    body(k, { T, skin: SKINS[(v + 1) % 4], coat: T.cloth, armor: 'mail', tabard: true, hands: [[0.21, 1.5, -0.2], [0.25, 1.1, -0.2]],
      elbows: [[-0.06, 1.32, -0.2], [0.3, 1.14, 0.02]], beard: HAIR[(v + 2) % 5], glove: LEATHER, hair: HAIR[v % 5] });
    helmet(k, 'kettle', T);
    k.add(cone(0.035, 0.3, 6), T.trim, [0, 1.95, 0.04], [0.35, 0, 0]);
    seg(k, [-0.14, 0.95, 0.12], [-0.3, 1.02, 0.05], 0.04, 0.022, IVORY, {}, 7);           // a horn at the belt
    k.add(cyl(0.045, 0.045, 0.02, 8), BRASS, [-0.3, 1.02, 0.05], [0, 0, Math.PI / 2], [1, 1, 1], metal);
  },
  // archer: padded jack, hood, longbow, quiver; attack: bow raised for a volley
  archer(k, T, v) {
    const A = ARM(-0.55);
    body(k, { T, skin: SKINS[(v + 3) % 4], coat: LINEN, skirt: WOOL, sleeve: T.cloth, hands: [[-0.2, 1.32, -0.42], [0.22, 1.05, -0.12]],
      elbows: [[-0.28, 1.34, -0.16], [0.28, 1.13, 0.04]], beard: v % 2 ? HAIR[(v + 1) % 5] : null, hair: HAIR[(v + 3) % 5], arms: [A, A] });
    k.add(cyl(0.232, 0.2, 0.3, 12), T.main, [0, 1.32, 0], [0, 0, 0], [1, 1, 0.74]);
    helmet(k, 'hood', T);
    // a shallow arc centred on the left hand, bulging forward, with its string
    k.add(new THREE.TorusGeometry(1.4, 0.017, 5, 18, 1.0), WOOD_L, [-0.2, 1.32, 0.98], [0, Math.PI / 2, -0.5], [1, 1, 1], A);
    seg(k, [-0.2, 1.99, -0.25], [-0.2, 0.65, -0.25], 0.004, 0.004, '#e8e0cc', A, 3);
    seg(k, [0.1, 0.95, 0.2], [0.18, 1.55, 0.24], 0.07, 0.065, LEATHER_L, {}, 8);
    for (let i = 0; i < 4; i++) k.add(box(0.012, 0.12, 0.05), i % 2 ? '#e8e0cc' : T.main, [0.15 + i * 0.015, 1.62, 0.22 + (i - 1.5) * 0.02], [0.12, 0, 0.12]);
  },
  // siege crew: rough wool, caps, both arms forward on the push bar
  crew(k, T, v) {
    body(k, { T, skin: SKINS[v % 4], coat: v % 2 ? WOOL : '#8a7254', hose: '#4d4232', hands: [[-0.2, 1.24, -0.5], [0.2, 1.24, -0.5]],
      elbows: [[-0.27, 1.26, -0.22], [0.27, 1.26, -0.22]], beard: HAIR[v % 5], hair: v % 2 ? HAIR[(v + 2) % 5] : null });
    k.add(box(0.36, 0.06, 0.32), T.main, [0, 1.0, 0]);                       // team sash
    helmet(k, v % 2 ? 'cap' : '', T);
  },
};

const soldierCache = new Map();
function soldierGeo(team, kind, variant) {
  const key = `${team}:${kind}:${variant}`;
  if (!soldierCache.has(key)) {
    const k = new Kit(variant * 97 + 5);
    SOLDIER_KINDS[kind](k, TEAMS[team], variant);
    soldierCache.set(key, k.build());
  }
  return soldierCache.get(key);
}

// ---------- horses & riders ----------
const HORSE_COATS = { bay: '#7a4a28', chestnut: '#94582c', black: '#2c2420', grey: '#9a948c', white: '#e6e0d4', dun: '#a5825a' };
const HOOF = '#2a221c';

function horseBody(coat, team, opts) {
  const T = TEAMS[team], k = new Kit(11), mane = opts.mane || '#2a1d15';
  // barrel, chest and haunches as overlapping ellipsoids
  k.add(ball(1, 16, 12), coat, [0, 1.34, 0.02], [0, 0, 0], [0.36, 0.37, 0.78]);
  k.add(ball(1, 14, 10), coat, [0, 1.4, -0.52], [0, 0, 0], [0.33, 0.37, 0.36]);
  k.add(ball(1, 14, 10), coat, [0, 1.43, 0.5], [0, 0, 0], [0.35, 0.37, 0.38]);
  // neck, then a long wedge-shaped head angled down and forward from the poll: round forehead,
  // big cheek, a tapering nasal bone, a soft muzzle with nostrils, eyes set wide, pricked ears
  seg(k, [0, 1.48, -0.66], [0, 1.98, -1.02], 0.24, 0.15, coat, {}, 12);
  const P = [0, 2.1, -1.06], D = [0, -0.622, -0.783];
  const at = (t, off = [0, 0, 0]) => [P[0] + D[0] * t + off[0], P[1] + D[1] * t + off[1], P[2] + D[2] * t + off[2]];
  k.add(ball(0.14, 14, 10), coat, at(0.06), [0, 0, 0], [0.92, 1, 1.05]);
  k.add(ball(0.15, 14, 10), coat, at(0.14, [0, -0.07, 0.06]), [0, 0, 0], [0.82, 1, 1.12]);
  seg(k, at(0.1), at(0.54), 0.115, 0.078, coat, {}, 12);
  seg(k, at(0.2, [0, -0.1, 0.04]), at(0.52, [0, -0.04, 0.02]), 0.07, 0.065, coat, {}, 10);        // lower jaw
  k.add(ball(0.092, 12, 9), opts.muzzle || coat, at(0.58), [0, 0, 0], [0.95, 0.9, 1.12]);
  for (const s of [-1, 1]) {
    k.add(ball(0.022, 6, 5), '#120d0a', at(0.63, [s * 0.045, 0.01, 0]));                            // nostrils
    k.add(ball(0.03, 8, 6), '#120d0a', at(0.13, [s * 0.112, 0.04, 0]), [0, 0, 0], [0.6, 1, 1.2]);   // eyes
    k.add(cone(0.038, 0.16, 6), coat, [s * 0.06, 2.24, -1.02], [-0.25, 0, s * 0.18], [1, 1, 0.7]);
  }
  k.add(box(0.1, 0.012, 0.012), '#2a1d15', at(0.6, [0, -0.06, 0.03]), [-0.9, 0, 0]);              // mouth
  // mane, forelock and tail
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    k.add(box(0.05, 0.16, 0.14), mane, [0, 1.62 + t * 0.48 + 0.1, -0.68 - t * 0.36 + 0.06], [-0.6, 0, (i % 2 ? 0.12 : -0.12)]);
  }
  k.add(box(0.07, 0.14, 0.05), mane, at(0.05, [0, 0.1, -0.02]), [0.6, 0, 0]);                      // forelock
  chain(k, curve([0, 1.6, 0.84], [[0.18, -1.3], [0.24, -0.75], [0.28, -0.38], [0.24, -0.18]]), 0.075, 0.05, mane, {}, 7);
  // tack: bridle (browband, noseband, cheek straps, bit), reins
  k.add(new THREE.TorusGeometry(0.105, 0.013, 4, 14), LEATHER, at(0.44), [2.47, 0, 0], [1, 1.1, 1]);
  k.add(new THREE.TorusGeometry(0.13, 0.013, 4, 14), LEATHER, at(0.08, [0, 0.02, 0]), [2.47, 0, 0], [1.05, 1.15, 1]);
  for (const s of [-1, 1]) {
    seg(k, at(0.1, [s * 0.125, 0, 0]), at(0.46, [s * 0.1, -0.03, 0]), 0.012, 0.012, LEATHER, {}, 4);
    k.add(new THREE.TorusGeometry(0.025, 0.008, 4, 8), IRON, at(0.5, [s * 0.1, -0.05, 0.02]), [0, Math.PI / 2, 0], [1, 1, 1], metal);
  }
  if (opts.rider) for (const s of [-1, 1]) seg(k, at(0.5, [s * 0.1, -0.05, 0.02]), [s * 0.16, 1.98, -0.45], 0.008, 0.008, LEATHER, {}, 3);
  if (opts.saddle !== false) {
    k.add(box(0.7, 0.03, 0.66), T.main, [0, 1.72, -0.02], [0, 0, 0], [1, 1, 1]);
    k.add(box(0.72, 0.035, 0.05), T.trim, [0, 1.72, 0.31]).add(box(0.72, 0.035, 0.05), T.trim, [0, 1.72, -0.35]);
    k.add(ball(1, 10, 6), LEATHER_L, [0, 1.75, -0.02], [0, 0, 0], [0.22, 0.08, 0.3]);
    k.add(box(0.26, 0.14, 0.06), LEATHER, [0, 1.82, 0.24]).add(box(0.18, 0.12, 0.06), LEATHER, [0, 1.81, -0.28]);
    for (const s of [-1, 1]) {
      seg(k, [s * 0.36, 1.72, -0.06], [s * 0.38, 1.28, -0.08], 0.008, 0.008, LEATHER, {}, 3);
      k.add(new THREE.TorusGeometry(0.05, 0.01, 4, 8), IRON, [s * 0.38, 1.24, -0.08], [0, Math.PI / 2, 0], [1, 1, 1], metal);
      seg(k, [s * 0.36, 1.7, 0.0], [s * 0.37, 1.1, 0.0], 0.012, 0.012, LEATHER, {}, 3);   // girth
    }
  }
  if (opts.harness) {
    k.add(new THREE.TorusGeometry(0.27, 0.065, 6, 16), LEATHER_L, [0, 1.62, -0.76], [-2.19, 0, 0], [1, 1.15, 1]);
    k.add(new THREE.TorusGeometry(0.29, 0.02, 4, 16), BRASS, [0, 1.62, -0.76], [-2.19, 0, 0], [1, 1.15, 1], metal);
    for (const s of [-1, 1]) seg(k, [s * 0.36, 1.45, -0.55], [s * 0.37, 1.35, 0.7], 0.018, 0.018, LEATHER, {}, 4);
    k.add(new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), T.main, [0, 1.6, 0.05], [0, 0, 0], [0.42, 0.16, 0.5]);
    k.add(new THREE.CylinderGeometry(0.42, 0.43, 0.04, 14, 1, true), T.trim, [0, 1.6, 0.05], [0, 0, 0], [1, 1, 1.19]);
  }
  if (opts.barding) {
    // caparison: a cloth skirt over the body with a trimmed hem, and a cloth hood over the neck
    k.add(new THREE.CylinderGeometry(0.47, 0.52, 0.66, 18, 1, true), T.main, [0, 1.25, 0.02], [0, 0, 0], [1, 1, 2.0], { grain: 0.04 });
    k.add(new THREE.CylinderGeometry(0.525, 0.53, 0.07, 18, 1, true), T.trim, [0, 0.92, 0.02], [0, 0, 0], [1, 1, 2.0]);
    k.add(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), T.main, [0, 1.56, 0.02], [0, 0, 0], [0.49, 0.24, 1.0]);
    for (const s of [-1, 1]) k.add(cyl(0.16, 0.16, 0.02, 14), T.trim, [s * 0.505, 1.25, 0.05], [0, 0, Math.PI / 2]);
    seg(k, [0, 1.5, -0.66], [0, 2.0, -1.04], 0.29, 0.19, T.main, {}, 12);
    // chanfron: a curved steel plate fitted down the face, eye guards, a gilded crest at the poll
    k.add(ball(1, 14, 8), STEEL, at(0.24, [0, 0.075, -0.06]), [2.47, 0, 0], [0.095, 0.035, 0.2], metal);
    k.add(ball(1, 10, 6), GOLD, at(0.24, [0, 0.1, -0.08]), [2.47, 0, 0], [0.015, 0.015, 0.17], metal);
    for (const s of [-1, 1]) k.add(dome(0.05, 8), STEEL, at(0.13, [s * 0.125, 0.04, 0]), [0, 0, -s * Math.PI / 2], [1, 0.6, 1], metal);
    k.add(cone(0.04, 0.2, 6), GOLD, [0, 2.26, -1.08], [-0.3, 0, 0], [1, 1, 1], metal);
    k.add(cone(0.03, 0.34, 6), T.trim, [0, 2.36, -1.0], [0.6, 0, 0]);
  }
  return k.build();
}

const legCache = new Map();
function horseLeg(coat, hind, sock) {
  const key = coat + hind + sock;
  if (legCache.has(key)) return legCache.get(key);
  const k = new Kit(), z = hind ? 1 : -1;
  if (hind) {
    seg(k, [0, 0.06, 0], [0, -0.42, 0.12], 0.11, 0.07, coat, {}, 9);
    k.add(ball(0.065, 8, 6), coat, [0, -0.43, 0.12]);
    seg(k, [0, -0.43, 0.12], [0, -0.86, 0.04], 0.048, 0.042, sock ? '#e7e1d6' : coat, {}, 8);
  } else {
    seg(k, [0, 0.06, 0], [0, -0.48, -0.02], 0.095, 0.062, coat, {}, 9);
    k.add(ball(0.06, 8, 6), coat, [0, -0.49, -0.02]);
    seg(k, [0, -0.49, -0.02], [0, -0.86, -0.01], 0.045, 0.042, sock ? '#e7e1d6' : coat, {}, 8);
  }
  k.add(ball(0.055, 8, 6), sock ? '#e7e1d6' : coat, [0, -0.88, 0.01 * z]);
  seg(k, [0, -0.88, 0.01 * z], [0, -0.97, -0.04], 0.048, 0.055, sock ? '#e7e1d6' : coat, {}, 8);
  k.add(cyl(0.06, 0.072, 0.1, 10), HOOF, [0, -1.02, -0.05]);
  const g = k.build();
  legCache.set(key, g);
  return g;
}

/** A horse: one body mesh plus four leg meshes that swing from the hip. */
function makeHorse(coat, team, opts = {}) {
  const group = new THREE.Group();
  const bodyMesh = new THREE.Mesh(horseBody(coat, team, opts), material);
  group.add(bodyMesh);
  const legs = [];
  for (const [x, z, hind] of [[-0.19, -0.56, false], [0.19, -0.56, false], [-0.2, 0.55, true], [0.2, 0.55, true]]) {
    const leg = new THREE.Mesh(horseLeg(coat, hind, opts.socks && (x > 0) === hind), material);
    leg.position.set(x, 1.08, z);
    group.add(leg);
    legs.push(leg);
  }
  return { group, legs, gait: 9, swing: 0.5 };
}

function riderGeo(team, role) {
  const T = TEAMS[team], k = new Kit(23);
  const king = role === 'king';
  // seated legs over the horse's sides, feet in the stirrups
  for (const s of [-1, 1]) {
    seg(k, [s * 0.12, 1.86, 0.02], [s * 0.26, 1.72, -0.3], 0.085, 0.07, king ? '#e8e0cc' : STEEL, king ? {} : metal, 9);
    seg(k, [s * 0.26, 1.72, -0.3], [s * 0.36, 1.32, -0.14], 0.065, 0.055, king ? '#e8e0cc' : STEEL, king ? {} : metal, 8);
    k.add(box(0.11, 0.1, 0.24), LEATHER, [s * 0.37, 1.25, -0.18]);
  }
  k.add(cyl(0.2, 0.33, 0.36, 14), king ? T.main : T.main, [0, 1.9, 0], [0, 0, 0], [1, 1, 0.9], { grain: 0.04 });
  k.add(cyl(0.33, 0.335, 0.05, 14), T.trim, [0, 1.73, 0], [0, 0, 0], [1, 1, 0.9]);
  // torso
  k.add(cyl(0.235, 0.2, 0.5, 14), king ? T.main : STEEL, [0, 2.22, 0], [0, 0, 0], [1, 1, 0.74], king ? {} : { metal: 1, grain: 0.1 });
  k.add(box(0.32, 0.5, 0.03), T.main, [0, 2.14, -0.165]).add(box(0.32, 0.5, 0.03), T.main, [0, 2.14, 0.165]);
  k.add(box(0.06, 0.5, 0.035), T.trim, [0, 2.14, -0.168]).add(box(0.33, 0.06, 0.035), T.trim, [0, 2.3, -0.168]);
  k.add(cyl(0.21, 0.21, 0.06, 12), LEATHER, [0, 1.98, 0], [0, 0, 0], [1, 1, 0.76]).add(box(0.07, 0.07, 0.03), GOLD, [0, 1.98, -0.16], [0, 0, 0], [1, 1, 1], metal);
  for (const s of [-1, 1]) k.add(ball(0.1, 10, 8), king ? GOLD : STEEL, [s * 0.225, 2.44, 0], [0, 0, 0], [1, 0.75, 1], metal);
  k.add(cyl(0.05, 0.06, 0.12, 7), SKINS[0], [0, 2.52, 0]);
  if (king) {
    k.add(ball(0.11, 12, 9), SKINS[0], [0, 2.64, 0], [0, 0, 0], [0.92, 1.1, 1]);
    k.add(box(0.03, 0.05, 0.04), SKINS[0], [0, 2.625, -0.107]);
    k.add(ball(0.115, 10, 7), '#d9d2c4', [0, 2.67, 0.02], [0, 0, 0], [0.97, 1, 1.03]);
    k.add(ball(0.09, 9, 7), '#d9d2c4', [0, 2.55, -0.06], [0, 0, 0], [1, 1.35, 0.85]);         // beard
    k.add(box(0.1, 0.018, 0.02), '#2a1d15', [0, 2.67, -0.1]);
    // crown
    k.add(cyl(0.12, 0.115, 0.08, 14), GOLD, [0, 2.77, 0.01], [0, 0, 0], [1, 1, 1], metal);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      k.add(cone(0.03, 0.11, 4), GOLD, [Math.sin(a) * 0.115, 2.85, 0.01 + Math.cos(a) * 0.115], [0, 0, 0], [1, 1, 1], metal);
      if (i % 2 === 0) k.add(ball(0.018, 6, 5), i % 4 ? '#2b6fd6' : '#d0242a', [Math.sin(a) * 0.12, 2.77, 0.01 + Math.cos(a) * 0.12]);
    }
    // cape with an ermine collar
    k.add(new THREE.CylinderGeometry(0.24, 0.52, 1.2, 16, 1, true, -Math.PI / 2, Math.PI), T.main, [0, 1.9, 0.05], [0.18, 0, 0], [1, 1, 0.75], { grain: 0.04 });
    k.add(new THREE.CylinderGeometry(0.525, 0.53, 0.07, 16, 1, true, -Math.PI / 2, Math.PI), T.trim, [0, 1.31, 0.16], [0.18, 0, 0], [1, 1, 0.75]);
    k.add(new THREE.TorusGeometry(0.2, 0.065, 6, 14), '#f2eee6', [0, 2.46, 0], [Math.PI / 2, 0, 0], [1, 0.8, 1]);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; k.add(box(0.02, 0.03, 0.02), '#151515', [Math.sin(a) * 0.2, 2.5, Math.cos(a) * 0.16]); }
    // arms: scepter raised in the right hand, reins in the left
    seg(k, [0.24, 2.4, 0], [0.38, 2.2, -0.08], 0.065, 0.055, T.main, {}, 8);
    seg(k, [0.38, 2.2, -0.08], [0.46, 2.26, -0.3], 0.055, 0.045, T.main, {}, 8);
    k.add(ball(0.045, 7, 6), SKINS[0], [0.46, 2.26, -0.3]);
    seg(k, [0.45, 1.98, -0.28], [0.53, 2.78, -0.36], 0.02, 0.025, GOLD, metal, 7);
    k.add(ball(0.07, 10, 8), GOLD, [0.535, 2.83, -0.365], [0, 0, 0], [1, 1, 1], metal);
    k.add(box(0.025, 0.12, 0.025), GOLD, [0.54, 2.94, -0.37], [0, 0, 0], [1, 1, 1], metal).add(box(0.08, 0.025, 0.025), GOLD, [0.54, 2.95, -0.37], [0, 0, 0], [1, 1, 1], metal);
    seg(k, [-0.24, 2.4, 0], [-0.3, 2.16, -0.1], 0.065, 0.055, T.main, {}, 8);
    seg(k, [-0.3, 2.16, -0.1], [-0.16, 2.0, -0.4], 0.055, 0.045, T.main, {}, 8);
    k.add(ball(0.045, 7, 6), SKINS[0], [-0.16, 2.0, -0.4]);
  } else {
    // sugarloaf great helm: a mail collar, a pointed crown, a raised face ridge between two eye
    // slits, breaths on the right cheek, a gilt rim; on top a small coronet and a feather plume;
    // a team-coloured mantling cloth hangs down the back
    k.add(cyl(0.16, 0.21, 0.12, 14), STEEL, [0, 2.49, 0], [0, 0, 0], [1, 1, 0.9], { metal: 1, grain: 0.12 });
    k.add(cyl(0.142, 0.152, 0.24, 16), STEEL, [0, 2.65, 0], [0, 0, 0], [1, 1, 1], metal);
    k.add(cone(0.142, 0.17, 16), STEEL, [0, 2.855, 0], [0, 0, 0], [1, 1, 1], metal);
    k.add(box(0.026, 0.36, 0.03), STEEL, [0, 2.68, -0.146], [0, 0, 0], [1, 1, 1], metal);
    for (const s of [-1, 1]) k.add(box(0.085, 0.022, 0.03), '#0a0a0a', [s * 0.058, 2.715, -0.138]);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) k.add(box(0.012, 0.014, 0.02), '#0a0a0a', [0.05 + j * 0.03, 2.62 - i * 0.03, -0.145]);
    k.add(cyl(0.155, 0.155, 0.025, 16), GOLD, [0, 2.54, 0], [0, 0, 0], [1, 1, 1], metal);
    k.add(cyl(0.155, 0.155, 0.02, 16), GOLD, [0, 2.77, 0], [0, 0, 0], [1, 1, 1], metal);
    k.add(cyl(0.06, 0.065, 0.05, 10), GOLD, [0, 2.95, 0], [0, 0, 0], [1, 1, 1], metal);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; k.add(cone(0.015, 0.05, 4), GOLD, [Math.sin(a) * 0.06, 3.0, Math.cos(a) * 0.06], [0, 0, 0], [1, 1, 1], metal); }
    for (const [x, rz, c, len] of [[-0.04, 0.35, T.trim, 0.28], [0, 0, T.main, 0.34], [0.04, -0.35, T.trim, 0.28]]) {
      k.add(cone(0.045, len, 7), c, [x, 2.98 + len * 0.4, 0.05], [0.75, 0, rz], [1, 1, 0.55]);
    }
    k.add(box(0.24, 0.3, 0.02), T.main, [0, 2.5, 0.17], [0.35, 0, 0]).add(box(0.25, 0.04, 0.025), T.trim, [0, 2.36, 0.22], [0.35, 0, 0]);
    // arms: the right hand grips the lance (a separate mesh, so it can be lowered to charge),
    // the left carries the kite shield and the reins
    seg(k, [0.24, 2.4, 0], [0.3, 2.16, 0.04], 0.065, 0.055, STEEL, metal, 8);
    seg(k, [0.3, 2.16, 0.04], [0.3, 2.12, -0.24], 0.055, 0.045, STEEL, metal, 8);
    k.add(ball(0.05, 7, 6), LEATHER, [0.3, 2.12, -0.24]);
    seg(k, [-0.24, 2.4, 0], [-0.31, 2.16, 0.02], 0.065, 0.055, STEEL, metal, 8);
    seg(k, [-0.31, 2.16, 0.02], [-0.22, 2.04, -0.3], 0.055, 0.045, STEEL, metal, 8);
    k.add(ball(0.05, 7, 6), LEATHER, [-0.22, 2.04, -0.3]);
    shield(k, T, 'kite', [-0.5, 1.98, -0.06], [0.05, 1.25, 0], [0.85, 0.85, 0.85]);
  }
  return { body: k.build(), lance: king ? null : lanceGeo(team) };
}

/** The knight's lance, built around the grip so rotating the mesh lowers it for a charge. */
const LANCE_GRIP = [0.3, 2.12, -0.24];
function lanceGeo(team) {
  const T = TEAMS[team], k = new Kit(29), [gx, gy, gz] = LANCE_GRIP;
  const g = p => [p[0] - gx, p[1] - gy, p[2] - gz];
  seg(k, g([0.3, 1.45, 0.05]), g([0.3, 4.75, -0.95]), 0.04, 0.025, WOOD_L, { grain: 0.08 }, 7);
  k.add(cone(0.085, 0.2, 10), STEEL, g([0.3, 1.98, -0.12]), [-0.29, 0, 0], [1, 1, 1], metal);         // vamplate
  k.add(cone(0.04, 0.3, 4), STEEL, g([0.3, 4.88, -0.99]), [-0.29, 0, 0], [1, 1, 1], metal);
  k.add(SHAPES.pennant, T.main, g([0.3, 4.6, -0.87]), [0, Math.PI / 2, -0.29]);
  k.add(box(0.012, 0.07, 0.3), T.trim, g([0.3, 4.48, -0.98]), [-0.29, 0, 0]);
  return k.build();
}

// ---------- the war cart ----------
function wheelKit(r, spokes, rimColor = IRON) {
  const w = new Kit(31);
  w.add(new THREE.TorusGeometry(r, 0.055, 6, 22), WOOD_D, [0, 0, 0], [0, Math.PI / 2, 0], [1, 1, 1], { grain: 0.1 });
  w.add(new THREE.TorusGeometry(r + 0.04, 0.025, 4, 22), rimColor, [0, 0, 0], [0, Math.PI / 2, 0], [1, 1, 1], metal);
  w.add(cyl(0.11, 0.11, 0.22, 10), WOOD_D, [0, 0, 0], [0, 0, Math.PI / 2]).add(cyl(0.06, 0.06, 0.26, 8), IRON, [0, 0, 0], [0, 0, Math.PI / 2], [1, 1, 1], metal);
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI;
    w.add(box(0.045, r * 2, 0.05), WOOD, [0, 0, 0], [a, 0, 0]);
  }
  return w;
}

function makeCart(team) {
  const T = TEAMS[team], k = new Kit(41);
  // bed of planks on a frame, side rails with posts
  for (let i = 0; i < 6; i++) k.add(box(0.27, 0.07, 2.1), i % 2 ? WOOD : WOOD_L, [-0.68 + i * 0.272, 1.04, 0], [0, 0, 0], [1, 1, 1], { grain: 0.12 });
  k.add(box(1.7, 0.12, 0.12), WOOD_D, [0, 0.96, -1.0]).add(box(1.7, 0.12, 0.12), WOOD_D, [0, 0.96, 1.0]).add(box(0.12, 0.12, 2.1), WOOD_D, [0, 0.95, 0]);
  for (const s of [-1, 1]) {
    k.add(box(0.06, 0.08, 2.1), WOOD_D, [s * 0.83, 1.5, 0]);
    for (let i = 0; i < 6; i++) k.add(box(0.05, 0.42, 0.05), WOOD, [s * 0.83, 1.28, -0.98 + i * 0.39]);
    k.add(box(0.04, 0.32, 2.0), T.main, [s * 0.86, 1.28, 0], [0, 0, 0], [1, 1, 1], { grain: 0.04 });
    k.add(box(0.045, 0.05, 2.0), T.trim, [s * 0.865, 1.12, 0]);
    for (let i = 0; i < 4; i++) k.add(cyl(0.06, 0.06, 0.02, 10), GOLD, [s * 0.885, 1.3, -0.75 + i * 0.5], [0, 0, Math.PI / 2], [1, 1, 1], metal);
  }
  k.add(box(1.7, 0.42, 0.06), WOOD_D, [0, 1.28, -1.04]);
  // driver's bench and a chest of scrolls at the back
  k.add(box(1.3, 0.08, 0.36), WOOD_L, [0, 1.42, -0.78]).add(box(0.08, 0.3, 0.3), WOOD_D, [-0.55, 1.24, -0.78]).add(box(0.08, 0.3, 0.3), WOOD_D, [0.55, 1.24, -0.78]);
  k.add(box(0.7, 0.36, 0.42), '#5b2d1a', [0, 1.26, 0.8], [0, 0, 0], [1, 1, 1], { grain: 0.06 });
  k.add(box(0.72, 0.05, 0.44), GOLD, [0, 1.42, 0.8], [0, 0, 0], [1, 1, 1], metal).add(box(0.06, 0.37, 0.44), GOLD, [0, 1.26, 0.8], [0, 0, 0], [1, 1, 1], metal);
  for (let i = 0; i < 3; i++) k.add(cyl(0.05, 0.05, 0.42, 8), '#e8dcbc', [-0.15 + i * 0.12, 1.5, 0.82], [0, 0, Math.PI / 2 + 0.1 * i]);
  // canopy over the rear half only, so the advisor stands in the open: hoops, a cloth roof with
  // trimmed edges, a gilded ridge and tassels along the front edge
  const CY = 1.75, CR = 0.86, cz0 = 0.22, cz1 = 1.08;
  for (const z of [cz0, (cz0 + cz1) / 2, cz1]) k.add(new THREE.TorusGeometry(CR, 0.035, 5, 16, Math.PI), WOOD_D, [0, CY, z]);
  for (const s of [-1, 1]) seg(k, [s * CR, 1.08, cz0], [s * CR, CY, cz0], 0.035, 0.035, WOOD_D, {}, 5);
  k.add(new THREE.CylinderGeometry(CR + 0.04, CR + 0.04, cz1 - cz0, 18, 1, true, -Math.PI / 2, Math.PI), T.main, [0, CY, (cz0 + cz1) / 2], [-Math.PI / 2, 0, 0], [1, 1, 1], { grain: 0.05 });
  for (const z of [cz0 - 0.02, cz1 + 0.02]) k.add(new THREE.TorusGeometry(CR + 0.05, 0.04, 5, 18, Math.PI), T.trim, [0, CY, z]);
  k.add(cyl(0.035, 0.035, cz1 - cz0, 6), GOLD, [0, CY + CR + 0.05, (cz0 + cz1) / 2], [Math.PI / 2, 0, 0], [1, 1, 1], metal);
  for (let i = 0; i < 9; i++) { const a = (i / 8) * Math.PI; k.add(cone(0.035, 0.12, 5), GOLD, [Math.cos(a) * (CR + 0.06), CY + Math.sin(a) * (CR + 0.06) - 0.08, cz0 - 0.03], [Math.PI, 0, 0], [1, 1, 1], metal); }
  // a lantern hanging from the front hoop
  seg(k, [0.62, CY + 0.58, cz0 - 0.02], [0.62, CY + 0.36, cz0 - 0.04], 0.008, 0.008, IRON, metal, 3);
  k.add(box(0.12, 0.16, 0.12), '#ffd27a', [0.62, CY + 0.27, cz0 - 0.04]).add(box(0.15, 0.03, 0.15), IRON, [0.62, CY + 0.36, cz0 - 0.04], [0, 0, 0], [1, 1, 1], metal).add(box(0.15, 0.03, 0.15), IRON, [0.62, CY + 0.18, cz0 - 0.04], [0, 0, 0], [1, 1, 1], metal);
  // shafts to the horses and the yoke
  for (const s of [-1, 1]) seg(k, [s * 0.32, 1.05, -1.0], [s * 0.32, 1.35, -2.6], 0.045, 0.04, WOOD_D, {}, 6);
  seg(k, [-0.7, 1.4, -2.55], [0.7, 1.4, -2.55], 0.05, 0.05, WOOD_D, {}, 6);
  // the advisor: long robe, wide sleeves, white beard, mitre, crozier
  const ax = 0, az = -0.28;
  k.add(cyl(0.2, 0.36, 1.05, 14), T.dark, [ax, 1.6, az], [0, 0, 0], [1, 1, 0.85], { grain: 0.04 });
  for (const y of [1.12, 1.6]) k.add(cyl(0.36 - (y - 1.12) * 0.33, 0.365 - (y - 1.12) * 0.33, 0.05, 14), T.trim, [ax, y, az], [0, 0, 0], [1, 1, 0.85]);
  k.add(box(0.09, 1.0, 0.03), T.trim, [ax, 1.6, az - 0.27], [-0.08, 0, 0]);
  k.add(cyl(0.22, 0.2, 0.42, 14), '#e8e0cc', [ax, 2.28, az], [0, 0, 0], [1, 1, 0.78]);
  k.add(new THREE.CylinderGeometry(0.17, 0.27, 0.32, 14, 1, true), T.main, [ax, 2.45, az], [0, 0, 0], [1, 1, 0.85]);
  k.add(cyl(0.05, 0.06, 0.1, 7), SKINS[2], [ax, 2.6, az]);
  k.add(ball(0.105, 12, 9), SKINS[2], [ax, 2.72, az], [0, 0, 0], [0.92, 1.1, 1]);
  k.add(box(0.03, 0.05, 0.04), SKINS[2], [ax, 2.705, az - 0.105]);
  chain(k, [[ax, 2.66, az - 0.08], [ax, 2.5, az - 0.13], [ax, 2.33, az - 0.12]], 0.075, 0.025, '#eeeae2', {}, 8);
  k.add(SHAPES.mitre, '#f0e8d6', [ax, 2.78, az], [0, 0, 0], [1, 1, 1]);
  k.add(box(0.05, 0.42, 0.18), GOLD, [ax, 3.0, az], [0, 0, 0], [1, 1, 1], metal).add(box(0.3, 0.05, 0.18), GOLD, [ax, 2.82, az], [0, 0, 0], [1, 1, 1], metal);
  for (const s of [-1, 1]) {
    seg(k, [s * 0.2, 2.42, az], [s * 0.3, 2.2, az - 0.16], 0.07, 0.11, T.main, {}, 9);
    k.add(ball(0.045, 7, 6), SKINS[2], [s * 0.3, 2.16, az - 0.24]);
  }
  seg(k, [0.3, 1.2, az - 0.26], [0.3, 3.0, az - 0.26], 0.022, 0.022, GOLD, metal, 7);
  k.add(new THREE.TorusGeometry(0.11, 0.025, 6, 14, Math.PI * 1.4), GOLD, [0.3, 3.08, az - 0.34], [0, Math.PI / 2, 0], [1, 1, 1], metal);
  k.add(ball(0.06, 10, 8), '#7fd0ff', [0.3, 2.99, az - 0.26]);
  // the driver on the bench
  const drv = new Kit(43);
  SOLDIER_KINDS.crew(drv, T, 3);
  k.merge(drv, [0, 0.55, -0.78], [0, 0, 0], [1, 1, 1]);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(k.build(), material));
  const wheelGeo = wheelKit(0.72, 4).build();
  const wheels = [];
  for (const x of [-0.98, 0.98]) {
    const w = new THREE.Mesh(wheelGeo, material);
    w.position.set(x, 0.76, 0.15);
    group.add(w);
    wheels.push({ mesh: w, r: 0.72 });
  }
  return { group, wheels, orb: new THREE.Vector3(0.3, 2.99, az - 0.26) };     // the crozier's orb: where spells start
}

// ---------- the siege tower ----------
function makeTower(team) {
  const T = TEAMS[team], k = new Kit(53), W = 2.9, half = W / 2, top = 7.9;
  // chassis beams
  for (const s of [-1, 1]) k.add(box(0.3, 0.32, 3.6), WOOD_D, [s * 1.6, 0.68, 0], [0, 0, 0], [1, 1, 1], { grain: 0.1 });
  for (const z of [-1.5, 0, 1.5]) k.add(box(3.4, 0.26, 0.26), WOOD_D, [0, 0.72, z], [0, 0, 0], [1, 1, 1], { grain: 0.1 });
  // four walls of vertical planks with slight colour and height variation
  const planks = 9, pw = W / planks;
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < planks; i++) {
      const u = -half + pw * (i + 0.5), h = top - 0.85 + ((i * 37 + side * 11) % 5) * 0.04;
      const color = [WOOD, WOOD_L, '#5e3f22', '#7a5430'][(i + side) % 4];
      const pos = side === 0 ? [u, 0.85 + h / 2, -half] : side === 1 ? [u, 0.85 + h / 2, half] : side === 2 ? [-half, 0.85 + h / 2, u] : [half, 0.85 + h / 2, u];
      k.add(box(side < 2 ? pw * 0.96 : 0.08, h, side < 2 ? 0.08 : pw * 0.96), color, pos, [0, 0, 0], [1, 1, 1], { grain: 0.14 });
    }
  }
  // floor beams that stick out, corner posts, diagonal braces on the sides
  for (const y of [2.9, 5.1, top - 0.1]) {
    for (const s of [-1, 1]) {
      k.add(box(W + 0.5, 0.2, 0.2), WOOD_D, [0, y, s * (half + 0.06)], [0, 0, 0], [1, 1, 1], { grain: 0.1 });
      k.add(box(0.2, 0.2, W + 0.5), WOOD_D, [s * (half + 0.06), y, 0], [0, 0, 0], [1, 1, 1], { grain: 0.1 });
    }
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.add(box(0.24, top - 0.6, 0.24), WOOD_D, [x * (half + 0.02), 0.85 + (top - 0.6) / 2, z * (half + 0.02)], [0, 0, 0], [1, 1, 1], { grain: 0.1 });
  for (const s of [-1, 1]) {
    for (const [y0, y1] of [[1.0, 2.9], [2.9, 5.1], [5.1, top - 0.1]]) {
      seg(k, [s * (half + 0.1), y0, -half], [s * (half + 0.1), y1, half], 0.06, 0.06, WOOD_D, {}, 4);
    }
  }
  // wet hides draped over the front against fire arrows, and the team's war banner
  const hides = ['#8a6d4f', '#7b5e43', '#9a7b58', '#6e523a'];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      k.add(box(0.78, 1.5, 0.05), hides[(i + j) % 4], [-1.07 + i * 0.71, 1.6 + j * 1.55 + (i % 2) * 0.1, -half - 0.08 - (j % 2) * 0.02], [((i + j) % 3 - 1) * 0.03, 0, ((i * j) % 3 - 1) * 0.03], [1, 1, 1], { grain: 0.15 });
    }
  }
  k.add(box(1.1, 2.6, 0.04), T.main, [0, 3.5, -half - 0.14], [0, 0, 0], [1, 1, 1], { grain: 0.04 });
  k.add(box(1.14, 0.12, 0.05), T.trim, [0, 2.2, -half - 0.15]).add(box(1.14, 0.12, 0.05), T.trim, [0, 4.8, -half - 0.15]);
  k.add(cyl(0.3, 0.3, 0.03, 14), T.trim, [0, 3.5, -half - 0.17], [Math.PI / 2, 0, 0]);
  // arrow slits on the sides
  for (const s of [-1, 1]) for (const y of [3.9, 6.1]) for (const z of [-0.6, 0.6]) k.add(box(0.04, 0.42, 0.09), '#120c08', [s * (half + 0.05), y, z]);
  // fighting deck with a plank parapet and raised drawbridge
  k.add(box(W + 0.7, 0.18, W + 0.7), WOOD_D, [0, top, 0], [0, 0, 0], [1, 1, 1], { grain: 0.12 });
  const P = half + 0.3;
  for (let i = 0; i < 7; i++) {
    const u = -P + 0.1 + i * ((2 * P - 0.2) / 6), tall = i % 2 ? 0.75 : 0.5;
    k.add(box(0.36, tall, 0.08), i % 2 ? WOOD : WOOD_L, [u, top + 0.1 + tall / 2, P], [0, 0, 0], [1, 1, 1], { grain: 0.12 });
    k.add(box(0.08, tall, 0.36), i % 2 ? WOOD : WOOD_L, [-P, top + 0.1 + tall / 2, u], [0, 0, 0], [1, 1, 1], { grain: 0.12 });
    k.add(box(0.08, tall, 0.36), i % 2 ? WOOD_L : WOOD, [P, top + 0.1 + tall / 2, u], [0, 0, 0], [1, 1, 1], { grain: 0.12 });
  }
  for (let i = 0; i < 6; i++) k.add(box(0.36, 2.2, 0.07), i % 2 ? WOOD : WOOD_L, [-0.9 + i * 0.36, top - 0.95, -half - 0.32], [0.12, 0, 0], [1, 1, 1], { grain: 0.12 });
  k.add(box(2.2, 0.12, 0.12), WOOD_D, [0, top - 0.2, -half - 0.24], [0.12, 0, 0]);
  for (const s of [-1, 1]) seg(k, [s * 0.95, top + 0.75, -half + 0.1], [s * 0.95, top - 1.9, -half - 0.4], 0.02, 0.02, IRON, metal, 4);
  // ladder up the back and the push poles for the crew
  for (const s of [-1, 1]) seg(k, [s * 0.3, 0.9, half + 0.15], [s * 0.3, top, half + 0.15], 0.04, 0.04, WOOD_D, {}, 5);
  for (let y = 1.2; y < top; y += 0.42) k.add(box(0.62, 0.05, 0.05), WOOD, [0, y, half + 0.15]);
  for (const s of [-1.3, 0, 1.3]) seg(k, [s, 1.15, half], [s, 1.15, half + 2.0], 0.06, 0.06, WOOD_D, {}, 6);
  k.add(box(3.0, 0.1, 0.1), WOOD_D, [0, 1.15, half + 0.82]).add(box(3.0, 0.1, 0.1), WOOD_D, [0, 1.15, half + 1.88]);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(k.build(), material));
  const wk = new Kit(61);
  wk.add(cyl(0.62, 0.62, 0.28, 18), WOOD_D, [0, 0, 0], [0, 0, Math.PI / 2], [1, 1, 1], { grain: 0.12 });
  wk.add(new THREE.TorusGeometry(0.62, 0.04, 4, 18), IRON, [0, 0, 0], [0, Math.PI / 2, 0], [1, 1, 1], metal);
  for (const s of [-1, 1]) wk.add(box(0.06, 1.1, 0.14), WOOD, [s * 0.15, 0, 0]).add(box(0.06, 0.14, 1.1), WOOD, [s * 0.15, 0, 0]).add(cyl(0.1, 0.1, 0.06, 8), IRON, [s * 0.16, 0, 0], [0, 0, Math.PI / 2], [1, 1, 1], metal);
  const wheelGeo = wk.build();
  const wheels = [];
  for (const [x, z] of [[-1.82, -1.15], [1.82, -1.15], [-1.82, 1.15], [1.82, 1.15]]) {
    const w = new THREE.Mesh(wheelGeo, material);
    w.position.set(x, 0.62, z);
    group.add(w);
    wheels.push({ mesh: w, r: 0.62 });
  }
  return { group, wheels };
}

// ---------- the war elephant ----------
function makeElephant(team) {
  const T = TEAMS[team], k = new Kit(71), hide = '#7b726b', dark = '#5f5751', pink = '#9c8076';
  // body, shoulders, rump, head
  k.add(ball(1, 20, 14), hide, [0, 2.85, 0.1], [0, 0, 0], [1.2, 1.12, 1.72], { grain: 0.03 });
  k.add(ball(1, 16, 12), hide, [0, 3.0, -0.75], [0, 0, 0], [1.1, 1.1, 0.9], { grain: 0.03 });
  k.add(ball(1, 16, 12), hide, [0, 2.75, 0.95], [0, 0, 0], [1.08, 1.05, 0.9], { grain: 0.03 });
  k.add(ball(0.82, 16, 12), hide, [0, 3.35, -1.82], [0, 0, 0], [0.95, 1.05, 0.95], { grain: 0.03 });
  k.add(ball(0.42, 12, 9), hide, [-0.3, 3.85, -1.85]).add(ball(0.42, 12, 9), hide, [0.3, 3.85, -1.85]);
  // ears: thin, wide and drooping
  for (const s of [-1, 1]) {
    k.add(ball(1, 14, 10), dark, [s * 0.86, 3.25, -1.48], [0, s * 0.45, s * 0.1], [0.08, 0.72, 0.62], { grain: 0.05 });
    k.add(ball(1, 12, 8), pink, [s * 0.83, 3.25, -1.5], [0, s * 0.45, s * 0.1], [0.06, 0.6, 0.5]);
  }
  // trunk curling forward at the tip, tusks with gold caps, eyes and mouth
  chain(k, curve([0, 3.05, -2.42], [[0.35, 0.55], [0.35, 0.3], [0.32, 0.12], [0.3, 0.05], [0.26, 0.2], [0.22, 0.6], [0.18, 1.2]]), 0.3, 0.09, hide, { grain: 0.04 }, 10);
  for (const s of [-1, 1]) {
    const tusk = curve([s * 0.34, 2.72, -2.25], [[0.3, 0.9], [0.3, 1.3], [0.25, 1.75], [0.18, 2.2]]);
    tusk.forEach(p => { p[0] = s * (0.34 + (p[2] + 2.25) * -0.1); });
    chain(k, tusk, 0.085, 0.025, IVORY, {}, 8);
    k.add(cyl(0.095, 0.095, 0.1, 10), GOLD, tusk[1], [0.9, 0, 0], [1, 1, 1], metal);
    k.add(ball(0.06, 8, 6), '#15100c', [s * 0.62, 3.42, -2.22]);
    k.add(ball(0.09, 8, 6), dark, [s * 0.62, 3.47, -2.2], [0, 0, 0], [1, 0.35, 1]);
  }
  k.add(ball(0.2, 10, 8), pink, [0, 2.6, -2.2], [0, 0, 0], [1, 0.45, 0.8]);
  // tail: hangs from the top of the rump, down and a little back, ending in a dark tuft
  const tail = curve([0, 3.35, 1.7], [[0.3, -0.45], [0.35, -0.2], [0.35, -0.08], [0.3, 0]]);
  chain(k, tail, 0.075, 0.04, dark, {}, 7);
  const tip = tail[tail.length - 1];
  k.add(cone(0.08, 0.28, 7), '#2a2420', [tip[0], tip[1] - 0.1, tip[2]], [Math.PI, 0, 0]);
  // armour: a team head plate with gold studs
  k.add(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), T.main, [0, 3.45, -2.05], [-1.1, 0, 0], [0.62, 0.42, 0.62], { grain: 0.04 });
  for (let i = 0; i < 5; i++) k.add(ball(0.05, 6, 5), GOLD, [-0.36 + i * 0.18, 3.78, -2.42 + Math.abs(i - 2) * 0.06], [0, 0, 0], [1, 1, 1], metal);
  k.add(cone(0.1, 0.4, 6), GOLD, [0, 4.05, -2.2], [-0.5, 0, 0], [1, 1, 1], metal);
  // war blanket: side panels with gold borders, roundels and tassels; a pad on the back
  k.add(box(1.9, 0.2, 2.5), T.dark, [0, 3.92, 0.1], [0, 0, 0], [1, 1, 1], { grain: 0.04 });
  for (const s of [-1, 1]) {
    k.add(box(0.06, 1.35, 2.55), T.main, [s * 1.2, 3.25, 0.1], [0, 0, s * 0.12], [1, 1, 1], { grain: 0.04 });
    k.add(box(0.07, 0.12, 2.6), GOLD, [s * 1.29, 2.6, 0.1], [0, 0, s * 0.12], [1, 1, 1], metal);
    k.add(box(0.07, 0.12, 2.6), GOLD, [s * 1.14, 3.86, 0.1], [0, 0, s * 0.12], [1, 1, 1], metal);
    k.add(cyl(0.38, 0.38, 0.03, 18), T.trim, [s * 1.26, 3.2, 0.1], [0, 0, Math.PI / 2 + s * 0.12]);
    k.add(cyl(0.24, 0.24, 0.035, 18), T.main, [s * 1.27, 3.2, 0.1], [0, 0, Math.PI / 2 + s * 0.12]);
    for (let i = 0; i < 9; i++) k.add(cone(0.05, 0.22, 6), GOLD, [s * 1.31, 2.42, -1.05 + i * 0.29], [Math.PI, 0, 0], [1, 1, 1], metal);
    seg(k, [s * 1.25, 2.4, 0.4], [s * 1.0, 1.85, 0.4], 0.04, 0.04, LEATHER, {}, 4);
  }
  // howdah: a little wooden fort with gold trim and a pointed canopy
  k.add(box(1.75, 0.2, 1.75), WOOD_D, [0, 4.12, 0.15]);
  for (const s of [-1, 1]) {
    k.add(box(1.75, 0.55, 0.1), WOOD, [0, 4.47, 0.15 + s * 0.83], [0, 0, 0], [1, 1, 1], { grain: 0.12 });
    k.add(box(0.1, 0.55, 1.75), WOOD, [s * 0.83, 4.47, 0.15], [0, 0, 0], [1, 1, 1], { grain: 0.12 });
    k.add(box(1.85, 0.07, 0.14), GOLD, [0, 4.76, 0.15 + s * 0.84], [0, 0, 0], [1, 1, 1], metal);
    k.add(box(0.14, 0.07, 1.85), GOLD, [s * 0.84, 4.76, 0.15], [0, 0, 0], [1, 1, 1], metal);
    for (let i = 0; i < 3; i++) {
      k.add(box(0.2, 0.18, 0.1), WOOD_L, [-0.6 + i * 0.6, 4.88, 0.15 + s * 0.83]);
      k.add(box(0.1, 0.18, 0.2), WOOD_L, [s * 0.83, 4.88, -0.45 + i * 0.6]);
    }
  }
  for (const [x, z] of [[-0.8, -0.65], [0.8, -0.65], [-0.8, 0.95], [0.8, 0.95]]) {
    seg(k, [x, 4.2, z], [x, 6.15, z], 0.04, 0.035, GOLD, metal, 7);
    k.add(ball(0.06, 7, 6), GOLD, [x, 6.17, z], [0, 0, 0], [1, 1, 1], metal);
  }
  k.add(new THREE.ConeGeometry(1.38, 1.0, 4, 1, true), T.main, [0, 6.65, 0.15], [0, Math.PI / 4, 0], [1, 1, 1], { grain: 0.04 });
  k.add(cone(0.55, 0.55, 4), T.trim, [0, 7.1, 0.15], [0, Math.PI / 4, 0]);
  k.add(cyl(0.02, 0.02, 0.4, 5), GOLD, [0, 7.5, 0.15], [0, 0, 0], [1, 1, 1], metal).add(ball(0.09, 8, 6), GOLD, [0, 7.72, 0.15], [0, 0, 0], [1, 1, 1], metal);
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2; k.add(cone(0.05, 0.25, 5), GOLD, [Math.sin(a) * 1.3, 6.03, 0.15 + Math.cos(a) * 1.3], [Math.PI, 0, 0], [1, 1, 1], metal); }
  // the Queen, standing at the front of the howdah: a full gown with a gold forepart and hem, a
  // fitted bodice, puffed sleeves, hands folded over an orb, long hair, a tall crown, a cape
  {
    const F = 4.22, z0 = -0.08, QSKIN = '#e6c0a2', QHAIR = '#6b2e1a';
    k.add(cyl(0.2, 0.44, 0.95, 18), T.main, [0, F + 0.475, z0], [0, 0, 0], [1, 1, 0.9], { grain: 0.04 });
    k.add(cyl(0.445, 0.452, 0.06, 18), GOLD, [0, F + 0.03, z0], [0, 0, 0], [1, 1, 0.9], metal);
    k.add(box(0.16, 0.9, 0.02), T.trim, [0, F + 0.47, z0 - 0.29], [-0.24, 0, 0]);
    k.add(new THREE.CylinderGeometry(0.21, 0.52, 1.28, 16, 1, true, -Math.PI / 2, Math.PI), T.dark, [0, F + 0.66, z0 + 0.04], [0.06, 0, 0], [1, 1, 0.85], { grain: 0.04 });
    k.add(cyl(0.19, 0.16, 0.36, 14), T.main, [0, F + 1.12, z0], [0, 0, 0], [1, 1, 0.78]);
    k.add(box(0.12, 0.3, 0.02), GOLD, [0, F + 1.1, z0 - 0.15], [0.08, 0, 0], [1, 1, 1], metal);
    k.add(cyl(0.165, 0.165, 0.04, 14), GOLD, [0, F + 0.95, z0], [0, 0, 0], [1, 1, 0.8], metal);
    for (const s of [-1, 1]) {
      k.add(ball(0.09, 10, 8), T.trim, [s * 0.2, F + 1.24, z0], [0, 0, 0], [1, 0.9, 1]);
      seg(k, [s * 0.22, F + 1.2, z0], [s * 0.2, F + 0.98, z0 - 0.1], 0.06, 0.05, T.main, {}, 8);
      seg(k, [s * 0.2, F + 0.98, z0 - 0.1], [s * 0.05, F + 0.98, z0 - 0.24], 0.05, 0.04, T.main, {}, 8);
      k.add(ball(0.04, 7, 6), QSKIN, [s * 0.05, F + 0.98, z0 - 0.25]);
    }
    k.add(ball(0.07, 10, 8), GOLD, [0, F + 1.03, z0 - 0.28], [0, 0, 0], [1, 1, 1], metal).add(box(0.02, 0.07, 0.02), GOLD, [0, F + 1.12, z0 - 0.28], [0, 0, 0], [1, 1, 1], metal);
    k.add(cyl(0.045, 0.055, 0.12, 8), QSKIN, [0, F + 1.33, z0]);
    k.add(new THREE.TorusGeometry(0.07, 0.012, 5, 14), GOLD, [0, F + 1.3, z0 - 0.01], [Math.PI / 2 - 0.3, 0, 0], [1, 1, 1], metal);
    k.add(ball(0.1, 14, 10), QSKIN, [0, F + 1.47, z0], [0, 0, 0], [0.9, 1.12, 1]);
    k.add(box(0.026, 0.04, 0.035), QSKIN, [0, F + 1.46, z0 - 0.1]);
    k.add(box(0.04, 0.012, 0.015), '#a83a3a', [0, F + 1.415, z0 - 0.092]);
    for (const s of [-1, 1]) k.add(ball(0.013, 6, 5), '#1c120c', [s * 0.035, F + 1.495, z0 - 0.088]);
    k.add(ball(0.108, 12, 8), QHAIR, [0, F + 1.5, z0 + 0.02], [0, 0, 0], [0.98, 1, 1.02]);
    seg(k, [0, F + 1.48, z0 + 0.07], [0, F + 1.0, z0 + 0.14], 0.1, 0.07, QHAIR, {}, 10);
    k.add(cyl(0.1, 0.095, 0.08, 14), GOLD, [0, F + 1.6, z0 + 0.01], [0, 0, 0], [1, 1, 1], metal);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      k.add(cone(0.028, 0.14, 4), GOLD, [Math.sin(a) * 0.095, 1.71 + F - 0.0, z0 + 0.01 + Math.cos(a) * 0.095], [0, 0, 0], [1, 1, 1], metal);
      k.add(ball(0.016, 6, 5), i % 2 ? '#2b6fd6' : '#d0242a', [Math.sin(a) * 0.1, F + 1.6, z0 + 0.01 + Math.cos(a) * 0.1]);
    }
    k.add(ball(0.03, 8, 6), GOLD, [0, F + 1.81, z0 + 0.01], [0, 0, 0], [1, 1, 1], metal);
  }
  // the mahout on the neck: turban, bare arms, goad
  const mh = new Kit(73);
  body(mh, { T, skin: SKINS[3], coat: LINEN, skirt: T.main, hose: LINEN, hands: [[-0.15, 1.15, -0.35], [0.18, 1.2, -0.38]], elbows: [[-0.26, 1.18, -0.1], [0.27, 1.18, -0.12]], sleeve: SKINS[3], beard: HAIR[2] });
  helmet(mh, 'turban', T);
  seg(mh, [0.18, 0.9, -0.3], [0.18, 1.7, -0.5], 0.015, 0.015, WOOD, {}, 5);
  mh.parts = mh.parts.filter(p => !p.limb);                                 // he sits: no legs below the skirt
  k.merge(mh, [0, 3.22, -1.3], [0.05, 0, 0]);
  for (const s of [-1, 1]) {
    seg(k, [s * 0.14, 4.12, -1.3], [s * 0.5, 3.95, -1.6], 0.075, 0.065, LINEN, {}, 7);
    seg(k, [s * 0.5, 3.95, -1.6], [s * 0.6, 3.55, -1.55], 0.06, 0.05, SKINS[3], {}, 7);
  }
  const group = new THREE.Group();
  group.add(new THREE.Mesh(k.build(), material));
  const lk = new Kit(79);
  lk.add(cyl(0.4, 0.36, 1.95, 14), hide, [0, -0.98, 0], [0, 0, 0], [1, 1, 1], { grain: 0.03 });
  lk.add(ball(0.4, 12, 8), hide, [0, 0, 0]);
  for (let y = -0.35; y > -1.8; y -= 0.35) lk.add(new THREE.TorusGeometry(0.385 - (y + 0.35) * -0.02, 0.012, 4, 14), dark, [0, y, 0], [Math.PI / 2, 0, 0]);
  lk.add(cyl(0.4, 0.43, 0.2, 14), dark, [0, -2.03, 0]);
  for (let i = 0; i < 3; i++) lk.add(ball(0.08, 8, 6), IVORY, [-0.18 + i * 0.18, -2.04, -0.39], [0, 0, 0], [1, 0.8, 0.6]);
  lk.add(cyl(0.42, 0.42, 0.12, 14), GOLD, [0, -1.72, 0], [0, 0, 0], [1, 1, 1], metal);
  const legG = lk.build();
  const legs = [];
  for (const [x, z] of [[-0.72, -1.0], [0.72, -1.0], [-0.72, 1.15], [0.72, 1.15]]) {
    const leg = new THREE.Mesh(legG, material);
    leg.position.set(x, 2.15, z);
    group.add(leg);
    legs.push(leg);
  }
  return { group, legs, gait: 4.5, swing: 0.28 };
}

// ---------- banners ----------
const flagTex = new Map();
function flagTexture(team, type) {
  const key = team + type;
  if (flagTex.has(key)) return flagTex.get(key);
  const T = TEAMS[team], c = document.createElement('canvas');
  c.width = 256; c.height = 176;
  const g = c.getContext('2d');
  g.fillStyle = T.flag; g.fillRect(0, 0, 256, 176);
  g.fillStyle = T.dark; g.fillRect(0, 0, 256, 22); g.fillRect(0, 154, 256, 22);
  g.strokeStyle = T.trim; g.lineWidth = 8; g.strokeRect(10, 10, 236, 156);
  g.fillStyle = T.glyph; g.font = '128px "Segoe UI Symbol", "Apple Symbols", "DejaVu Sans", serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(UNIT_INFO[type].glyph + '︎', 128, 96);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  flagTex.set(key, tex);
  return tex;
}

function makeBanner(team, type, height, size) {
  const T = TEAMS[team], group = new THREE.Group();
  const pk = new Kit(83);
  seg(pk, [0, 0, 0], [0, height, 0], 0.05, 0.04, WOOD, { grain: 0.08 }, 7);
  pk.add(cyl(0.035, 0.035, 2.05 * size, 6), WOOD_D, [1.0 * size, height - 0.06, 0], [0, 0, Math.PI / 2]);
  pk.add(cone(0.09, 0.32, 8), T.trim, [0, height + 0.18, 0], [0, 0, 0], [1, 1, 1], metal).add(ball(0.07, 8, 6), T.trim, [0, height + 0.02, 0], [0, 0, 0], [1, 1, 1], metal);
  for (const s of [0.15, 2.0 * size - 0.1]) pk.add(cone(0.035, 0.14, 6), T.trim, [s, height - 0.2, 0], [Math.PI, 0, 0]);
  group.add(new THREE.Mesh(pk.build(), material));
  const w = 2.0 * size, h = 1.37 * size;
  const geo = new THREE.PlaneGeometry(w, h, 12, 5).translate(w / 2, 0, 0);
  const flag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: flagTexture(team, type), side: THREE.DoubleSide, roughness: 0.95 }));
  flag.position.set(0.05, height - h / 2 - 0.1, 0);
  group.add(flag);
  return { group, flag, base: geo.attributes.position.array.slice(), w };
}

// ---------- unit layouts ----------
const jitter = (rand, a) => (rand() * 2 - 1) * a;

/** Where everything stands, in the unit's local frame (front is -z).
    foot:   { kind, x, z, y0 (standing height above the ground), lean, bearer, mount }
            — `mount` is a body index: that soldier rides the vehicle (archers on the tower deck
              or in the howdah), so he moves, tilts and falls with it instead of walking
    bodies: { make, x, z, rider }
    banner: { bearer: true, height, size }          — carried by the foot soldier marked `bearer`
         or { mount: body index, at: [x, y, z], height, size } — fixed on a vehicle */
function layout(type, rand) {
  const foot = [], bodies = [];
  const man = (kind, x, z, y0 = 0, lean = 0, mount) => foot.push({ kind, x, z, y0, lean, mount });
  const bearer = (x, z) => foot.push({ kind: 'bearer', x, z, y0: 0, lean: 0, bearer: true });
  let banner = { bearer: true, height: 4.6, size: 0.85 };
  // eye: where the first-person camera sits — a foot soldier (index into foot) or a point on a body
  let eye = null;
  switch (type) {
    case 'p':
      for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++)
        man('spear', -1.65 + col * 1.1 + jitter(rand, 0.08), -1.3 + row * 1.3 + jitter(rand, 0.1));
      eye = { soldier: 1 };                                                      // front row, middle
      bearer(2.45, -1.3);
      break;
    case 'n':
      // three knights in a wedge, five men-at-arms behind them (one carries the banner)
      bodies.push({ make: t => makeHorse(HORSE_COATS.black, t, { barding: true, rider: true }), x: 0, z: -2.1, rider: 'knight' });
      bodies.push({ make: t => makeHorse(HORSE_COATS.bay, t, { barding: true, rider: true }), x: -1.6, z: -0.7, rider: 'knight' });
      bodies.push({ make: t => makeHorse(HORSE_COATS.grey, t, { barding: true, rider: true, mane: '#d8d2c8' }), x: 1.6, z: -0.7, rider: 'knight' });
      for (const [x, z] of [[-1.3, 1.5], [0, 1.65], [1.3, 1.5], [-0.7, 2.85]]) man('sword', x + jitter(rand, 0.08), z + jitter(rand, 0.08));
      bearer(0.75, 2.85);
      break;
    case 'b':
      bodies.push({ make: t => makeHorse(HORSE_COATS.bay, t, { harness: true, saddle: false, socks: true }), x: -0.48, z: -2.3 });
      bodies.push({ make: t => makeHorse(HORSE_COATS.grey, t, { harness: true, saddle: false, mane: '#e8e2d8' }), x: 0.48, z: -2.3 });
      bodies.push({ make: t => makeCart(t), x: 0, z: 0.75 });
      man('spear', -1.9, 0.2); man('spear', -1.9, 1.8); man('spear', 1.9, 1.8);
      bearer(1.9, 0.2);
      break;
    case 'r':
      bodies.push({ make: t => makeTower(t), x: 0, z: -0.9 });
      for (const [x, z] of [[-1.3, 1.45], [0, 1.45], [1.3, 1.45], [-1.3, 2.5], [0, 2.5], [1.3, 2.5]]) man('crew', x + jitter(rand, 0.06), z, 0, -0.22);
      man('archer', -0.6, -1.5, 8.0, 0, 0); man('archer', 0.6, -0.7, 8.0, 0, 0);
      eye = { soldier: foot.length - 2 };                                        // the front archer on the deck
      banner = { mount: 0, at: [1.2, 7.99, 1.2], height: 3.2, size: 0.95 };            // a back corner of the deck
      break;
    case 'q':
      bodies.push({ make: t => makeElephant(t), x: 0, z: -0.4 });
      man('archer', -0.52, 0.25, 4.22, 0, 0); man('archer', 0.52, 0.25, 4.22, 0, 0);
      for (const [x, z] of [[-2.4, -1.2], [2.4, -1.2], [-2.4, 1.6], [2.4, 1.6]]) man('spear', x, z);
      banner = { mount: 0, at: [0, 7.75, 0.15], height: 2.3, size: 0.9 };              // from the canopy's peak
      break;
    case 'k':
      bodies.push({ make: t => makeHorse(HORSE_COATS.white, t, { barding: true, rider: true, mane: '#f2eee6' }), x: 0, z: -0.3, rider: 'king' });
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + 0.35, x = Math.sin(a) * 2.75, z = Math.cos(a) * 2.75;
        if (i === 3) bearer(x, z); else man('halberd', x, z);
      }
      banner = { bearer: true, height: 5.0, size: 1.0 };
      break;
  }
  // the lead knight, the advisor on his cart, the queen in the howdah, the king in the saddle
  eye ||= { n: { body: 0, at: [0, 2.715, -0.17] }, b: { body: 2, at: [0, 2.74, -0.4] },
            q: { body: 0, at: [0, 5.72, -0.19] }, k: { body: 0, at: [0, 2.67, -0.12] } }[type];
  return { foot, bodies, banner, eye };
}

// ---------- the unit ----------
const _mat = new THREE.Matrix4(), _quat = new THREE.Quaternion(), _eul = new THREE.Euler(), _pos = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
const _tint = new THREE.Color();
const _none = new THREE.Vector3(0, 0, 0);
const HAND = { x: 0.25, y: 0.35, z: -0.2 };           // where a bearer holds the foot of his pole

export class Unit {
  constructor(type, color, seed = 1) {
    this.type = type;
    this.color = color;
    this.info = UNIT_INFO[type];
    this.group = new THREE.Group();
    this.yaw = color === 'w' ? 0 : Math.PI;
    this.walking = 0;          // 0..1 blend toward the walk cycle (set by whoever moves the unit)
    this.speed = 0;            // m/s, drives wheels
    this.attack = false;       // fighting: soldiers strike, horses rear, lances drop
    this.attacking = 0;        // eased 0..1 toward `attack`
    this.hideEye = false;      // set while the camera looks through this unit's eye soldier
    this.dead = false;
    this.deathT = -1;
    this.gone = false;
    let s = seed;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const { foot, bodies, banner, eye } = layout(type, rand);

    this.bodies = bodies.map(b => {
      const made = b.make(color);
      made.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
      if (b.rider) {
        const geos = riderGeo(color, b.rider);
        const rider = new THREE.Mesh(geos.body, material);
        rider.castShadow = true;
        made.group.children[0].add(rider);                              // rides the body's bob
        if (geos.lance) {
          made.lance = new THREE.Mesh(geos.lance, material);
          made.lance.position.set(...LANCE_GRIP);
          made.lance.castShadow = true;
          rider.add(made.lance);
        }
      }
      this.group.add(made.group);
      return { ...made, x: b.x, z: b.z, phase: rand() * 6.28, delay: rand() * 0.5 };
    });

    // foot soldiers, one InstancedMesh per kind, look variant and mount
    const groups = {};
    foot.forEach((f, index) => {
      const variant = Math.floor(rand() * 4);
      const sol = { ...f, index, ry: f.bearer ? 0 : jitter(rand, 0.12), phase: rand() * 6.28, delay: rand() * 0.9, shade: 0.9 + rand() * 0.14, shot: rand() };
      if (f.bearer) this.bearer = sol;
      (groups[`${f.kind}:${variant}:${f.mount ?? ''}`] ||= { kind: f.kind, variant, mount: f.mount, list: [] }).list.push(sol);
    });
    this.formations = Object.values(groups).map(({ kind, variant, mount, list }) => {
      const base = soldierGeo(color, kind, variant);
      const geo = new THREE.BufferGeometry();                          // shares the cached attributes
      for (const name in base.attributes) geo.setAttribute(name, base.attributes[name]);
      geo.boundingSphere = base.boundingSphere;
      const anim = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
      list.forEach((sol, i) => anim.setXYZ(i, sol.phase, 0, 0));
      geo.setAttribute('aAnim', anim);
      const mesh = new THREE.InstancedMesh(geo, material, list.length);
      list.forEach((sol, i) => mesh.setColorAt(i, _tint.setScalar(sol.shade)));
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      (mount === undefined ? this.group : this.bodies[mount].group).add(mesh);
      return { mesh, list, anim, geo };
    });

    // combat effects: archers loose arrows, the Bishop casts from his crozier's orb
    if (foot.some(f => f.kind === 'archer')) this.arrows = new Arrows(this.group, (x, z) => this.groundAt(x, z));
    const cart = this.bodies.find(b => b.orb);
    if (cart) this.spell = new Spell(cart.group, cart.orb, color === 'w' ? '#ffb347' : '#8fdcff');

    this.banner = makeBanner(color, type, banner.height, banner.size);
    this.banner.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
    if (banner.mount !== undefined) {
      this.banner.group.position.set(...banner.at);
      this.bodies[banner.mount].group.add(this.banner.group);            // moves and falls with the vehicle
    } else {
      this.group.add(this.banner.group);
    }
    this.flagPhase = rand() * 6.28;
    addOutlines(this.group);

    // the eye anchor that a first-person camera reads; a soldier's eye is moved with him each frame
    this.eye = new THREE.Object3D();
    if (eye.soldier !== undefined) {
      this.eyeSoldier = this.formations.flatMap(f => f.list).find(s => s.index === eye.soldier);
      (this.eyeSoldier.mount === undefined ? this.group : this.bodies[this.eyeSoldier.mount].group).add(this.eye);
    } else {
      const b = this.bodies[eye.body];
      (b.legs ? b.group.children[0] : b.group).add(this.eye);       // riders bob with their mount
      this.eye.position.set(...eye.at);
    }
  }

  get x() { return this.group.position.x; }
  get z() { return this.group.position.z; }

  place(x, z, yaw = this.yaw) { this.group.position.set(x, 0, z); this.yaw = yaw; }

  /** Ground height under a point given in this unit's local (unrotated) frame. */
  groundAt(lx, lz) {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return H(this.x + lx * c + lz * s, this.z - lx * s + lz * c);
  }

  kill() { if (!this.dead) { this.dead = true; this.deathT = 0; } }

  update(dt, t) {
    unitClock.value = t;
    this.group.rotation.y = this.yaw;
    this.attacking += ((this.attack && !this.dead ? 1 : 0) - this.attacking) * Math.min(1, dt * 5);
    const walk = this.walking, att = this.attacking;
    const dying = this.dead ? this.deathT : -1;
    if (this.dead) {
      this.deathT += dt;
      if (this.deathT > 2.6) this.group.position.y -= dt * 0.9;
      if (this.deathT > 4.2) this.gone = true;
    }
    const fallOf = delay => (dying < 0 ? 0 : Math.min(1, Math.max(0, (dying - delay) / 0.45)) ** 2);
    // per soldier: stride bob, attack lunge, the fall backwards when killed
    const pose = s => {
      const fall = fallOf(s.delay);
      if (s.mount !== undefined) {
        // a passenger: no stride, no lunge; stands on the deck in the vehicle's own frame, so the
        // vehicle carries him when it rolls, rears or topples, and he falls where he stands
        const b = this.bodies[s.mount];
        return { fall, fights: att, stride: 0, x: s.x - b.x, y: s.y0 + Math.sin(t * 1.4 + s.phase) * 0.008 - fall * 0.1, z: s.z - b.z, tilt: fall * 1.5 };
      }
      const bob = walk * Math.abs(Math.sin(t * 8.5 + s.phase)) * 0.06 + (1 - walk) * Math.sin(t * 1.4 + s.phase) * 0.01;
      const fights = s.bearer || s.kind === 'crew' ? 0 : att;
      const lunge = s.kind === 'archer' ? 0 : fights * (0.5 + 0.5 * Math.sin(t * 7 + s.phase * 1.7)) * 0.22;
      const y = (s.y0 ? H(this.x, this.z) + s.y0 : this.groundAt(s.x, s.z)) + bob * (1 - fall) - fall * 0.15;
      return { fall, fights, stride: walk, x: s.x, y, z: s.z - lunge * (1 - fall), tilt: fall * 1.5 + (s.lean - fights * 0.12) * (1 - fall) };
    };

    for (const { mesh, list, anim } of this.formations) {
      list.forEach((s, i) => {
        const p = pose(s);
        if (s === this.eyeSoldier) this.eye.position.set(p.x, p.y + 1.64 * Math.cos(p.tilt), p.z - 0.12 + 1.64 * Math.sin(p.tilt));
        _eul.set(p.tilt, s.ry + Math.sin(t * 0.6 + s.phase) * 0.04 * (1 - p.stride), p.stride * Math.sin(t * 8.5 + s.phase) * 0.04);
        _mat.compose(_pos.set(p.x, p.y, p.z), _quat.setFromEuler(_eul), s === this.eyeSoldier && this.hideEye ? _none : _one);         // the camera is inside him
        mesh.setMatrixAt(i, _mat);
        anim.setY(i, p.stride * (1 - p.fall));
        anim.setZ(i, p.fights * (1 - p.fall));
        // archers loose an arrow each time the bow comes up, while fighting
        if (s.kind === 'archer' && this.arrows && att > 0.6 && p.fall === 0) {
          s.shot -= dt;
          if (s.shot <= 0) {
            s.shot = 0.9 + Math.random() * 0.5;
            const base = s.mount !== undefined ? this.groundAt(this.bodies[s.mount].x, this.bodies[s.mount].z) : this.groundAt(s.x, s.z);
            this.arrows.shoot(_pos.set(s.x - 0.2, base + s.y0 + 1.55, s.z - 0.5));
          }
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
      anim.needsUpdate = true;
    }
    this.arrows?.update(dt);
    this.spell?.update(dt, t, att);

    for (const b of this.bodies) {
      const fall = fallOf(b.delay);
      b.group.position.set(b.x, this.groundAt(b.x, b.z) - fall * 0.3, b.z);
      b.group.rotation.z = fall * (b.wheels ? 0.35 : 1.35);
      if (b.legs) {
        // attacking: the animal rears and paws with its front legs
        const rear = att * (1 - fall) * (0.6 + 0.4 * Math.sin(t * 5 + b.phase)) * (b.gait > 6 ? 0.17 : 0.08);
        b.group.rotation.x = rear;
        b.legs.forEach((leg, i) => {
          const stride = Math.sin(t * b.gait + b.phase + (i === 0 || i === 3 ? 0 : Math.PI)) * b.swing * walk;
          const paw = i < 2 ? att * (0.45 + 0.4 * Math.sin(t * 9 + b.phase + i * 1.6)) : 0;
          leg.rotation.x = (stride + paw) * (1 - fall);
        });
        const body = b.group.children[0];
        body.position.y = walk * Math.abs(Math.sin(t * b.gait + b.phase)) * 0.06;
        body.rotation.x = (1 - walk) * Math.sin(t * 0.7 + b.phase) * 0.012;      // breathing
      } else {
        b.group.rotation.x = -fall * 0.2 + att * Math.sin(t * 23 + b.phase) * 0.006;
      }
      if (b.lance) b.lance.rotation.x = -att * (1.05 + 0.08 * Math.sin(t * 7 + b.phase)) * (1 - fall);
      if (b.wheels) for (const w of b.wheels) w.mesh.rotation.x -= (this.speed * dt) / w.r;
    }

    const bn = this.banner;
    if (this.bearer) {
      // the pole stays in the bearer's hands: it bobs with his stride and goes down when he falls
      const s = this.bearer, p = pose(s), a = p.tilt, c = Math.cos(a), sn = Math.sin(a);
      bn.group.position.set(s.x + HAND.x, p.y + HAND.y * c - HAND.z * sn, p.z + HAND.y * sn + HAND.z * c);
      bn.group.rotation.x = a;
    }
    const pos = bn.flag.geometry.attributes.position, a = pos.array, base = bn.base;
    const gust = 1 + walk * 0.8;
    for (let i = 0; i < a.length; i += 3) {
      const x = base[i], k = x / bn.w;
      a[i + 2] = Math.sin(x * 2.4 - t * 5 * gust + this.flagPhase) * 0.2 * k + Math.sin(base[i + 1] * 3 + t * 3) * 0.04 * k;
      a[i + 1] = base[i + 1] - k * k * 0.12;
    }
    pos.needsUpdate = true;
    bn.flag.geometry.computeVertexNormals();
  }

  dispose() {
    for (const f of this.formations) f.mesh.dispose();       // not the geometry: its attributes are shared
    this.arrows?.mesh.dispose();
    this.group.traverse(o => { if (o.userData.outline && o.isInstancedMesh) o.dispose(); });
    this.spell?.points.geometry.dispose();
    this.banner.flag.geometry.dispose();
  }
}
