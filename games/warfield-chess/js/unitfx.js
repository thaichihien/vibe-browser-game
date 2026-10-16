/* Warfield Chess — combat effects owned by a unit: archers' arrow volleys and the Bishop's spell.
   Both live in the unit's local frame (front is -z), so they turn with it. Neither is fog-proof on
   purpose: arrows are ordinary geometry and fade into the mist; the spell's glow is additive (it
   would shine through fog), so it is hidden whenever the viewer is beyond its sight range —
   main.js reports the viewer through setViewer(). */
import * as THREE from 'three';
import { Kit, cyl, cone, box, flatMat } from './geo.js';

const viewer = { pos: new THREE.Vector3(), sight: 1e9 };
export function setViewer(pos, sight) { viewer.pos.copy(pos); viewer.sight = sight; }
const _w = new THREE.Vector3();
/** Is this object close enough to the viewer to be seen through the mist? */
const inSight = obj => obj.getWorldPosition(_w).distanceTo(viewer.pos) < viewer.sight;

// ---------- arrows ----------
const arrowGeo = (() => {
  const k = new Kit(5);
  k.add(cyl(0.012, 0.012, 0.78, 5), '#8a6238', [0, 0, 0], [Math.PI / 2, 0, 0]);
  k.add(cone(0.028, 0.1, 4), '#5f656c', [0, 0, -0.43], [-Math.PI / 2, 0, 0]);
  for (const r of [0, Math.PI / 2]) k.add(box(0.07, 0.004, 0.12), '#e8e0cc', [0, 0, 0.33], [0, 0, r]);
  return k.build();
})();
const arrowMat = flatMat();
const GRAVITY = 9.8;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const _fwd = new THREE.Vector3(0, 0, -1), _zero = new THREE.Vector3(0, 0, 0);

