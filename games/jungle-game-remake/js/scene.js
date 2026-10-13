/* The diorama: a grass-and-dirt voxel island (the color.png block look) floating in turquoise
   sea, the 7×9 board on top, two river pools cut into it, one warm sun, and the fixed true-
   isometric camera. Board tile tops are separate meshes so a hovered square can lift. */
import * as THREE from 'three';
import { VoxelGrid, hash3 } from './voxel.js';
import { C, TEAM } from './palette.js';
import { ROWS, COLS, terrain, trapOwner } from './rules.js';
import { voxelMesh, swayMaterial, STATIC_MAT, shared } from './mesh.js';

const V = 8;                          // terrain voxels per tile
export const WATER_Y = -0.3;          // river surface
export const SWIM_Y = -0.42;          // a swimming rat's feet: body half under the surface
export const SEA_Y = -1.0;
/**
 * The camera view. Yaw −45° looks from the −x/+z side, so rows run from the bottom-right (blue's
 * home, row 8) to the top-left (red's home, row 0); pitch 35.264° is true isometric. The debug
 * panel (?debug) edits these live; `zoom` multiplies the framed size and `panX`/`panZ` slide the
 * view across the ground.
 */
export const VIEW = { yaw: -45, pitch: 35.264, zoom: 1, panX: 0, panZ: 0 };
const CAMERA_DISTANCE = 34.64;

// Island outline, rows r = −2…10 × cols c = −2…8. '.' = board square; digits = ring tile
// height (0 low, 1 level with the board, 2 raised); ' ' = open sea. Raised tiles stay on the
// far (top) sides — high columns and low rows — so nothing tall stands between the camera and
// the board.
const ISLAND = [
  '  1222222  ',
  ' 112222222 ',
  '01.......22',
  '01.......22',
  '01.......12',
  '01.......22',
  '01.......12',
  '01.......22',
  '01.......12',
  '01.......22',
  '01.......12',
  ' 011111111 ',
  '  0000000  ',
];
const RING_H = { 0: 8, 1: 12, 2: 16 };
const BOARD_H = 12;
const RIVERBED_H = 5;

export function tileKind(r, c) {
  if (r >= 0 && r < ROWS && c >= 0 && c < COLS) return terrain[r][c];
  const ch = ISLAND[r + 2]?.[c + 2];
  return ch && ch !== ' ' ? 'ring' : null;
}
function tileHeight(r, c) {
  const kind = tileKind(r, c);
  if (kind === 'ring') return RING_H[ISLAND[r + 2][c + 2]];
  return kind === 'water' ? RIVERBED_H : BOARD_H;
}
/** World y of the top of island tile (r, c) — where scenery props stand. */
export const ringTop = (r, c) => tileHeight(r, c) / V - 1.5;

function grass(X, Z, light) {
  const n = hash3(X, 0, Z, 11);
  if (light) return n < 0.5 ? C.lime2 : n < 0.88 ? C.lime3 : C.lime1;
  return n < 0.55 ? C.lime3 : n < 0.85 ? C.lime2 : C.lime4;
}
function soil(X, y, Z, h) {
  const n = hash3(X, y, Z, 3);
  if (y === h - 2 && n < 0.55) return C.lime4;     // grass hangs over the block edge
  if (y === h - 3 && n < 0.2) return C.lime5;
  if (n < 0.035) return C.stone2;                  // pebbles in the dirt
  if (y < 3) return C.earth4;
  return y >= h - 5 ? C.earth2 : C.earth3;
}
function ringTopColor(X, Z, r, c, i, k) {
  if (hash3(r, c, 0, 41) < 0.16 && (i - 3.5) ** 2 + (k - 3.5) ** 2 < 7) {   // bare dirt patch
    const n = hash3(X, 1, Z, 5);
    return n < 0.6 ? C.earth1 : n < 0.9 ? C.earth2 : C.sand;
  }
  return grass(X, Z, false);
}
function riverbed(X, Z) {
  const n = hash3(X, 2, Z, 9);
  return n < 0.25 ? C.stone2 : n < 0.35 ? C.earth1 : C.sand;
}

