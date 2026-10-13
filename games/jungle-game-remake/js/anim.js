/* Replays rules.js event lists as animation: hops, river jumps, swims, pounce-and-gore captures,
   trap snaps and the victory. It also owns the move markers and the hover cursor. Each
   sequence marks its views busy so idle animation keeps its hands off them. */
import * as THREE from 'three';
import { ANIMALS, terrain, onEnemyTrap } from './rules.js';
import { C } from './palette.js';
import { VoxelGrid } from './voxel.js';
import { geometryFrom } from './mesh.js';
import { WATER_Y } from './scene.js';
import { tween, wait, ease, hitStop, startShake } from './fx.js';

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const rand = (a, b) => a + Math.random() * (b - a);

function markerGeometry(kind) {
  // 16 × 16 voxel frame on one square. Moves and captures get a two-voxel frame — dark ink
  // outside, white (move) or red (capture) inside — so it reads on light grass; a move adds an
  // ink-ringed centre dot, a capture ink claw marks. The hover cursor is white corner brackets.
  const g = new VoxelGrid();
  const ring = (lo, hi, col, brackets) => {
    for (let i = lo; i <= hi; i++) {
      if (brackets && i > lo + 3 && i < hi - 3) continue;
      g.set(i, 0, lo, col); g.set(i, 0, hi, col); g.set(lo, 0, i, col); g.set(hi, 0, i, col);
    }
  };
  if (kind === 'hover') {
    ring(1, 14, C.white, true);
  } else {
    ring(1, 14, C.ink);
    ring(2, 13, kind === 'capture' ? C.red : C.white);
  }
  if (kind === 'move') { g.box(6, 0, 6, 9, 0, 9, C.ink); g.box(7, 0, 7, 8, 0, 8, C.white); }
  if (kind === 'capture') for (const o of [-3, 0, 3]) for (let s = 0; s < 6; s++) g.set(5 + s + o, 0, 10 - s, C.ink);
  return geometryFrom(g, 1 / 16, [8, 0, 8], { jitter: 0 });
}

