/* The stall: counter, stations, the street behind the customers, the camera, and the per-frame
   sync from game state to meshes. Stations carry userData.hit so main.js can raycast taps. */
import * as THREE from 'three';
import * as M from './models.js';
import { basketState, TEA_TIME, TOPPING_ORDER, ENTER_TIME, LEAVE_TIME, EXTRA_ORDER, CHOP_TIME } from './game.js';

const P = M.P;
const FLOOR_Y = -10;
const CUST_Z = -4.6;
const PERSON_SCALE = 0.8;

/* The counter runs z = BACK (customer edge) … FRONT (cook edge) in three rows:
   back = pots, bowls, tea; middle = noodle and topping trays; front = hành, giá, tiêu, ớt. */
const BACK = -2.8, FRONT = 13.8;
export const SEATS = { 3: [-6, 4, 14], 4: [-17, -7, 3, 13] };
const BOWL_X = [-3, 2, 7, 12];
const BOWL_Z = 2.4;
const BASKET_POS = [[-13.1, 2.2], [-9.9, 2.2]];
const BLANCH = [-11.5, 1.6];
const BROTH = [-20.3, 1.6];
const TRAY_X = i => -5.6 + i * 3.45;
const TRAY_Z = 7.4;
const ROW3 = 11.7;
const GLASS_POS = [[20.3, 1.0], [22.8, 1.0]];
const BOARD = [-20.4, ROW3];
const HANH_DISH = [-15.0, ROW3 + 0.2];

