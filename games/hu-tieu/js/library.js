/* ?debug model library: every model the stall builds, one card each, drawn through the same pixel
   pipeline at the game's own pixel density, so a card shows what the counter shows. Click a card
   to inspect it large and drag to orbit. The #numbers are stable names to use in feedback. */
import * as THREE from 'three';
import * as M from './models.js';
import { createPixel } from './renderer.js';
import { LOOK } from './look.js';
import { TOPPINGS, TOPPING_ORDER } from './game.js';

const P = M.P;
const GAME_PITCH = 55;                 // the stall camera's angle (stall.js makeCamera)
const SKY = 0xaee8f5;

/* ------------------------------------------------------------------ catalog */

const bowlOf = b => {
  const g = M.makeBowl();
  g.add(M.bowlContents({ tops: [], hanh: false, gia: false, tieu: false, ot: false, ...b }, 7));
  return g;
};
const withFill = (g, kid) => { g.getObjectByName('fill').add(kid); return g; };
const glass = full => {
  const g = M.makeGlass();
  const tea = g.getObjectByName('tea');
  tea.visible = full;
  tea.scale.y = 1.9;                   // what syncStall sets for a full glass
  return g;
};
const pose = (g, { scale = 1, tilt = 0 } = {}) => { g.scale.setScalar(scale); g.rotation.x = tilt; return g; };
const PEOPLE = ['Chú xe ôm', 'Học sinh', 'Chị văn phòng', 'Bà áo bà ba', 'Anh thợ', 'Anh sinh viên', 'Ông ba lỗ', 'Cô áo dài'];

