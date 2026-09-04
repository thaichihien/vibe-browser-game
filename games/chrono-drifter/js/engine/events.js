/* Era events. DOM-free.

   Every so often the era itself interrupts — a meteor, a fog bank, a stranger
   falling through the same crack you did. They exist to break the long stalemate
   that a big field settles into, and they are deliberately blind to sides: the
   sky does not care whose army it lands on.

   An event may kill, and killing the last unit of a side ends the battle. That is
   allowed; "Kẻ Cuối Cùng" is the counterweight. */

import { mult, RING } from './elements.js';
import { living, ULT_FULL, statOf } from './combat.js';
import { randInt, pick, sample } from './rng.js';

export const PERIOD_MIN = 30;
export const PERIOD_MAX = 50;
/** Nothing fires while a fight is still being set up. */
export const GRACE_TURNS = 6;

export const rollPeriod = (rng) => randInt(rng, PERIOD_MIN, PERIOD_MAX);

/* The line that introduces an interruption. Generic on purpose — one pool serves
   all eighteen, and the same line never runs twice in a row inside a battle. */
export const LEADINS = [
  'Một sự kiện diễn ra như định mệnh cho cuộc chiến:',
  'Dòng thời gian rẽ nhánh, và trận đánh không còn như cũ:',
  'Thời đại chen vào giữa hai lằn đao:',
  'Có thứ vượt khỏi tầm tay của cả hai phe:',
  'Vết nứt thời gian hé mở, và điều này tràn qua:',
  'Định mệnh không hỏi ai đang thắng:'
];

function nextLeadIn(state) {
  const pool = LEADINS.filter(l => l !== state.lastLeadIn);
  const line = pick(state.rng, pool.length ? pool : LEADINS);
  state.lastLeadIn = line;
  return line;
}

const frac = (u, p) => Math.max(1, Math.round(u.max * p));
const both = (state) => living(state);
const other = (state, side) => (side === 'ally' ? 'foe' : 'ally');

/** Distance between two units on the painted field, when the view has published it. */
function near(state, origin, n) {
  const rest = living(state).filter(u => u !== origin);
  if (!origin.pos) return sample(state.rng, rest, n);
  const d = (u) => u.pos ? Math.hypot(u.pos.x - origin.pos.x, (u.pos.y - origin.pos.y) * 0.6) : 1e9;
  return rest.sort((a, b) => d(a) - d(b)).slice(0, n);
}

function hurt(state, u, amount, el, ev) {
  u.hp -= amount;
  ev.push({ t: 'dmg', tgt: u.uid, n: amount, el, em: 1, crit: false });
  if (u.hp <= 0) {
    u.hp = 0; u.alive = false; u.buffs = []; u.dots = []; u.shield = 0; u.taunt = 0;
    ev.push({ t: 'death', tgt: u.uid });
  }
}

const healUp = (u, amount, ev) => {
  const before = u.hp;
  u.hp = Math.min(u.max, u.hp + amount);
  ev.push({ t: 'heal', tgt: u.uid, n: Math.round(u.hp - before) });
};

/* ── the roster ─────────────────────────────────────────────────────────── */

