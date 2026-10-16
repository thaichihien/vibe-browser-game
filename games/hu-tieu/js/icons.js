/* Order-bubble icons. The food comes from the reference sheets in /reference, cut out to 64×64
   PNGs in img/ (SPRITES); the rest — kho, nước, tiêu, trà — are hand-placed 12×12 pixel maps
   in the same ink-outlined style. Each map row is one string; '.' is transparent. */

// hủ tiếu shows as its bowl, mì as the yellow nest: the two bowls look alike at 30 px
const SPRITES = new Set(['hu', 'mi', 'thit', 'tom', 'gan', 'trung', 'bam', 'muc', 'top', 'hanh', 'gia', 'ot']);

const COLORS = {
  k: '#2a1f3d', w: '#fffdf6', s: '#d9d4c4', b: '#2f7be0', c: '#f7f2e6', C: '#cfc6b2',
  y: '#ffd447', Y: '#c9962a', a: '#f2b54a', A: '#ffe39a', o: '#c98a3c', O: '#8a5520',
  t: '#a8643a', p: '#eab39a', P: '#b86a55', r: '#ff6a2a', R: '#c8481c', e: '#fbf6ea', E: '#f6c02b',
  g: '#6e2a26', G: '#9a4a3c', m: '#b98e6e', M: '#8a6448', u: '#f4ecda', U: '#c9bfa8',
  f: '#f0b24a', F: '#c47a20', i: '#e6f6fb', I: '#9fd0e0', h: '#3fa34d', n: '#b8622a', N: '#7a3a14',
  l: '#d5edf2', x: '#ff2e2e', X: '#b8141c', d: '#4a3a40', H: '#a6ee6a', z: '#fffbe8', Z: '#ffd23f',
};

const BOWL = [
  'kbbbbbbbbbbk',
  'kcccccccccck',
  '.kcbccbccbk.',
  '..kccccccCk.',
  '...kkkkkk...',
  '....kCCk....',
  '....kkkk....',
];

const MAPS = {
  kho: ['..........t.', '.........t..', '...o..oot.o.', '..oOooOtoOo.', '.ooOooto.oOo', ...BOWL],
  nuoc: [
    '.....kk.....', '....kAak....', '....kAak....', '...kAaaak...', '..kAaaaaak..', '..kAaaaaak..',
    '.kAaaaaaaak.', '.kAaaaaaaak.', '.kaaaaaaaak.', '..kaaaaaak..', '...kkkkkk...', '............',
  ],
  tra: [
    '..kkkkkkkk..', '..klllllllk.', '..kiIiiIik..', '..kinnnnik..', '..knnnnnnk..', '..knNnnnnk..',
    '..knnnnNnk..', '..knnnnnnk..', '..knnNnnnk..', '..kNnnnnNk..', '..kkkkkkkk..', '............',
  ],
  tieu: [
    '....kkkk....', '...kxxxxk...', '...kxxxxk...', '..kkkkkkkk..', '..kllllllk..', '..kldddddk..',
    '..kldddddk..', '..kldddddk..', '..kldddddk..', '..kllllllk..', '..kkkkkkkk..', '............',
  ],
};

const cache = {};
export function icon(name) {
  if (cache[name]) return cache[name];
  const rows = MAPS[name];
  const c = document.createElement('canvas');
  c.width = 12; c.height = 12;
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    row.padEnd(12, '.').slice(0, 12).split('').forEach((ch, x) => {
      if (ch === '.' || !COLORS[ch]) return;
      g.fillStyle = COLORS[ch];
      g.fillRect(x, y, 1, 1);
    });
  });
  return (cache[name] = c.toDataURL());
}

export const iconImg = (name, title = '') => (SPRITES.has(name)
  ? `<img class="px sprite" src="img/${name}.png" alt="${title}" title="${title}">`
  : `<img class="px" src="${icon(name)}" alt="${title}" title="${title}">`);
