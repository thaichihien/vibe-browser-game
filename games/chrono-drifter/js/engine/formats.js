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
    par: 24, a: { n: [6, 8], pool: 'mixed' }, b: { n: [6, 8], pool: 'mixed' } },

  /* ── the draft formats ────────────────────────────────────────────────────
     The first five vary one thing only: how many bodies each side has. These
     six vary WHO gets drafted and what state they start in, which is a second
     axis over the same engine — no new win conditions, no new verbs. */

  // one house against itself: both sides out of the SAME faction, so the
  // counter wheel goes quiet and it is read-and-respond rather than matchup
  { key: 'civil', name: 'NỘI CHIẾN', blurb: 'một nhà chia làm hai',
    par: 14, sameFaction: true,
    a: { n: [3, 3], pool: 'named' }, b: { n: [3, 3], pool: 'named' } },

  // nobody matters alone: grunts and mooks only, duplicates everywhere
  { key: 'brawl', name: 'LOẠN ĐẢ',   blurb: 'cả đám lao vào nhau',
    par: 26, a: { n: [6, 8], pool: 'rabble' }, b: { n: [6, 8], pool: 'rabble' } },

  // a hard counter against numbers. Side A holds the element that beats side
  // B's; side B answers with bodies, and the parity pass tops up the rest.
  { key: 'counter', name: 'TƯƠNG KHẮC', blurb: 'khắc chế đấu với đông người',
    par: 15, counter: true,
    a: { n: [2, 3], pool: 'element' }, b: { n: [4, 5], pool: 'element' } },

  // the premise, made literal: you drop into a fight already in progress
  { key: 'survivor', name: 'KẺ SỐNG SÓT', blurb: 'rơi vào giữa trận đang dở',
    par: 13, wounded: { hp: [.55, .85], ep: [.30, .60] },
    a: { n: [3, 4], pool: 'mixed' }, b: { n: [3, 4], pool: 'mixed' } },

  // nobody has an ultimate: pure move economy and energy discipline
  { key: 'rookie', name: 'TÂN BINH',  blurb: 'không ai có tuyệt kỹ',
    par: 16, a: { n: [4, 4], pool: 'nolegend' }, b: { n: [4, 4], pool: 'nolegend' } },

  // two monsters that were never supposed to meet
  { key: 'titan', name: 'SONG QUÁI', blurb: 'hai con khổng lồ của hai thời đại',
    par: 18, crossEra: true,
    a: { n: [1, 1], pool: 'boss', minions: [1, 2] },
    b: { n: [1, 1], pool: 'boss', minions: [1, 2] } }
];

/** Score multiplier — a pitched battle is worth more than a duel. */
export const FORMAT_WORTH = {
  duel: 1.4, even: 2.0, horde: 2.6, boss: 2.8, war: 3.2,
  civil: 2.0, brawl: 3.0, counter: 2.4, survivor: 1.8, rookie: 2.2, titan: 3.4
};

/** What winning this battle pays. The single source of truth for the economy. */
export function winShards(difficulty, format) {
  return Math.round((12 + 14 * (FORMAT_WORTH[format.key] || 2)) * difficulty.reward);
}

/** What losing pays — the consolation of a witness. */
export const lossShards = (difficulty, format) => Math.round(winShards(difficulty, format) * 0.25);

/* Bail out early and the era takes its toll. The window is twenty turns, not a
   handful: a battle is only readable once both sides have shown their hand, and a
   five-turn window let you fold before you had seen anything worth folding on.
   Priced off the same payout table, at half a win: enough to make running hurt,
   never so much that fleeing digs a hole a win cannot fill. */
export const FLEE_GRACE_TURNS = 20;
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
