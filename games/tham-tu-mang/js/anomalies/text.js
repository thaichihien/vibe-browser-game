/* Họ TEXT. Không chạm DOM ở tầng import — mọi thứ nằm trong apply(). */

import { pick } from '../engine/rng.js';

/* ── T03: cái thang tụt xuống ──────────────────────────────────────────
   Nỗi sợ không phải là con số về 0. Nó là chuyện con số THÔI KHÔNG CÒN là
   thứ đếm được, trong khi câu văn quanh nó vẫn lịch sự y nguyên. Spec §6 T03. */

export function formatVi(n) {
  if (!Number.isFinite(n)) return String(n);
  const s = Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));
  return s.replace('.', ',');
}

/** Khi con số thôi không còn là một con số nữa. */
const GIVE_UP = ['∅', 'NaN', '∞', '∅'];

/** Trả về số kế tiếp, hoặc một chuỗi khi nó không còn là số nữa. */
export function descend(value, step) {
  if (step < 4) return value - 1;                       // 1 · đếm ngược thật
  if (step < 8) return value / 2;                       // 2 · phân số — đang bị chia, không phải đang bớt
  if (step < 12) return -(Math.abs(value) * 4 + 1);     // 3 · âm và tăng tốc
  if (step === 12) return -1.7e3;                       // 4 · ký hiệu khoa học
  if (step === 13) return -4.4e9;
  if (step === 14) return 6.02e23;                      // Avogadro — mọi thứ, cùng lúc, đang nhìn
  return GIVE_UP[(step - 15) % GIVE_UP.length];         // 5 · thôi không còn là số
}

/** Exported so the test can assert what the player actually sees, not what String() gives. */
export function renderNumber(value) {
  if (typeof value === 'string') return value;
  const abs = Math.abs(value);
  if (abs >= 1e3 && (abs >= 1e6 || !Number.isInteger(value))) {
    return value.toExponential(2).replace('.', ',').replace('e+', 'e');
  }
  return formatVi(value);
}

export const T01 = {
  id: 'T01', family: 'TEXT', label: 'Câu chữ bị thay bằng lời nguyền', slots: ['paragraph', 'notice'], weight: 3,
  apply(ctx) {
    ctx.slot.textContent = pick(ctx.rng, ctx.flavour);
    ctx.mark(ctx.slot);
  }
};

export const T02 = {
  id: 'T02', family: 'TEXT', label: 'Đoạn văn tự viết lại khi đọc lần hai', slots: ['paragraph', 'post-title', 'notice'], weight: 3,
  apply(ctx) {
    const entry = pick(ctx.rng, ctx.flavour);
    ctx.slot.textContent = entry.before;
    ctx.mark(ctx.slot);

    let left = false;
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) { left = true; continue; }
        if (left) {
          ctx.slot.textContent = entry.after;   // bản sau tệ hơn, và không có bản thứ ba
          observer.disconnect();
        }
      }
    }, { threshold: 0.2 });
    observer.observe(ctx.slot);
  }
};

export const T03 = {
  id: 'T03', family: 'TEXT', label: 'Con số đếm ngược thành thứ không đếm được', slots: ['paragraph', 'price', 'tile'], weight: 3,
  apply(ctx) {
    const entry = pick(ctx.rng, ctx.flavour);
    let value = entry.start;
    let step = 0;

    const paint = () => {
      ctx.slot.textContent = entry.text.replace('{n}', renderNumber(value));
    };
    paint();
    ctx.mark(ctx.slot);

    setInterval(() => {
      value = descend(value, step++);
      paint();
    }, 9000);
  }
};

/* Những gì trình duyệt thành thật biết về người chơi, không cần mạng, không cần lưu trữ.
   Một lời nói dối thì đoán được; một câu nói THẬT thì không. */
const FACTS = {
  tz: () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return null; } },
  screen: () => (window.innerWidth ? `${window.innerWidth}×${window.innerHeight}` : null),
  cores: () => navigator.hardwareConcurrency || null,
  lang: () => navigator.language || null
};

export const T04 = {
  id: 'T04', family: 'TEXT', label: 'Trang web biết về bạn nhiều hơn nó nên biết',
  slots: ['paragraph', 'footer', 'tile'], weight: 3,
  apply(ctx) {
    // Chỉ dùng những quan sát ĐÚNG. Nếu trình duyệt không trả lời được thì bỏ qua mục đó
    // thay vì bịa — nói bừa thì người chơi bắt được ngay, còn nói đúng thì không.
    const usable = ctx.flavour.filter((f) => FACTS[f.fact]?.() != null);
    if (!usable.length) return;

    const entry = pick(ctx.rng, usable);
    const line = document.createElement('span');
    line.textContent = ' ' + entry.text.replace('{v}', String(FACTS[entry.fact]()));
    ctx.slot.appendChild(line);
    ctx.mark(line);
  }
};

export const T05 = {
  id: 'T05', family: 'TEXT', label: 'Chú thích ẩn nói ngược lại chữ nhìn thấy',
  slots: ['avatar', 'photo', 'product-title'], weight: 2,
  apply(ctx) {
    const entry = pick(ctx.rng, ctx.flavour);
    ctx.slot.setAttribute('title', entry);
    // Một dấu hiệu rất mờ. Không có nó thì dị thường này chỉ tìm ra bằng cách rê chuột lên
    // từng thứ một, mà một dị thường không thể tìm ra thì làm ván chơi hỏng chứ không khó.
    ctx.slot.style.borderBottom = '1px dotted currentColor';
    ctx.mark(ctx.slot);
  }
};

export const TEXT_ANOMALIES = [T01, T02, T03, T04, T05];
