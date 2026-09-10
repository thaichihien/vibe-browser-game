/* Họ REACTIVE — hai giai đoạn. Trang web trung thực cho tới khi người chơi thử nghiệm;
   thử nghiệm làm dị thường HIỆN RA; rồi vẫn phải khoanh nó. Thử nghiệm không bao giờ
   mất máu, nên tò mò luôn an toàn. Spec §6 REACTIVE. */

import { pick } from '../engine/rng.js';

export const R05 = {
  id: 'R05', family: 'REACTIVE', label: 'Đăng ký nhận tin, hoá ra đã đăng ký từ lâu',
  slots: ['subscribe', 'newsletter'], weight: 3,
  // Cố tình chưa có mặt trong DOM lúc áp dụng — reconcile() không được coi đó là lỗi.
  deferred: true,
  apply(ctx) {
    const entry = pick(ctx.rng, ctx.flavour);
    const form = ctx.slot.querySelector('form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (ctx.slot.querySelector('[data-anom="R05"]')) return;

      const note = document.createElement('p');
      note.innerHTML =
        `Cảm ơn bạn. Bạn đã đăng ký nhận thư của chúng tôi từ ngày ${entry.since}. ` +
        `<a href="#" style="color:inherit">${entry.unsub}</a>`;
      note.style.cssText = 'font-size:12px;color:#6f635d;margin-top:8px;';
      ctx.slot.appendChild(note);
      ctx.mark(note);
    });
  }
};

export const REACTIVE_ANOMALIES = [R05];
