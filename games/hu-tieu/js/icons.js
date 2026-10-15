/* Hand-placed 12×12 pixel sprites for the order bubbles, in the same ink-outlined style as the
   3D view. Each row is one string; '.' is transparent. Rendered once to data URLs. */

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
  hu: ['............', '............', '...w..ww.w..', '..wswwswwsw.', '.wwswwwswwsw', ...BOWL],
  mi: ['............', '............', '...y..yy.y..', '..yYyyYyyYy.', '.yyYyyyYyyYy', ...BOWL],
  kho: ['..........t.', '.........t..', '...o..oot.o.', '..oOooOtoOo.', '.ooOooto.oOo', ...BOWL],
  nuoc: [
    '.....kk.....', '....kAak....', '....kAak....', '...kAaaak...', '..kAaaaaak..', '..kAaaaaak..',
    '.kAaaaaaaak.', '.kAaaaaaaak.', '.kaaaaaaaak.', '..kaaaaaak..', '...kkkkkk...', '............',
  ],
  tom: [
    '............', '....kkkk....', '..kkrrrrkk..', '.krrRRRRrrk.', '.krRkkkkRrk.', 'krRk....kRk.',
    'krRk.....k..', 'krRk..kk....', '.krRkkrRk...', '..krrrrRk...', '...kkkkk....', '............',
  ],
  thit: [
    '............', '............', '...kkkkkkk..', '..kppppppPk.', '.kpppppppPk.', '.kppPppppPk.',
    'kpppppppPk..', 'kppppppPPk..', 'kPPPPPPPk...', '.kkkkkkkk...', '............', '............',
  ],
  trung: [
    '............', '............', '..kkk..kkk..', '.keeek.keek.', 'keEEek.keeek', 'keEEEk.keEek',
    'keEEek.keEek', 'keeeek.keeek', '.keeek..kek.', '..kkk...kk..', '............', '............',
  ],
  gan: [
    '............', '............', '....kkkkk...', '..kkggggGk..', '.kggggggGk..', '.kgGgggggk..',
    'kgggggGggk..', 'kggggggGk...', '.kGGGGGGk...', '..kkkkkk....', '............', '............',
  ],
  bam: [
    '............', '............', '...km.mk....', '..kmMmmMk...', '.kmmMmmmmk..', '.kMmmmMmmk..',
    'kmmMmmmmMmk.', 'kmmmmMmmmmk.', '.kMmmmmMmk..', '..kkkkkkk...', '............', '............',
  ],
  muc: [
    '............', '...kkkkkk...', '..kuuuuuuk..', '.kuUkkkkUuk.', '.kuk....kuk.', '.kuk....kuk.',
    '.kuk....kuk.', '.kuk....kuk.', '.kuUkkkkUuk.', '..kuuuuuuk..', '...kkkkkk...', '............',
  ],
  top: [
    '............', '............', '.kkkk..kkkk.', 'kffffk.kfffk', 'kfFffkkkffFk', 'kffFfkfkfffk',
    '.kkkkkfFfkk.', '....kffFfk..', '....kfffFk..', '.....kkkk...', '............', '............',
  ],
  tra: [
    '..kkkkkkkk..', '..klllllllk.', '..kiIiiIik..', '..kinnnnik..', '..knnnnnnk..', '..knNnnnnk..',
    '..knnnnNnk..', '..knnnnnnk..', '..knnNnnnk..', '..kNnnnnNk..', '..kkkkkkkk..', '............',
  ],
  hanh: [
    '............', '..kkk...kkk.', '.khHhk.khHhk', '.kH.Hk.kH.Hk', '.khHhk.khHhk', '..kkkkkk.kk.',
    '....khHhk...', '....kH.Hk...', '....khHhk...', '.....kkk....', '............', '............',
  ],
  gia: [
    '............', '..ZZ....ZZ..', '.kZZk..kZZk.', '..kzk..kzk..', '..kzk.kzk...', '...kzkkzk.ZZ',
    '...kzkzk.kZZ', '....kzzk.kzk', '....kzzkkzk.', '.....kzzzk..', '......kkk...', '............',
  ],
  tieu: [
    '....kkkk....', '...kxxxxk...', '...kxxxxk...', '..kkkkkkkk..', '..kllllllk..', '..kldddddk..',
    '..kldddddk..', '..kldddddk..', '..kldddddk..', '..kllllllk..', '..kkkkkkkk..', '............',
  ],
  ot: [
    '..........h.', '.........hh.', '........khk.', '.......kxxk.', '......kxxxk.', '.....kxxXk..',
    '....kxxXk...', '...kxxXk....', '..kxxXk.....', '.kxXkk......', '.kkk........', '............',
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

export const iconImg = (name, title = '') => `<img class="px" src="${icon(name)}" alt="${title}" title="${title}">`;
