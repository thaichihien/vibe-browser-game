/* The campaign: three raids, three stages each — Stage 1 → Stage 2 → Boss,
 * exactly Crazy Arcade's monster mode. The first two are cleared by killing
 * every monster, the last by killing the boss.
 *
 * The important part is the `monsters` array. **Nothing spawns randomly.** Every
 * monster sits on a named tile with a named script, because that is what makes
 * a CA stage a stage and not an arena:
 *
 *   move   'h' | 'v'   patrols one axis only, reversing at walls. It will never
 *                      turn to follow you, so the lane you are standing in is
 *                      the whole question.
 *          'chase'     comes for you.
 *          'still'     does not move at all.
 *   wake   { at, onKill, move, speed }
 *                      changes the script when the timer hits, or the moment
 *                      the first monster in the stage dies. CA leans on this
 *                      constantly — half a stage stands frozen until you commit
 *                      to the first kill, and then the room comes alive.
 *   revive n           comes back n times; you have to kill it again.
 *
 * Each raid drills its own water-reaction, which is why each has its own
 * roster: 🎱🧨 die on the first hit, ⛄ freezes and must be touched, 🐊
 * shrivels and needs a second hit.
 *
 * All three raids are the same difficulty and none is ever locked — you pick
 * your boss, like you do in CA.
 */

import {
  DOCK, WAREHOUSE, TRENCH,
  RINK, CAVERN, THRONE,
  HILL, SHOAL, BAY,
} from './maps.js';