export function buildStall(scene) {
  scene.background = new THREE.Color(0xaee8f5);
  const hits = [];
  const tag = (obj, hit) => { obj.userData.hit = hit; hits.push(obj); return obj; };
  const put = (obj, x, y, z) => { obj.position.set(x, y, z); scene.add(obj); return obj; };

  /* lights: a bright Saigon noon — strong sky fill so nothing sinks into murk */
  const hemi = new THREE.HemisphereLight(0xffffff, 0xc8d4f0, 1.75);   // intensities come from LOOK each frame
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.35);
  sun.position.set(-30, 50, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 40, bottom: -40, near: 1, far: 140 });
  sun.shadow.bias = -0.002;
  scene.add(sun);

  buildStreet(scene, put);

  /* the counter: steel top on a cart painted turquoise with a yellow trim */
  const depth = FRONT - BACK, mid = (FRONT + BACK) / 2;
  put(M.tbox(51, 0.8, depth, ['steel', [], [51 / 4, depth / 4]], 0, 0, 0), 0, -0.4, mid);
  put(M.tbox(51.4, 0.45, 0.5, ['steel', [P.steelL], [12, 0.2]], 0, 0, 0), 0, -0.05, FRONT);
  put(M.tbox(50, 9.2, depth - 1, ['tealPlank', [], [50 / 4, 9.2 / 4]], 0, 0, 0), 0, -5.2, mid);
  put(M.box(50.2, 0.8, 0.3, P.yellow, 0, 0, 0), 0, -1.4, FRONT - 0.4);
  // rivets along the steel lip
  for (let i = 0; i < 26; i++) put(M.box(0.25, 0.12, 0.12, P.steelD, 0, 0, 0), -24.5 + i * 1.96, 0.2, FRONT + 0.27);
  // wooden boards under the trays, as in the reference art
  put(M.tbox(25, 0.4, 3.8, ['wood', [P.woodL], [25 / 4, 1]], 0, 0, 0), 4.7, 0.2, TRAY_Z);
  put(M.tbox(9.4, 0.4, 3.8, ['wood', [P.woodL], [9.4 / 4, 1]], 0, 0, 0), -19.7, 0.2, TRAY_Z);
  put(M.tbox(19, 0.3, 3.6, ['wood', [P.wood], [19 / 4, 1]], 0, 0, 0), -11.5, 0.15, ROW3);

  /* back row */
  const broth = tag(put(M.makeBrothPot(), BROTH[0], 0, BROTH[1]), 'broth');
  put(M.makeBlanchPot(), BLANCH[0], 0, BLANCH[1]);
  const baskets = BASKET_POS.map(([x, z], i) => tag(put(M.makeBasket(), x, 3.2, z), `basket:${i}`));
  const bowls = BOWL_X.map((x, i) => {
    const g = put(new THREE.Group(), x, 0, BOWL_Z);
    // a little bamboo mat under each bowl marks the slot
    g.add(M.tbox(4.6, 0.12, 4.6, ['bamboo', [], [2.3, 2.3]], 0, 0.06, 0));
    const bowl = M.makeBowl();
    bowl.position.y = 0.12;
    g.add(bowl);
    const contents = new THREE.Group();
    bowl.add(contents);
    g.userData.contents = contents;
    g.userData.sig = '';
    return tag(g, `bowl:${i}`);
  });
  const teaJug = tag(put(M.makeTeaJug(), 17.3, 0, 1.4), 'tea');
  const glasses = GLASS_POS.map(([x, z], i) => tag(put(M.makeGlass(), x, 0, z), `glass:${i}`));

  /* middle row */
  const noodleTrays = {
    hu: tag(put(M.makeNoodleTray('hu'), -22, 0.4, TRAY_Z), 'noodle:hu'),
    mi: tag(put(M.makeNoodleTray('mi'), -17.5, 0.4, TRAY_Z), 'noodle:mi'),
  };
  const toppingTrays = {};
  TOPPING_ORDER.forEach((t, i) => { toppingTrays[t] = tag(put(M.makeToppingTray(t), TRAY_X(i), 0.4, TRAY_Z), `top:${t}`); });
  const sauce = tag(put(M.makeSauce(), 18.6, 0, 7.0), 'sauce');
  for (let i = 0; i < 4; i++) put(M.makeBowl(), 22.6, i * 0.5, 6.6).scale.setScalar(0.85);   // clean bowls

  /* front row: everything that finishes a bowl */
  const board = tag(put(M.makeBoard(), BOARD[0], 0.3, BOARD[1]), 'chop');
  const hanhDish = tag(put(M.makeHanhDish(), HANH_DISH[0], 0.3, HANH_DISH[1]), 'extra:hanh');
  const extras = {
    hanh: hanhDish,
    gia: tag(put(M.makeGiaBasket(), -9.6, 0.3, ROW3), 'extra:gia'),
    tieu: tag(put(M.makePepper(), -5.2, 0.3, ROW3 + 0.3), 'extra:tieu'),
    ot: tag(put(M.makeChiliDish(), -1.8, 0.3, ROW3 + 0.2), 'extra:ot'),
  };
  put(M.makeCutleryTray(), 6, 0, ROW3);
  put(M.makeLimeDish(), 11, 0, ROW3 + 0.3);
  const trash = tag(put(M.makeTrash(), 22.3, 0, ROW3), 'trash');

  const coinSpots = [];
  const people = new Map();
  const steam = makeSteam(scene);

  return {
    hits, broth, baskets, noodleTrays, toppingTrays, bowls, sauce, teaJug, glasses, trash,
    board, extras, coinSpots, people, steam, scene, lights: { hemi, sun },
  };
}

/* ------------------------------------------------------------------ the street */

