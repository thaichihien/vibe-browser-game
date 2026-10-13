/* The colours every rendered pixel snaps to, tuned toward reference/color.png: limes and
   turquoise, warm earth, light shadows. The post shader gets each key plus a darker shade
   (0.68×) so lit, shaded and outlined pixels all have somewhere to land. */

export const C = {
  // greens, light → dark
  lime0: 0xf0fb8c, lime1: 0xe4f75a, lime2: 0xc7f02a, lime3: 0x8ed11f, lime4: 0x5fae22,
  lime5: 0x3d7f24, lime6: 0x2a5a1e,
  // water
  water0: 0xe6fbf6, water1: 0xbff3ea, water2: 0x8fe6dd, water3: 0x5fd3c9, water4: 0x3fb3b0,
  water5: 0x2f8f93,
  // sea, after reference/sea01.png: foam → light cyan → cyan → azure → blue → deep
  sea0: 0xf2fdff, sea1: 0x8fe9f4, sea2: 0x3fcde6, sea3: 0x22a8e3, sea4: 0x1a86d2, sea5: 0x1767b6,
  // earth
  sand: 0xf1d6a0, earth1: 0xd9955a, earth2: 0xa8673a, earth3: 0x7a4a2c, earth4: 0x5a3a24,
  earth5: 0x3b2618,
  // stone
  stone0: 0xf4f2ea, stone1: 0xe8e6dc, stone2: 0xb9b7ad, stone3: 0x85847e, stone4: 0x55554f,
  // animals
  ratFur: 0xa9a3a8, ratDark: 0x7b737c, pink: 0xf2a0a8,
  catFur: 0xf0b05c, catStripe: 0xd98a3a, cream: 0xfff1d6,
  dogFur: 0xc98d52, dogEar: 0x8a5631, dogMuzzle: 0xf3e3c3,
  wolfFur: 0x8e9aaa, wolfDark: 0x5f6b7c, wolfBelly: 0xd4dbe3,
  leoFur: 0xe9b949, leoSpot: 0x6a4424, leoBelly: 0xfbe9b7,
  tigerFur: 0xf08a24, tigerBelly: 0xfff7e6,
  lionFur: 0xe3b25a, lionMane: 0xa8562a, lionManeDark: 0x7a3a1c, lionBelly: 0xf6dfa6,
  eleSkin: 0x9aa3b5, eleDark: 0x747d90, eleEar: 0xd9a3a8,
  // teams, effects, scenery accents
  red: 0xe2523f, redDark: 0xa8302a, blue: 0x3f8fe2, blueDark: 0x2a5ea8,
  blood: 0xc8102e, bloodDark: 0x7a0a1c,
  gold: 0xffd23f, flame: 0xff8a1f,
  flowerPink: 0xff8fb1, flowerYellow: 0xffe14d, flowerViolet: 0xb48cff,
  white: 0xfffdf3, ink: 0x2b1d14,
};

export const TEAM = {
  red: { main: C.red, dark: C.redDark },
  blue: { main: C.blue, dark: C.blueDark },
};

export const hexCss = hex => `#${hex.toString(16).padStart(6, '0')}`;

const rgb = hex => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];

/** RGBA bytes for the post shader's palette texture: keys first, then their shades. */
export function paletteRGBA() {
  const list = [];
  const near = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 9;
  const add = c => { if (!list.some(o => near(o, c))) list.push(c); };
  const keys = Object.values(C).map(rgb);
  keys.forEach(c => list.push(c));                  // every key exactly, even near-duplicates
  keys.forEach(c => add(c.map(v => Math.round(v * 0.68))));
  const count = Math.min(256, list.length);
  const data = new Uint8Array(count * 4);
  list.slice(0, count).forEach((c, i) => { data.set([...c, 255], i * 4); });
  return { data, count };
}
