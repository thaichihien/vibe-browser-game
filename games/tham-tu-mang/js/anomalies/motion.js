/* Họ MOTION. Chuyển động phải ở dưới ngưỡng nhận biết — đủ để thấy khi nhìn chằm chằm,
   không đủ để chắc chắn khi liếc qua. */

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
    ctx.slot.style.animation = 'tho 4s ease-in-out infinite';
    ctx.mark(ctx.slot);
  }
};

export const MOTION_ANOMALIES = [M01, M03];
