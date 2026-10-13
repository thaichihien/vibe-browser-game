/* Scenery props for the island ring, after reference/image01–02 and color.png: layered pixel
   trees with hanging vines, bushes, rocks, mushrooms, a mossy log, flower patches, torches by
   the dens, a small dock, bamboo in the shallows, lily pads, butterflies and fish shadows.
   1 voxel = 1/16 tile, like the animals. */
import * as THREE from 'three';
import { VoxelGrid, hash3 } from './voxel.js';
import { C } from './palette.js';
import { geometryFrom, voxelMesh, swayMaterial, STATIC_MAT } from './mesh.js';

const S = 1 / 16;
const mod = (a, n) => ((a % n) + n) % n;
const pickH = (arr, h) => arr[Math.floor(h * arr.length) % arr.length];
const noShadow = m => { m.castShadow = false; return m; };

export function buildTree(seed = 1, size = 1) {
  const group = new THREE.Group();
  const H = Math.round(20 * size);
  const bark = (x, y, z) => (hash3(x, y, z, seed) < 0.12 ? C.earth4 : mod(x + y + z, 3) === 0 ? C.earth3 : C.earth2);
  const trunk = new VoxelGrid().box(-2, 0, -2, 1, H - 1, 1, bark);
  trunk.box(-3, 0, -3, 2, 1, 2, (x, y, z) => ((x === -3 || x === 2) && (z === -3 || z === 2) ? null : bark(x, y, z)));
  for (let i = 0; i < 5; i++) {                  // two branches reaching into the canopy
    trunk.set(2 + i, H - 7 + i, 0, C.earth3);
    trunk.set(-3 - i, H - 5 + i, 0, C.earth3);
  }
  group.add(voxelMesh(trunk, S));

  const canopy = new VoxelGrid();
  const clumps = [[0, H + 4, 0, 10, 7, 10], [6, H + 1, 3, 6, 5, 6], [-6, H + 2, -2, 7, 5, 6], [2, H + 8, -3, 6, 4, 6]];
  for (const [cx, cy, cz, rx, ry, rz] of clumps) {
    const jx = Math.round((hash3(cx, seed, 1, 2) - 0.5) * 4);
    canopy.ellipsoid(cx * size + jx, cy, cz * size, rx * size, ry * size, rz * size, (x, y, z) => {
      const t = (y - cy) / (ry * size), n = hash3(x, y, z, seed + 3);
      if (t > 0.45) return n < 0.3 ? C.lime0 : C.lime1;
      if (t > 0) return n < 0.12 ? C.lime3 : C.lime2;
      if (t > -0.5) return n < 0.12 ? C.lime4 : C.lime3;
      return C.lime4;
    });
  }
  for (let i = 0; i < 16; i++) {                 // vines hanging from the canopy's underside
    const x = Math.round((hash3(i, seed, 0, 51) - 0.5) * 18 * size);
    const z = Math.round((hash3(i, seed, 1, 51) - 0.5) * 18 * size);
    let y0 = null;
    for (let y = H - 4; y < H + 14; y++) if (canopy.has(x, y, z)) { y0 = y; break; }
    if (y0 === null) continue;
    const len = 3 + Math.floor(hash3(i, seed, 2, 51) * 8);
    for (let j = 1; j <= len; j++) canopy.set(x, y0 - j, z, j % 3 === 0 ? C.lime5 : C.lime4);
  }
  group.add(voxelMesh(canopy, S, swayMaterial(0.35)));
  return group;
}

export function buildBush(seed = 1) {
  const g = new VoxelGrid().ellipsoid(0, 3, 0, 6, 4, 5, (x, y, z) => {
    if (y < 0) return null;
    const n = hash3(x, y, z, seed);
    if (n < 0.05) return pickH([C.white, C.flowerPink, C.flowerYellow], hash3(x, y, z, seed + 1));
    return y > 4 ? (n < 0.4 ? C.lime1 : C.lime2) : n < 0.5 ? C.lime3 : C.lime4;
  });
  return voxelMesh(g, S, swayMaterial(0.25));
}

export function buildRock(seed = 1, size = 1) {
  const g = new VoxelGrid().ellipsoid(0, 1.5, 0, 5 * size, 3.5 * size, 4 * size, (x, y, z) => {
    if (y < 0) return null;
    const n = hash3(x, y, z, seed);
    if (y >= 3.5 * size && n < 0.35) return C.lime3;               // moss on top
    if (y >= 3 * size) return C.stone1;
    return y >= 1 ? (n < 0.15 ? C.stone3 : C.stone2) : C.stone3;
  });
  return voxelMesh(g, S);
}

export function buildMushrooms(seed = 1) {
  const g = new VoxelGrid();
  for (const [x, z, h] of [[0, 0, 5], [4, 2, 3], [-3, 3, 4]]) {
    g.box(x, 0, z, x + 1, h - 1, z + 1, C.cream);
    g.ellipsoid(x + 0.5, h, z + 0.5, 2.6, 1.6, 2.6,
      (cx, cy, cz) => (cy < h ? null : hash3(cx, cy, cz, seed) < 0.22 ? C.white : C.red));
  }
  return voxelMesh(g, S);
}