// [section, name, how it is built, build]
const CATALOG = [
  ...TOPPING_ORDER.map(k => ['Đồ ăn', TOPPINGS[k].name, `toppingPiece('${k}')`, () => M.toppingPiece(k, 1)]),
  ['Đồ ăn', 'Hành lá cắt', 'scallionRings(10, 1.9)', () => M.scallionRings(10, 1.9, 1)],
  ['Đồ ăn', 'Giá', 'sprouts(9, 1.0)', () => M.sprouts(9, 1.0, 1)],
  ['Đồ ăn', 'Ớt cắt', 'chiliSlices(5, 0.8)', () => M.chiliSlices(5, 0.8, 1)],

  ['Tô', 'Tô trống', 'makeBowl()', () => M.makeBowl()],
  ['Tô', 'Hủ tiếu, chưa chan', "bowlContents({ noodle: 'hu' })", () => bowlOf({ noodle: 'hu' })],
  ['Tô', 'Hủ tiếu nước thịt tôm', "bowlContents({ hu, nuoc, thit tom, hành giá })",
    () => bowlOf({ noodle: 'hu', style: 'nuoc', tops: ['thit', 'tom'], hanh: true, gia: true })],
  ['Tô', 'Mì nước trứng gan, tiêu ớt', "bowlContents({ mi, nuoc, trung gan, hành giá tiêu ớt })",
    () => bowlOf({ noodle: 'mi', style: 'nuoc', tops: ['trung', 'gan'], hanh: true, gia: true, tieu: true, ot: true })],
  ['Tô', 'Hủ tiếu khô thịt bằm', "bowlContents({ hu, kho, bam top, hành })",
    () => bowlOf({ noodle: 'hu', style: 'kho', tops: ['bam', 'top'], hanh: true })],
  ['Tô', 'Mì khô 4 món', "bowlContents({ mi, kho, muc thit tom trung, all extras })",
    () => bowlOf({ noodle: 'mi', style: 'kho', tops: ['muc', 'thit', 'tom', 'trung'], hanh: true, gia: true, tieu: true, ot: true })],
  ['Tô', 'Chồng tô sạch', 'makeBowl() ×4, scale 0.85', () => {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) { const b = M.makeBowl(); b.position.y = i * 0.5; b.scale.setScalar(0.85); g.add(b); }
    return g;
  }],

  ['Trạm', 'Mâm hủ tiếu', "makeNoodleTray('hu')", () => M.makeNoodleTray('hu')],
  ['Trạm', 'Mâm mì', "makeNoodleTray('mi')", () => M.makeNoodleTray('mi')],
  ...TOPPING_ORDER.map(k => ['Trạm', `Mâm ${TOPPINGS[k].name.toLowerCase()}`, `makeToppingTray('${k}')`, () => M.makeToppingTray(k)]),
  ['Trạm', 'Nồi nước lèo', 'makeBrothPot()', () => M.makeBrothPot()],
  ['Trạm', 'Nồi trụng', 'makeBlanchPot()', () => M.makeBlanchPot()],
  ['Trạm', 'Vợt trụng (trống)', 'makeBasket()', () => M.makeBasket()],
  ['Trạm', 'Vợt — hủ tiếu chín', "makeBasket() + basketFill('hu', 'ready')", () => withFill(M.makeBasket(), M.basketFill('hu', 'ready'))],
  ['Trạm', 'Vợt — mì chín', "makeBasket() + basketFill('mi', 'ready')", () => withFill(M.makeBasket(), M.basketFill('mi', 'ready'))],
  ['Trạm', 'Vợt — nhũn', "makeBasket() + basketFill('hu', 'mushy')", () => withFill(M.makeBasket(), M.basketFill('hu', 'mushy'))],
  ['Trạm', 'Chai sốt', 'makeSauce()', () => M.makeSauce()],
  ['Trạm', 'Bình trà đá', 'makeTeaJug()', () => M.makeTeaJug()],
  ['Trạm', 'Ly (trống)', 'makeGlass()', () => glass(false)],
  ['Trạm', 'Ly trà đá', 'makeGlass(), tea full', () => glass(true)],
  ['Trạm', 'Thùng rác', 'makeTrash()', () => M.makeTrash()],
  ['Trạm', 'Tiền — 1 tô', 'makeMoney(43000)', () => M.makeMoney(43000)],
  ['Trạm', 'Tiền — nhiều', 'makeMoney(150000)', () => M.makeMoney(150000)],
  ['Trạm', 'Thớt + hành + dao', 'makeBoard()', () => M.makeBoard()],
  ['Trạm', 'Thớt — đang cắt', 'makeBoard() + setChop(b, 0.75)', () => { const b = M.makeBoard(); M.setChop(b, 0.75); return b; }],
  ['Trạm', 'Chén hành (trống)', 'makeHanhDish()', () => M.makeHanhDish()],
  ['Trạm', 'Chén hành (×3)', 'makeHanhDish() + scallionRings(15, 1.35)', () => withFill(M.makeHanhDish(), M.scallionRings(15, 1.35, 90))],
  ['Trạm', 'Rổ giá', 'makeGiaBasket()', () => M.makeGiaBasket()],
  ['Trạm', 'Lọ tiêu', 'makePepper()', () => M.makePepper()],
  ['Trạm', 'Chén ớt', 'makeChiliDish()', () => M.makeChiliDish()],
  ['Trạm', 'Khay muỗng đũa', 'makeCutleryTray()', () => M.makeCutleryTray()],
  ['Trạm', 'Dĩa chanh', 'makeLimeDish()', () => M.makeLimeDish()],

  // posed as syncStall poses them: scaled down and leaning back toward the cook
  ...PEOPLE.map((n, i) => ['Khách', n, `makePerson(${i}), scale 0.8, tilt −0.5`, () => pose(M.makePerson(i), { scale: 0.8, tilt: -0.5 })]),

  ['Phố', 'Ghế nhựa đỏ', 'makeStool(0xf0453a)', () => M.makeStool(0xf0453a)],
  ['Phố', 'Ghế nhựa xanh', 'makeStool(0x2f7be0)', () => M.makeStool(0x2f7be0)],
  ['Phố', 'Bàn inox', 'makeTable()', () => M.makeTable()],
  ['Phố', 'Chậu cây', 'makePlant()', () => M.makePlant()],
  ['Phố', 'Xe máy (chưa dùng)', 'makeMotorbike(0xf0453a) — not placed in the stall', () => M.makeMotorbike(0xf0453a)],
].map(([section, name, code, build], i) => ({ id: `#${String(i + 1).padStart(2, '0')}`, section, name, code, build }));

