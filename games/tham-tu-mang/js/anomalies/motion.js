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

/* ── M06: có gì đó đang bay bên trong một tấm ảnh ──────────────────────
   Một tấm ảnh TĨNH thì không có gì trong nó di chuyển được. Đó là toàn bộ dị thường này, và
   đó cũng là lý do nó sống sót qua câu hỏi "…hay trang nó vốn thế?" tốt hơn mọi thứ khác
   trong họ MOTION: một khối phóng to thu nhỏ còn giải thích được là hiệu ứng giao diện, chứ
   một đốm sáng đi ngang qua bức ảnh chụp mặt hồ thì không có cách nào là cố ý cả.

   Chậm là bắt buộc. Đủ nhanh để nhận ra khi nhìn thẳng vào ảnh, đủ chậm để liếc qua thì
   tưởng mình hoa mắt — đúng ngưỡng mà cả họ MOTION nhắm tới.

   ĐÁNH DẤU CẢ ĐỐM SÁNG LẪN TẤM ẢNH. Thứ người chơi nhìn thấy là cái đốm, nên khoanh quanh
   cái đốm phải tính điểm; nhưng một vòng tròn nhỏ quanh nó KHÔNG bao lấy tâm của tấm ảnh,
   nên nếu chỉ đánh dấu tấm ảnh thì người chơi khoanh đúng thứ mình nhìn ra và mất một trái
   tim. run.found lưu theo ID dị thường chứ không theo phần tử, nên khoanh cái nào cũng ghi
   được một lần, và khoanh nốt cái kia trả về ĐÃ GHI RỒI thay vì trừ máu (xem I03).

   Đường bay được dựng LÚC TẤM ẢNH LỌT VÀO KHUNG NHÌN LẦN ĐẦU, không phải lúc apply(). Ở
   chương nhiều trang, mọi trang đều được gắn cùng lúc và các trang chưa mở đang display:none,
   nên đo lúc apply() sẽ ra khung 0×0 và đốm sáng đứng im tại chỗ. */
export const M06 = {
  id: 'M06', family: 'MOTION', label: 'Có gì đó đang bay bên trong một tấm ảnh',
  slots: ['photo', 'gallery-caption'], weight: 2,
  apply(ctx) {
    const figure = ctx.slot.closest('figure') ?? ctx.slot.parentElement;
    const img = figure?.querySelector('img');
    if (!figure || !img) return;
    const entry = pick(ctx.rng, ctx.flavour);
    ctx.mark(img);

    let started = false;
    const start = () => {
      if (started) return;
      started = true;

      const fr = figure.getBoundingClientRect();
      const r = img.getBoundingClientRect();
      if (!r.width || !r.height) { started = false; return; }   // chưa có khung thì đợi lần sau

      if (getComputedStyle(figure).position === 'static') figure.style.position = 'relative';

      const dot = document.createElement('span');
      dot.style.cssText =
        'position:absolute;width:7px;height:7px;border-radius:50%;background:#fff;' +
        'box-shadow:0 0 7px 2px rgba(255,255,255,.8);pointer-events:none;z-index:2;';
      dot.style.left = `${(r.left - fr.left).toFixed(1)}px`;
      dot.style.top = `${(r.top - fr.top).toFixed(1)}px`;
      figure.appendChild(dot);
      ctx.mark(dot);

      const at = (p) => `translate(${(p.x * r.width).toFixed(1)}px, ${(p.y * r.height).toFixed(1)}px)`;
      dot.animate([
        { transform: at(entry.from), opacity: 0 },
        { opacity: 0.95, offset: 0.12 },
        { opacity: 0.95, offset: 0.88 },
        { transform: at(entry.to), opacity: 0 }
      ], { duration: entry.seconds * 1000, iterations: Infinity, easing: 'linear' });
    };

    const seen = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        start();
        if (started) seen.disconnect();
      }
    }, { threshold: 0.2 });
    seen.observe(img);
  }
};

export const MOTION_ANOMALIES = [M01, M03, M06];
