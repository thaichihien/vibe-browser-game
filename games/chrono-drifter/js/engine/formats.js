/* The five shapes a drift can take. The coin flip that picks your side happens
   AFTER the draft, so you can be the three heroes or the eight mooks, the hunting
   party or the boss. */

export const FORMATS = [
  { key: 'duel',  name: 'TAY ĐÔI',   blurb: 'một chọi một',
    par: 10, a: { n: [1, 1], pool: 'named' }, b: { n: [1, 1], pool: 'named' } },

  { key: 'even',  name: 'CHẠM TRÁN', blurb: 'một trận cân sức',
    par: 14, a: { n: [3, 4], pool: 'mixed' }, b: { n: [3, 4], pool: 'mixed' } },

  { key: 'horde', name: 'TỬ THỦ',    blurb: 'vài người chống lại cả đám',
    par: 18, a: { n: [3, 4], pool: 'named' }, b: { n: [6, 8], pool: 'mook' } },

  { key: 'boss',  name: 'SĂN QUÁI',  blurb: 'một nhóm đối đầu con khổng lồ',
    par: 16, a: { n: [3, 4], pool: 'named' }, b: { n: [1, 1], pool: 'boss', minions: [0, 2] } },

  { key: 'war',   name: 'ĐẠI CHIẾN', blurb: 'dàn quân đầy đủ cả hai bên',
    par: 24, a: { n: [6, 8], pool: 'mixed' }, b: { n: [6, 8], pool: 'mixed' } }
];

/** Score multiplier — a pitched battle is worth more than a duel. */
export const FORMAT_WORTH = { duel: 1.4, even: 2.0, horde: 2.6, boss: 2.8, war: 3.2 };

/** What winning this battle pays. The single source of truth for the economy. */
export function winShards(difficulty, format) {
  return Math.round((12 + 14 * (FORMAT_WORTH[format.key] || 2)) * difficulty.reward);
}

/** What losing pays — the consolation of a witness. */
export const lossShards = (difficulty, format) => Math.round(winShards(difficulty, format) * 0.25);

/* Bail out in the first few turns and the era takes its toll. Priced off the same
   payout table, at half a win: enough to make running hurt, never so much that
   fleeing digs a hole a win cannot fill. */
export const FLEE_GRACE_TURNS = 5;
export function fleeCost(difficulty, format, turns) {
  if (turns > FLEE_GRACE_TURNS) return 0;
  return Math.max(5, Math.round(winShards(difficulty, format) * 0.5));
}

export const DIFFICULTIES = [
  { key: 0, name: 'RẤT DỄ',  stars: '★☆☆☆☆', stat: 0.75, ai: 0, reward: 0.6, edge: 0 },
  { key: 1, name: 'DỄ',      stars: '★★☆☆☆', stat: 0.90, ai: 1, reward: 0.8, edge: 0 },
  { key: 2, name: 'THƯỜNG',  stars: '★★★☆☆', stat: 1.00, ai: 2, reward: 1.0, edge: 0 },
  { key: 3, name: 'KHÓ',     stars: '★★★★☆', stat: 1.15, ai: 3, reward: 1.5, edge: 1 },
  { key: 4, name: 'RẤT KHÓ', stars: '★★★★★', stat: 1.30, ai: 4, reward: 2.2, edge: 2 }
];