export const EVENTS = [
  /* A · the era strikes the field */
  {
    id: 'meteor', name: 'THIÊN THẠCH', kind: 'cataclysm',
    blurb: 'Một khối lửa xuyên qua thời đại và cắm xuống giữa trận.',
    effect: 'Một mục tiêu ngẫu nhiên chịu đòn nặng; ba kẻ đứng gần nhất chịu một nửa.',
    run(state, ev) {
      const alive = living(state);
      if (!alive.length) return;
      const hit = pick(state.rng, alive);
      hurt(state, hit, frac(hit, .28), 'EMBER', ev);
      for (const u of near(state, hit, 3)) {
        if (u.alive) hurt(state, u, frac(u, .14), 'EMBER', ev);
      }
    }
  },
  {
    id: 'fissure', name: 'NỨT ĐẤT', kind: 'cataclysm',
    blurb: 'Mặt đất tách ra dưới chân hàng đầu.',
    effect: 'Hàng đầu của cả hai phe trúng đòn và bị đẩy xuống cuối dòng lượt.',
    run(state, ev) {
      for (const side of ['ally', 'foe']) {
        const team = living(state, side);
        if (!team.length) continue;
        const front = Math.max(...team.map(u => (u.pos ? u.pos.y : 90)));
        for (const u of team) {
          if ((u.pos ? u.pos.y : 90) < front - 6) continue;
          hurt(state, u, frac(u, .16), 'FORGE', ev);
          if (u.alive) { u.gauge = -600; ev.push({ t: 'note', tgt: u.uid, text: 'MẤT THĂNG BẰNG' }); }
        }
      }
    }
  },
  {
    id: 'elemstorm', name: 'BÃO NGUYÊN TỐ', kind: 'cataclysm',
    blurb: 'Cả bầu trời đổi màu theo một thứ sức mạnh duy nhất.',
    effect: 'Một hệ nguyên tố tràn qua: ai khắc thì chịu đòn, ai khắc lại thì được nộ.',
    run(state, ev) {
      const el = pick(state.rng, RING);
      if (ev[0]) ev[0].effect = `Hệ ${el} tràn qua: ai bị khắc thì chịu đòn, ai khắc lại thì được +40 nộ.`;
      ev.push({ t: 'log', sys: true, text: `Cơn bão mang hệ ${el} quét qua.` });
      for (const u of both(state)) {
        if (mult(el, u.el) > 1) hurt(state, u, frac(u, .18), el, ev);
        else if (mult(u.el, el) > 1) {
          u.charge = Math.min(ULT_FULL, u.charge + 40);
          ev.push({ t: 'note', tgt: u.uid, text: '+40 NỘ' });
        }
      }
    }
  },
  {
    id: 'eclipse', name: 'NHẬT THỰC', kind: 'cataclysm',
    blurb: 'Ánh sáng tắt. Bóng tối được nuôi.',
    effect: 'Hệ Thánh Quang −30% PWR, hệ Bóng Tối +30% PWR trong 4 lượt.',
    run(state, ev) {
      for (const u of both(state)) {
        if (u.el === 'RADIANT') { u.buffs.push({ stat: 'pwr', pct: -30, t: 5 }); ev.push({ t: 'debuff', tgt: u.uid, label: 'Nhật thực' }); }
        if (u.el === 'UMBRA') { u.buffs.push({ stat: 'pwr', pct: 30, t: 5 }); ev.push({ t: 'buff', tgt: u.uid, label: 'Nhật thực' }); }
      }
    }
  },

  /* B · the era gives something back */
  {
    id: 'cornered', name: 'ĐƯỜNG CÙNG', kind: 'mercy',
    blurb: 'Kẻ sắp gục đánh mạnh nhất.',
    effect: 'Mọi nhân vật dưới 50% máu được +40% PWR trong 3 lượt.',
    when: (s) => living(s).some(u => u.hp / u.max < .5),
    run(state, ev) {
      for (const u of both(state)) {
        if (u.hp / u.max >= .5) continue;
        u.buffs.push({ stat: 'pwr', pct: 40, t: 4 });
        ev.push({ t: 'buff', tgt: u.uid, label: 'Đường cùng' });
      }
    }
  },
  {
    id: 'lastlight', name: 'HỒI QUANG', kind: 'mercy',
    blurb: 'Một kẻ đã gục đứng dậy — nhưng chỉ trong chốc lát.',
    effect: 'Một kẻ đã gục trở lại với 40% máu — chỉ trong 5 lượt.',
    when: (s) => s.units.some(u => !u.alive),
    run(state, ev) {
      const fallen = state.units.filter(u => !u.alive);
      if (!fallen.length) return;
      const u = pick(state.rng, fallen);
      u.alive = true; u.hp = frac(u, .4); u.ep = u.epMax; u.temp = 5;
      if (ev[0]) ev[0].effect = `${u.e} ${u.n} trở lại với 40% máu — chỉ trong 5 lượt.`;
      ev.push({ t: 'revive', tgt: u.uid, n: u.hp });
      ev.push({ t: 'note', tgt: u.uid, text: 'CÒN 5 LƯỢT' });
    }
  },
  {
    id: 'laststand', name: 'KẺ CUỐI CÙNG', kind: 'mercy',
    blurb: 'Người cuối cùng còn đứng không dễ ngã.',
    effect: 'Phe chỉ còn một người: +50% PWR, +25đ chí mạng và một lớp khiên.',
    when: (s) => ['ally', 'foe'].some(side => living(s, side).length === 1),
    run(state, ev) {
      for (const side of ['ally', 'foe']) {
        const team = living(state, side);
        if (team.length !== 1) continue;
        const u = team[0];
        u.buffs.push({ stat: 'pwr', pct: 50, t: 4 }, { stat: 'crt', pct: 25, t: 4 });
        u.shield += frac(u, .3);
        ev.push({ t: 'shield', tgt: u.uid, n: frac(u, .3), gain: true });
        ev.push({ t: 'buff', tgt: u.uid, label: 'Kẻ cuối cùng' });
      }
    }
  },
  {
    id: 'secondwind', name: 'CƠN GIÓ THỨ HAI', kind: 'mercy',
    blurb: 'Một hơi thở nữa cho tất cả.',
    effect: 'Tất cả hồi 20% máu và gỡ được một hiệu ứng xấu.',
    run(state, ev) {
      for (const u of both(state)) {
        healUp(u, frac(u, .2), ev);
        const bad = u.buffs.findIndex(b => b.pct < 0);
        if (bad >= 0) { u.buffs.splice(bad, 1); ev.push({ t: 'note', tgt: u.uid, text: 'NHẸ NGƯỜI' }); }
      }
    }
  },

  /* C · resource and tempo */
  {
    id: 'surge', name: 'TRƯỜNG NĂNG LƯỢNG', kind: 'tempo',
    blurb: 'Không khí đặc lại vì năng lượng.',
    effect: 'Tất cả đầy năng lượng; hồi năng lượng gấp đôi trong một lúc.',
    run(state, ev) {
      state.epScale = { mult: 2, until: state.turns + 12 };
      for (const u of both(state)) { u.ep = u.epMax; ev.push({ t: 'ep', tgt: u.uid, n: u.epMax }); }
    }
  },
  {
    id: 'vacuum', name: 'CHÂN KHÔNG', kind: 'tempo',
    blurb: 'Thời đại hút cạn sức lực của mọi người.',
    effect: 'Tất cả mất một nửa năng lượng; hồi năng lượng giảm một nửa.',
    run(state, ev) {
      state.epScale = { mult: .5, until: state.turns + 10 };
      for (const u of both(state)) { u.ep = Math.round(u.ep / 2); ev.push({ t: 'ep', tgt: u.uid, n: -u.ep }); }
    }
  },
  {
    id: 'fury', name: 'TIẾNG GỌI NỘ KHÍ', kind: 'tempo',
    blurb: 'Cơn giận của cả chiến trường dồn lại thành một nhịp.',
    effect: 'Tất cả +40 nộ — mọi tuyệt kỹ cùng chín một lúc.',
    run(state, ev) {
      for (const u of both(state)) {
        u.charge = Math.min(ULT_FULL, u.charge + 40);
        ev.push({ t: 'note', tgt: u.uid, text: '+40 NỘ' });
      }
    }
  },
  {
    id: 'snap', name: 'MẠCH THỜI GIAN ĐỨT', kind: 'tempo',
    blurb: 'Ai đáng lẽ đi trước bỗng thấy mình đứng cuối.',
    effect: 'Thứ tự lượt bị xáo lại từ đầu.',
    run(state, ev) {
      for (const u of both(state)) {
        u.gauge = Math.round(state.rng() * 900);
        ev.push({ t: 'note', tgt: u.uid, text: 'XÁO LƯỢT' });
      }
    }
  },

  /* D · the rules bend */
  {
    id: 'fog', name: 'SƯƠNG MÙ DÀY', kind: 'rule',
    blurb: 'Không ai còn nhìn rõ mục tiêu.',
    effect: 'Cả hai phe −25đ chính xác trong 4 lượt.',
    run(state, ev) {
      for (const u of both(state)) {
        u.buffs.push({ stat: 'acc', pct: -25, t: 5 });
        ev.push({ t: 'debuff', tgt: u.uid, label: 'Sương mù' });
      }
    }
  },
  {
    id: 'barren', name: 'ĐẤT CẰN', kind: 'rule',
    blurb: 'Không vết thương nào lành trên mảnh đất này.',
    effect: 'Mọi phép hồi máu vô hiệu trong một lúc.',
    run(state, ev) {
      state.noHeal = state.turns + 12;
      ev.push({ t: 'log', sys: true, text: 'Đất cằn: mọi phép hồi máu vô hiệu trong một lúc.' });
    }
  },
  {
    id: 'razor', name: 'LƯỠI DAO CẠO', kind: 'rule',
    blurb: 'Mọi đòn đánh đều tìm đúng chỗ hiểm.',
    effect: 'Cả hai phe +30đ chí mạng trong 3 lượt.',
    run(state, ev) {
      for (const u of both(state)) {
        u.buffs.push({ stat: 'crt', pct: 30, t: 4 });
        ev.push({ t: 'buff', tgt: u.uid, label: 'Lưỡi dao cạo' });
      }
    }
  },
  {
    id: 'rift', name: 'VẾT NỨT', kind: 'rule',
    blurb: 'Một kẻ bước qua vết nứt và đi trước tất cả.',
    effect: 'Một nhân vật được hành động thêm 2 lượt ngay lập tức.',
    run(state, ev) {
      const alive = living(state);
      if (!alive.length) return;
      const u = pick(state.rng, alive);
      u.extraTurns += 2;
      if (ev[0]) ev[0].effect = `${u.e} ${u.n} được hành động thêm 2 lượt ngay lập tức.`;
      ev.push({ t: 'note', tgt: u.uid, text: 'THÊM 2 LƯỢT' });
    }
  },

  /* E · someone else slips through */
  {
    id: 'drifter', name: 'KẺ LẠC THỜI', kind: 'outsider',
    blurb: 'Một kẻ từ thời đại khác rơi qua cùng một vết nứt.',
    effect: 'Một kẻ từ thời đại khác nhập cuộc cho phe yếu hơn trong 5 lượt.',
    when: (s) => living(s, 'ally').length !== living(s, 'foe').length,
    run(state, ev) {
      const elsewhere = (state.allEras || []).filter(e => e.key !== state.era.key);
      if (!elsewhere.length || !state.spawn) return;
      const weak = living(state, 'ally').length <= living(state, 'foe').length ? 'ally' : 'foe';
      const era = pick(state.rng, elsewhere);
      const def = pick(state.rng, era.mooks);
      const u = state.spawn(def, weak, { temp: 5, fromEra: era.name });
      if (ev[0]) ev[0].effect = `${def.e} ${def.n} từ ${era.name} nhập cuộc, chỉ trong 5 lượt.`;
      ev.push({ t: 'spawn', tgt: u.uid });
      ev.push({ t: 'log', sys: true, text: `${def.e} ${def.n} rơi vào đây từ ${era.name}.` });
    }
  },
  {
    id: 'satchel', name: 'TÚI RÁCH', kind: 'outsider',
    blurb: 'Túi của Kẻ Trôi bung ra giữa trận.',
    effect: 'Một món trong túi rơi ra và tự dùng lên đồng đội yếu nhất.',
    when: (s) => (s.bag || []).length > 0,
    run(state, ev) {
      if (!state.bag || !state.bag.length) return;
      const id = pick(state.rng, state.bag);
      state.spilled = id;                       // the shell spends it and reports what happened
      ev.push({ t: 'log', sys: true, text: 'Túi bung ra, một món rơi xuống và tự dùng.' });
    }
  }
];

export const byId = (id) => EVENTS.find(e => e.id === id);

/** Which events could meaningfully fire right now, minus any already spent. */
export function eligible(state) {
  return EVENTS.filter(e =>
    !state.eventsFired.includes(e.id) && (!e.when || e.when(state)));
}

/** True when the clock says the era is due to interrupt. */
export function due(state) {
  return !state.over
    && state.turns >= GRACE_TURNS
    && state.turns >= state.nextEventAt
    && living(state, 'ally').length > 0
    && living(state, 'foe').length > 0;
}

/**
 * Fire one. Mutates `state` and returns { event, ev } — or null when nothing is
 * eligible, in which case the clock is pushed back rather than wasted.
 */
export function fire(state) {
  state.nextEventAt = state.turns + state.eventPeriod;
  const pool = eligible(state);
  if (!pool.length) return null;
  const event = pick(state.rng, pool);
  state.eventsFired.push(event.id);
  const ev = [{ t: 'era', name: event.name, blurb: event.blurb,
                effect: event.effect, leadIn: nextLeadIn(state) }];
  event.run(state, ev);
  return { event, ev };
}
