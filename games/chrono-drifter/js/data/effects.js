/* What every status chip means, in one place, so the inspect panel can explain
   itself on hover instead of leaving the player to guess at an emoji. DOM-free. */

const STAT_VI = { pwr: 'Sức mạnh', grd: 'Giáp vật lý', wrd: 'Kháng nguyên tố', spd: 'Tốc độ' };

export const EFFECTS = {
  shield:    { icon: '🛡️', name: 'Khiên',        desc: 'Hấp thụ sát thương trước khi máu bị trừ. Vỡ khi hết điểm khiên.' },
  taunt:     { icon: '🚩', name: 'Khiêu khích',  desc: 'Mọi đòn đơn mục tiêu của địch bị hút về đơn vị này. Đòn diện rộng thì không.' },
  marked:    { icon: '🎯', name: 'Bị đánh dấu',  desc: 'Nhận thêm 25% sát thương từ mọi nguồn cho tới khi dấu hết hạn.' },
  stunned:   { icon: '💫', name: 'Choáng',       desc: 'Mất trọn lượt kế tiếp.' },
  silenced:  { icon: '🔇', name: 'Câm lặng',     desc: 'Không dùng được chiêu thức nào, chỉ còn Chờ.' },
  dot:       { icon: '☠️', name: 'Sát thương theo thời gian', desc: 'Mất máu vào đầu mỗi lượt của mình. Giáp không chặn được.' },
  regen:     { icon: '💚', name: 'Hồi phục',     desc: 'Hồi máu vào cuối mỗi lượt của mình.' },
  chargeup:  { icon: '💢', name: 'Dồn lực',      desc: 'Đòn tấn công kế tiếp gây gấp đôi sát thương.' },
  extra:     { icon: '⏩', name: 'Thêm lượt',     desc: 'Sẽ được hành động thêm ngay sau lượt này.' },
  ramp:      { icon: '📈', name: 'Tăng dần',     desc: 'Chiêu tăng dần đang cộng dồn — đổi chiêu khác là mất.' },
  buff:      { icon: '🔼', name: 'Tăng chỉ số',  desc: 'Một chỉ số đang được cộng thêm.' },
  debuff:    { icon: '🔽', name: 'Giảm chỉ số',  desc: 'Một chỉ số đang bị trừ đi.' },
  ccImmune:  { icon: '🧿', name: 'Kháng khống chế',
               desc: 'Vừa thoát khỏi choáng hoặc câm lặng nên tạm thời miễn nhiễm với cả hai. Không thể bị khoá liên tục.' }
};

/** The status chips a unit is currently carrying, ready to render. */
export function effectsOf(u) {
  const out = [];
  const push = (key, extra) => out.push({ ...EFFECTS[key], ...extra });

  if (u.shield > 0) push('shield', { label: `Khiên ${Math.round(u.shield)}`, desc: `${EFFECTS.shield.desc} Còn ${Math.round(u.shield)} điểm.` });
  if (u.taunt > 0) push('taunt', { label: `Khiêu khích ${u.taunt}`, desc: `${EFFECTS.taunt.desc} Còn ${u.taunt} lượt.` });
  if (u.marked > 0) push('marked', { label: `Đánh dấu ${u.marked}`, desc: `${EFFECTS.marked.desc} Còn ${u.marked} lượt.` });
  if (u.stunned > 0) push('stunned', { label: 'Choáng' });
  if (u.silenced > 0) push('silenced', { label: `Câm lặng ${u.silenced}`, desc: `${EFFECTS.silenced.desc} Còn ${u.silenced} lượt.` });
  if (u.chargeup > 0) push('chargeup', { label: 'Dồn lực' });
  if (u.extraTurns > 0) push('extra', { label: `Thêm ${u.extraTurns} lượt` });
  if (u.ramp > 0) push('ramp', { label: `Tăng dần +${Math.round(u.ramp * 100)}%` });
  if (u.ccImmune > 0) push('ccImmune', { label: `Kháng khống chế ${u.ccImmune}` });

  for (const d of u.dots) {
    push('dot', { label: `Mất ${d.amt}/lượt`, desc: `${EFFECTS.dot.desc} Mất ${d.amt} máu mỗi lượt, còn ${d.t} lượt.` });
  }
  for (const b of u.buffs) {
    if (b.regen) { push('regen', { label: `Hồi ${b.regen}/lượt`, desc: `${EFFECTS.regen.desc} Hồi ${b.regen} máu, còn ${b.t} lượt.` }); continue; }
    if (!b.stat) continue;
    const name = STAT_VI[b.stat] || b.stat;
    const up = b.pct > 0;
    push(up ? 'buff' : 'debuff', {
      label: `${name} ${up ? '+' : ''}${b.pct}%`,
      desc: `${name} đang ${up ? 'tăng' : 'giảm'} ${Math.abs(b.pct)}% trong ${b.t} lượt nữa.`
    });
  }
  return out;
}