/** A pool of arrows shot by archers: a high arc forward, then stuck in the ground for a moment. */
export class Arrows {
  constructor(parent, groundAt, max = 24) {
    this.mesh = new THREE.InstancedMesh(arrowGeo, arrowMat, max);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.groundAt = groundAt;
    this.items = Array.from({ length: max }, () => ({ live: false, stuck: 0, p: new THREE.Vector3(), v: new THREE.Vector3() }));
    this.next = 0;
    _m.compose(_zero, _q.identity(), _s.set(0, 0, 0));
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, _m);
    parent.add(this.mesh);
  }
  /** Loose one arrow from a point (unit-local), aimed forward with a little spread. */
  shoot(from, spread = 1) {
    const a = this.items[this.next++ % this.items.length];
    a.live = true; a.stuck = 0;
    a.p.copy(from);
    a.v.set((Math.random() - 0.5) * 2.2 * spread, 7 + Math.random() * 2.5, -13 - Math.random() * 4);
  }
  update(dt) {
    this.items.forEach((a, i) => {
      if (!a.live) return;
      if (a.stuck > 0) {
        a.stuck -= dt;
        if (a.stuck <= 0) { a.live = false; _m.compose(_zero, _q.identity(), _s.set(0, 0, 0)); this.mesh.setMatrixAt(i, _m); }
        return;
      }
      a.v.y -= GRAVITY * dt;
      a.p.addScaledVector(a.v, dt);
      if (a.p.y < this.groundAt(a.p.x, a.p.z) + 0.25) { a.p.y = this.groundAt(a.p.x, a.p.z) + 0.25; a.stuck = 1.6; }
      _q.setFromUnitVectors(_fwd, _v.copy(a.v).normalize());
      _m.compose(a.p, _q, _s.set(1, 1, 1));
      this.mesh.setMatrixAt(i, _m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------- the Bishop's spell ----------
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function runeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.translate(256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.fillStyle = 'rgba(255,255,255,0.95)';
  g.shadowColor = 'white'; g.shadowBlur = 12;
  for (const [r, w] of [[240, 6], [214, 3], [128, 4], [110, 2]]) { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
  g.lineWidth = 3;
  for (let k = 0; k < 2; k++) {                          // two interlaced triangles
    g.beginPath();
    for (let i = 0; i <= 3; i++) { const a = (i / 3) * Math.PI * 2 + k * Math.PI / 3; const x = Math.sin(a) * 214, y = Math.cos(a) * 214; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }
  g.font = 'bold 26px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
  for (let i = 0; i < 24; i++) { g.save(); g.rotate((i / 24) * Math.PI * 2); g.fillText(runes[i], 0, -227); g.restore(); }
  return new THREE.CanvasTexture(c);
}
let GLOW = null, RUNE = null;

/** Glowing orb, a turning rune circle on the ground, and bolts of light flung forward with a
    sparkling trail that burst where they land. Everything is a child of the cart. */
export class Spell {
  constructor(parent, orb, color = '#8fdcff') {
    GLOW ||= glowTexture(); RUNE ||= runeTexture();
    this.parent = parent;
    this.orb = orb.clone();
    this.color = new THREE.Color(color);
    const add = (opacity, size) => new THREE.SpriteMaterial({ map: GLOW, color: this.color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.glow = new THREE.Sprite(add(0, 1));
    this.glow.position.copy(orb);
    parent.add(this.glow);
    this.circle = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 6.5).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: RUNE, color: this.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.circle.position.set(0, 0.12, -0.6);
    parent.add(this.circle);
    this.bolts = Array.from({ length: 5 }, () => {
      const s = new THREE.Sprite(add(1, 1));
      s.visible = false; s.scale.setScalar(0.9);
      parent.add(s);
      return { s, life: 0, v: new THREE.Vector3(), wob: 0 };
    });
    // sparks: a Points pool whose colour fades to black (additive, so black is invisible)
    const N = 160;
    this.spark = { pos: new Float32Array(N * 3), col: new Float32Array(N * 3), vel: new Float32Array(N * 3), life: new Float32Array(N), next: 0, N };
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.spark.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.spark.col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ map: GLOW, size: 0.45, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.points.frustumCulled = false;
    parent.add(this.points);
    this.cooldown = 0.3;
  }
  sparks(at, n, speed, life = 0.7) {
    const S = this.spark;
    for (let k = 0; k < n; k++) {
      const i = S.next++ % S.N;
      S.pos.set([at.x, at.y, at.z], i * 3);
      S.vel.set([(Math.random() - 0.5) * speed, (Math.random() - 0.2) * speed, (Math.random() - 0.5) * speed], i * 3);
      S.life[i] = life * (0.6 + Math.random() * 0.6);
    }
  }
  update(dt, t, attacking) {
    const seen = inSight(this.parent);
    for (const o of [this.glow, this.circle, this.points]) o.visible = seen;
    const a = attacking;
    // the orb flares and pulses while casting; the circle fades in and turns
    this.glow.material.opacity = 0.35 * a + 0.12;
    this.glow.scale.setScalar(0.45 + a * (1.1 + Math.sin(t * 9) * 0.3));
    this.circle.material.opacity = a * (0.55 + Math.sin(t * 3) * 0.15);
    this.circle.rotation.y = t * 0.6;
    if (a > 0.05 && Math.random() < dt * 25 * a) this.sparks(this.orb, 1, 1.2, 0.6);
    // cast a bolt every so often
    this.cooldown -= dt;
    if (a > 0.6 && this.cooldown <= 0) {
      this.cooldown = 0.75 + Math.random() * 0.3;
      const b = this.bolts.find(x => x.life <= 0);
      if (b) {
        b.life = 1.0; b.wob = Math.random() * 6.28;
        b.s.position.copy(this.orb);
        b.v.set((Math.random() - 0.5) * 3, 3.5, -16);
        b.s.visible = seen;
        this.sparks(this.orb, 14, 3, 0.5);
      }
    }
    for (const b of this.bolts) {
      if (b.life <= 0) continue;
      b.life -= dt;
      b.v.y -= 4 * dt;
      b.s.position.addScaledVector(b.v, dt);
      b.s.position.x += Math.sin(t * 14 + b.wob) * 0.03;
      b.s.scale.setScalar(0.9 + Math.sin(t * 30 + b.wob) * 0.2);
      b.s.visible = seen;
      this.sparks(b.s.position, 2, 0.8, 0.5);
      if (b.life <= 0 || b.s.position.y < 0.3) { b.life = 0; b.s.visible = false; this.sparks(b.s.position, 30, 6, 0.8); }
    }
    const S = this.spark;
    for (let i = 0; i < S.N; i++) {
      if (S.life[i] <= 0) { S.col[i * 3] = S.col[i * 3 + 1] = S.col[i * 3 + 2] = 0; continue; }
      S.life[i] -= dt;
      for (let k = 0; k < 3; k++) S.pos[i * 3 + k] += S.vel[i * 3 + k] * dt;
      S.vel[i * 3 + 1] -= 1.5 * dt;
      const f = Math.max(0, Math.min(1, S.life[i] / 0.5));
      S.col[i * 3] = this.color.r * f; S.col[i * 3 + 1] = this.color.g * f; S.col[i * 3 + 2] = this.color.b * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