function buildIsland() {
  const g = new VoxelGrid();
  for (let r = -2; r <= 10; r++) {
    for (let c = -2; c <= 8; c++) {
      const kind = tileKind(r, c);
      if (!kind) continue;
      const h = tileHeight(r, c);
      const ownTop = kind === 'land' || kind === 'trap' || kind === 'den';   // see tileTop()
      const fillTo = ownTop ? h - 2 : h;
      for (let i = 0; i < V; i++) {
        for (let k = 0; k < V; k++) {
          const X = (c + 2) * V + i, Z = (r + 2) * V + k;
          for (let y = 0; y < fillTo; y++) {
            const top = y === h - 1;
            g.set(X, y, Z, top ? (kind === 'water' ? riverbed(X, Z) : ringTopColor(X, Z, r, c, i, k))
              : soil(X, y, Z, h));
          }
        }
      }
    }
  }
  // voxel (44, 12, 52) → world (0, 0, 0): x = X/8 − 5.5, y = Y/8 − 1.5, z = Z/8 − 6.5
  return voxelMesh(g, 1 / V, STATIC_MAT, [44, 12, 52]);
}

/** The top two voxel layers of a board square, as its own mesh (so it can lift on hover). */
function tileTop(r, c, kind) {
  const g = new VoxelGrid();
  const light = (r + c) % 2 === 0;               // checkerboard of two grass tones
  for (let i = 0; i < V; i++) {
    for (let k = 0; k < V; k++) {
      const X = c * V + i, Z = r * V + k;
      const n = hash3(X, 7, Z, 21);
      g.set(i, 0, k, n < 0.55 ? C.lime4 : C.earth2);
      const inner = i >= 1 && i <= 6 && k >= 1 && k <= 6;
      let top = grass(X, Z, light);
      if (kind === 'trap' && inner) {
        const corner = (i === 1 || i === 6) && (k === 1 || k === 6);
        top = corner ? TEAM[trapOwner(r)].dark : n < 0.15 ? C.stone3 : n < 0.6 ? C.stone2 : C.stone1;
      } else if (kind === 'den' && inner) {
        top = n < 0.15 ? C.stone2 : n < 0.55 ? C.earth1 : C.sand;
      }
      g.set(i, 1, k, top);
    }
  }
  const mesh = voxelMesh(g, 1 / V, STATIC_MAT, [4, 0, 4]);
  mesh.position.set(c - 3, (BOARD_H - 2) / V - 1.5, r - 4);   // top face lands on y = 0
  mesh.userData.baseY = mesh.position.y;
  return mesh;
}

/** Little grass tufts along the edges of board squares, clear of the centre where pieces stand. */
function buildTufts() {
  const g = new VoxelGrid();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (terrain[r][c] !== 'land') continue;
      const n = hash3(r, c, 0, 61) < 0.6 ? 1 + (hash3(r, c, 1, 61) < 0.35 ? 1 : 0) : 0;
      for (let t = 0; t < n; t++) {
        const side = Math.floor(hash3(r, c, t, 62) * 4);
        const along = 2 + Math.floor(hash3(r, c, t, 63) * 12);
        const [i, k] = [[along, 1], [along, 14], [1, along], [14, along]][side];
        const X = c * 16 + i, Z = r * 16 + k;
        const h = 2 + Math.floor(hash3(r, c, t, 64) * 2);
        for (let y = 0; y < h; y++) g.set(X, y, Z, y === h - 1 ? C.lime2 : C.lime4);
        g.set(X + 1, 0, Z, C.lime3);
        g.set(X - 1, 1, Z, C.lime3);
      }
    }
  }
  const mesh = voxelMesh(g, 1 / 16, swayMaterial(0.6), [56, 0, 72]);
  mesh.castShadow = false;
  return mesh;
}

