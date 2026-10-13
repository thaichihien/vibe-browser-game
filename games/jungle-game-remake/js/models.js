/* Procedural voxel models. Animals are built from separate pivoted parts — body, head with
   eyes, four legs, tail, and species extras (elephant ears and trunk) — so they can animate.
   Part geometry is meshed once per species+team and cached; each animal gets its own
   material so a weakened piece can be tinted alone. */
import * as THREE from 'three';
import { VoxelGrid, hash3 } from './voxel.js';
import { C, TEAM } from './palette.js';
import { geometryFrom, voxelMesh, lambert, STATIC_MAT } from './mesh.js';

export const S = 1 / 16;   // animal voxel size: a tile is 16 voxels across

const mod = (a, n) => ((a % n) + n) % n;

// Proportions in voxels. The body is centred on x and z; the head grows forward (+z) from the
// neck; the tail grows backward (−z) from the rump.
export const SPECIES = {
  rat: {
    bw: 4, bh: 4, bl: 8, legH: 2, legW: 2, hw: 4, hh: 4, hl: 4, neck: 0, snout: [2, 2, 2],
    ears: 'round', earSize: 3, tail: { len: 10, t: 1, rise: 0.15, color: C.pink },
    fur: C.ratFur, belly: C.stone1, dark: C.ratDark, nose: C.pink, earIn: C.pink, paw: C.pink,
  },
  cat: {
    bw: 4, bh: 4, bl: 8, legH: 4, legW: 2, hw: 6, hh: 5, hl: 4, neck: 1, snout: [2, 2, 1],
    ears: 'point', earSize: 3, tail: { len: 8, t: 1, rise: 0.6, color: C.catFur, stripe: C.catStripe },
    fur: C.catFur, belly: C.cream, dark: C.catStripe, nose: C.pink, earIn: C.pink, paw: C.cream,
    muzzle: C.cream,
    pattern: (x, y, z) => (y >= 2 && mod(z, 3) === 0 ? C.catStripe : null),
  },
  dog: {
    bw: 6, bh: 5, bl: 10, legH: 4, legW: 2, hw: 6, hh: 5, hl: 5, neck: 1, snout: [4, 3, 3],
    ears: 'floppy', earSize: 4, tail: { len: 5, t: 1, rise: 0.8, color: C.dogFur },
    fur: C.dogFur, belly: C.dogMuzzle, dark: C.dogEar, nose: C.ink, earIn: C.dogEar,
    paw: C.dogMuzzle, muzzle: C.dogMuzzle,
    pattern: (x, y, z) => (y >= 3 && z >= -3 && z <= 0 && x >= 0 ? C.dogEar : null),   // saddle patch
  },
  wolf: {
    bw: 6, bh: 6, bl: 12, legH: 5, legW: 2, hw: 6, hh: 5, hl: 5, neck: 1, snout: [4, 3, 4],
    ears: 'point', earSize: 3, tail: { len: 7, t: 3, rise: -0.35, color: C.wolfFur, tip: C.wolfBelly },
    fur: C.wolfFur, belly: C.wolfBelly, dark: C.wolfDark, nose: C.ink, earIn: C.wolfDark,
    paw: C.wolfDark, muzzle: C.wolfBelly,
    pattern: (x, y, z, sp) => (y >= sp.bh - 1 ? C.wolfDark : null),
  },
  leopard: {
    bw: 6, bh: 5, bl: 12, legH: 5, legW: 2, hw: 6, hh: 5, hl: 5, neck: 1, snout: [4, 3, 2],
    ears: 'small', earSize: 2, tail: { len: 9, t: 1, rise: 0.3, color: C.leoFur, spots: true },
    fur: C.leoFur, belly: C.leoBelly, dark: C.leoSpot, nose: C.pink, earIn: C.leoSpot,
    paw: C.leoBelly, muzzle: C.leoBelly,
    pattern: (x, y, z) => (y > 0 && hash3(x, y, z, 5) < 0.17 ? C.leoSpot : null),
    headPattern: (x, y, z) => (y >= 2 && hash3(x, y, z, 6) < 0.12 ? C.leoSpot : null),
  },
  tiger: {
    bw: 6, bh: 6, bl: 14, legH: 5, legW: 2, hw: 8, hh: 6, hl: 5, neck: 1, snout: [4, 3, 2],
    ears: 'small', earSize: 2, tail: { len: 9, t: 1, rise: 0.3, color: C.tigerFur, stripe: C.ink },
    fur: C.tigerFur, belly: C.tigerBelly, dark: C.ink, nose: C.pink, earIn: C.ink,
    paw: C.tigerBelly, muzzle: C.tigerBelly,
    pattern: (x, y, z) => (y >= 1 && mod(z + (y >> 1), 4) === 0 ? C.ink : null),
    headPattern: (x, y, z, sp) => (y >= sp.hh - 2 && mod(x, 2) === 0 && z <= sp.hl - 3 ? C.ink : null),
  },
  lion: {
    bw: 8, bh: 6, bl: 14, legH: 5, legW: 2, hw: 8, hh: 7, hl: 5, neck: 1, snout: [4, 3, 2],
    ears: 'none', earSize: 0, tail: { len: 8, t: 1, rise: 0.1, color: C.lionFur, tuft: C.lionManeDark },
    fur: C.lionFur, belly: C.lionBelly, dark: C.lionMane, nose: C.ink, earIn: C.lionMane,
    paw: C.lionBelly, muzzle: C.lionBelly, mane: true,
  },
  elephant: {
    bw: 10, bh: 8, bl: 14, legH: 5, legW: 4, hw: 8, hh: 7, hl: 5, neck: 1, snout: null,
    ears: 'big', earSize: 7, tail: { len: 4, t: 1, rise: -0.5, color: C.eleSkin, tuft: C.eleDark },
    fur: C.eleSkin, belly: C.eleSkin, dark: C.eleDark, nose: C.eleDark, earIn: C.eleEar,
    paw: C.stone1, trunk: true, tusks: true,
    pattern: (x, y, z) => (mod(y, 3) === 0 && hash3(x, y, z, 7) < 0.3 ? C.eleDark : null),   // wrinkles
  },
};

