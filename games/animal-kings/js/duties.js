/* Royal duties — the opening tasks, and the only tutorial this game gets.

   Written as a chancellor's instructions rather than a checklist, shown one at a
   time, and gone for good once the last is done. The rewards are deliberately
   front-loaded toward whatever the next duty needs. */

import { RETINUE_STEP, RETINUE_MAX } from './config.js';

export const DUTIES = [
  {
    id: 'chop', icon: '🪵', text: 'Đích thân thu 100 gỗ',
    hint: 'Đứng trước một cái cây và giữ Space.',
    done: (G, kd) => kd.stats.kingGathered >= 100,
    reward: { food: 60 }, rewardText: '+60 🌾'
  },
  {
    id: 'barracks', icon: '🛖', text: 'Dựng một trại lính',
    hint: 'Gặp 🔨 Thợ Xây, chọn Trại Lính, đặt xuống gần nhà. '
        + 'Đây là nơi duy nhất ra quân — kể cả thợ.',
    done: (G, kd) => kd.buildings.some(b => b.alive && b.built && b.key === 'barracks'),
    reward: { wood: 60 }, rewardText: '+60 🪵'
  },
  {
    id: 'workers', icon: '⚒', text: 'Tuyển đủ 6 thợ',
    hint: 'Tới tận trại lính, bấm E, luyện thêm thợ.',
    done: (G, kd) => kd.units.filter(u => u.alive && u.cls === 'worker').length >= 6,
    reward: { unit: 'warrior' }, rewardText: 'một Chiến Binh miễn phí'
  },
  {
    id: 'wolves', icon: '🐺', text: 'Diệt bầy sói canh mỏ',
    hint: 'Vàng chỉ có ở mỏ, và mỏ nào cũng có thú canh.',
    done: (G, kd) => kd.stats.killed >= 3,
    reward: { gold: 50 }, rewardText: '+50 🪙'
  },
  {
    id: 'outpost', icon: '🏕️', text: 'Chiếm một mỏ vàng bằng tiền đồn',
    hint: 'Tiền đồn cho thợ chỗ đổ vàng — không có nó thì chỉ Vua đào được.',
    done: (G, kd) => kd.buildings.some(b => b.alive && b.built && b.key === 'outpost'),
    reward: { item: 'sword' }, rewardText: '⚔️ Kiếm Vua'
  },
  {
    id: 'retinue', icon: '👥', text: 'Chiêu mộ 6 người vào đoàn tùy tùng',
    hint: 'Quân mới luyện đứng yên ở trại — tới nơi và bấm E.',
    done: (G, kd) => kd.retinue.length >= 6,
    reward: { retinue: 1 }, rewardText: `+${RETINUE_STEP} chỗ tùy tùng`
  },
  {
    id: 'findKing', icon: '👑', text: 'Tìm ra vua địch',
    hint: 'Cho quân đi 🔎 DO THÁM, hoặc tự mình đi mà xem.',
    done: (G, kd) => G.kingdoms.some(o => o !== kd && o.king && o.seenBy?.has?.(kd.id)),
    reward: { item: 'horn' }, rewardText: '🎺 Tù Và'
  }
];

export function makeDuties() { return { index: 0, done: [], flash: 0 }; }

export function currentDuty(state) {
  return state.index < DUTIES.length ? DUTIES[state.index] : null;
}

/* Checked a few times a second, not every frame — none of these predicates are
   cheap enough to want sixty times over. */
export function updateDuties(G, dt) {
  const state = G.duties;
  if (state.index >= DUTIES.length) return;
  state.t = (state.t || 0) - dt;
  if (state.t > 0) return;
  state.t = 0.4;

  const duty = DUTIES[state.index];
  if (!duty.done(G, G.player)) return;

  state.index++;
  state.done.push(duty.id);
  G.grantDutyReward(duty);
  G.hooks.onDuty?.(duty, state.index >= DUTIES.length);
}