function buildStreet(scene, put) {
  // gạch bông floor: the patterned cement tiles of a Saigon shophouse
  const tile = M.canvasTexture(32, 32, (c) => {
    c.fillStyle = '#fff3d6'; c.fillRect(0, 0, 32, 32);
    c.fillStyle = '#ff7a5a';
    c.fillRect(0, 0, 32, 2); c.fillRect(0, 0, 2, 32);
    c.fillStyle = '#3cc7b8';
    for (const [x, y] of [[16, 6], [6, 16], [26, 16], [16, 26]]) { c.fillRect(x - 3, y - 3, 6, 6); }
    c.fillStyle = '#ffc94a'; c.fillRect(13, 13, 6, 6);
    c.fillStyle = '#ff7a5a';
    for (const [x, y] of [[6, 6], [26, 6], [6, 26], [26, 26]]) { c.fillRect(x - 1, y - 1, 2, 2); }
  });
  tile.wrapS = tile.wrapT = THREE.RepeatWrapping;
  tile.repeat.set(40, 20);
  const floor = M.texturedPlane(160, 80, tile);
  floor.rotation.x = -Math.PI / 2;
  put(floor, 0, FLOOR_Y, -10);

  // the shophouse front just behind the customers: sunny yellow, mint shutters, a lit shop
  const wall = M.canvasTexture(320, 48, (c, w, h) => {
    c.fillStyle = '#ffd95e'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffc93f';
    for (let y = 3; y < h; y += 6) c.fillRect(0, y, w, 1);
    for (const x0 of [4, 246]) {                                   // rolling shutters
      c.fillStyle = '#8fe3cf'; c.fillRect(x0, 14, 70, 34);
      c.fillStyle = '#5fc9b0';
      for (let y = 16; y < h; y += 3) c.fillRect(x0, y, 70, 1);
      c.fillStyle = '#3aa58c'; c.fillRect(x0, 12, 70, 2);
    }
    c.fillStyle = '#fff1d2'; c.fillRect(84, 14, 152, 34);          // the bright shop inside
    c.fillStyle = '#f2a65a'; c.fillRect(90, 18, 140, 3);
    c.fillStyle = '#ff6f5e';
    for (let i = 0; i < 8; i++) c.fillRect(96 + i * 17, 21, 9, 6);  // jars on the shelf
    c.fillStyle = '#3cc7b8';
    for (let i = 0; i < 8; i++) c.fillRect(98 + i * 17, 22, 5, 2);
    c.fillStyle = '#ff4d4d';                                         // red lanterns
    for (const x of [100, 220]) { c.fillRect(x - 4, 28, 8, 9); c.fillStyle = '#ffd23f'; c.fillRect(x - 1, 37, 2, 3); c.fillStyle = '#ff4d4d'; }
    c.fillStyle = '#e9f6ff'; c.fillRect(150, 30, 20, 14);            // a calendar
    c.fillStyle = '#ff4d4d'; c.fillRect(150, 30, 20, 4);
  });
  put(M.texturedPlane(128, 20, wall), 0, FLOOR_Y + 10, -11.5);

  // the red sign board over the shop
  const sign = M.canvasTexture(176, 32, (c, w, h) => {
    c.fillStyle = '#e8322a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffd23f'; c.fillRect(0, 0, w, 2); c.fillRect(0, h - 2, w, 2); c.fillRect(0, 0, 2, h); c.fillRect(w - 2, 0, 2, h);
    c.font = 'bold 17px "Trebuchet MS", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#7a0f0a'; c.fillText('HỦ TIẾU NAM VANG', w / 2 + 1, 13);
    c.fillStyle = '#fff07a'; c.fillText('HỦ TIẾU NAM VANG', w / 2, 12);
    c.font = 'bold 8px "Trebuchet MS", sans-serif';
    c.fillStyle = '#ffffff'; c.fillText('KHÔ • NƯỚC • MÌ • HỦ TIẾU MÌ', w / 2, 25);
  });
  put(M.box(23, 4.6, 0.6, P.woodD, 0, 0, 0), 0, 1.4, -11.3);
  put(M.texturedPlane(22, 4, sign), 0, 1.4, -10.9);

  // seating against the wall: low steel tables with red and blue plastic stools
  for (const [x, z] of [[-31, -8.5], [-12, -9], [24, -8.5], [40, -9]]) {
    put(M.makeTable(), x, FLOOR_Y, z);
    put(M.makeStool(0xf0453a), x - 5, FLOOR_Y, z + 1);
    put(M.makeStool(0x2f7be0), x + 5, FLOOR_Y, z + 1.5);
  }
  put(M.makePlant(), -44, FLOOR_Y, -9);
  put(M.makePlant(), 46, FLOOR_Y, -9);

  // a string of coloured bulbs along the shop front (no shadows: they would blot the wall)
  for (let i = 0; i < 17; i++) {
    const sag = Math.cos((i - 8) / 8 * Math.PI / 2) * 1.2;
    const bulb = M.cyl(0.45, 0.45, 0.7, [0xffe27a, 0xff6f9a, 0x6fe3ff, 0x9dff7a][i % 4], 0, 0, 0, 8);
    bulb.castShadow = false;
    put(bulb, -48 + i * 6, 8.6 - sag, -11);
  }
}

