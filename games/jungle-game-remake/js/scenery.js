/* Places the scenery props on the island ring and animates the ambient life: torch flames,
   butterflies over the grass, fish shadows circling in the sea. Tall props sit on the far
   (top) sides — high columns, low rows — and the near sides get only low ones, so nothing hides the board. */
import * as THREE from 'three';
import { C } from './palette.js';
import { ringTop, SEA_Y, WATER_Y } from './scene.js';
import {
  buildTree, buildBush, buildRock, buildMushrooms, buildLog, buildFlowers, buildTorch,
  buildDock, buildBamboo, buildLily, buildButterfly, buildFish,
} from './props.js';

const tileAt = (r, c) => new THREE.Vector3(c - 3, ringTop(r, c), r - 4);

export function buildScenery(scene) {
  const place = (obj, r, c, { dx = 0, dz = 0, rot = 0 } = {}) => {
    const p = tileAt(r, c);
    obj.position.set(p.x + dx, p.y, p.z + dz);
    obj.rotation.y = rot;
    scene.add(obj);
    return obj;
  };

  // [row, col, seed, size] — all on the far ring
  for (const [r, c, seed, size] of [[-2, 6, 1, 1.15], [-2, 1, 2, 1], [-1, 7, 3, 1.1], [2, 8, 4, 1.2],
    [5, 8, 5, 1], [8, 8, 6, 1.1], [-2, 4, 7, 0.85]]) {
    place(buildTree(seed, size), r, c, { rot: seed });
  }
  [[-1, 6], [-1, 0], [3, 7], [7, 7], [3, -1], [6, -1], [9, 6]]
    .forEach(([r, c], i) => place(buildBush(i + 1), r, c, { rot: i }));
  [[1, -1, 1, 1], [9, 0, 2, 0.8], [5, 7, 3, 1.2], [-2, 0, 4, 0.9], [10, 3, 5, 0.7]]
    .forEach(([r, c, seed, size]) => place(buildRock(seed, size), r, c, { rot: seed }));
  [[1, 7], [8, -1], [10, 5]].forEach(([r, c], i) => place(buildMushrooms(i + 1), r, c, { rot: i * 2 }));
  place(buildLog(), 6, 7, { rot: -0.3 });
  [[0, 7], [2, -1], [4, -1], [9, 5], [9, 1], [10, 2], [4, 7], [-1, 5], [-1, 1], [7, -1], [10, 0]]
    .forEach(([r, c], i) => place(buildFlowers(i + 1), r, c));

  // torches beside each den, nudged toward the board
  const torches = [];
  for (const [r, c, dz] of [[-1, 2, 0.3], [-1, 4, 0.3], [9, 2, -0.3], [9, 4, -0.3]]) {
    const t = buildTorch();
    place(t.group, r, c, { dz });
    torches.push(t.flame);
  }

  const dock = buildDock();
  dock.position.set(-5.4, -0.56, 2);
  dock.rotation.y = Math.PI;            // reach out over the sea on the −x side
  scene.add(dock);

  for (const [x, z, seed] of [[6.3, -3, 1], [6, 2.6, 2], [2.5, -7.3, 3], [-1.5, -7.4, 4], [-6.4, -5.5, 5]]) {
    const b = buildBamboo(seed);
    b.position.set(x, SEA_Y, z);
    scene.add(b);
  }
  for (const [x, z, flower] of [[2.15, -1.1, true], [0.8, 1.15, false], [-2.2, 0.4, false], [-0.85, -1.2, true]]) {
    const l = buildLily(1, flower);
    l.position.set(x, WATER_Y + 0.005, z);
    l.rotation.y = x * 2;
    scene.add(l);
  }

  const flies = [[-1, 5, C.flowerPink], [9, 3, C.flowerYellow], [4, -1, C.white], [3, 7, C.flowerViolet]]
    .map(([r, c, color], i) => {
      const b = buildButterfly(color);
      scene.add(b.group);
      return { ...b, base: tileAt(r, c), seed: i * 2.3 };
    });

  const fish = [[7, -2, 1.2, 0.5], [-6.8, 1.5, 1, -0.6], [1.5, 8.2, 1.4, 0.4], [-7.2, -6, 0.9, 0.7], [6.5, 7, 1.1, -0.45]]
    .map(([x, z, r, speed], i) => {
      const mesh = buildFish();
      scene.add(mesh);
      return { mesh, c: new THREE.Vector3(x, 0, z), r, speed, a: i * 1.3 };
    });

  function update(dt, t) {
    torches.forEach((f, i) => {
      f.scale.set(1, 0.85 + 0.25 * Math.abs(Math.sin(t * 9 + i * 1.7)) + Math.random() * 0.05, 1);
    });
    for (const b of flies) {
      const s = b.seed;
      b.group.position.set(
        b.base.x + Math.sin(t * 0.7 + s) * 0.8,
        b.base.y + 0.5 + Math.sin(t * 2.1 + s) * 0.15,
        b.base.z + Math.cos(t * 0.5 + s * 2) * 0.8);
      b.group.rotation.y = t * 0.7 + s;
      const f = Math.sin(t * 18 + s) * 0.9;
      b.wingL.rotation.z = -f;
      b.wingR.rotation.z = f;
    }
    for (const f of fish) {
      f.a += f.speed * dt;
      f.mesh.position.set(f.c.x + Math.cos(f.a) * f.r, SEA_Y + 0.004, f.c.z + Math.sin(f.a) * f.r);
      f.mesh.rotation.y = Math.atan2(-Math.sin(f.a) * Math.sign(f.speed), Math.cos(f.a) * Math.sign(f.speed));
    }
  }

  return { update };
}