/* ------------------------------------------------------------------ studio scene */

function makeStudio() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xc8d4f0, LOOK.sky);
  const sun = new THREE.DirectionalLight(0xfff1d6, LOOK.sun);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.002;
  scene.add(hemi, sun, sun.target);
  // the counter's steel, so shadows and outlines read as they do on the stall
  const ground = M.tbox(400, 0.4, 400, ['steel', [], [100, 100]], 0, -0.2, 0);
  ground.castShadow = false;
  scene.add(ground);
  const holder = new THREE.Group();
  scene.add(holder);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 600);

  const box = new THREE.Box3(), sphere = new THREE.Sphere(), v = new THREE.Vector3();
  let model = null;

  return {
    scene, cam, ground,
    /** Put one model on the counter, centred, its feet at y = 0. Returns its bounding radius. */
    show(entry) {
      if (model) holder.remove(model);
      model = entry.build();
      holder.add(model);
      box.setFromObject(model);
      model.position.x -= (box.min.x + box.max.x) / 2;
      model.position.z -= (box.min.z + box.max.z) / 2;
      model.position.y -= box.min.y;
      box.setFromObject(model);
      box.getBoundingSphere(sphere);
      // the game's sun direction, with a shadow camera sized to this model
      const r = sphere.radius;
      sun.position.copy(sphere.center).add(v.set(-30, 50, 30).normalize().multiplyScalar(r * 4 + 10));
      sun.target.position.copy(sphere.center);
      Object.assign(sun.shadow.camera, { left: -r * 2, right: r * 2, top: r * 2, bottom: -r * 2, near: 0.1, far: r * 8 + 30 });
      sun.shadow.camera.updateProjectionMatrix();
      return sphere.radius;
    },
    center: () => sphere.center,
    box: () => box,
    lights() { hemi.intensity = LOOK.sky; sun.intensity = LOOK.sun; },
    /** Aim the camera at the model from yaw/pitch (degrees); yaw 0 is the cook's side. */
    aim(yaw, pitch) {
      const y = THREE.MathUtils.degToRad(yaw), p = THREE.MathUtils.degToRad(pitch);
      cam.position.copy(sphere.center).add(v.set(Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)).multiplyScalar(200));
      cam.lookAt(sphere.center);
      cam.updateMatrixWorld();
    },
  };
}

/** Set an ortho frustum of w×h art pixels at `wpp` world units per pixel, offset (x0, y0) in view space. */
function frame(cam, x0, y0, w, h, wpp) {
  Object.assign(cam, { left: x0, right: x0 + w * wpp, bottom: y0, top: y0 + h * wpp });
  cam.updateProjectionMatrix();
}

/* ------------------------------------------------------------------ the overlay */

const KEY = 'huTieu.library';
const loadPrefs = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const savePrefs = p => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked */ } };

let lib = null;

/** `density()` → { wpp, scale }: world units per art pixel and CSS px per art pixel in the game now. */
export function openLibrary(density) {
  if (!lib) lib = build(density);
  lib.open();
}

