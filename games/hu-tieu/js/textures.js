/* Procedural pixel-art textures: every pattern on every model is drawn here, texel by texel, on
   small canvases — brushed steel, wood grain, the blue flowers of a Vietnamese bowl, woven
   bamboo, shirt prints, faces, banknotes. Nearest filtering keeps each texel a hard pixel; at
   the usual zoom one world unit is ~8–10 screen pixels, so textures aim for ~8 texels per unit.
   Seeded, so the stall looks the same every load. */
import * as THREE from 'three';
import { rng } from './game.js';

const cache = new Map();

const hex = n => `#${n.toString(16).padStart(6, '0')}`;
/** Lighten (k > 0) or darken (k < 0) a 0xRRGGBB colour. */
export function shade(c, k) {
  const f = v => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
  return (f(c >> 16 & 255) << 16) | (f(c >> 8 & 255) << 8) | f(c & 255);
}

function make(w, h, draw, seed = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const r = rng(seed);
  const px = (x, y, col, ww = 1, hh = 1) => { g.fillStyle = typeof col === 'number' ? hex(col) : col; g.fillRect(x, y, ww, hh); };
  draw({ g, w, h, r, px });
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* ------------------------------------------------------------------ generators */

const GEN = {
  // brushed stainless: horizontal streaks and the odd scratch
  steel: (base = 0xcfdbe8) => make(32, 32, ({ w, h, r, px }) => {
    px(0, 0, base, w, h);
    for (let y = 0; y < h; y++) {
      const k = r();
      // short broken streaks, not full-width stripes, so a long counter does not read as ruled paper
      if (k < 0.25) px(Math.floor(r() * w), y, shade(base, 0.12), 6 + Math.floor(r() * 12), 1);
      else if (k < 0.4) px(Math.floor(r() * w), y, shade(base, -0.05), 4 + Math.floor(r() * 10), 1);
    }
    for (let i = 0; i < 6; i++) px(Math.floor(r() * w), Math.floor(r() * h), shade(base, -0.15), 3 + Math.floor(r() * 5), 1);
    for (let i = 0; i < 4; i++) px(Math.floor(r() * w), Math.floor(r() * h), 0xffffff, 2, 1);
  }, 3),

  // pot walls: brushed vertically, a dark band near the rim and a row of rivets
  potSide: () => make(64, 24, ({ w, h, r, px }) => {
    px(0, 0, 0xcfdbe8, w, h);
    for (let x = 0; x < w; x++) if (r() < 0.35) px(x, 0, r() < 0.5 ? 0xe8f0f8 : 0xbac8d8, 1, h);
    px(0, 2, 0x93a5bb, w, 2);
    px(0, h - 3, 0x93a5bb, w, 2);
    for (let x = 2; x < w; x += 8) { px(x, 5, 0x7d8ea4, 2, 2); px(x, 5, 0xffffff, 1, 1); }
    px(0, 9, 0xffffff, w, 1);                                       // the highlight
  }, 5),

  wood: (base = 0xe08a45) => make(32, 32, ({ w, h, r, px }) => {
    px(0, 0, base, w, h);
    for (let x = 0; x < w; x += 1) {
      const k = Math.sin(x * 0.9 + r() * 0.5);
      if (k > 0.75) px(x, 0, shade(base, -0.18), 1, h);
      else if (k < -0.85) px(x, 0, shade(base, 0.18), 1, h);
    }
    for (let i = 0; i < 2; i++) {                                     // knots
      const x = Math.floor(r() * (w - 4)), y = Math.floor(r() * (h - 3));
      px(x, y, shade(base, -0.35), 3, 2); px(x + 1, y + 2, shade(base, -0.2), 2, 1);
    }
    for (let i = 0; i < 10; i++) px(Math.floor(r() * w), Math.floor(r() * h), shade(base, -0.1), 1, 3);
  }, 7),

  // end grain of the round thớt (cylinder caps are UV-mapped as a disc)
  boardTop: () => make(48, 48, ({ px }) => {
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
      const d = Math.hypot(x - 23.5, y - 23.5) + Math.sin(Math.atan2(y - 24, x - 24) * 5) * 0.6;
      px(x, y, Math.floor(d) % 4 === 0 ? 0xd98e4a : d > 22 ? 0xa85a2a : 0xf7c07a);
    }
    for (let i = 0; i < 9; i++) px(12 + i * 3, 20 + (i % 3) * 3, 0xc77a3a, 2, 1);   // knife marks
  }),

  // the cart: turquoise painted planks with a yellow trim
  tealPlank: () => make(32, 32, ({ w, h, r, px }) => {
    px(0, 0, 0x22b5c4, w, h);
    for (let x = 0; x < w; x += 8) { px(x, 0, 0x15899a, 1, h); px(x + 1, 0, 0x4fd0dc, 1, h); }
    for (let i = 0; i < 14; i++) px(Math.floor(r() * w), Math.floor(r() * h), 0x1ea3b1, 1, 2);
    px(0, 0, 0xffd23f, w, 2);
  }, 9),

  // bamboo mat (chiếu tre) under the bowls: woven over-under strips
  bamboo: () => make(16, 16, ({ px }) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const over = ((x >> 2) + (y >> 2)) % 2 === 0;
      const edge = over ? x % 4 === 3 : y % 4 === 3;
      px(x, y, edge ? 0xc99a4a : over ? 0xf2c97a : 0xe8b860);
    }
  }),

  /* the tô: white glaze with the classic blue — foot ring, a band of flowers and leaves on the
     outside, a solid blue lip, and a thin line inside. Rows follow the lathe profile's v. */
  bowl: () => make(96, 36, ({ w, px }) => {
    const B = 0x2f7be0, BL = 0x8fb8f0;
    px(0, 0, 0xfffbf0, w, 36);
    px(0, 4, B, w, 1);                                            // foot ring
    px(0, 8, B, w, 1);
    for (let x = 0; x < w; x += 12) {                             // flowers
      px(x + 4, 10, B, 3, 3); px(x + 5, 9, B, 1, 1); px(x + 5, 13, B, 1, 1); px(x + 3, 11, B, 1, 1); px(x + 7, 11, B, 1, 1);
      px(x + 5, 11, 0xfffbf0, 1, 1);
      px(x + 8, 13, BL, 3, 1); px(x + 10, 12, BL, 2, 1); px(x + 1, 13, BL, 2, 1); // leaves
      px(x + 9, 14, B, 1, 1);
    }
    px(0, 15, B, w, 1);
    px(0, 16, B, w, 8);                                           // the lip
    px(0, 18, 0x5d9cf0, w, 1);
    px(0, 26, B, w, 1);                                           // inside line
    for (let x = 0; x < w; x += 6) px(x, 33, BL, 2, 1);           // a ring in the well
  }),

  broth: () => make(32, 32, ({ r, px }) => {
    px(0, 0, 0xf2b54a, 32, 32);
    for (let i = 0; i < 40; i++) px(Math.floor(r() * 32), Math.floor(r() * 32), 0xe09a32, 2, 1);
    for (let i = 0; i < 16; i++) {                                 // beads of fat
      const x = Math.floor(r() * 30), y = Math.floor(r() * 30);
      px(x, y, 0xffe08a, 2, 2); px(x, y, 0xfff4c8, 1, 1);
    }
    for (let i = 0; i < 6; i++) px(Math.floor(r() * 30), Math.floor(r() * 30), 0xc8402a, 1, 1);   // a fleck of chili oil
  }, 11),

  water: () => make(32, 32, ({ r, px }) => {
    px(0, 0, 0xcdeaf2, 32, 32);
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(r() * 28), y = Math.floor(r() * 28), s = 2 + Math.floor(r() * 3);
      px(x, y, 0xffffff, s, 1); px(x, y + s, 0xffffff, s, 1); px(x - 1, y + 1, 0xffffff, 1, s - 1); px(x + s, y + 1, 0xffffff, 1, s - 1);
    }
    for (let i = 0; i < 20; i++) px(Math.floor(r() * 32), Math.floor(r() * 32), 0xa9d3e2, 3, 1);
  }, 13),

  // wire mesh: dark wires, holes cut out (alphaTest)
  net: () => make(16, 16, ({ g, px }) => {
    g.clearRect(0, 0, 16, 16);
    for (let i = 0; i < 16; i += 4) { px(i, 0, 0x5d6672, 1, 16); px(0, i, 0x5d6672, 16, 1); }
  }),

  // rổ nhựa: green plastic weave with square holes
  weave: () => make(16, 16, ({ g, px }) => {
    g.clearRect(0, 0, 16, 16);
    px(0, 0, 0x3fc26a, 16, 16);
    for (let y = 1; y < 16; y += 4) for (let x = 1; x < 16; x += 4) g.clearRect(x, y, 2, 2);
    px(0, 0, 0x6fe08f, 16, 1);
  }),

  jug: () => make(48, 32, ({ w, px }) => {
    px(0, 0, 0xe8682e, w, 32);
    px(0, 6, 0xffffff, w, 3); px(0, 24, 0xffffff, w, 2);
    for (let x = 0; x < w; x += 24) {                              // a printed ice-cube logo
      px(x + 8, 12, 0xffffff, 8, 8); px(x + 9, 13, 0x8fdcff, 6, 6); px(x + 10, 14, 0xffffff, 2, 2);
    }
    for (let x = 0; x < w; x += 3) px(x, 0, 0xc54d1c, 1, 1);
  }),

  trash: () => make(48, 32, ({ w, px }) => {
    px(0, 0, 0x3f9d5a, w, 32);
    for (let x = 0; x < w; x += 4) px(x, 0, 0x2f7e46, 1, 32);
    px(0, 0, 0x5fbf7a, w, 2);
    for (let x = 0; x < w; x += 24) {                              // white label with an arrow
      px(x + 6, 10, 0xffffff, 12, 10); px(x + 9, 13, 0x3f9d5a, 6, 1); px(x + 9, 16, 0x3f9d5a, 6, 1); px(x + 14, 12, 0x3f9d5a, 1, 3);
    }
  }),

  // plastic stools and tables keep a moulded texture
  plastic: (base) => make(16, 16, ({ r, px }) => {
    px(0, 0, base, 16, 16);
    for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 * 2; x < 16; x += 4) px(x, y, shade(base, -0.18), 2, 2);
    for (let i = 0; i < 5; i++) px(Math.floor(r() * 16), Math.floor(r() * 16), shade(base, 0.3), 1, 1);
  }, 17),

  /* VND polymer notes: coloured field, border, portrait oval, a big number */
  note: (base, digit) => make(48, 24, ({ g, px }) => {
    px(0, 0, base, 48, 24);
    px(0, 0, shade(base, -0.3), 48, 1); px(0, 23, shade(base, -0.3), 48, 1);
    px(0, 0, shade(base, -0.3), 1, 24); px(47, 0, shade(base, -0.3), 1, 24);
    px(30, 4, shade(base, 0.45), 12, 16); px(32, 6, shade(base, -0.2), 8, 12); px(34, 8, shade(base, 0.3), 4, 3);
    px(4, 4, shade(base, 0.35), 20, 2); px(4, 18, shade(base, 0.35), 14, 2);
    px(26, 2, 0xf4f8ff, 3, 20);                                      // the clear window
    g.fillStyle = hex(shade(base, -0.45)); g.font = 'bold 10px monospace'; g.textBaseline = 'top';
    g.fillText(digit, 5, 7);
  }),

  /* food */
  meat: () => make(16, 16, ({ r, px }) => {
    px(0, 0, 0xffbfa3, 16, 16);
    for (let i = 0; i < 10; i++) px(Math.floor(r() * 14), Math.floor(r() * 14), 0xffe2d4, 3, 1);
    for (let i = 0; i < 8; i++) px(Math.floor(r() * 15), Math.floor(r() * 15), 0xe89a80, 1, 2);
    px(0, 13, 0xd9735a, 16, 3); px(0, 12, 0xfff0e6, 16, 1);         // fat cap and rind
  }, 19),
  liver: () => make(16, 16, ({ r, px }) => {
    px(0, 0, 0x8a3328, 16, 16);
    for (let i = 0; i < 12; i++) px(Math.floor(r() * 15), Math.floor(r() * 15), 0xa8483a, 2, 1);
    for (let i = 0; i < 4; i++) px(Math.floor(r() * 15), Math.floor(r() * 15), 0xd88070, 1, 1);
  }, 23),
  shrimp: () => make(16, 8, ({ px }) => {
    px(0, 0, 0xff6a2a, 16, 8);
    for (let x = 0; x < 16; x += 3) { px(x, 0, 0xffd6a6, 1, 8); px(x + 1, 0, 0xff8a4a, 1, 8); }
    px(0, 0, 0xffe2c4, 16, 2);
  }),
  squid: () => make(16, 8, ({ r, px }) => {
    px(0, 0, 0xfff6e2, 16, 8);
    for (let i = 0; i < 10; i++) px(Math.floor(r() * 16), Math.floor(r() * 8), 0xf2b8c0, 1, 1);
  }, 29),
  crackling: () => make(16, 16, ({ r, px }) => {
    px(0, 0, 0xffbf3f, 16, 16);
    for (let i = 0; i < 14; i++) { const x = Math.floor(r() * 14), y = Math.floor(r() * 14); px(x, y, 0xfff0a0, 2, 1); px(x, y + 1, 0xd88a20, 2, 1); }
  }, 31),
  noodle: (base) => make(32, 32, ({ px }) => {
    px(0, 0, base, 32, 32);
    for (let y = 0; y < 32; y += 3) for (let x = 0; x < 32; x++) {
      const yy = y + Math.round(Math.sin((x + y * 2) * 0.5));
      px(x, yy, shade(base, -0.12), 1, 1);
      px(x, yy + 1, shade(base, 0.35), 1, 1);
    }
  }),

  // nón lá: rings of palm leaf around the cone
  nonla: () => make(32, 32, ({ px }) => {
    px(0, 0, 0xf0dca0, 32, 32);
    for (let y = 2; y < 32; y += 4) { px(0, y, 0xc9ae6a, 32, 1); px(0, y + 1, 0xfff0c4, 32, 1); }
    for (let x = 0; x < 32; x += 2) px(x, 0, 0xe0c88a, 1, 32);
  }),
  hair: (base) => make(16, 16, ({ r, px }) => {
    px(0, 0, base, 16, 16);
    for (let i = 0; i < 18; i++) px(Math.floor(r() * 16), Math.floor(r() * 16), shade(base, 0.25), 1, 3);
    for (let i = 0; i < 10; i++) px(Math.floor(r() * 16), Math.floor(r() * 16), shade(base, -0.3), 1, 2);
  }, 37),

  /* faces: brows, eyes with a highlight, a nose shadow and blush. The mouth stays a mesh so
     it can change with the customer's mood. */
  face: (skin, brow) => make(24, 24, ({ px }) => {
    px(0, 0, skin, 24, 24);
    px(5, 7, brow, 4, 1); px(15, 7, brow, 4, 1);
    for (const x of [6, 16]) { px(x, 9, 0x2a1f3d, 3, 4); px(x, 9, 0xffffff, 1, 1); px(x + 1, 12, 0x5a4a7a, 2, 1); }
    px(11, 13, shade(skin, -0.15), 2, 2);
    px(3, 15, 0xff9a9a, 3, 2); px(18, 15, 0xff9a9a, 3, 2);
    px(0, 23, shade(skin, -0.12), 24, 1);
  }),
  skin: (skin) => make(8, 8, ({ px }) => { px(0, 0, skin, 8, 8); px(0, 7, shade(skin, -0.1), 8, 1); }),
};

