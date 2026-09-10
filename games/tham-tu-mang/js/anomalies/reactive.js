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

      /* Cùng một class với dòng xác nhận thật của trang (xem behaviour() trong page.js), nên
         hai bản trông GIỐNG HỆT nhau. Nếu bản dị thường có kiểu dáng riêng thì người chơi
         nhận ra nó bằng mắt mà không cần đọc, và cả dị thường này chỉ nằm ở chỗ được đọc. */
      const note = document.createElement('p');
      note.className = 'news-ok';
      note.innerHTML =
        `Cảm ơn bạn. Bạn đã đăng ký nhận thư của chúng tôi từ ngày ${entry.since}. ` +
        `<a href="#" style="color:inherit">${entry.unsub}</a>`;
      /* KHÔNG đặt style inline ở đây. Bản đầu để lại font-size:13px làm dự phòng, và nó đè
         luôn class .news-ok của trang (13,5px) — thành ra dòng dị thường nhỏ hơn dòng thật
         nửa pixel, tức là phân biệt được bằng mắt mà không cần đọc chữ. Đó đúng là thứ dị
         thường này không được phép có. Chương nào mở slot newsletter/subscribe thì phải tự
         style .news-ok; chưa style thì <p> vẫn thừa kế phông của trang, vẫn lành. */
      ctx.slot.appendChild(note);
      ctx.mark(note);

      // Trang thật thì xoá ô nhập sau khi gửi; bản này cũng vậy, để khác biệt duy nhất là chữ.
      const input = form.querySelector('input');
      if (input) input.value = '';
    });
  }
};

/* ── R06: một liên kết mở ra thứ không ai gõ vào ───────────────────────
   Bấm vào LIÊN HỆ, hoặc vào nút đặt lịch, và trình duyệt mở một tab mới đi tìm một thứ mà
   bạn không hề gõ. Trang web không giải thích gì. Khi bạn quay lại, chỗ vừa bấm đã không
   còn ghi cái nó vẫn ghi nữa.

   Hai giai đoạn, đúng luật của họ REACTIVE: trang trung thực cho tới khi người chơi thử,
   cú thử KHÔNG BAO GIỜ mất máu, và dấu vết để lại mới là thứ phải khoanh. Nếu không đổi
   chữ ở chỗ vừa bấm thì người chơi bấm xong sẽ chẳng có gì để khoanh — mở một tab rồi
   không để lại vết là một dị thường không tồn tại trên trang.

   deferred: true vì lúc apply() nó chưa gắn vào đâu cả; reconcile() không được coi đó là
   hỏng (xem run.js). */
export const R06 = {
  id: 'R06', family: 'REACTIVE', label: 'Một liên kết đi tìm thứ bạn không gõ',
  slots: ['nav', 'cta'], weight: 2,
  deferred: true,
  apply(ctx) {
    const entry = pick(ctx.rng, ctx.flavour);

    // Trên slot `nav` thì bám vào đúng một liên kết, không phải cả thanh menu.
    const links = [...ctx.slot.querySelectorAll('a')];
    const target = ctx.slot.tagName === 'NAV'
      ? (links.find((a) => /liên hệ/i.test(a.textContent)) ?? links[links.length - 1])
      : ctx.slot;
    if (!target) return;

    let fired = false;
    target.addEventListener('click', () => {
      if (fired) return;
      fired = true;
      // sealNavigation() đã preventDefault ở pha capture nên trang không bị điều hướng đi;
      // mở tab mới thì lượt chơi đang dở vẫn còn nguyên ở tab này.
      window.open(
        `https://www.google.com/search?q=${encodeURIComponent(entry.q)}`,
        '_blank',
        'noopener'
      );
      target.textContent = entry.label;
      ctx.mark(target);
    });
  }
};

export const REACTIVE_ANOMALIES = [R05, R06];
