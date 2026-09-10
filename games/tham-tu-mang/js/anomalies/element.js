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
    ctx.slot.parentNode.insertBefore(holder, ctx.slot);

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

export const ELEMENT_ANOMALIES = [E01, E04, E05];