/* shirts: the front face gets the detailed print, the other faces the plain cloth */
const SHIRTS = {
  // chú xe ôm: green jacket, zip, a reflective stripe
  jacket: [0x4f8a3a, ({ px }) => { px(15, 0, 0xd9e0c0, 2, 32); px(0, 18, 0xe6ff7a, 32, 2); px(4, 6, 0x3d6e2c, 7, 6); px(21, 6, 0x3d6e2c, 7, 6); px(12, 0, 0x3d6e2c, 8, 3); }],
  // học sinh: white shirt, blue name badge on the pocket
  school: [0xf8f8f2, ({ px }) => { px(12, 0, 0xdfe4ea, 8, 3); px(15, 3, 0xdfe4ea, 2, 29); for (let y = 6; y < 32; y += 6) px(15, y, 0x9aa3ae, 2, 2); px(20, 8, 0x2f7be0, 7, 4); px(21, 9, 0xffffff, 5, 1); }],
  // chị văn phòng: pink blouse, white collar, buttons
  blouse: [0xf59ac0, ({ px }) => { px(10, 0, 0xffffff, 12, 4); px(13, 4, 0xffffff, 6, 2); for (let y = 8; y < 32; y += 6) px(15, y, 0xffffff, 2, 2); px(0, 30, 0xd9709a, 32, 2); }],
  // bà áo bà ba: purple with a small floral print all over
  floral: [0x8a63b8, ({ px }) => { for (let y = 1; y < 32; y += 6) for (let x = (y % 12 ? 3 : 0); x < 32; x += 6) { px(x, y, 0xffd6f0, 2, 2); px(x + 1, y + 2, 0x6fd08a, 1, 1); } }, true],
  // anh thợ: blue work shirt with a chest pocket and a pen
  work: [0x3f6fb0, ({ px }) => { px(12, 0, 0x2f5590, 8, 3); px(15, 3, 0x2f5590, 2, 29); px(19, 8, 0x2f5590, 8, 7); px(20, 6, 0xf0453a, 1, 4); px(0, 22, 0x2f5590, 32, 1); }],
  // anh sinh viên: black tee with a printed Saigon skyline
  tee: [0x2d2a36, ({ px }) => { px(10, 0, 0x45414f, 12, 2); const b = [3, 6, 4, 9, 5, 7, 3]; b.forEach((hh, i) => px(7 + i * 3, 20 - hh, 0xffd23f, 3, hh)); px(6, 20, 0xffd23f, 21, 2); px(15, 6, 0xf0453a, 2, 2); }],
  // ông ba lỗ: ribbed white tank top
  tank: [0xf4f4ec, ({ px }) => { for (let x = 0; x < 32; x += 3) px(x, 0, 0xdedfd4, 1, 32); }, true],
  // cô áo dài: white silk with a faint pattern and the side buttons
  aodai: [0xfdfdf8, ({ px }) => { for (let y = 2; y < 32; y += 8) for (let x = 2; x < 32; x += 8) px(x, y, 0xe6eef8, 3, 3); for (let y = 2; y < 14; y += 3) px(22, y, 0xd9c08a, 1, 1); }, true],
};
function shirt(name, front) {
  const [base, draw, allOver] = SHIRTS[name];
  return make(32, 32, ({ px, w, h, r, g }) => {
    px(0, 0, base, w, h);
    for (let i = 0; i < 12; i++) px(Math.floor(r() * w), Math.floor(r() * h), shade(base, -0.06), 2, 1);   // cloth weave
    if (front || allOver) draw({ px, w, h, r, g });
    px(0, h - 2, shade(base, -0.2), w, 2);                          // hem shadow
  }, 41);
}

/* ------------------------------------------------------------------ public */

/** A shared texture by name (args are part of the key), optionally repeated. */
export function tex(name, args = [], repeat = null) {
  const key = `${name}|${args.join(',')}|${repeat ? repeat.join('x') : ''}`;
  if (cache.has(key)) return cache.get(key);
  let t;
  if (repeat) {
    t = tex(name, args).clone();
    t.repeat.set(repeat[0], repeat[1]);
    t.needsUpdate = true;
  } else if (name === 'shirt') t = shirt(args[0], args[1]);
  else t = GEN[name](...args);
  cache.set(key, t);
  return t;
}
