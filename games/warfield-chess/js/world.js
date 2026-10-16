/* Warfield Chess — the battlefield: a golden-hour sky, rolling terrain with the 8×8 field faintly
   tinted into squares, wind-blown grass, forests on the hills, tree clumps / rocks / bushes on the
   field itself (they block sight, never movement), and each side's fortress behind its back rank.
   Obstacles sit on square corners and edges so they never overlap a unit standing on a square. */
import * as THREE from 'three';
import { Kit, box, cyl, cone, ico, flatMat, H, fbm, noise, rng, SQ, HALF } from './geo.js';
import { TEAMS } from './units.js';

export const SUN_DIR = new THREE.Vector3(0.55, 0.36, -0.75).normalize();
export const MIST = new THREE.Color('#cfc6ad');

const material = flatMat();

function sky() {
  const geo = new THREE.SphereGeometry(900, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color('#4f7fc4') }, horizon: { value: new THREE.Color('#f0d3a6') },
      low: { value: MIST.clone() }, sunDir: { value: SUN_DIR }, sunCol: { value: new THREE.Color('#ffd9a0') },
      uTime: { value: 0 }, mist: { value: 0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform vec3 top, horizon, low, sunDir, sunCol; uniform float uTime, mist; varying vec3 vDir;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
        return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
      float fb(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++){ v += a*vn(p); p *= 2.07; a *= .5; } return v; }
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 col = mix(horizon, top, pow(clamp(h, 0., 1.), 0.5));
        col = mix(col, low, smoothstep(0.06, -0.02, h));
        float s = max(dot(d, sunDir), 0.);
        col += sunCol * (pow(s, 900.) * 6. + pow(s, 12.) * 0.35);
        if (h > 0.02) {
          vec2 uv = d.xz / (h + 0.12) * 1.4 + vec2(uTime * 0.004, 0.);
          float c = smoothstep(0.52, 0.8, fb(uv));
          vec3 cc = mix(vec3(1.0, 0.93, 0.85), vec3(1.0, 0.8, 0.62), pow(s, 3.));
          col = mix(col, cc, c * 0.85 * smoothstep(0.02, 0.2, h));
        }
        // in a unit's view the mist climbs the sky, so nothing tall beyond sight shows as a silhouette
        col = mix(col, low, mist * (1. - smoothstep(0.2, 0.6, h)));
        gl_FragColor = vec4(col, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}

function terrain() {
  const geo = new THREE.PlaneGeometry(760, 760, 240, 240).rotateX(-Math.PI / 2);
  const p = geo.attributes.position, cols = [];
  const c = new THREE.Color(), lush = new THREE.Color('#4d6b24'), dry = new THREE.Color('#9a9346'), dirt = new THREE.Color('#7a6440'), dark = new THREE.Color('#33501c');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = H(x, z);
    p.setY(i, y);
    const n = fbm(x * 0.02 + 40, z * 0.02 - 13, 4);
    c.copy(lush).lerp(dry, Math.min(1, Math.max(0, (n - 0.42) * 2.4)));
    c.lerp(dark, Math.min(1, Math.max(0, (fbm(x * 0.008 - 3, z * 0.008 + 9, 3) - 0.55) * 3)) * Math.min(1, y / 18));
    if (noise(x * 0.09, z * 0.09) > 0.82) c.lerp(dirt, 0.35);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  mesh.receiveShadow = true;
  return mesh;
}

/** A barely-there tint over the field so a careful eye can count squares in the grass. */
function fieldTint() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d'), s = 1024 / 8;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    if ((r + f) % 2 === 0) { g.fillStyle = 'rgba(70, 58, 10, 0.16)'; g.fillRect(f * s, r * s, s, s); }
    else { g.fillStyle = 'rgba(190, 210, 120, 0.06)'; g.fillRect(f * s, r * s, s, s); }
  }
  g.strokeStyle = 'rgba(60, 45, 20, 0.22)'; g.lineWidth = 3;
  for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, 1024); g.moveTo(0, i * s); g.lineTo(1024, i * s); g.stroke(); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const geo = new THREE.PlaneGeometry(SQ * 8, SQ * 8, 80, 80).rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, H(p.getX(i), p.getZ(i)) + 0.04);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
  mesh.receiveShadow = true;
  return mesh;
}

