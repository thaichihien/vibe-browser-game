/* Piece views: one voxel animal per piece, plus its team ring and rank badge. Idle life comes
   from breathing, a look-around, the tail, blinks and an occasional species flourish. Positions
   snap to the low-res pixel grid so moving pieces step in whole pixels, like sprites. A view
   whose `busy` flag is set belongs to an animation sequence (anim.js), and idle leaves it alone. */
import * as THREE from 'three';
import { ANIMALS, terrain } from './rules.js';
import { C, TEAM, hexCss } from './palette.js';
import { buildAnimal, buildArrow } from './models.js';
import { cellToWorld } from './layout.js';


const DIGITS = {
  1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'], 6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '010', '010', '010'], 8: ['111', '101', '111', '101', '111'],
};

function makeBadge(rank, team) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 9;
  const g = cv.getContext('2d');
  g.fillStyle = hexCss(C.ink); g.fillRect(0, 0, 9, 9);
  g.fillStyle = hexCss(TEAM[team].main); g.fillRect(1, 1, 7, 7);
  g.fillStyle = hexCss(C.white);
  DIGITS[rank].forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '1') g.fillRect(3 + x, 2 + y, 1, 1); }));
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: tex }));
  mesh.castShadow = false;
  return mesh;
}

const stretch = (v, k) => {
  const s = Math.sin(k * Math.PI);
  v.rig.legs[0].rotation.x = v.rig.legs[1].rotation.x = -0.7 * s;
  v.model.rotation.x = 0.12 * s;
  v.rig.head.rotation.x = -0.2 * s;
};
// Species flourishes, as poses of k ∈ [0, 1] over ~1.4 s.
const FLOURISH = {
  elephant(v, k) {
    const f = Math.sin(k * Math.PI * 4) * 0.7;
    v.rig.earL.rotation.y = -f; v.rig.earR.rotation.y = f;
    v.rig.trunk.rotation.x = -Math.sin(k * Math.PI) * 0.9;
  },
  lion(v, k) { v.rig.head.rotation.z = Math.sin(k * Math.PI * 6) * 0.25 * (1 - k); },
  cat(v, k) {
    const s = Math.sin(k * Math.PI);
    v.rig.legs[0].rotation.x = -1.3 * s;
    v.rig.head.rotation.x = 0.35 * s;
    v.rig.head.rotation.y = 0.3 * s;
  },
  rat(v, k) {
    v.rig.head.scale.z = 1 + 0.12 * Math.abs(Math.sin(k * Math.PI * 8));
    v.rig.head.rotation.y = Math.sin(k * Math.PI * 3) * 0.4;
  },
  dog(v, k) { v.rig.tail.rotation.y = Math.sin(k * Math.PI * 16) * 0.7; },
  wolf(v, k) { v.rig.head.rotation.x = -0.7 * Math.sin(Math.min(1, k * 1.4) * Math.PI); },
  tiger: stretch,
  leopard: stretch,
};

