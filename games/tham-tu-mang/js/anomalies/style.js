/* Họ STYLE. */

import { pick } from '../engine/rng.js';

export const S01 = {
  id: 'S01', family: 'STYLE', label: 'Một chữ sai phông chữ',
  slots: ['paragraph', 'hero-title', 'notice'], weight: 3,
  apply(ctx) {
    /* The word is taken FROM THE ELEMENT'S OWN TEXT, never from a fixed list.
       An earlier version carried its own words ('mong', 'luôn', 'nhớ') and bailed out when
       the paragraph did not contain one — which, on this chapter, was always. The anomaly
       then marked nothing at all, so it could never be captured and the run could never be
       won. An anomaly that can silently decline to exist is worse than one that is too easy. */
    const entry = pick(ctx.rng, ctx.flavour);
    const text = ctx.slot.textContent.replace(/\s+/g, ' ').trim();

    // Skip the shortest words: a reskinned "và" is invisible, and the point is that the
    // word is unremarkable, not that it is unreadable.
    const words = [...new Set(text.split(' ').filter((w) => w.replace(/[.,:;!?()"'“”]/g, '').length >= 4))];
    if (!words.length) return;

    const raw = pick(ctx.rng, words);
    const word = raw.replace(/[.,:;!?()"'“”]/g, '');
    if (!word) return;

    const span = document.createElement('span');
    span.textContent = word;
    span.style.fontFamily = entry.family;
    span.style.letterSpacing = entry.spacing ?? '0.06em';
    if (entry.style) span.style.fontStyle = entry.style;
    if (entry.weight) span.style.fontWeight = String(entry.weight);

    const at = text.indexOf(word);
    ctx.slot.textContent = '';
    ctx.slot.append(text.slice(0, at), span, text.slice(at + word.length));
    ctx.mark(span);
  }
};

export const S05 = {
  id: 'S05', family: 'STYLE', label: 'Chú thích không khớp với tấm ảnh', slots: ['gallery-caption', 'avatar', 'photo'], weight: 3,
  apply(ctx) {
    // Ảnh đã được ghim (pinned) nên chú thích được viết đối chọi với một bức ảnh ĐÃ BIẾT.
    ctx.slot.textContent = pick(ctx.rng, ctx.flavour);
    ctx.mark(ctx.slot);
  }
};

export const S07 = {
  id: 'S07', family: 'STYLE', label: 'Emoji lạc loài giữa các biểu tượng', slots: ['feature-icon', 'tile', 'nav'], weight: 4,
  apply(ctx) {
    const emoji = pick(ctx.rng, ctx.flavour);

    /* Chỗ bám có thể là MỘT biểu tượng (feature-icon), mà cũng có thể là cả một khối chứa
       nhiều thứ bên trong (nav, tile). Bản đầu gán thẳng textContent cho chỗ bám, nên khi nó
       rơi vào thanh điều hướng thì CẢ NĂM liên kết biến mất, còn lại đúng một cái emoji —
       14% số ván của chương 1. Đó không đọc ra là "một biểu tượng lạc loài", nó đọc ra là
       trang web hỏng, mà trang hỏng thì người chơi bỏ qua chứ không khoanh.

       Nên: có phần tử con thì thay chữ của ĐÚNG MỘT đứa con và đánh dấu đứa đó — người chơi
       khoanh được đúng cái họ nhìn ra. Không có con thì mới thay chữ của chính chỗ bám. */
    const kids = [...ctx.slot.children].filter((el) => el.textContent.trim());
    const target = kids.length ? pick(ctx.rng, kids) : ctx.slot;

    target.textContent = emoji;
    ctx.mark(target);
  }
};

export const S06 = {
  id: 'S06', family: 'STYLE', label: 'Một dòng chữ đang rời khỏi trang',
  slots: ['paragraph', 'footer', 'notice'], weight: 2,
  apply(ctx) {
    /* Bản đầu chỉ dịch cả khối sang trái một lần rồi đứng yên, và người chơi đọc nó ra là
       LỖI GIAO DIỆN chứ không phải dị thường — hoàn toàn đúng, vì một khối chữ lệch lề đứng
       im chính xác là cái mà một trang web hỏng CSS trông như thế.

       Cái tách "hỏng" khỏi "sai" là ý chí. Nên ở đây nó không đứng yên: mỗi lần người chơi
       cuộn đi rồi cuộn lại, dòng chữ đã ra xa thêm một đoạn và nghiêng thêm một chút, như
       thể nó đang cố đi ra khỏi trang và mỗi lần bạn quay lưng nó lại đi thêm được một quãng.
       Một lỗi CSS thì không nhích. Có trần cứng để nó không bao giờ ra khỏi màn hình — một
       dị thường trôi mất khỏi chỗ khoanh được thì cũng thành không thắng nổi. */
    const entry = pick(ctx.rng, ctx.flavour);
    const STEP = entry.step ?? 16;
    const MAX = entry.max ?? 88;

    ctx.slot.style.position = 'relative';
    ctx.slot.style.willChange = 'transform';

    let out = 20 + Math.floor(ctx.rng() * 10);
    const paint = () => {
      const tilt = -(out / MAX) * 2.4;          // càng ra xa càng nghiêng
      ctx.slot.style.transform = `translateX(-${out}px) rotate(${tilt.toFixed(2)}deg)`;
    };
    paint();
    ctx.mark(ctx.slot);

    let away = false;
    const watch = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) { away = true; continue; }
        if (!away) continue;
        away = false;
        out = Math.min(out + STEP, MAX);
        paint();
      }
    }, { threshold: 0.25 });
    watch.observe(ctx.slot);
  }
};

/* S04 `bóng-đổ-sai-hướng` đã bị RÚT sau lần chơi thử ngày 10/09/2026.
   Một cái bóng đổ ngược hướng so với phần còn lại của trang không đọc ra là "sai" — nó đọc
   ra là một thẻ được style hơi khác, tức là đúng thứ mà mọi trang thật đều có vài chỗ. Nó
   không sống sót qua câu hỏi "…hay trang nó vốn thế?" theo hướng ngược lại: câu trả lời
   luôn luôn là "ừ, chắc vậy". Xem spec §6 STYLE. Nếu khôi phục, nó cần một cái tell thứ hai
   chứ không phải một cái bóng đậm hơn. */

export const STYLE_ANOMALIES = [S01, S05, S06, S07];