function bodyGrid(sp, team) {
  const g = new VoxelGrid();
  const x0 = -sp.bw / 2, x1 = sp.bw / 2 - 1, z0 = -sp.bl / 2, z1 = sp.bl / 2 - 1, top = sp.bh - 1;
  g.box(x0, 0, z0, x1, top, z1, (x, y, z) => {
    const edgeX = x === x0 || x === x1, edgeZ = z === z0 || z === z1;
    if ((y === top || y === 0) && edgeX && edgeZ) return null;      // round the corners
    if (y === 0) return sp.belly;
    return sp.pattern?.(x, y, z, sp) ?? sp.fur;
  });
  // team bandana just behind the head, knot hanging at the chest
  const t = TEAM[team];
  for (let z = z1 - 3; z <= z1 - 2; z++) {
    for (let y = 1; y <= top; y++) { g.set(x0 - 1, y, z, t.main); g.set(x1 + 1, y, z, t.main); }
    for (let x = x0 - 1; x <= x1 + 1; x++) g.set(x, top + 1, z, t.main);
  }
  g.box(-1, 0, z1 + 1, 0, 1, z1 + 1, t.dark);
  return g;
}

function earsGrid(sp) {
  const g = new VoxelGrid();
  const x0 = -sp.hw / 2, hh = sp.hh, s = sp.earSize;
  if (sp.ears === 'round') {
    for (let dx = 0; dx < s; dx++) for (let dy = 0; dy < s; dy++) {
      if ((dx === 0 || dx === s - 1) && (dy === 0 || dy === s - 1)) continue;
      g.set(x0 - 1 + dx, hh - 1 + dy, 1, dx === 1 && dy === 1 ? sp.earIn : sp.fur);
    }
  } else if (sp.ears === 'point') {
    for (let j = 0; j < s; j++) for (let i = 0; i < s - j; i++) {
      g.set(x0 + Math.floor(j / 2) + i, hh + j, 1, j === 0 && i > 0 && i < s - 1 ? sp.earIn : sp.fur);
    }
  } else if (sp.ears === 'small') {
    g.box(x0, hh, 1, x0 + 1, hh + 1, 1, (x, y) => (x === x0 + 1 && y === hh ? sp.earIn : sp.fur));
  } else if (sp.ears === 'floppy') {
    g.box(x0 - 1, hh - s, 1, x0 - 1, hh - 1, 2, sp.dark);
  } else {
    return g;
  }
  return g.merge(g.mirrorX());
}