const WATER_VERT = /* glsl */`
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const WATER_FRAG = /* glsl */`
uniform float uTime;
uniform sampler2D uMask;
uniform vec4 uBounds;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uLight;
uniform vec3 uFoam;
varying vec3 vWorld;
void main() {
  vec2 q = floor(vWorld.xz * 8.0) / 8.0;                 // lock the pattern to the voxel grid
  float dist = texture2D(uMask, (q - uBounds.xy) / uBounds.zw).r;
  vec3 col = mix(uShallow, uDeep, smoothstep(0.15, 0.7, dist));
  float w = sin(q.x * 2.3 + uTime * 0.8) + sin(q.y * 1.9 - uTime * 1.1)
          + 0.6 * sin((q.x - q.y) * 4.1 + uTime * 1.6);
  if (w > 1.75) col = uLight;
  float foam = 0.13 + 0.05 * sin(uTime * 2.2 + (q.x + q.y) * 3.0);
  if (dist < foam) col = uFoam;
  gl_FragColor = vec4(col, 1.0);
}`;

/** Distance-to-shore texture: 0 on solid texels, rising to 1 at `cap` texels away. */
function distanceMask(w, h, solid, cap = 8) {
  const d = new Float32Array(w * h).fill(cap);
  const queue = [];
  for (let i = 0; i < w * h; i++) if (solid(i % w, (i / w) | 0)) { d[i] = 0; queue.push(i); }
  for (let qi = 0; qi < queue.length; qi++) {
    const i = queue[qi], x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (d[j] > d[i] + 1) { d[j] = d[i] + 1; queue.push(j); }
    }
  }
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = Math.round(Math.min(1, d[i] / cap) * 255);
    data.set([v, v, v, 255], i * 4);
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function waterMaterial(mask, bounds, [deep, shallow, light, foam]) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uMask: { value: mask },
      uBounds: { value: new THREE.Vector4(...bounds) },
      uDeep: { value: new THREE.Color(deep) },
      uShallow: { value: new THREE.Color(shallow) },
      uLight: { value: new THREE.Color(light) },
      uFoam: { value: new THREE.Color(foam) },
    },
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
  });
}

function buildPool(cx) {
  // 2 × 3 squares; a one-texel solid border makes the foam hug the walls
  const W = 2 * V + 2, H = 3 * V + 2;
  const mask = distanceMask(W, H, (x, y) => x === 0 || y === 0 || x === W - 1 || y === H - 1);
  const mat = waterMaterial(mask, [cx - 1 - 1 / V, -1.5 - 1 / V, W / V, H / V],
    [C.water3, C.water2, C.water1, C.water0]);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 3), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(cx, WATER_Y, 0);
  return mesh;
}

function buildSea() {
  const minX = -8.5, minZ = -9.5, W = 17 * V, H = 19 * V;
  const mask = distanceMask(W, H, (x, y) => {
    const wx = minX + (x + 0.5) / V, wz = minZ + (y + 0.5) / V;
    return !!tileKind(Math.floor(wz + 4.5), Math.floor(wx + 3.5));
  });
  const mat = waterMaterial(mask, [minX, minZ, 17, 19], [C.water4, C.water3, C.water2, C.water0]);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = SEA_Y;
  return mesh;
}

// Light levels are tuned for the palette-snap pass; adjust at playtest, keep shadows light.
const SUN = 2.2, SKY = 1.6;
function addLights(scene) {
  scene.add(new THREE.HemisphereLight(C.white, C.water2, SKY));
  const sun = new THREE.DirectionalLight(0xfff4d6, SUN);
  sun.position.set(-8, 14, 3);       // lights the camera-facing −x sides, shades the +z sides
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
}

/** Point the camera along VIEW; its resting position is kept in cam.userData.base. */
export function aimCamera(cam, view = VIEW) {
  const yaw = THREE.MathUtils.degToRad(view.yaw), pitch = THREE.MathUtils.degToRad(view.pitch);
  const target = new THREE.Vector3(view.panX, 0, view.panZ);
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  cam.position.copy(target).addScaledVector(dir, CAMERA_DISTANCE);
  cam.lookAt(target);
  cam.updateMatrixWorld();
  cam.userData.base = cam.position.clone();
}

export function createCamera() {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 80);
  aimCamera(cam);
  return cam;
}

/** Frame the board plus a strip of island, with headroom for tall pieces at the back. */
export function fitCamera(cam, w, h, view = VIEW) {
  let hx = 0, hy = 0;
  const v = new THREE.Vector3();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
  for (const x of [-4.6, 4.6]) for (const y of [-0.5, 1.6]) for (const z of [-5.6, 5.6]) {
    v.set(x, y, z);                       // measured from the board centre, so panning moves the view
    hx = Math.max(hx, Math.abs(v.dot(right)));
    hy = Math.max(hy, Math.abs(v.dot(up)));
  }
  const aspect = w / h;
  const half = Math.max(hy, hx / aspect) * 1.04 / view.zoom;
  Object.assign(cam, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
  cam.updateProjectionMatrix();
}

export function buildWorld(scene) {
  scene.background = new THREE.Color(C.water2);
  addLights(scene);
  scene.add(buildIsland(), buildSea(), buildPool(-1.5), buildPool(1.5), buildTufts());

  const tiles = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (terrain[r][c] === 'water') continue;
      tiles[r][c] = tileTop(r, c, terrain[r][c]);
      scene.add(tiles[r][c]);
    }
  }

  return {
    tiles,
    traps: new Map(),       // "r,c" → trap prop (Task 6)
    dens: new Map(),        // "r,c" → den prop (Task 6)
    groundY: (r, c) => (terrain[r][c] === 'water' ? SWIM_Y : 0),
    surfaceY: (r, c) => (terrain[r][c] === 'water' ? WATER_Y : 0),
    liftTile(r, c, on) {
      const t = tiles[r]?.[c];
      if (t) t.position.y = t.userData.baseY + (on ? 1 / 16 : 0);
    },
  };
}