export const CHAPTERS = [
  /* ── 문어대습격 ─────────────────────────────────────────────────────── */
  {
    id: 'octopus',
    icon: '🐙',
    name: 'Bạch Tuộc Đại Náo',
    boss: 'octopus',
    ss: { time: 150, kills: 18 },
    theme: {
      floorA: '#0b2b3c', floorB: '#0e3548', wall: '#17495f',
      hard: '🪨', soft: '📦', hazard: '🌊',
      glow: '#2dd4bf',
    },
    stages: [
      {
        map: DOCK,
        title: 'Bến Tàu Nhỏ',
        hint: 'Đạn Pháo 🎱 chỉ chạy theo một hàng, không bao giờ quay sang tìm bạn. ' +
              'Đứng khác hàng là an toàn. Chạm vào quái là mất mạng ngay lập tức.',
        monsters: [
          { kind: 'cannon', c: 6,  r: 3, move: 'h' },
          { kind: 'cannon', c: 11, r: 3, move: 'h' },
          { kind: 'cannon', c: 3,  r: 7, move: 'h' },
          { kind: 'cannon', c: 7,  r: 7, move: 'h' },
          /* Both rushers stand frozen until you take the first kill. */
          { kind: 'rusher', c: 7, r: 5, move: 'still', wake: { onKill: true, move: 'chase' } },
          { kind: 'rusher', c: 7, r: 9, move: 'still', wake: { onKill: true, move: 'chase' } },
        ],
      },
      {
        map: WAREHOUSE,
        title: 'Kho Hàng',
        hint: 'Ba con bị nhốt trong lồng thùng gỗ giữa bản đồ — phá vào mới giết được, ' +
              'nhưng phá xong là chúng đuổi bạn. Dùng Ném Bom 🤾 nếu nhặt được.',
        monsters: [
          { kind: 'cannon', c: 5, r: 5, move: 'still', wake: { onKill: true, move: 'chase' } },
          { kind: 'cannon', c: 7, r: 5, move: 'still', wake: { onKill: true, move: 'chase' } },
          { kind: 'cannon', c: 6, r: 7, move: 'still', wake: { onKill: true, move: 'chase' } },
          { kind: 'rusher', c: 7,  r: 1,  move: 'h' },
          { kind: 'rusher', c: 7,  r: 11, move: 'h' },
          { kind: 'cannon', c: 3,  r: 4,  move: 'v' },
          { kind: 'cannon', c: 11, r: 8,  move: 'v' },
        ],
      },
      {
        map: TRENCH,
        boss: 'octopus',
        title: 'Vực Xoáy',
        hint: 'Nấp sau cột đá và đứng *ghé mép* ô — thân bạn chạm trùm nhưng tâm ở ô khô, ' +
              'nước phun trượt qua. Dọn quái trước cho dễ thở.',
        monsters: [
          { kind: 'cannon', c: 4,  r: 3, move: 'h' },
          { kind: 'cannon', c: 10, r: 9, move: 'h' },
          { kind: 'rusher', c: 3,  r: 7, move: 'still', wake: { at: 10, move: 'chase' } },
          { kind: 'rusher', c: 11, r: 5, move: 'still', wake: { at: 10, move: 'chase' } },
        ],
      },
    ],
  },

  /* ── 황제의귀환 ─────────────────────────────────────────────────────── */
  {
    id: 'penguin',
    icon: '🐧',
    name: 'Hoàng Đế Trở Về',
    boss: 'penguin',
    ss: { time: 150, kills: 16 },
    theme: {
      floorA: '#12304a', floorB: '#173a58', wall: '#22587f',
      hard: '🏔️', soft: '🧊', hazard: '❄️',
      glow: '#7cf7ff',
    },
    stages: [
      {
        map: RINK,
        title: 'Sân Băng',
        hint: 'Cục Bông ⛄ trúng nước chỉ bị đông cứng — phải *chạm vào* nó mới vỡ. ' +
              'Bỏ mặc vài giây là nó tan đá và sống lại.',
        monsters: [
          { kind: 'fuzzy', c: 3,  r: 4, move: 'v' },
          { kind: 'fuzzy', c: 7,  r: 4, move: 'v' },
          { kind: 'fuzzy', c: 11, r: 4, move: 'v' },
          { kind: 'fuzzy', c: 5,  r: 8, move: 'v' },
          { kind: 'fuzzy', c: 9,  r: 8, move: 'v' },
          { kind: 'fuzzy', c: 7,  r: 7, move: 'h', wake: { at: 45, speed: 1.5 } },
        ],
      },
      {
        map: CAVERN,
        title: 'Hang Băng',
        hint: 'Phòng giữa chỉ có bốn khối băng làm cửa. Ba con bên trong đứng yên ' +
              'cho đến khi bạn giết con đầu tiên.',
        monsters: [
          { kind: 'fuzzy', c: 6, r: 6, move: 'still', wake: { onKill: true, move: 'chase' } },
          { kind: 'fuzzy', c: 8, r: 6, move: 'still', wake: { onKill: true, move: 'chase' } },
          { kind: 'fuzzy', c: 7, r: 5, move: 'still', wake: { onKill: true, move: 'chase' } },
          { kind: 'fuzzy', c: 7, r: 1,  move: 'h' },
          { kind: 'fuzzy', c: 7, r: 11, move: 'h' },
          { kind: 'fuzzy', c: 2, r: 5,  move: 'h' },
        ],
      },
      {
        map: THRONE,
        boss: 'penguin',
        title: 'Ngai Băng',
        hint: 'Trứng 🥚 nó đẻ ra sẽ nở thành Cục Bông. Nổ trứng sớm, đừng để nở.',
        monsters: [
          { kind: 'fuzzy', c: 3,  r: 3, move: 'h' },
          { kind: 'fuzzy', c: 11, r: 9, move: 'h' },
        ],
      },
    ],
  },

  /* ── 물개의분노 ─────────────────────────────────────────────────────── */
  {
    id: 'seal',
    icon: '🦭',
    name: 'Cơn Giận Hải Cẩu',
    boss: 'seal',
    ss: { time: 150, kills: 16 },
    theme: {
      floorA: '#1d3524', floorB: '#24402c', wall: '#3c6446',
      hard: '🧱', soft: '🪵', hazard: '💧',
      glow: '#c9d94a',
    },
    stages: [
      {
        map: HILL,
        title: 'Đồi Bong Bóng',
        hint: 'Cá Sấu 🐊 trúng nước lần đầu chỉ teo lại — phải trúng lần hai trước khi ' +
              'nó hồi. Hai con nằm trong dải kín giữa bản đồ.',
        monsters: [
          { kind: 'croc',   c: 3,  r: 3, move: 'h' },
          { kind: 'croc',   c: 11, r: 9, move: 'h' },
          { kind: 'croc',   c: 6, r: 6, move: 'still', wake: { onKill: true, move: 'h' } },
          { kind: 'croc',   c: 7, r: 6, move: 'still', wake: { onKill: true, move: 'h' } },
          { kind: 'cannon', c: 7, r: 1,  move: 'h' },
          { kind: 'cannon', c: 7, r: 11, move: 'h' },
        ],
      },
      {
        map: SHOAL,
        title: 'Bãi Đá',
        hint: 'Bốn con Cá Sấu chạy dọc bốn giếng khác nhau. Con dưới cùng sống lại một lần.',
        monsters: [
          { kind: 'croc',   c: 3,  r: 2,  move: 'v' },
          { kind: 'croc',   c: 11, r: 2,  move: 'v' },
          { kind: 'croc',   c: 7,  r: 6,  move: 'v' },
          { kind: 'croc',   c: 3,  r: 10, move: 'v' },
          { kind: 'cannon', c: 6,  r: 5,  move: 'h' },
          { kind: 'cannon', c: 10, r: 7,  move: 'h' },
          { kind: 'croc',   c: 7,  r: 11, move: 'h', revive: 1 },
        ],
      },
      {
        map: BAY,
        boss: 'seal',
        title: 'Vịnh Hải Cẩu',
        hint: 'Nó KHÔNG phun nước quanh mình — đứng sát bên cạnh là an toàn. ' +
              'Cái giết bạn là cú lăn ngang cả hàng. Đổi hàng khi thấy ô cam.',
        monsters: [
          { kind: 'croc', c: 3,  r: 3, move: 'h' },
          { kind: 'croc', c: 11, r: 8, move: 'h' },
        ],
      },
    ],
  },
];

export const TOTAL_STAGES = CHAPTERS.length * 3;
