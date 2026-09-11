/* The three kings, one per raid — Crazy Arcade's own boss roster.
 *
 * Plain HP, counted in hits. No meter, no phases you have to decode: you bomb
 * it until it dies, and the difficulty lives entirely in its patterns and in
 * the arena. `PHASE_AT` in config.js only makes it act *faster* and unlock its
 * last pattern; it never makes it invulnerable for long.
 *
 * Movement is deliberately dumb. CA bosses mostly slide along one axis, and
 * that is a feature — a boss on a fixed axis is a boss you can set up against,
 * which is what makes 걸치기 (standing half-off a tile at its edge and bombing
 * it while its spray passes you) the technique the whole mode is built on. A
 * free-roaming boss with a big ability list is a different, worse game.
 */

export const BOSSES = {
  /* 대왕문어. Sprays water around itself, fires balloons from cannons across the
   * whole map, and at low HP splits into one real octopus and two fakes — only
   * the real one ends the fight, but the fakes chase you and will kill you. */
  octopus: {
    id: 'octopus',
    icon: '🐙',
    name: 'Bạch Tuộc Vương',
    blurb: 'Phun nước quanh mình và bắn bóng khắp bản đồ.',
    threat: 'Bắn tầm xa',
    moods: [null, '😠', '😡'],
    size: 3,
    hp: 26,
    speed: 1.1,
    move: 'h',                 // slides left and right only
    gcd: 2.6,
    tint: '#22d3ee',
    patterns: [
      { kind: 'spray',  phase: 0, cd: [4.5, 3.8, 3.0] },
      { kind: 'cannon', phase: 0, cd: [6.5, 5.5, 4.5] },
      { kind: 'clone',  phase: 2, cd: [99] },     // once, on entering last phase
    ],
    cloneHp: 6,
  },

  /* 황제펭귄. Lays eggs that walk, then hatch into the fuzzies you spent the
   * first two stages learning to shatter. Leave an egg alone and you have made
   * yourself a second problem. */
  penguin: {
    id: 'penguin',
    icon: '🐧',
    name: 'Hoàng Đế Chim Cánh Cụt',
    blurb: 'Đẻ trứng nở ra Cục Bông, và húc thẳng vào bạn.',
    threat: 'Đẻ thêm quái',
    moods: [null, '😤', '💢'],
    size: 3,
    hp: 26,
    speed: 1.1,
    move: 'chase',             // lumbers toward the nearest player
    gcd: 2.8,
    tint: '#7cf7ff',
    patterns: [
      { kind: 'spray', phase: 0, cd: [5.0, 4.2, 3.4] },
      { kind: 'hatch', phase: 0, cd: [9, 8, 6.5] },
      { kind: 'charge', phase: 1, cd: [8, 6.5] },
    ],
    eggs: 2,
  },

  /* 황제물개. Rolls flat along a row at speed, and drops 3×3 balloons anywhere
   * on the map. Notably it has *no* spray — standing next to it is safe, which
   * inverts everything the other two teach. */
  seal: {
    id: 'seal',
    icon: '🦭',
    name: 'Hải Cẩu Bạo Chúa',
    blurb: 'Lăn ngang cả hàng, và thả bom 3×3 khắp nơi. Không phun nước quanh mình.',
    threat: 'Lăn ngang · bom 3×3',
    moods: [null, '😤', '👹'],
    size: 3,
    hp: 26,
    speed: 1.1,
    move: 'h',
    gcd: 2.6,
    tint: '#f59e0b',
    patterns: [
      { kind: 'drop', phase: 0, cd: [5.5, 4.5, 3.6] },
      { kind: 'roll', phase: 0, cd: [8, 6.5, 5.2] },
      { kind: 'drop', phase: 2, cd: [3.0] },       // a second, faster dropper
    ],
    rollSpeed: 7.5,
  },
};
