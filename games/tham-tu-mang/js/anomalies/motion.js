/* Họ MOTION. Chuyển động phải ở dưới ngưỡng chắc chắn — đủ để thấy khi nhìn thẳng vào nó,
   không đủ để chắc chắn khi liếc qua. */

import { pick } from '../engine/rng.js';

export const M01 = {
  id: 'M01', family: 'MOTION', label: 'Phần tử trôi theo con trỏ chuột', slots: ['avatar', 'tile', 'cta'], weight: 2,
  apply(ctx) {
    ctx.mark(ctx.slot);
    const MAX = 6;                       // không bao giờ trôi quá 6px
    let x = 0, y = 0;

    document.addEventListener('pointermove', (e) => {
      const r = ctx.slot.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      x += ((dx / d) * MAX - x) * 0.04;   // trễ nặng
      y += ((dy / d) * MAX - y) * 0.04;
      ctx.slot.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
    });
  }
};

export const M03 = {
  id: 'M03', family: 'MOTION', label: 'Phần tử đang thở', slots: ['tile', 'avatar', 'cta', 'map'], weight: 2,
  apply(ctx) {
    /* Bản đầu phóng 1,2% trong 4 giây và người chơi báo là KHÔNG THỂ THẤY. Dưới ngưỡng nhận
       biết thì không phải là tinh tế, chỉ là không tồn tại — mà vì phải tìm ĐỦ mọi dị thường
       mới thắng, một dị thường không nhìn thấy được không làm ván khó lên, nó làm ván hỏng.

       Bản này thở thật: biên độ đủ để bắt được bằng mắt ngoại vi, và nhịp có NGHỈ ở hai đầu
       (hít — giữ — thở ra) thay vì dao động đều. Nhịp đều đọc ra là hiệu ứng giao diện;
       quãng nghỉ mới là cái làm nó đọc ra là hơi thở. */
    const entry = pick(ctx.rng, ctx.flavour);
    ctx.slot.style.setProperty('--tho-scale', String(entry.scale));
    ctx.slot.style.animation = `tho ${entry.seconds}s ease-in-out infinite`;
    ctx.slot.style.transformOrigin = 'center center';
    ctx.mark(ctx.slot);
  }
};

export const MOTION_ANOMALIES = [M01, M03];