function grass(time, seed) {
  const R = rng(seed ^ 0x9e37);
  const k = new Kit();
  // three crossed blades per instance, each bending slightly
  for (let i = 0; i < 3; i++) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.05, 0, 0, 0.05, 0, 0, -0.03, 0.5, 0.02, 0.03, 0.5, 0.02, 0, 1, 0.08], 3));
    g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
    k.add(g, '#ffffff', [(R() - 0.5) * 0.3, 0, (R() - 0.5) * 0.3], [0, (i / 3) * Math.PI + R() * 0.5, 0]);
  }
  const geo = k.build();
  const nrm = geo.attributes.normal.array;
  for (let i = 0; i < nrm.length; i += 3) { nrm[i] = 0; nrm[i + 1] = 1; nrm[i + 2] = 0; }   // lit like the ground
  const mat = new THREE.MeshLambertMaterial({ vertexColors: false, side: THREE.DoubleSide });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = time;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 ip = instanceMatrix[3];
      float w = sin(uTime * 1.6 + ip.x * 0.13 + ip.z * 0.09) * 0.6 + sin(uTime * 3.3 + ip.x * 0.7 + ip.z * 0.4) * 0.25;
      float hh = position.y * position.y;
      transformed.x += w * hh * 0.28; transformed.z += w * hh * 0.18;`);
    // both faces lit as the ground is: no dark backsides
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize(vNormal);');
  };
  const N = 46000, AREA = SQ * 8 + 34;
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const c = new THREE.Color(), cA = new THREE.Color('#5e7d27'), cB = new THREE.Color('#a8a14c'), cC = new THREE.Color('#3f6020');
  for (let i = 0; i < N; i++) {
    const x = (R() - 0.5) * AREA, z = (R() - 0.5) * AREA;
    const n = fbm(x * 0.02 + 40, z * 0.02 - 13, 3);
    const tall = 0.45 + R() * 0.4 + n * 0.3;
    m.compose(v.set(x, H(x, z) - 0.05, z), q.setFromEuler(e.set(0, R() * 6.28, 0)), s.set(1.1, tall, 1.1));
    mesh.setMatrixAt(i, m);
    c.copy(cA).lerp(cB, Math.min(1, Math.max(0, (n - 0.4) * 2.2 + (R() - 0.5) * 0.3))).lerp(cC, R() * 0.3);
    mesh.setColorAt(i, c);
  }
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

// ---------- trees, rocks, bushes ----------
const TREE_GEOS = (() => {
  const pine = new Kit().add(cyl(0.22, 0.32, 3, 6), '#4a3322', [0, 1.5, 0])
    .add(cone(2.4, 4.2, 7), '#2c4a22', [0, 3.6, 0]).add(cone(1.9, 3.6, 7), '#335826', [0, 5.4, 0]).add(cone(1.3, 3.0, 7), '#3b6229', [0, 7.1, 0]).build();
  const oak = new Kit().add(cyl(0.28, 0.42, 3.6, 6), '#4d3725', [0, 1.8, 0]).add(cyl(0.12, 0.18, 2, 5), '#4d3725', [0.7, 3.6, 0], [0, 0, -0.6])
    .add(ico(2.3, 0), '#476f2a', [0, 5.0, 0]).add(ico(1.8, 0), '#55802f', [1.5, 4.5, 0.6]).add(ico(1.7, 0), '#3e6324', [-1.3, 4.6, -0.5]).add(ico(1.5, 0), '#5a8633', [0.2, 6.3, 0.3]).build();
  const rock = new Kit().add(ico(1, 1), '#8a8478').build();
  const p = rock.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), f = 0.75 + noise(x * 2 + 5, z * 2 + y * 3) * 0.5;
    p.setXYZ(i, x * f, Math.max(-0.3, y) * f * 0.75, z * f);
  }
  rock.computeVertexNormals();
  const bush = new Kit().add(ico(0.9, 0), '#3f5e22', [0, 0.5, 0]).add(ico(0.7, 0), '#4b6d29', [0.6, 0.45, 0.2]).add(ico(0.65, 0), '#36521d', [-0.5, 0.4, -0.2]).build();
  return { pine, oak, rock, bush };
})();

function scatter(geo, items) {
  const mesh = new THREE.InstancedMesh(geo, material, items.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  items.forEach((it, i) => {
    m.compose(v.set(it.x, H(it.x, it.z) - (it.sink || 0.1), it.z), q.setFromEuler(e.set(it.tilt || 0, it.ry, 0)), s.set(it.s * (it.sx || 1), it.s * (it.sy || 1), it.s));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.setScalar(it.shade ?? 1));
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Trees and rocks on square corners, bushes on square edges, forests around the field. */
function vegetation(seed) {
  const R = rng(seed);
  const pines = [], oaks = [], rocks = [], bushes = [];
  const shade = () => 0.8 + R() * 0.35;
  const corners = [];
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) corners.push([i, j]);
  corners.sort(() => R() - 0.5);
  let placed = 0;
  for (const [i, j] of corners) {
    if (placed >= 17) break;
    if (j === 0 || j === 8) continue;                       // keep each back line open
    const x = -HALF + i * SQ, z = -HALF + j * SQ;
    const kind = R();
    if (kind < 0.62) {
      const n = 1 + Math.floor(R() * 3);
      for (let t = 0; t < n; t++) {
        const a = R() * 6.28, d = t ? 0.9 + R() * 0.7 : 0;
        const tree = { x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, ry: R() * 6.28, s: 0.75 + R() * 0.4, shade: shade() };
        (R() < 0.5 ? pines : oaks).push(tree);
      }
    } else {
      rocks.push({ x, z, ry: R() * 6.28, s: 1.4 + R() * 0.9, sy: 1.2 + R() * 0.9, shade: shade(), sink: 0.3 });
      if (R() < 0.6) rocks.push({ x: x + (R() - 0.5) * 2.4, z: z + (R() - 0.5) * 2.4, ry: R() * 6.28, s: 0.6 + R() * 0.5, shade: shade(), sink: 0.2 });
    }
    placed++;
  }
  for (let k = 0; k < 26; k++) {
    const along = Math.floor(R() * 8), line = 1 + Math.floor(R() * 7);
    const vertical = R() < 0.5;
    const a = -HALF + (along + 0.5) * SQ + (R() - 0.5) * 3, b = -HALF + line * SQ;
    bushes.push({ x: vertical ? b : a, z: vertical ? a : b, ry: R() * 6.28, s: 0.9 + R() * 0.7, sy: 0.8 + R() * 0.6, shade: shade() });
  }
  // forests: denser in patches, thinning toward the far hills; clear of the field and the fortresses
  for (let k = 0; k < 2600; k++) {
    const x = (R() - 0.5) * 640, z = (R() - 0.5) * 640;
    const d = Math.max(Math.abs(x), Math.abs(z));
    if (d < HALF + 9) continue;
    if (Math.abs(x) < 44 && Math.abs(z) > HALF + 14 && Math.abs(z) < HALF + 52) continue;
    if (fbm(x * 0.018 + 7, z * 0.018 - 2, 3) < 0.48 - Math.min(0.12, (d - HALF) * 0.004)) continue;
    const tree = { x, z, ry: R() * 6.28, s: 0.9 + R() * 0.7, shade: shade() };
    (fbm(x * 0.01, z * 0.01, 2) > 0.5 ? pines : oaks).push(tree);
  }
  for (let k = 0; k < 140; k++) {
    const x = (R() - 0.5) * 300, z = (R() - 0.5) * 300;
    if (Math.max(Math.abs(x), Math.abs(z)) < HALF + 6) continue;
    rocks.push({ x, z, ry: R() * 6.28, s: 0.8 + R() * 2.5, sy: 0.7 + R(), shade: shade(), sink: 0.4 });
  }
  const group = new THREE.Group();
  group.add(scatter(TREE_GEOS.pine, pines), scatter(TREE_GEOS.oak, oaks), scatter(TREE_GEOS.rock, rocks), scatter(TREE_GEOS.bush, bushes));
  return group;
}

function fortress(team, z) {
  const T = TEAMS[team], k = new Kit(), stone = '#b9ab8e', stoneD = '#8f826a';
  const dir = Math.sign(z);
  const y0 = Math.min(H(-30, z), H(30, z), H(0, z), H(0, z + dir * 14)) - 1;
  k.add(box(64, 9 + 6, 3), stone, [0, 1.5, 0]);
  for (let i = -15; i <= 15; i++) k.add(box(1.2, 1.3, 3.2), stone, [i * 2.05, 9.6, 0]);
  k.add(box(9, 8, 3.4), stoneD, [0, 2, -dir * 0.1]).add(box(5, 6, 3.6), '#2e2418', [0, 1.5, 0]);
  for (const x of [-32, -11, 11, 32]) {
    k.add(cyl(3.6, 4.0, 18, 10), stone, [x, 4, 0]).add(cyl(4.0, 4.0, 1.2, 10), stoneD, [x, 13.4, 0]);
    k.add(cone(4.6, 6, 10), T.main, [x, 17, 0]);
  }
  k.add(box(30, 12, 22), stoneD, [0, 3, dir * 14]).add(cyl(5, 5.5, 26, 8), stone, [0, 9, dir * 16]).add(cone(6, 8, 8), T.dark, [0, 26, dir * 16]);
  const mesh = new THREE.Mesh(k.build(), material);
  mesh.position.set(0, y0, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  // banners on the towers
  const tex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128;
    const g = c.getContext('2d'); g.fillStyle = T.flag; g.fillRect(0, 0, 64, 128); g.fillStyle = T.trim; g.fillRect(0, 54, 64, 14);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const flagMat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 1 });
  for (const x of [-21.5, 21.5]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 7), flagMat);
    f.position.set(x, y0 + 6, z - dir * 1.8);
    group.add(f);
  }
  return group;
}

export function buildWorld(scene, seed) {
  const time = { value: 0 };
  scene.background = MIST.clone();
  scene.fog = new THREE.Fog(MIST.clone(), 20, 60);
  const skyMesh = sky();
  scene.add(skyMesh);

  const hemi = new THREE.HemisphereLight('#d4e2ff', '#5c4c2c', 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffdcaa', 2.7);
  sun.position.copy(SUN_DIR).multiplyScalar(140);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -68, right: 68, top: 68, bottom: -68, near: 10, far: 330 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  scene.add(terrain(), fieldTint(), grass(time, seed), vegetation(seed));
  scene.add(fortress('w', HALF + 34), fortress('b', -HALF - 34));

  return {
    sun,
    sky: skyMesh,
    update(t) { time.value = t; skyMesh.material.uniforms.uTime.value = t; },
    /** Mist distance. Units see as far as their height allows. */
    setSight(far) {
      scene.fog.far = far; scene.fog.near = far * 0.3;
      skyMesh.material.uniforms.mist.value = Math.min(1, Math.max(0, (220 - far) / 100));
    },
  };
}