function headGrid(sp) {
  const g = new VoxelGrid();
  const x0 = -sp.hw / 2, x1 = sp.hw / 2 - 1, top = sp.hh - 1, front = sp.hl - 1;
  g.box(x0, 0, 0, x1, top, front, (x, y, z) => {
    if ((x === x0 || x === x1) && (y === top || y === 0) && (z === 0 || z === front)) return null;
    if (sp.muzzle && z === front && y <= 1) return sp.muzzle;            // cheeks
    return sp.headPattern?.(x, y, z, sp) ?? sp.fur;
  });
  if (sp.snout) {
    const [sw, sh, sl] = sp.snout;
    const sx0 = -sw / 2, sx1 = sw / 2 - 1, sz1 = sp.hl + sl - 1;
    g.box(sx0, 0, sp.hl, sx1, sh - 1, sz1, sp.muzzle ?? sp.fur);
    for (let x = Math.max(sx0, -1); x <= Math.min(sx1, 0); x++) g.set(x, sh - 1, sz1, sp.nose);
    if (sh >= 3) for (let x = sx0; x <= sx1; x++) g.set(x, 0, sz1, sp.dark);   // mouth line
  }
  if (sp.tusks) {
    for (const x of [-3, 2]) {
      g.set(x, 1, sp.hl, C.white);
      g.set(x, 0, sp.hl + 1, C.white);
      g.set(x, 0, sp.hl + 2, C.white);
    }
  }
  if (sp.mane) {
    g.box(x0 - 2, -2, -1, x1 + 2, sp.hh + 1, sp.hl - 3, (x, y, z) => {
      if (x >= x0 && x <= x1 && y >= 0 && y < sp.hh && z >= 0) return null;     // the head itself
      if ((x === x0 - 2 || x === x1 + 2) && (y === -2 || y === sp.hh + 1)) return null;
      return hash3(x, y, z, 17) < 0.35 ? C.lionManeDark : C.lionMane;
    });
  }
  return g.merge(earsGrid(sp));
}

const eyeY = sp => Math.max(2, sp.hh - 3);
function eyesGrid(sp) {
  // one voxel each, just proud of the face, so a blink can squash them without a hole behind
  return new VoxelGrid()
    .set(-sp.hw / 2, eyeY(sp), sp.hl, C.ink)
    .set(sp.hw / 2 - 1, eyeY(sp), sp.hl, C.ink);
}

function legGrid(sp) {
  const w = sp.legW;
  return new VoxelGrid().box(-w / 2, -sp.legH, -w / 2, w / 2 - 1, -1, w / 2 - 1,
    (x, y) => (y === -sp.legH ? sp.paw : sp.fur));
}

function tailGrid(sp) {
  const t = sp.tail;
  const g = new VoxelGrid();
  for (let i = 0; i < t.len; i++) {
    const y = Math.round(i * t.rise), z = -1 - i;
    const r = t.t === 3 && i < t.len - 2 ? 1 : 0;     // bushy tails taper at the tip
    let col = t.color;
    if (t.stripe && i % 2 === 1) col = t.stripe;
    if (t.spots && hash3(i, 3, 0, 9) < 0.3) col = sp.dark;
    if ((t.tip || t.tuft) && i >= t.len - 2) col = t.tip ?? t.tuft;
    g.box(-r, y - r, z, r, y + r, z, col);
  }
  if (t.tuft) {
    const end = t.len - 1, y = Math.round(end * t.rise);
    g.box(-1, y - 1, -2 - end, 0, y, -1 - end, t.tuft);
  }
  return g;
}

