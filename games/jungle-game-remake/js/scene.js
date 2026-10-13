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
 * home, row 8) to the top-left (red's home, row 0). Pitch 51.5° (steeper than true iso, 35.264°)
 * keeps tall pieces from hiding the squares behind them; chosen by playtest. The debug
 * panel (?debug) edits these live; `zoom` multiplies the framed size and `panX`/`panZ` slide the
 * view across the ground.
 */
export const VIEW = { yaw: -45, pitch: 51.5, zoom: 1.27, panX: 0, panZ: 0 };
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
// Water: everything is computed on the 1/8-tile voxel grid so it reads as pixel art.
// Distances come from a shore-distance texture in tiles (`uCap` = its range):
//   · shallows lighten toward land, slow drifting patches mottle the open water;
//   · thin caustic light-lines wander across it;
//   · land (island, or a pool's walls) casts a darker shadow on the side away from the sun;
//   · a wobbly foam line hugs the shore and broken wave rings roll outward and fade;
//   · now and then a single pixel glints.
const WATER_FRAG = /* glsl */`
uniform float uTime;
uniform sampler2D uMask;
uniform vec4 uBounds;
uniform float uCap;
uniform vec2 uSunOffset;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uLight;
uniform vec3 uFoam;
uniform vec3 uDark;
varying vec3 vWorld;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float shoreAt(vec2 q) { return texture2D(uMask, (q - uBounds.xy) / uBounds.zw).r * uCap; }

void main() {
  vec2 cell = floor(vWorld.xz * 8.0);
  vec2 q = (cell + 0.5) / 8.0;                       // centre of this water pixel's voxel
  float d = shoreAt(q);                               // tiles to the nearest land

  // depth: shallows near land, then mottled open water
  vec3 col = mix(uDeep, uShallow, smoothstep(1.4, 0.15, d));
  float patchN = noise(q * 0.45 + vec2(uTime * 0.03, -uTime * 0.02));
  if (patchN > 0.68) col = mix(col, uDark, 0.45);
  else if (patchN < 0.3) col = mix(col, uShallow, 0.45);

  // caustic light-lines: where either of two warped waves crosses zero
  vec2 w = q * 1.7;
  float c1 = abs(sin(w.x + 1.2 * sin(w.y * 1.3 + uTime * 0.7) + uTime * 0.4));
  float c2 = abs(sin(w.y * 1.1 + 1.3 * sin(w.x * 0.9 - uTime * 0.6) - uTime * 0.35));
  if (min(c1, c2) < 0.07) col = mix(col, uLight, 0.8);

  // land shadow on the side away from the sun
  if (d > 0.02 && shoreAt(q + uSunOffset) < 0.05) col = mix(col, uDark, 0.55);

  // foam: a wobbly line on the shore, broken wave rings rolling out
  float n = noise(q * 2.2 + uTime * 0.3);
  float shore = 0.12 + 0.04 * sin(uTime * 2.0 + (q.x + q.y) * 2.5) + (n - 0.5) * 0.08;
  if (d < shore) {
    col = uFoam;
  } else {
    for (int i = 0; i < 2; i++) {
      float ph = fract(uTime * 0.2 + float(i) * 0.5);
      float ring = 0.2 + ph * 0.55;
      if (abs(d - ring) < 0.05 && n > 0.3 + ph * 0.5) col = mix(col, uFoam, 0.85 - ph * 0.5);
    }
  }

  // glints out in open water
  if (d > 0.4 && hash(cell + floor(uTime * 2.0)) > 0.9975) col = uFoam;

  gl_FragColor = vec4(col, 1.0);
}`;

/**
 * Distance-to-land texture: 0 on solid texels, rising to 1 at `cap` texels away. A two-pass
 * chamfer (3–4) gives round distances, so foam rings follow the coast instead of squaring off.
 */
function distanceMask(w, h, solid, cap) {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = solid(i % w, (i / w) | 0) ? 0 : INF;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? INF : d[y * w + x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    d[i] = Math.min(d[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    d[i] = Math.min(d[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
  }
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = Math.round(Math.min(1, d[i] / 3 / cap) * 255);
    data.set([v, v, v, 255], i * 4);
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// Where a water point looks to see whether land blocks the sun: toward the sun, by roughly the
// height of the island over the sun's slope.
const SUN_DIR = new THREE.Vector3(-8, 14, 3);
const sunOffset = reach => new THREE.Vector2(SUN_DIR.x, SUN_DIR.z).normalize().multiplyScalar(reach);

function waterMaterial(mask, bounds, capTiles, reach, [deep, shallow, light, foam, dark]) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uMask: { value: mask },
      uBounds: { value: new THREE.Vector4(...bounds) },
      uCap: { value: capTiles },
      uSunOffset: { value: sunOffset(reach) },
      uDeep: { value: new THREE.Color(deep) },
      uShallow: { value: new THREE.Color(shallow) },
      uLight: { value: new THREE.Color(light) },
      uFoam: { value: new THREE.Color(foam) },
      uDark: { value: new THREE.Color(dark) },
    },
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
  });
}

function buildPool(cx) {
  // 2 × 3 squares; a one-texel solid border stands in for the walls (foam, wall shadow)
  const W = 2 * V + 2, H = 3 * V + 2;
  const mask = distanceMask(W, H, (x, y) => x === 0 || y === 0 || x === W - 1 || y === H - 1, V);
  const mat = waterMaterial(mask, [cx - 1 - 1 / V, -1.5 - 1 / V, W / V, H / V], 1, 0.25,
    [C.water3, C.water2, C.water1, C.water0, C.water4]);
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
  }, 3 * V);
  const mat = waterMaterial(mask, [minX, minZ, 17, 19], 3, 0.55,
    [C.water4, C.water2, C.water1, C.white, C.water5]);
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
  sun.position.copy(SUN_DIR);       // lights the camera-facing −x sides, shades the +z sides
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
