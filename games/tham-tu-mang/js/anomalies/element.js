/* Họ ELEMENT. */

import { pick } from '../engine/rng.js';

export const E01 = {
  id: 'E01', family: 'ELEMENT', label: 'Cái nút không thuộc về đâu cả', slots: ['paragraph', 'footer', 'nav'], weight: 3,
  apply(ctx) {
    const entry = pick(ctx.rng, ctx.flavour);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = entry.label;
    button.style.cssText =
      'position:absolute;left:8px;padding:6px 12px;border:1px solid #b0a49c;' +
      'background:#fff;font:11px/1 monospace;letter-spacing:.1em;cursor:pointer;';

    const holder = document.createElement('div');
    holder.style.cssText = 'position:relative;height:0;';
    holder.appendChild(button);

    /* Đi ngược lên tới chỗ nào còn là dòng chảy khối bình thường rồi mới chèn.
       Chèn thẳng cạnh chỗ bám thì khi chỗ đó nằm trong một flex/grid — thanh điều hướng,
       lưới hàng — cái giá đỡ trở thành một ô của flex, và nút bị đặt chồng lên chữ bên cạnh.
       Đè lên chữ thì đọc ra là trang hỏng, chứ không phải là "một cái nút bị bỏ quên ngoài
       lề", mà lề mới là toàn bộ ý của dị thường này. */
    let anchor = ctx.slot;
    const laidOut = (el) => {
      const d = el ? getComputedStyle(el).display : '';
      return d === 'flex' || d === 'grid' || d === 'inline-flex' || d === 'inline-grid';
    };
    while (anchor.parentElement && laidOut(anchor.parentElement)) anchor = anchor.parentElement;
    anchor.parentNode.insertBefore(holder, anchor);

    // Bấm vào KHÔNG tính điểm — vẫn phải khoanh.
    button.addEventListener('click', () => { window.alert(entry.dialog); });
    ctx.mark(button);
  }
};

export const E04 = {
  id: 'E04', family: 'ELEMENT', label: 'Dòng chân trang không nên có', slots: ['footer'], weight: 3,
  apply(ctx) {
    const line = document.createElement('span');
    line.textContent = pick(ctx.rng, ctx.flavour);
    ctx.slot.appendChild(line);
    ctx.mark(line);
  }
};

export const E05 = {
  id: 'E05', family: 'ELEMENT', label: 'Con trỏ chuột đổi hình ở chỗ không nên',
  slots: ['paragraph', 'cta', 'avatar', 'photo'], weight: 2,
  apply(ctx) {
    const entry = pick(ctx.rng, ctx.flavour);
    ctx.slot.style.cursor = entry.cursor;
    ctx.mark(ctx.slot);
  }
};

/* ── E02: một ô nhập không có lý do gì để tồn tại ──────────────────────
   Cái ô này phải trông GIỐNG HỆT hàng xóm của nó, nếu không người chơi nhận ra nó bằng mắt
   chứ không phải bằng cách đọc — mà chữ trên nhãn mới là toàn bộ dị thường. Nên nó không tự
   dựng kiểu dáng: nó NHÂN BẢN một ô đã có sẵn trong chính cái form đó rồi chỉ đổi phần chữ.
   Cách này cũng khiến nó chạy được trên mọi chương mà không cần biết gì về CSS của trang. */
export const E02 = {
  id: 'E02', family: 'ELEMENT', label: 'Một ô nhập không nên có trong biểu mẫu này',
  slots: ['comment-form', 'booking-form', 'shipping-form', 'subscribe', 'newsletter'], weight: 3,
  apply(ctx) {
    const entry = pick(ctx.rng, ctx.flavour);
    const form = ctx.slot.querySelector('form') ?? ctx.slot;
    const model = form.querySelector('input:not([type="hidden"])');
    if (!model) return;

    const field = model.cloneNode(true);
    field.value = '';
    field.type = 'text';
    field.placeholder = entry;
    field.setAttribute('aria-label', entry);
    // Không bắt buộc, và không mang tên trường của bản gốc — nó không được phép cản người
    // chơi gửi biểu mẫu, vì thử nghiệm thì không bao giờ được mất máu.
    field.removeAttribute('required');
    field.removeAttribute('name');

    model.insertAdjacentElement('afterend', field);
    ctx.mark(field);
  }
};

export const ELEMENT_ANOMALIES = [E01, E02, E04, E05];