function trunkGrid() {
  const g = new VoxelGrid();
  for (let i = 0; i < 8; i++) g.box(-1, -i, 0, 0, -i, 1, i % 2 ? C.eleDark : C.eleSkin);
  g.box(-1, -8, 1, 0, -8, 3, C.eleSkin);              // the tip curls forward
  g.box(-1, -7, 3, 0, -7, 3, C.eleDark);
  return g;
}

function bigEarGrid(sp) {
  // rounded flap hinged at its front edge: outer skin at x = 0, pink inner face at x = 1
  const g = new VoxelGrid();
  for (let y = -6; y <= 3; y++) for (let z = -6; z <= 0; z++) {
    if (((y + 1.5) / 4.5) ** 2 + ((z + 2.5) / 3.5) ** 2 > 1) continue;
    g.set(0, y, z, sp.fur);
    g.set(1, y, z, sp.earIn);
  }
  return g;
}

const geoCache = new Map();
function cachedGeometry(key, make, pivot) {
  if (!geoCache.has(key)) geoCache.set(key, geometryFrom(make(), S, pivot));
  return geoCache.get(key);
}

export function buildAnimal(type, team) {
  const sp = SPECIES[type];
  const mat = lambert();
  const part = (name, make, pivot) => {
    const m = new THREE.Mesh(cachedGeometry(`${type}:${team}:${name}`, make, pivot), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  const root = new THREE.Group();
  const model = new THREE.Group();
  model.rotation.order = 'YXZ';            // facing first, then tilt/roll in the animal's frame
  root.add(model);

  const body = part('body', () => bodyGrid(sp, team));
  body.position.y = sp.legH * S;
  model.add(body);

  const headY = sp.legH + sp.bh - 2 + sp.neck;
  const head = new THREE.Group();
  head.position.set(0, headY * S, (sp.bl / 2 - 2) * S);
  head.add(part('head', () => headGrid(sp)));
  const ey = eyeY(sp);
  const eyes = part('eyes', () => eyesGrid(sp), [0, ey + 0.5, 0]);
  eyes.position.y = (ey + 0.5) * S;
  head.add(eyes);
  model.add(head);

  const lx = (sp.bw / 2 - sp.legW / 2) * S, lz = (sp.bl / 2 - sp.legW / 2 - 1) * S;
  const legs = [[-lx, lz], [lx, lz], [-lx, -lz], [lx, -lz]].map(([x, z]) => {   // fl, fr, bl, br
    const leg = part('leg', () => legGrid(sp));
    leg.position.set(x, sp.legH * S, z);
    model.add(leg);
    return leg;
  });

  const tail = part('tail', () => tailGrid(sp));
  tail.position.set(0, (sp.legH + sp.bh - 2) * S, (-sp.bl / 2) * S);
  model.add(tail);

  const rig = { body, head, eyes, legs, tail, bodyY: body.position.y };
  if (sp.trunk) {
    rig.trunk = part('trunk', trunkGrid);
    rig.trunk.position.set(0, (sp.hh - 3) * S, sp.hl * S);
    head.add(rig.trunk);
  }
  if (sp.ears === 'big') {
    rig.earL = part('earL', () => bigEarGrid(sp));
    rig.earL.position.set((-sp.hw / 2 - 2) * S, (sp.hh - 2) * S, 2 * S);
    rig.earR = part('earR', () => bigEarGrid(sp).mirrorX());
    rig.earR.position.set((sp.hw / 2 + 2) * S, (sp.hh - 2) * S, 2 * S);
    head.add(rig.earL, rig.earR);
  }

  model.rotation.y = team === 'red' ? 0 : Math.PI;
  const crown = sp.ears === 'point' ? sp.earSize : sp.ears === 'small' || sp.mane ? 2 : 0;
  return {
    root, model, rig, mat,
    height: (headY + sp.hh + crown) * S,
    colors: [sp.fur, sp.fur, sp.belly, sp.dark, TEAM[team].main],
  };
}

/** Snare on a trap square: four stakes and a rope, with two toothed jaws lying open. */
export function buildTrap() {
  const group = new THREE.Group();
  const base = new VoxelGrid();
  for (const [x, z] of [[-6, -6], [5, -6], [-6, 5], [5, 5]]) base.box(x, 0, z, x, 3, z, C.earth3);
  for (let i = -6; i <= 5; i++) {
    base.set(i, 2, -6, C.sand); base.set(i, 2, 5, C.sand);
    base.set(-6, 2, i, C.sand); base.set(5, 2, i, C.sand);
  }
  group.add(voxelMesh(base, S));

  const jaw = new VoxelGrid().box(0, 0, -4, 4, 0, 3, C.stone3);
  for (let z = -4; z <= 3; z += 2) jaw.set(4, 1, z, C.stone1);           // teeth on the inner edge
  const jawA = voxelMesh(jaw, S);
  jawA.position.set(-5 * S, 0.005, 0);
  const jawB = voxelMesh(jaw.mirrorX(), S);
  jawB.position.set(5 * S, 0.005, 0);
  group.add(jawA, jawB);

  return {
    group,
    setClosed(k) { jawA.rotation.z = k * 1.35; jawB.rotation.z = -k * 1.35; },
  };
}

/** Mossy stone arch over a den square. The opening faces along the rows, toward the board. */
export function buildDen(owner) {
  const t = TEAM[owner];
  const g = new VoxelGrid();
  const brick = (x, y, z) => {
    if (y % 2 === 0 && hash3(x, y, z, 4) < 0.6) return C.stone3;          // mortar course
    if (mod(x + z + (Math.floor(y / 2) % 2) * 2, 4) === 0) return C.stone3;
    return hash3(x, y, z, 5) < 0.3 ? C.stone1 : C.stone2;
  };
  g.box(-8, 0, -3, -5, 13, 2, brick);       // pillars on the square's left and right edges
  g.box(4, 0, -3, 7, 13, 2, brick);
  g.box(-9, 14, -4, 8, 15, 3, brick);       // lintel
  g.box(-6, 16, -3, 5, 16, 2, brick);       // stepped cap
  for (let i = 0; i < 46; i++) {            // ivy over the lintel and down the pillar faces
    const x = -9 + Math.floor(hash3(i, 1, 0, 31) * 18);
    const front = hash3(i, 2, 0, 31) < 0.5;
    const len = 2 + Math.floor(hash3(i, 3, 0, 31) * 10);
    const onPillar = (x >= -8 && x <= -5) || (x >= 4 && x <= 7);
    for (let j = 0; j < len; j++) {
      const y = 16 - j;
      if (y < 14 && !onPillar) break;
      const z = y >= 14 ? (front ? -5 : 4) : (front ? -4 : 3);
      g.set(x, y, z, hash3(x, y, z, 8) < 0.5 ? C.lime4 : C.lime3);
    }
  }
  const group = new THREE.Group();
  group.add(voxelMesh(g, S));

  // team banners on the pillars' outer faces (clear of pieces walking through the arch)
  const banner = new VoxelGrid();
  for (let y = 4; y <= 12; y++) for (let z = -2; z <= 1; z++) {
    banner.set(0, y, z, z === -2 || z === 1 || y === 12 ? t.dark : t.main);
  }
  banner.set(0, 3, -1, t.main).set(0, 3, 0, t.main);
  for (const [y, z] of [[7, -1], [7, 0], [8, -1], [8, 0], [10, -1], [10, 0]]) banner.set(0, y, z, C.white);
  const left = voxelMesh(banner, S);
  left.position.x = -9 * S;
  const right = voxelMesh(banner, S);
  right.position.x = 8 * S;
  group.add(left, right);
  return { group };
}

/** Bobbing gold arrow over the selected piece. */
export function buildArrow() {
  const g = new VoxelGrid();
  const widths = [0, 1, 2, 3, 1, 1, 1];
  widths.forEach((k, y) => g.box(-k, y, 0, k, y, 0, y === 0 ? C.flame : C.gold));
  const mesh = voxelMesh(g, S, STATIC_MAT, [0.5, 0, 0.5]);
  mesh.castShadow = false;
  return mesh;
}