/* ------------------------------------------------------------------ steam */

function makeSteam(scene) {
  const puffs = [];
  // translucent and depth-blind, so the ink pass draws no outline round the puffs
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false });
  const geo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.visible = false;
    scene.add(m);
    puffs.push({ m, life: 0, max: 1, vx: 0 });
  }
  let next = 0;
  return {
    emit(x, y, z) {
      const p = puffs[next++ % puffs.length];
      p.life = 0; p.max = 1.2 + Math.random() * 0.8; p.vx = (Math.random() - 0.5) * 0.8;
      p.m.position.set(x + (Math.random() - 0.5) * 3, y, z + (Math.random() - 0.5) * 2.5);
      p.m.visible = true;
    },
    update(dt) {
      for (const p of puffs) {
        if (!p.m.visible) continue;
        p.life += dt;
        if (p.life >= p.max) { p.m.visible = false; continue; }
        const k = p.life / p.max;
        p.m.position.y += dt * 3.2;
        p.m.position.x += p.vx * dt;
        p.m.scale.setScalar(0.6 + Math.sin(k * Math.PI) * 0.9);
      }
    },
  };
}

/* ------------------------------------------------------------------ camera */

/** Share of the screen height the counter top takes, from its customer edge to the cook's lip. */
export const COUNTER_SHARE = 0.6;

/**
 * Orthographic camera looking steeply down over the cook's shoulder. The frame is anchored at
 * the counter's front lip and sized so the counter fills COUNTER_SHARE of the height; the rest,
 * above it, shows the customers. On screens too narrow for the whole counter width, the width
 * wins and the extra height goes to the street above.
 */
export function makeCamera() {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 300);
  const pitch = THREE.MathUtils.degToRad(55);
  cam.position.set(0, Math.sin(pitch) * 120, Math.cos(pitch) * 120);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();

  const viewY = p => p.clone().applyMatrix4(cam.matrixWorldInverse).y;
  const yBack = viewY(new THREE.Vector3(0, 0, BACK));
  const yFront = viewY(new THREE.Vector3(0, -1.2, FRONT + 0.3));
  const HALF_W = 25.5;
  cam.fit = (w, h) => {
    let hh = (yBack - yFront) / COUNTER_SHARE / 2;
    let hw = hh * w / h;
    if (hw < HALF_W) { hw = HALF_W; hh = hw * h / w; }
    const bottom = yFront - 0.2;
    Object.assign(cam, { left: -hw, right: hw, bottom, top: bottom + hh * 2 });
    cam.updateProjectionMatrix();
  };
  return cam;
}

/* ------------------------------------------------------------------ per-frame sync */

const bowlSig = b => (b.noodle ? `${b.noodle}|${b.style}|${b.tops.join(',')}|${EXTRA_ORDER.map(k => (b[k] ? 1 : 0)).join('')}` : '');

function setLayer(obj, on) {
  obj.traverse(o => { if (on) o.layers.enable(1); else o.layers.disable(1); });
}