export function createAnimator({ scene, camera, world, views, particles, sound, hud, camRig }) {
  const markerMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const geos = { move: markerGeometry('move'), capture: markerGeometry('capture'), hover: markerGeometry('hover') };
  const markers = [];
  const cursor = new THREE.Mesh(geos.hover, markerMat);
  cursor.visible = false;
  scene.add(cursor);
  let lifted = null;
  const ripples = new Set();
  const rippleGeo = new THREE.RingGeometry(0.16, 0.2, 18);

  // ---------- markers and hover ----------
  function showMoves(moves) {
    clearMoves();
    for (const m of moves) {
      const mesh = new THREE.Mesh(m.capture ? geos.capture : geos.move, markerMat);
      const p = views.cellPos(m.row, m.col);
      mesh.position.set(p.x, world.surfaceY(m.row, m.col) + 0.012, p.z);
      mesh.userData.capture = !!m.capture;
      scene.add(mesh);
      markers.push(mesh);
    }
  }
  function clearMoves() { markers.splice(0).forEach(m => scene.remove(m)); }

  function setHover(cell, game) {
    if (lifted) { world.liftTile(lifted.row, lifted.col, false); lifted = null; }
    cursor.visible = !!cell;
    if (!cell) return;
    const p = views.cellPos(cell.row, cell.col);
    cursor.position.set(p.x, world.surfaceY(cell.row, cell.col) + 0.02, p.z);
    if (terrain[cell.row][cell.col] !== 'water' && !game.pieceAt(cell.row, cell.col)) {
      world.liftTile(cell.row, cell.col, true);
      cursor.position.y += 1 / 16;
      lifted = cell;
    }
  }

  // ---------- particles ----------
  function dust(at, n = 6, colors = [C.sand, C.earth1, C.stone1]) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(0.4, 1.1);
      particles.spawn({
        pos: new THREE.Vector3(at.x + Math.cos(a) * 0.15, at.y + 0.04, at.z + Math.sin(a) * 0.15),
        vel: new THREE.Vector3(Math.cos(a) * s, rand(0.3, 0.8), Math.sin(a) * s),
        color: pick(colors), size: rand(0.05, 0.09), life: rand(0.35, 0.6), gravity: -0.3, drag: 3, grow: 0.6,
      });
    }
  }
  function splash(at, colors = [C.water0, C.water1, C.white]) {
    for (let i = 0; i < 16; i++) {
      const a = rand(0, Math.PI * 2), s = rand(0.3, 1);
      particles.spawn({
        pos: new THREE.Vector3(at.x, WATER_Y + 0.05, at.z),
        vel: new THREE.Vector3(Math.cos(a) * s, rand(1.4, 2.6), Math.sin(a) * s),
        color: pick(colors), size: rand(0.03, 0.06), life: 1, gravity: 8, floor: WATER_Y, onFloor: () => {},
      });
    }
  }
  function ripple(at, color = C.water0, delay = 0) {
    wait(delay).then(() => {
      const m = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({ color }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(at.x, WATER_Y + 0.006, at.z);
      scene.add(m);
      ripples.add(m);
      tween(700, k => m.scale.setScalar(0.5 + k * 1.8), ease.out).then(() => {
        scene.remove(m); m.material.dispose(); ripples.delete(m);
      });
    });
  }
  function stain(p, size, life, floorY) {
    particles.spawn({
      pos: new THREE.Vector3(p.x, floorY + 0.006, p.z), color: pick([C.blood, C.bloodDark]),
      size, flat: true, life, gravity: 0, tail: 0.3,
    });
  }
  function gore(at, inWater) {
    const floorY = inWater ? WATER_Y : 0.004;
    for (let i = 0; i < 64; i++) {
      const a = rand(0, Math.PI * 2), out = rand(0.6, 2.2);
      const size = rand(0.03, 0.075);
      particles.spawn({
        pos: new THREE.Vector3(at.x, at.y + 0.3, at.z),
        vel: new THREE.Vector3(Math.cos(a) * out, rand(1.5, 4.5), Math.sin(a) * out),
        color: pick([C.blood, C.blood, C.bloodDark, C.red]),
        size, sy: Math.random() < 0.4 ? size * 2.2 : size,          // some elongated streaks
        life: rand(1.6, 2.8), gravity: 9, floor: floorY, spin: rand(-8, 8), shrink: false,
        onFloor: inWater ? () => {} : P => { if (Math.random() < 0.35) stain(P.p, rand(0.05, 0.13), rand(3, 5), floorY); },
      });
    }
    if (inWater) {
      splash(at, [C.blood, C.water1, C.bloodDark, C.water0]);
      ripple(at, C.blood);
      ripple(at, C.bloodDark, 160);
    } else {
      for (let i = 0; i < 5; i++) {
        stain({ x: at.x + rand(-0.35, 0.35), z: at.z + rand(-0.35, 0.35) }, rand(0.14, 0.3), rand(4, 5.5), floorY);
      }
    }
  }
  function smoke(at) {
    for (let i = 0; i < 20; i++) {
      particles.spawn({
        pos: new THREE.Vector3(at.x + rand(-0.3, 0.3), at.y + rand(0.1, 0.5), at.z + rand(-0.3, 0.3)),
        vel: new THREE.Vector3(rand(-0.3, 0.3), rand(0.4, 0.9), rand(-0.3, 0.3)),
        color: pick([C.stone1, C.stone2, C.white]), size: rand(0.16, 0.3), life: rand(1.4, 2.2),
        gravity: 0, drag: 0.8, grow: 1.2, tail: 0.4,
      });
    }
  }
  function sparks(at) {
    for (let i = 0; i < 14; i++) {
      const a = rand(0, Math.PI * 2), s = rand(0.8, 2);
      particles.spawn({
        pos: new THREE.Vector3(at.x, 0.12, at.z), vel: new THREE.Vector3(Math.cos(a) * s, rand(0.8, 2), Math.sin(a) * s),
        color: pick([C.gold, C.white, C.flame]), size: 0.035, life: 0.5, gravity: 6,
      });
    }
  }
  function chunks(v) {
    for (let i = 0; i < 40; i++) {
      const a = rand(0, Math.PI * 2), s = rand(0.5, 1.8);
      particles.spawn({
        pos: new THREE.Vector3(v.pos.x + rand(-0.2, 0.2), v.pos.y + rand(0.05, v.height), v.pos.z + rand(-0.2, 0.2)),
        vel: new THREE.Vector3(Math.cos(a) * s, rand(1, 2.8), Math.sin(a) * s),
        color: pick(v.colors), size: rand(0.05, 0.08), life: rand(0.9, 1.4), gravity: 9,
        floor: v.pos.y, spin: rand(-10, 10), tail: 0.5,
      });
    }
  }
  function confetti() {
    for (let i = 0; i < 140; i++) {
      particles.spawn({
        pos: new THREE.Vector3(rand(-3.5, 3.5), rand(3, 5), rand(-4.5, 4.5)),
        vel: new THREE.Vector3(rand(-0.3, 0.3), rand(-0.6, 0), rand(-0.3, 0.3)),
        color: pick([C.lime1, C.lime2, C.flowerPink, C.flowerYellow, C.white, C.flowerViolet]),
        size: 0.05, sy: 0.015, life: rand(3, 4.5), gravity: 0.9, drag: 0.6, spin: rand(-6, 6), floor: 0.01,
      });
    }
  }

  // ---------- motion helpers ----------
  function swingLegs(v, a) {
    const [fl, fr, bl, br] = v.rig.legs;
    fl.rotation.x = br.rotation.x = a;
    fr.rotation.x = bl.rotation.x = -a;
  }
  async function faceTo(v, dx, dz) {
    if (!dx && !dz) return;
    const from = v.model.rotation.y;
    let to = Math.atan2(dx, dz);
    to = from + ((((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI);   // shortest way
    if (Math.abs(to - from) < 0.01) return;
    await tween(140, k => { v.model.rotation.y = from + (to - from) * k; }, ease.out);
  }
  async function hop(v, to, { height = 0.28, ms = 340, legs = true } = {}) {
    const from = v.pos.clone();
    await tween(ms, (e, k) => {
      v.pos.lerpVectors(from, to, k);
      v.air = Math.sin(Math.PI * k) * height;
      if (legs) swingLegs(v, Math.sin(k * Math.PI * 2) * 0.7);
    }, ease.linear);
    v.pos.copy(to);
    v.air = 0;
    swingLegs(v, 0);
  }
  async function squashLand(v, amt = 0.22) {
    await tween(90, k => v.model.scale.set(1 + amt * k, 1 - amt * k, 1 + amt * k), ease.out);
    await tween(180, k => {
      const s = amt * (1 - k);
      v.model.scale.set(1 + s, 1 - s, 1 + s);
    }, ease.outBack);
    v.model.scale.set(1, 1, 1);
  }
  async function crouch(v, ms = 150, amt = 0.2) {
    await tween(ms, k => v.model.scale.set(1 + amt * 0.5 * k, 1 - amt * k, 1 + amt * 0.5 * k), ease.out);
    v.model.scale.set(1, 1, 1);
  }
  function flash(v) {
    const white = new THREE.MeshBasicMaterial({ color: C.white });
    const saved = [];
    v.model.traverse(o => { if (o.isMesh) { saved.push([o, o.material]); o.material = white; } });
    wait(120).then(() => { saved.forEach(([o, m]) => { o.material = m; }); white.dispose(); });
  }

  // ---------- sequences ----------
  async function playStep(v, to) {
    const heavy = v.piece.type === 'elephant';
    sound.move();
    await hop(v, to, { height: heavy ? 0.12 : 0.28, ms: heavy ? 480 : 340 });
    dust(to, heavy ? 14 : 6);
    if (heavy) { startShake('soft'); sound.rumble('soft'); }
    await squashLand(v, heavy ? 0.12 : 0.2);
  }

  async function playJump(v, to) {
    sound.move();
    await crouch(v);
    const dist = v.pos.distanceTo(to);
    await hop(v, to, { height: 0.6 + dist * 0.28, ms: 520 + dist * 70, legs: false });
    dust(to, 18);
    startShake('soft');                    // visual only: the original plays no rumble here
    await squashLand(v, 0.3);
  }

  async function playSwim(v, mv, to) {
    const into = terrain[mv.to.row][mv.to.col] === 'water';
    const fromWater = terrain[mv.from.row][mv.from.col] === 'water';
    if (into) sound.splash(); else sound.move();
    await hop(v, to, { height: into && fromWater ? 0.1 : 0.3, ms: 380 });
    if (into) {
      splash(to);
      ripple(to); ripple(to, undefined, 180); ripple(to, undefined, 360);
    } else {
      for (let i = 0; i < 8; i++) {          // drips shaken off on the bank
        particles.spawn({
          pos: new THREE.Vector3(to.x + rand(-0.15, 0.15), 0.25, to.z + rand(-0.15, 0.15)),
          vel: new THREE.Vector3(rand(-0.4, 0.4), rand(0.2, 0.8), rand(-0.4, 0.4)),
          color: pick([C.water0, C.water1]), size: 0.03, life: 0.6, gravity: 8, floor: 0, onFloor: () => {},
        });
      }
      await squashLand(v, 0.15);
    }
  }

  async function knockAndShatter(victim, away) {
    victim.busy = true;
    victim.flourish = null;
    const start = victim.pos.clone();
    await tween(260, (e, k) => {
      victim.pos.copy(start).addScaledVector(away, 0.3 * e);
      victim.air = Math.sin(k * Math.PI) * 0.15;
      victim.model.rotation.z = e * 1.4;
    }, ease.out);
    chunks(victim);
    views.remove(victim);
  }

  async function playCapture(v, victim, cap, mv, to) {
    const isJump = mv.type === 'jump';
    const from = v.pos.clone();
    await crouch(v, 160, 0.22);
    const strike = from.clone().lerp(to, isJump ? 0.85 : 0.6);
    await hop(v, strike, {
      height: isJump ? 0.6 + from.distanceTo(to) * 0.28 : 0.35,
      ms: isJump ? 600 : 240, legs: false,
    });

    // impact
    sound.capture(ANIMALS[v.piece.type].rank);
    hitStop(90);
    flash(victim);
    gore(to, cap.inWater);
    if (cap.heavy) { startShake('heavy'); sound.rumble('heavy'); }
    if (cap.ratElephant) smoke(to);
    hud.toast(cap.message, 'success');

    const away = new THREE.Vector3(to.x - from.x, 0, to.z - from.z).normalize();
    knockAndShatter(victim, away);          // runs alongside the attacker's landing
    await hop(v, to, { height: 0.15, ms: 200, legs: false });
    await squashLand(v, 0.25);
  }

  async function playTrap(v, e) {
    const trap = world.traps.get(`${e.at.row},${e.at.col}`);
    sound.trap();
    hud.toast(e.message, 'info');
    await tween(70, k => trap.setClosed(k), ease.in);
    sparks(v.pos);
    await tween(120, (x, k) => { v.air = Math.sin(k * Math.PI) * 0.1; }, ease.linear);
    v.air = 0;
    wait(450).then(() => tween(300, k => trap.setClosed(1 - k), ease.inOut));
  }

  /** The den the winner walked into shakes, crumbles into falling stone and is gone. */
  async function collapseDen(den, at) {
    const parts = den.group.children;
    parts.forEach(p => { p.userData.home ??= { y: p.position.y }; });
    startShake('heavy');
    sound.rumble('heavy');
    await tween(320, (e, k) => { den.group.position.x = Math.sin(k * 60) * 0.025; }, ease.linear);
    den.group.position.x = 0;
    for (let i = 0; i < 46; i++) {
      const a = rand(0, Math.PI * 2), s = rand(0.4, 1.6);
      particles.spawn({
        pos: new THREE.Vector3(at.x + rand(-0.5, 0.5), rand(0.2, 1.1), at.z + rand(-0.3, 0.3)),
        vel: new THREE.Vector3(Math.cos(a) * s, rand(0.5, 2.2), Math.sin(a) * s),
        color: pick([C.stone1, C.stone2, C.stone2, C.stone3, C.lime4]),
        size: rand(0.06, 0.12), life: rand(1.4, 2), gravity: 9, floor: 0, spin: rand(-8, 8), tail: 0.4,
      });
    }
    dust(at, 26, [C.stone1, C.stone2, C.sand]);
    await tween(520, e => parts.forEach((p, i) => {
      p.position.y = p.userData.home.y - 0.9 * e;
      p.rotation.z = (i % 2 ? 1 : -1) * 0.5 * e;
      p.scale.y = Math.max(0.05, 1 - 0.9 * e);
    }), ease.in);
    den.group.visible = false;
    dust(at, 14, [C.stone1, C.stone2, C.sand]);
  }

  function restoreDens() {
    for (const den of world.dens.values()) {
      den.group.visible = true;
      den.group.position.x = 0;
      for (const p of den.group.children) {
        if (p.userData.home) p.position.y = p.userData.home.y;
        p.rotation.z = 0;
        p.scale.y = 1;
      }
    }
  }

  async function playWin(e, v) {
    if (terrain[e.piece.row][e.piece.col] === 'den') {
      await collapseDen(world.dens.get(`${e.piece.row},${e.piece.col}`), v.pos);
    }
    const base = v.model.rotation.y;
    for (let i = 0; i < 2; i++) {
      await tween(380, (x, k) => {
        v.air = Math.sin(k * Math.PI) * 0.5;
        if (i === 1) v.model.rotation.y = base + k * Math.PI * 2;
      }, ease.linear);
    }
    v.air = 0;
    v.model.rotation.y = base;
    confetti();
    for (const w of views.views.values()) {
      if (w.piece.player === e.player) continue;
      w.busy = true;
      tween(500, k => {
        w.model.rotation.x = 0.3 * k;
        w.model.scale.set(1, 1 - 0.15 * k, 1);
        w.rig.head.rotation.x = 0.5 * k;
      }, ease.out);
    }
    const target = new THREE.Vector3(v.pos.x, 0, v.pos.z).multiplyScalar(0.6);
    await tween(1200, k => { camRig.offset.copy(target).multiplyScalar(k); camRig.zoom = 1 + 0.35 * k; }, ease.inOut);
    hud.showWin(e.player, e.reason);
    sound.win();
  }

  async function play(events) {
    const cap = events.find(e => e.type === 'capture');
    const mv = events.find(e => e.type === 'move' || e.type === 'jump' || e.type === 'swim');
    const v = views.get(mv.piece.id);
    v.busy = true;
    v.flourish = null;
    views.resetPose(v);
    const to = views.cellPos(mv.to.row, mv.to.col);
    await faceTo(v, mv.to.col - mv.from.col, mv.to.row - mv.from.row);

    if (cap) await playCapture(v, views.get(cap.victim.id), cap, mv, to);
    else if (mv.type === 'jump') await playJump(v, to);
    else if (mv.type === 'swim') await playSwim(v, mv, to);
    else await playStep(v, to);

    for (const e of events) {
      if (e.type === 'trap') await playTrap(v, e);
      if (e.type === 'turn') { views.setActive(e.player); hud.setTurn(e.player); }
      if (e.type === 'win') await playWin(e, v);
    }
    for (const w of views.views.values()) views.setWeakened(w, onEnemyTrap(w.piece));
    if (!events.some(e => e.type === 'win')) { views.resetPose(v); v.busy = false; }
  }

  async function spawnAll(pieces) {
    const list = pieces.map(p => views.add(p));
    list.forEach(v => { v.busy = true; v.root.visible = false; v.air = 3; });
    await Promise.all(list.map(async (v, i) => {
      await wait(i * 55);
      v.root.visible = true;
      await tween(380, e => { v.air = 3 * (1 - e); }, ease.in);
      v.air = 0;
      dust(v.pos, 5);
      await squashLand(v, 0.2);
      v.busy = false;
    }));
  }

  function reset() {
    clearMoves();
    setHover(null);
    views.clear();
    particles.clear();
    camRig.offset.set(0, 0, 0);
    camRig.zoom = 1;
    views.setActive('red');
    for (const trap of world.traps.values()) trap.setClosed(0);
    restoreDens();
  }

  function update(t) {
    const pulse = 0.9 + 0.1 * Math.abs(Math.sin(t * 4));
    for (const m of markers) m.scale.setScalar(m.userData.capture ? 1 : pulse);
  }

  return { play, spawnAll, reset, showMoves, clearMoves, setHover, update };
}
