/* Small effects kit: promise tweens with a global hit-stop, one pooled InstancedMesh of cubes
   for every particle (dust, blood, splashes, smoke, sparks, confetti, stains), and a camera
   shake measured in whole low-res pixels so the shaken frame stays crisp. */
import * as THREE from 'three';

export const ease = {
  linear: t => t,
  out: t => 1 - (1 - t) ** 3,
  in: t => t ** 3,
  inOut: t => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: t => { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
};

const tweens = new Set();
let frozen = 0;

/** Run fn(easedK, k) every frame for `ms`; resolves when done. */
export function tween(ms, fn, easing = ease.inOut) {
  return new Promise(res => tweens.add({ t: 0, d: Math.max(1, ms), fn, easing, res }));
}
export const wait = ms => tween(ms, () => {});
/** Freeze every tween for `ms` — the impact frame of a capture. */
export function hitStop(ms) { frozen = Math.max(frozen, ms); }

export function updateTweens(dtMs) {
  if (frozen > 0) { frozen -= dtMs; return; }
  for (const tw of [...tweens]) {
    tw.t += dtMs;
    const k = Math.min(1, tw.t / tw.d);
    tw.fn(tw.easing(k), k);
    if (k >= 1) { tweens.delete(tw); tw.res(); }
  }
}

export function createParticles(scene, max = 900) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, new THREE.Color(1, 1, 1));       // allocates instanceColor
  mesh.count = 0;
  mesh.frustumCulled = false;
  scene.add(mesh);

  const list = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const sc = new THREE.Vector3(), col = new THREE.Color();

  function spawn(o) {
    if (list.length >= max) return;
    const size = o.size ?? 0.05;
    list.push({
      p: o.pos.clone(), v: o.vel ? o.vel.clone() : new THREE.Vector3(),
      size, sy: o.flat ? 0.012 : (o.sy ?? size), color: o.color,
      life: o.life ?? 1, age: 0, g: o.gravity ?? 9, drag: o.drag ?? 0,
      floor: o.floor ?? -Infinity, onFloor: o.onFloor, spin: o.spin ?? 0, rot: Math.random() * 6,
      shrink: o.shrink ?? true, tail: o.tail ?? 1, grow: o.grow ?? 0,
    });
  }

  function update(dt) {
    const landed = [];
    for (let i = list.length - 1; i >= 0; i--) {
      const P = list[i];
      P.age += dt;
      if (P.age >= P.life) { list.splice(i, 1); continue; }
      P.v.y -= P.g * dt;
      if (P.drag) P.v.multiplyScalar(Math.max(0, 1 - P.drag * dt));
      P.p.addScaledVector(P.v, dt);
      P.rot += P.spin * dt;
      if (P.p.y < P.floor) {
        P.p.y = P.floor;
        if (P.onFloor) { landed.push(P); list.splice(i, 1); continue; }
        P.v.set(0, 0, 0);
        P.spin = 0;
      }
    }
    landed.forEach(P => P.onFloor(P));                 // may spawn stains; safe after the loop

    let n = 0;
    for (const P of list) {
      const left = 1 - P.age / P.life;
      const k = P.shrink ? Math.min(1, left / P.tail) : 1;
      const g = 1 + P.grow * (P.age / P.life);
      sc.set(P.size * k * g, P.sy * k * g, P.size * k * g);
      q.setFromEuler(e.set(P.rot, P.rot * 0.7, 0));
      m4.compose(P.p, q, sc);
      mesh.setMatrixAt(n, m4);
      mesh.setColorAt(n, col.setHex(P.color));
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  return { spawn, update, clear: () => { list.length = 0; } };
}

const shake = { t: 0, dur: 1, amp: 0 };
export function startShake(intensity = 'heavy') {
  const heavy = intensity !== 'soft';
  shake.amp = heavy ? 4 : 2;
  shake.dur = shake.t = heavy ? 0.55 : 0.35;
}
/** This frame's shake offset in whole low-res pixels. */
export function shakeOffset(dt) {
  if (shake.t <= 0) return [0, 0];
  shake.t -= dt;
  const a = Math.round(shake.amp * Math.max(0, shake.t / shake.dur));
  return [Math.round((Math.random() * 2 - 1) * a), Math.round((Math.random() * 2 - 1) * a)];
}