export function syncStall(st, s, dt, time, hoverHit) {
  const lv = s.lv;
  // which stations exist today
  st.noodleTrays.mi.visible = lv.noodles.includes('mi');
  for (const t of TOPPING_ORDER) st.toppingTrays[t].visible = lv.tops.includes(t);
  st.sauce.visible = lv.styles.includes('kho');
  st.teaJug.visible = !!lv.tea;
  st.glasses.forEach(g => { g.visible = !!lv.tea; });
  st.extras.tieu.visible = !!lv.tieu;
  st.extras.ot.visible = !!lv.ot;

  // bowls
  st.bowls.forEach((g, i) => {
    const b = s.bowls[i];
    const sig = bowlSig(b);
    if (sig !== g.userData.sig) {
      const c = g.userData.contents;
      c.clear();
      c.add(M.bowlContents(b, 7 + i * 3));
      g.userData.sig = sig;
      g.userData.pop = 0.18;
    }
    const pop = g.userData.pop || 0;
    g.userData.pop = Math.max(0, pop - dt);
    const lift = s.selected === i ? 0.6 : 0;
    g.children[1].position.y = 0.12 + lift + Math.sin((pop / 0.18) * Math.PI) * 0.5;
  });

  // baskets: dip while cooking, lift when ready
  st.baskets.forEach((g, i) => {
    const b = s.baskets[i];
    const state = basketState(b);
    const fill = g.getObjectByName('fill');
    const sig = `${b.noodle}|${state}`;
    if (fill.userData.sig !== sig) {
      fill.clear();
      fill.add(M.basketFill(b.noodle, state));
      fill.userData.sig = sig;
    }
    const y = state === 'cooking' ? 2.2 + Math.sin(time * 9 + i) * 0.12 : state === 'empty' ? 3.0 : 4.3;
    g.position.y += (y - g.position.y) * Math.min(1, dt * 10);
    if (state === 'cooking' && Math.random() < dt * 6) st.steam.emit(g.position.x, 4.4, g.position.z);
  });

  if (Math.random() < dt * 3) st.steam.emit(BROTH[0], 5.5, BROTH[1]);
  if (Math.random() < dt * 1.5) st.steam.emit(BLANCH[0], 4.5, BLANCH[1]);
  st.steam.update(dt);

  // the thớt: the cleaver chops while chopT runs; the dish fills with the chopped pile
  const sc = s.scallion;
  M.setChop(st.board, sc.chopT, CHOP_TIME);
  const fill = st.extras.hanh.getObjectByName('fill');
  if (fill.userData.pile !== sc.pile) {
    fill.clear();
    if (sc.pile > 0) fill.add(M.scallionRings(sc.pile * 5, 0.6 + sc.pile * 0.25, 90));
    fill.userData.pile = sc.pile;
  }

  // tea glasses
  st.glasses.forEach((g, i) => {
    const gl = s.glasses[i];
    const tea = g.getObjectByName('tea');
    const k = gl.state === 'full' ? 1 : gl.state === 'filling' ? Math.min(1, gl.t / TEA_TIME) : 0;
    tea.visible = k > 0.02;
    tea.scale.y = Math.max(0.02, k * 1.9);
  });

  // customers
  const xs = SEATS[lv.seats];
  const seen = new Set();
  s.seats.forEach((c, i) => {
    if (!c) return;
    seen.add(c.id);
    let p = st.people.get(c.id);
    if (!p) {
      p = M.makePerson(c.look);
      p.scale.setScalar(PERSON_SCALE);
      st.scene.add(p);
      st.people.set(c.id, p);
      p.userData.from = xs[i] < 0 ? -40 : 40;
    }
    const u = p.userData;
    const x = xs[i];
    let px = x, bob = 0;
    if (c.phase === 'enter') {
      const k = Math.min(1, c.phaseT / ENTER_TIME);
      px = u.from + (x - u.from) * (1 - (1 - k) ** 2);
      bob = Math.abs(Math.sin(c.phaseT * 12)) * 0.6;
    } else if (c.phase === 'leave') {
      const k = Math.min(1, c.phaseT / LEAVE_TIME);
      px = x + (u.from - x) * k * k;
      bob = Math.abs(Math.sin(c.phaseT * 12)) * 0.6;
    } else {
      bob = Math.sin(time * 2 + c.id) * 0.15;
    }
    const worried = c.phase === 'wait' && c.patience / c.maxPatience < 0.3;
    if (worried) px += Math.sin(time * 30) * 0.15;
    p.position.set(px, -2.6 + bob, CUST_Z);
    // leaning back, looking up at the cook, so the steep view still sees their faces
    p.rotation.set(-0.5, c.phase === 'wait' ? 0 : (c.phase === 'enter' ? (u.from < 0 ? 1 : -1) : (u.from < 0 ? -1 : 1)) * 0.9, 0);
    // face: smile, flat, or a frown when they storm off
    const mood = c.phase === 'leave' ? (c.happy ? 1 : -1) : worried ? -0.5 : c.patience / c.maxPatience > 0.6 ? 1 : 0;
    u.mouth.scale.set(mood > 0 ? 1.3 : 1, mood > 0 ? 1.6 : 1, 1);
    u.mouth.position.y = mood < 0 ? 0.8 : 1.0;
    u.mouth.material = M.mat(mood < 0 ? 0x4a1a1a : 0x9a2a2a);
    u.armR.rotation.x = c.phase === 'leave' && c.happy ? -2.6 + Math.sin(time * 14) * 0.3 : 0;   // waves goodbye
    u.armL.rotation.z = worried ? Math.sin(time * 16) * 0.25 : 0;
  });
  for (const [id, p] of st.people) if (!seen.has(id)) { st.scene.remove(p); st.people.delete(id); }

  // money on the counter
  s.coins.forEach((m, i) => {
    let spot = st.coinSpots[i];
    const sig = m ? m.amount : 0;
    if (spot && spot.userData.sig === sig) return;
    if (spot) { st.scene.remove(spot); st.hits.splice(st.hits.indexOf(spot), 1); st.coinSpots[i] = null; }
    if (!m) return;
    spot = M.makeMoney(m.amount);
    spot.position.set(xs[i], 0, -1.2);
    spot.userData = { sig, hit: `coin:${i}` };
    st.scene.add(spot);
    st.hits.push(spot);
    st.coinSpots[i] = spot;
  });
  for (let i = s.coins.length; i < st.coinSpots.length; i++) if (st.coinSpots[i]) { st.scene.remove(st.coinSpots[i]); st.coinSpots[i] = null; }

  // white outlines: whatever is hovered, the selected bowl, and anything ready to act on
  const want = new Set();
  const lit = o => (o.userData.hit?.startsWith('bowl:') ? o.children[1] : o);   // a bowl, not its mat
  if (hoverHit) want.add(lit(hoverHit));
  if (s.selected != null) want.add(lit(st.bowls[s.selected]));
  s.baskets.forEach((b, i) => { if (basketState(b) === 'ready') want.add(st.baskets[i]); });
  s.glasses.forEach((g, i) => { if (g.state === 'full') want.add(st.glasses[i]); });
  st.coinSpots.forEach(c => c && want.add(c));
  st.lit ??= new Set();
  for (const o of st.lit) if (!want.has(o)) setLayer(o, false);
  for (const o of want) if (!st.lit.has(o)) setLayer(o, true);
  st.lit = want;
}

/** World points the HUD pins labels to. `head` is beside the face, where the bubble hangs. */
export function anchors(st, s) {
  const xs = SEATS[s.lv.seats];
  return {
    head: i => new THREE.Vector3((st.people.get(s.seats[i]?.id)?.position.x ?? xs[i]) + 2.0, 4.2, CUST_Z - 3),
    basket: i => new THREE.Vector3(st.baskets[i].position.x, 6.6, st.baskets[i].position.z),
    glass: i => new THREE.Vector3(GLASS_POS[i][0], 4.2, GLASS_POS[i][1]),
    coin: i => new THREE.Vector3(xs[i], 2.5, -1.2),
    bowl: i => new THREE.Vector3(BOWL_X[i], 3, BOWL_Z),
    board: () => new THREE.Vector3(BOARD[0], 3.2, BOARD[1]),
    hanh: () => new THREE.Vector3(HANH_DISH[0], 2.4, HANH_DISH[1]),
  };
}