function build(density) {
  const prefs = { sel: 0, grid: 0, ground: true, detail: 1, ...loadPrefs() };
  // `detail` > 1 draws finer than the game does — for judging shapes, not the in-game look
  const game = density;
  density = () => { const d = game(); return { wpp: d.wpp / prefs.detail, scale: d.scale }; };
  const el = document.createElement('div');
  el.className = 'lib';
  el.hidden = true;
  el.innerHTML = `
    <header>
      <b>🧱 Model library</b>
      <span class="sub">${CATALOG.length} models · "in-game" detail is the game's own pixel density</span>
      <label>Card size <select data-act="grid">
        <option value="0">as in game</option><option value="1">1 px</option><option value="2">2 px</option>
        <option value="3">3 px</option><option value="4">4 px</option></select></label>
      <label>Detail <select data-act="detail">
        <option value="1">in-game</option><option value="2">×2</option><option value="4">×4</option></select></label>
      <label><input type="checkbox" data-act="ground"> Counter floor</label>
      <button data-act="close" aria-label="Close">✕</button>
    </header>
    <div class="lib-body">
      <section class="lib-focus">
        <div class="lib-stage"><canvas></canvas></div>
        <div class="lib-info">
          <div><b class="lib-id"></b> <span class="lib-name"></span></div>
          <code class="lib-code"></code>
          <div class="lib-btns">
            <button data-act="prev">◀</button><button data-act="spin">⟳ Spin</button>
            <button data-act="front">🎯 Game angle</button><button data-act="copy">📋 Copy ref</button><button data-act="next">▶</button>
          </div>
          <p class="lib-hint">Drag to orbit · ← → step through · Esc closes</p>
        </div>
      </section>
      <section class="lib-grid"></section>
    </div>`;
  document.body.appendChild(el);
  const $ = s => el.querySelector(s);
  const canvas = $('.lib-stage canvas'), stageEl = $('.lib-stage'), grid = $('.lib-grid');
  $('[data-act=grid]').value = String(prefs.grid);
  $('[data-act=ground]').checked = prefs.ground;
  $('[data-act=detail]').value = String(prefs.detail);

  const pixel = createPixel(canvas);
  const studio = makeStudio();

  // grid of cards, grouped by section
  const cards = [];
  let section = '';
  CATALOG.forEach((e, i) => {
    if (e.section !== section) {
      section = e.section;
      const h = document.createElement('h3');
      h.textContent = section;
      grid.appendChild(h);
    }
    const card = document.createElement('button');
    card.className = 'lib-card';
    card.dataset.i = i;
    card.title = e.code;
    card.innerHTML = `<canvas></canvas><span><b>${e.id}</b> ${e.name}</span>`;
    grid.appendChild(card);
    cards.push(card);
  });

  /* thumbnails: one shot each at the game angle, copied off the WebGL canvas */
  const corner = new THREE.Vector3();
  function snapAll() {
    const { wpp, scale } = density();
    const css = prefs.grid || scale;
    studio.ground.visible = prefs.ground;
    studio.lights();
    CATALOG.forEach((e, i) => {
      studio.show(e);
      studio.aim(0, GAME_PITCH);
      // tight frame: the model's box corners in view space, plus a few pixels for the ink line
      const b = studio.box();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let k = 0; k < 8; k++) {
        corner.set(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z).applyMatrix4(studio.cam.matrixWorldInverse);
        x0 = Math.min(x0, corner.x); x1 = Math.max(x1, corner.x); y0 = Math.min(y0, corner.y); y1 = Math.max(y1, corner.y);
      }
      const pad = 4 * wpp;
      const w = Math.ceil((x1 - x0 + pad * 2) / wpp), h = Math.ceil((y1 - y0 + pad * 2) / wpp);
      pixel.resize(w, h, 1);
      frame(studio.cam, x0 - pad, y0 - pad, w, h, wpp);
      pixel.render(studio.scene, studio.cam);
      const c = cards[i].querySelector('canvas');
      c.width = w; c.height = h;
      c.style.width = `${w * css}px`;
      c.style.height = `${h * css}px`;
      c.getContext('2d').drawImage(canvas, 0, 0);
    });
    select(prefs.sel, false);
  }

  /* focus view: the selected model, orbiting, as big as whole pixels allow */
  let radius = 1, yaw = 0, pitch = GAME_PITCH, spin = false, art = 1;
  function select(i, scroll = true) {
    prefs.sel = (i + CATALOG.length) % CATALOG.length;
    savePrefs(prefs);
    const e = CATALOG[prefs.sel];
    radius = studio.show(e);
    cards.forEach((c, k) => c.classList.toggle('on', k === prefs.sel));
    if (scroll) cards[prefs.sel].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    $('.lib-id').textContent = e.id;
    $('.lib-name').textContent = `${e.name} · ${e.section}`;
    $('.lib-code').textContent = e.code;
    fitFocus();
  }
  function fitFocus() {
    const { wpp } = density();
    art = Math.ceil((radius * 2 + 8 * wpp) / wpp);
    const room = Math.min(stageEl.clientWidth, stageEl.clientHeight);
    const s = Math.max(1, Math.floor(room / art));
    pixel.resize(art * s, art * s, s);
  }
  new ResizeObserver(() => { if (!el.hidden) fitFocus(); }).observe(stageEl);

  // drag to orbit
  let drag = null;
  stageEl.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; spin = false; paintSpin(); stageEl.setPointerCapture(e.pointerId); });
  stageEl.addEventListener('pointermove', e => {
    if (!drag) return;
    yaw -= (e.clientX - drag.x) * 0.5;
    pitch = Math.max(-10, Math.min(85, pitch + (e.clientY - drag.y) * 0.4));
    drag = { x: e.clientX, y: e.clientY };
  });
  stageEl.addEventListener('pointerup', () => { drag = null; });
  const paintSpin = () => $('[data-act=spin]').classList.toggle('on', spin);

  el.addEventListener('click', e => {
    const card = e.target.closest('.lib-card');
    if (card) return select(Number(card.dataset.i), false);
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'close') close();
    if (act === 'prev') select(prefs.sel - 1);
    if (act === 'next') select(prefs.sel + 1);
    if (act === 'spin') { spin = !spin; paintSpin(); }
    if (act === 'front') { yaw = 0; pitch = GAME_PITCH; spin = false; paintSpin(); }
    if (act === 'copy') {
      const ent = CATALOG[prefs.sel];
      navigator.clipboard?.writeText(`${ent.id} ${ent.name} (${ent.code})`).catch(() => {});
      e.target.textContent = '✓ Copied';
      setTimeout(() => { e.target.textContent = '📋 Copy ref'; }, 1200);
    }
  });
  el.addEventListener('change', e => {
    const act = e.target.dataset.act;
    if (act === 'grid') prefs.grid = Number(e.target.value);
    if (act === 'ground') prefs.ground = e.target.checked;
    if (act === 'detail') { prefs.detail = Number(e.target.value); fitFocus(); }
    savePrefs(prefs);
    snapAll();
  });
  // keep keys and clicks from reaching the game underneath
  window.addEventListener('keydown', e => {
    if (el.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') select(prefs.sel - 1);
    else if (e.key === 'ArrowRight') select(prefs.sel + 1);
    else return;
    e.preventDefault();
    e.stopPropagation();
  }, true);
  el.addEventListener('pointerdown', e => e.stopPropagation());

  // live loop; re-shoot the cards when the look panel or the game's pixel size changes
  let raf = 0, last = 0, seen = '', check = 0;
  const sig = () => JSON.stringify(LOOK) + JSON.stringify(density());
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if ((check += dt) > 0.4) {
      check = 0;
      if (sig() !== seen) { seen = sig(); snapAll(); }
    }
    if (spin) yaw += dt * 40;
    studio.ground.visible = prefs.ground;
    studio.lights();
    studio.aim(yaw, pitch);
    const { wpp } = density();
    frame(studio.cam, -art * wpp / 2, -art * wpp / 2, art, art, wpp);
    pixel.render(studio.scene, studio.cam);
    raf = requestAnimationFrame(loop);
  }

  function open() {
    el.hidden = false;
    seen = sig();
    snapAll();
    select(prefs.sel);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
  function close() {
    el.hidden = true;
    cancelAnimationFrame(raf);
  }
  return { open };
}