export function createViews({ scene, camera, world, getPixel }) {
  const views = new Map();
  const ringGeo = new THREE.RingGeometry(0.33, 0.43, 20);
  const hitGeo = new THREE.BoxGeometry(0.8, 1, 0.8);
  const hitMat = new THREE.MeshBasicMaterial();
  const starGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
  const starMat = new THREE.MeshBasicMaterial({ color: C.gold });
  const arrow = buildArrow();
  // Ground directions that move a point straight right / straight up on screen, and the pitch
  // factors, read off the camera each frame so the debug panel can turn the view.
  const SCREEN_RIGHT = new THREE.Vector3(), SCREEN_UP = new THREE.Vector3();
  let SIN_P = 0.577, COS_P = 0.816;
  function readCamera() {
    SCREEN_RIGHT.set(1, 0, 0).applyQuaternion(camera.quaternion).setY(0).normalize();
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    SIN_P = Math.max(0.05, -f.y);
    COS_P = Math.sqrt(1 - SIN_P * SIN_P);
    SCREEN_UP.copy(f).setY(0).normalize();
    arrow.rotation.y = Math.atan2(-SCREEN_UP.x, -SCREEN_UP.z);   // face the camera
  }
  readCamera();
  arrow.visible = false;
  scene.add(arrow);
  const tmp = new THREE.Vector3();
  let selectedId = null;
  let activePlayer = 'red';

  function cellPos(r, c) {
    const { x, z } = cellToWorld(r, c);
    return new THREE.Vector3(x, world.groundY(r, c), z);
  }

  function add(piece) {
    const a = buildAnimal(piece.type, piece.player);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: TEAM[piece.player].main }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.015;
    const badge = makeBadge(ANIMALS[piece.type].rank, piece.player);
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.visible = false;
    hit.scale.y = a.height;
    hit.position.y = a.height / 2;
    hit.userData.pieceId = piece.id;
    a.root.add(ring, badge, hit);
    scene.add(a.root);
    const v = {
      ...a, ring, badge, hit, piece,
      pos: cellPos(piece.row, piece.col), air: 0, busy: false,
      seed: Math.random() * 100, blinkT: 1 + Math.random() * 4,
      nextFlourish: 3 + Math.random() * 6, flourish: null, weakened: false, stars: null,
    };
    views.set(piece.id, v);
    snap(v, getPixel().ppu);
    return v;
  }

  function remove(v) {
    scene.remove(v.root);
    v.mat.dispose();
    v.ring.material.dispose();
    v.badge.material.map.dispose();
    v.badge.material.dispose();
    v.badge.geometry.dispose();
    views.delete(v.piece.id);
  }
  const clear = () => [...views.values()].forEach(remove);

  function resetPose(v) {
    const R = v.rig;
    R.body.position.y = R.bodyY;
    R.head.rotation.set(0, 0, 0);
    R.head.scale.set(1, 1, 1);
    R.tail.rotation.set(0, 0, 0);
    R.legs.forEach(l => l.rotation.set(0, 0, 0));
    if (R.trunk) R.trunk.rotation.set(0, 0, 0);
    if (R.earL) { R.earL.rotation.set(0, 0, 0); R.earR.rotation.set(0, 0, 0); }
    v.model.rotation.x = 0;
    v.model.rotation.z = 0;
    v.model.scale.set(1, 1, 1);
  }

  function setWeakened(v, on) {
    if (v.weakened === on) return;
    v.weakened = on;
    v.mat.color.setHex(on ? 0xb0b0b0 : 0xffffff);
    if (on) {
      v.stars = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const m = new THREE.Mesh(starGeo, starMat);
        const a = (i * Math.PI * 2) / 3;
        m.position.set(Math.cos(a) * 0.18, 0, Math.sin(a) * 0.18);
        v.stars.add(m);
      }
      v.root.add(v.stars);
    } else {
      v.root.remove(v.stars);
      v.stars = null;
    }
  }

  /** Put the root on the pixel grid: the screen-space rounding error is undone along the ground. */
  function snap(v, ppu) {
    tmp.copy(v.pos).applyMatrix4(camera.matrixWorldInverse);
    const dx = Math.round(tmp.x / ppu) * ppu - tmp.x;
    const dy = Math.round(tmp.y / ppu) * ppu - tmp.y;
    v.root.position.copy(v.pos).addScaledVector(SCREEN_RIGHT, dx).addScaledVector(SCREEN_UP, dy / SIN_P);
    const step = ppu / COS_P;                      // one pixel of vertical world motion
    v.model.position.y = Math.round(v.air / step) * step;
  }

  function update(dt, t) {
    const { ppu } = getPixel();
    readCamera();
    for (const v of views.values()) {
      const R = v.rig, s = v.seed;
      const active = v.piece.player === activePlayer;
      const sel = v.piece.id === selectedId;
      if (!v.busy) {
        if (v.flourish) {
          v.flourish.t += dt;
          const k = Math.min(1, v.flourish.t / v.flourish.dur);
          resetPose(v);
          v.flourish.fn(v, k);
          if (k >= 1) { v.flourish = null; resetPose(v); }
        } else {
          R.body.position.y = R.bodyY + Math.sin(t * 2.4 + s) * 0.012 * (active ? 1.5 : 1);
          R.head.rotation.x = Math.sin(t * 1.3 + s) * 0.06;
          R.head.rotation.y = Math.sin(t * 0.45 + s * 2) * (active ? 0.3 : 0.18);
          R.tail.rotation.y = Math.sin(t * 3 + s) * 0.3;
          if (R.trunk) R.trunk.rotation.x = Math.sin(t * 1.1 + s) * 0.15;
          if (R.earL) { const f = Math.sin(t * 1.6 + s) * 0.12; R.earL.rotation.y = -f; R.earR.rotation.y = f; }
          v.nextFlourish -= dt;
          if (v.nextFlourish <= 0) {
            v.nextFlourish = 6 + Math.random() * 8;
            v.flourish = { t: 0, dur: 1.4, fn: FLOURISH[v.piece.type] };
          }
        }
        const swimming = terrain[v.piece.row][v.piece.col] === 'water';
        v.air = sel ? Math.abs(Math.sin(t * 6)) * 0.08 : swimming ? 0.02 + Math.sin(t * 3 + s) * 0.02 : 0;
      }
      v.blinkT -= dt;
      if (v.blinkT < -0.12) v.blinkT = 2 + Math.random() * 4;
      R.eyes.scale.y = v.blinkT < 0 ? 0.25 : 1;
      v.ring.scale.setScalar(sel ? 1 + Math.sin(t * 8) * 0.08 : 1);
      v.ring.material.color.setHex(active ? TEAM[v.piece.player].main : TEAM[v.piece.player].dark);
      snap(v, ppu);
      v.badge.position.y = v.height + 0.2 + v.model.position.y;
      v.badge.quaternion.copy(camera.quaternion);
      if (v.stars) {
        v.stars.rotation.y = t * 3;
        v.stars.position.y = v.height + 0.02 + v.model.position.y;
      }
    }
    const sv = views.get(selectedId);
    arrow.visible = !!sv;
    if (sv) {
      arrow.position.set(sv.root.position.x,
        sv.root.position.y + sv.model.position.y + sv.height + 0.42 + Math.abs(Math.sin(t * 4)) * 0.08,
        sv.root.position.z);
    }
  }

  return {
    views, add, remove, clear, cellPos, resetPose, setWeakened, update,
    get: id => views.get(id),
    setSelected(id) { selectedId = id; },
    setActive(player) { activePlayer = player; },
    hitboxes: () => [...views.values()].map(v => v.hit),
  };
}

/** Portraits for the captured trays: each animal rendered through the same pixel pipeline. */
export function makePortraits(pixel) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.cream);
  scene.add(new THREE.HemisphereLight(C.white, C.water2, 1.6));
  const sun = new THREE.DirectionalLight(0xfff4d6, 2.2);
  sun.position.set(8, 14, 3);
  scene.add(sun);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 80);
  const out = {};
  for (const team of ['red', 'blue']) {
    for (const type of Object.keys(ANIMALS)) {
      const a = buildAnimal(type, team);
      a.model.rotation.y = Math.PI / 4;           // three-quarter view toward the camera
      scene.add(a.root);
      const half = 0.3 + a.height * 0.45;
      Object.assign(cam, { left: -half, right: half, top: half, bottom: -half });
      cam.updateProjectionMatrix();
      cam.position.set(20, 20 + a.height / 2, 20);
      cam.lookAt(0, a.height / 2, 0);
      cam.updateMatrixWorld();
      out[`${type}:${team}`] = pixel.snapshot(scene, cam, 40, 40);
      scene.remove(a.root);
      a.mat.dispose();
    }
  }
  return out;
}