export function buildLog() {
  const g = new VoxelGrid();
  for (let x = -9; x <= 8; x++) for (let y = 0; y <= 6; y++) for (let z = -3; z <= 3; z++) {
    const d = (y - 3) ** 2 + z ** 2;
    if (d > 10) continue;
    let col = mod(x, 4) === 0 ? C.earth3 : C.earth2;
    if (x === -9 || x === 8) col = d < 3 ? C.sand : d < 6 ? C.earth1 : C.earth3;   // growth rings
    else if (y >= 5 && hash3(x, y, z, 12) < 0.45) col = C.lime3;                    // moss
    g.set(x, y, z, col);
  }
  return voxelMesh(g, S);
}

export function buildFlowers(seed = 1) {
  const g = new VoxelGrid();
  for (let i = 0; i < 6; i++) {
    const x = Math.round((hash3(i, seed, 0, 71) - 0.5) * 12);
    const z = Math.round((hash3(i, seed, 1, 71) - 0.5) * 12);
    const h = 2 + Math.floor(hash3(i, seed, 2, 71) * 3);
    const petal = pickH([C.flowerPink, C.flowerYellow, C.white, C.flowerViolet, C.red], hash3(i, seed, 3, 71));
    for (let y = 0; y < h; y++) g.set(x, y, z, C.lime4);
    g.set(x + 1, 1, z, C.lime3);                                      // a leaf
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.set(x + dx, h, z + dz, petal);
    g.set(x, h, z, petal === C.flowerYellow ? C.flame : C.flowerYellow);
  }
  return noShadow(voxelMesh(g, S, swayMaterial(0.8)));
}

export function buildTorch() {
  const group = new THREE.Group();
  const pole = new VoxelGrid()
    .box(-1, 0, -1, 0, 13, 0, (x, y) => (y % 4 === 0 ? C.earth4 : C.earth3))
    .box(-2, 14, -2, 1, 15, 1, C.stone3);
  group.add(voxelMesh(pole, S));
  const fire = new VoxelGrid()
    .box(-2, 0, -2, 1, 1, 1, C.flame)
    .box(-1, 2, -1, 0, 3, 0, C.gold)
    .set(-1, 4, -1, C.white)
    .set(0, 4, 0, C.gold);
  const flame = new THREE.Mesh(geometryFrom(fire, S), new THREE.MeshBasicMaterial({ vertexColors: true }));
  flame.position.y = 16 * S;
  group.add(flame);
  return { group, flame };
}

export function buildDock() {
  const g = new VoxelGrid();
  for (let x = 0; x < 32; x++) for (let z = -6; z <= 5; z++) {
    g.set(x, 0, z, mod(x, 4) === 3 ? C.earth4 : hash3(x, 0, z, 81) < 0.5 ? C.earth2 : C.earth3);
  }
  for (const x of [1, 14, 28]) for (const z of [-6, 5]) g.box(x, -12, z, x + 1, 2, z, C.earth4);
  return voxelMesh(g, S);
}

export function buildBamboo(seed = 1) {
  const g = new VoxelGrid();
  const h = 22 + Math.floor(hash3(seed, 0, 0, 91) * 10);
  g.box(0, 0, 0, 1, h, 1, (x, y) => (y % 6 === 0 ? C.lime5 : x === 0 ? C.lime3 : C.lime4));
  for (const [y, side, dz] of [[h - 2, 1, 0], [h - 5, -1, 1], [h - 9, 1, 1]]) {
    for (let i = 1; i <= 4; i++) g.set(side > 0 ? 1 + i : -i, y - (i >> 1), dz ? i : 0, C.lime2);
  }
  return voxelMesh(g, S, swayMaterial(1));
}

export function buildLily(seed = 1, flower = false) {
  const g = new VoxelGrid();
  for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) {
    if (x * x + z * z > 18) continue;
    if (z > 0 && Math.abs(x) < 1) continue;          // the notch
    g.set(x, 0, z, x * x + z * z > 12 ? C.lime4 : C.lime3);
  }
  if (flower) g.box(-1, 1, -2, 0, 1, -1, C.flowerPink).set(0, 2, -2, C.white).set(-1, 2, -1, C.flowerYellow);
  return noShadow(voxelMesh(g, S));
}

export function buildButterfly(color) {
  const group = new THREE.Group();
  group.add(noShadow(voxelMesh(new VoxelGrid().box(0, 0, -1, 0, 0, 1, C.ink), S, STATIC_MAT, [0.5, 0, 0])));
  const wing = new VoxelGrid().box(0, 0, -1, 2, 0, 1, (x, y, z) => (x === 2 && z === 0 ? C.flowerYellow : color));
  const wingR = noShadow(voxelMesh(wing, S));
  wingR.position.x = 0.5 * S;
  const wingL = noShadow(voxelMesh(wing.mirrorX(), S));
  wingL.position.x = -0.5 * S;
  group.add(wingL, wingR);
  return { group, wingL, wingR };
}

export function buildFish() {
  const g = new VoxelGrid();
  for (const [z, w] of [[3, 0], [2, 1], [1, 1], [0, 1], [-1, 0], [-2, 0], [-3, 1]]) g.box(-w, 0, z, w, 0, z, C.water5);
  const m = voxelMesh(g, S, new THREE.MeshBasicMaterial({ vertexColors: true }), [0.5, 0, 0.5]);
  m.castShadow = m.receiveShadow = false;
  return m;
}
