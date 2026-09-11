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

/* ── T05: dòng chữ chỉ hiện khi rê chuột ───────────────────────────────
   CÁI NÀY LÀ GÌ, nói cho gọn: chú thích nhìn thấy nói một đằng, còn dòng chữ nấp sau nó —
   chỉ hiện khi rê chuột lên — nói một nẻo, và nẻo kia mới là sự thật. Chú thích ghi
   "Khách hàng hài lòng"; rê chuột lên thì trang nói thêm "cô ấy chưa rời phòng thử kể từ
   tháng 3". Trang web không sửa lại lời nó đã viết. Nó chỉ nói thêm, cho riêng bạn.

   Bản đầu dùng thuộc tính title= của trình duyệt và người chơi không hiểu chuyện gì đang
   xảy ra — hợp lý: tooltip mặc định đợi gần một giây mới hiện, hiện ra bằng phông hệ thống
   ở một góc màn hình, và trông y hệt một cái tooltip bình thường của trình duyệt, tức là
   trông như một phần của TRÌNH DUYỆT chứ không phải của TRANG. Thứ trông như chrome của
   trình duyệt thì không thể là dị thường của trang được.

   Nên nó tự vẽ lấy: hiện sau 180ms, ngay dưới chỗ đang rê, bằng phông và màu của trang.
   Cái tell tĩnh (gạch chân chấm) vẫn giữ, vì không có nó thì chỉ tìm ra bằng cách rê chuột
   lên từng thứ một — mà phải tìm ĐỦ mới thắng, nên một dị thường không tìm ra được không
   làm ván khó lên, nó làm ván không thắng nổi. */
export const T05 = {
  id: 'T05', family: 'TEXT', label: 'Rê chuột lên thì trang nói ngược lại chính nó',
  slots: ['avatar', 'photo', 'product-title'], weight: 2,
  apply(ctx) {
    const entry = pick(ctx.rng, ctx.flavour);
    ctx.slot.removeAttribute('title');
    ctx.slot.style.borderBottom = '1px dotted currentColor';
    ctx.mark(ctx.slot);

    let tip = null;
    let timer = 0;

    const hide = () => { clearTimeout(timer); tip?.remove(); tip = null; };
    const show = () => {
      if (tip) return;
      tip = document.createElement('div');
      tip.className = 'ghost-tip';
      tip.textContent = entry;
      ctx.root.appendChild(tip);
      // position:fixed, nên toạ độ khung nhìn của phần tử dùng thẳng được.
      const r = ctx.slot.getBoundingClientRect();
      tip.style.left = `${Math.max(12, Math.round(r.left))}px`;
      tip.style.top = `${Math.round(r.bottom) + 8}px`;
    };

    ctx.slot.addEventListener('pointerenter', () => { timer = setTimeout(show, 180); });
    ctx.slot.addEventListener('pointerleave', hide);
  }
};

/* ── T07: một mốc thời gian không thể tồn tại ──────────────────────────
   Giờ mở cửa là chỗ tốt nhất cho nó: ba cửa hàng xếp cạnh nhau, cùng một khuôn mẫu
   "HH:MM – HH:MM", nên mắt đọc cả ba như một khối và không ai soi từng chữ số. Con số sai
   không hét lên; nó chỉ nằm đó, được trình bày lịch sự y như hai con số đúng bên cạnh.

   Giờ mở cửa được GIỮ NGUYÊN, chỉ giờ đóng cửa bị thay — vì một dòng mà cả hai đầu đều sai
   thì đọc ra là dữ liệu rác, còn một dòng bắt đầu đúng rồi mới sai thì đọc ra là một cửa
   hàng thật sự đóng cửa vào lúc đó. */
export const T07 = {
  id: 'T07', family: 'TEXT', label: 'Một mốc thời gian không thể tồn tại',
  slots: ['hours', 'date', 'incident'], weight: 3,
  apply(ctx) {
    /* Hai hình dạng, hai kho chữ riêng — KHÔNG trộn chung. Một cái giờ đặt vào chỗ ngày
       tháng thì không đọc ra là "ngày này không có thật", nó đọc ra là trang bị lỗi dữ liệu,
       và lỗi dữ liệu thì người chơi bỏ qua. */
    const KINDS = [
      { key: 'time', re: /(\d{1,2}:\d{2})(\s*[–—-]\s*)(\d{1,2}:\d{2})/, keep: 2 },
      { key: 'date', re: /(\d{1,2}\/\d{1,2}\/\d{4})/, keep: 0 },
      // Danh sách lưu trữ của blog: "Tháng 3, 2026". Không phải dd/mm/yyyy, nên nếu thiếu
      // dạng này thì T07 rơi vào đó sẽ lặng lẽ không khớp gì và bị reconcile() loại đi.
      { key: 'month', re: /(Tháng\s+\d{1,2},\s*\d{4})/, keep: 0 }
    ];

    // Lấy đúng nút văn bản chứa mốc thời gian, để <b> và các <br> quanh nó còn nguyên.
    const walker = document.createTreeWalker(ctx.slot, NodeFilter.SHOW_TEXT);
    let node = null;
    let kind = null;
    while (walker.nextNode() && !node) {
      for (const k of KINDS) {
        if (!k.re.test(walker.currentNode.nodeValue)) continue;
        if (!(ctx.flavour?.[k.key] || []).length) continue;
        node = walker.currentNode;
        kind = k;
        break;
      }
    }
    if (!node) return;

    const m = node.nodeValue.match(kind.re);
    const head = node.nodeValue.slice(0, m.index);
    const tail = node.nodeValue.slice(m.index + m[0].length);
    const wrong = pick(ctx.rng, ctx.flavour[kind.key]);

    /* Giờ MỞ cửa giữ nguyên, chỉ vế sau sai (keep = 2 phần đầu của match). Một dòng sai ở cả
       hai đầu đọc ra là dữ liệu rác; một dòng bắt đầu đúng rồi mới sai đọc ra là một cửa hàng
       thật sự đóng cửa vào lúc đó. Ngày tháng thì chỉ có một mốc nên thay trọn (keep = 0). */
    const span = document.createElement('span');
    span.textContent = m.slice(1, 1 + kind.keep).join('') + wrong;
    node.replaceWith(document.createTextNode(head), span, document.createTextNode(tail));
    ctx.mark(span);
  }
};

/* ── T08: chữ ký của người không còn nữa ───────────────────────────────
   Kinh dị bằng ĐỐI CHIẾU, không bằng hình ảnh. Không có gì trên màn hình biến dạng: chỉ là
   một cái tên, đặt cạnh một cái ngày, ở đúng chỗ mà mọi blog đều đặt tên tác giả. Nó chỉ trở
   thành dị thường khi người chơi đã đọc một chỗ KHÁC trên trang — ô tưởng niệm ở thanh bên —
   và tự mình nối hai thứ lại.

   Vì thế chương phải tự viết sẵn ô tưởng niệm như NỘI DUNG SẠCH, luôn luôn có mặt. Ở những
   ván không bốc trúng T08, nó chỉ là một chi tiết buồn. Sự bất đối xứng đó là cố ý: trang
   web phải buồn được mà không cần phải sai. */
export const T08 = {
  id: 'T08', family: 'TEXT', label: 'Chữ ký của người không còn nữa',
  slots: ['byline', 'comment', 'notice'], weight: 3,
  apply(ctx) {
    const entry = pick(ctx.rng, ctx.flavour);

    /* Markup hợp đồng: chỗ nào có tên người thì bọc trong [data-who], thời điểm thì
       [data-when]. Đánh dấu ĐÚNG cái tên chứ không phải cả khối bình luận — thứ người chơi
       nhìn ra là cái tên, nên đó phải là thứ họ khoanh được. */
    const who = ctx.slot.matches('[data-who]') ? ctx.slot : ctx.slot.querySelector('[data-who]');
    if (!who) {           // không có hợp đồng thì vẫn phải bám được vào đâu đó
      ctx.slot.textContent = entry.name;
      ctx.mark(ctx.slot);
      return;
    }

    who.textContent = entry.name;
    const when = ctx.slot.querySelector('[data-when]');
    if (when && entry.when) when.textContent = entry.when;
    ctx.mark(who);
  }
};

/* ── T06: trang web quên dần cách viết tiếng Việt ──────────────────────
   Không phải MỘT chữ sai, mà cả một danh sách MỤC RỮA DẦN: mục đầu tiên tiếng Việt hoàn
   hảo, mục sau mất dấu thanh, mục sau nữa mất luôn nguyên âm, mục cuối chỉ còn phụ âm trơ.
   Đọc lướt qua thì giống lỗi phông chữ; đọc kỹ thì thấy nó không hỏng — nó đang quên.

   Vì thế nó là dị thường DUY NHẤT tác động lên nhiều phần tử cùng lúc theo một thứ tự có ý
   nghĩa, nên nó cần một cửa sổ các mục liền nhau chứ không phải một chỗ bám đơn lẻ. Mục đầu
   trong cửa sổ được giữ NGUYÊN VẸN: nếu mọi mục đều sai thì không còn cái mốc nào để thấy
   rằng chúng đang rữa đi. */

/** Bỏ dấu thanh và dấu mũ, giữ nguyên chữ cái. "nghỉ lễ" -> "nghi le" */
export function boDau(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

/** Ba mức rữa. Mức 0 là nguyên vẹn và không bao giờ được đánh dấu. */
export function decay(text, level) {
  if (level <= 0) return text;
  const flat = boDau(text);
  if (level === 1) return flat;
  if (level === 2) return flat.toLowerCase().replace(/[aeiouy]/g, '');
  return flat.toLowerCase().split(/\s+/).map((w) => w.replace(/[^a-z]/g, '')[0] ?? '')
    .filter(Boolean).join(' ');
}

export const T06 = {
  id: 'T06', family: 'TEXT', label: 'Trang web quên dần cách viết tiếng Việt',
  slots: ['product-title', 'notice'], weight: 3,
  apply(ctx) {
    const entry = pick(ctx.rng, ctx.flavour);
    const span = entry.span ?? 4;

    const all = [...ctx.root.querySelectorAll(`[data-slot="${ctx.slot.dataset.slot}"]`)];
    let start = all.indexOf(ctx.slot);
    if (start < 0) return;
    // Không đủ chỗ phía sau thì lùi cửa sổ lại, để lúc nào cũng có đủ mục mà rữa.
    start = Math.max(0, Math.min(start, all.length - span));
    const window = all.slice(start, start + span);
    if (window.length < 2) return;

    window.forEach((el, i) => {
      if (i === 0) return;                       // cái mốc, giữ nguyên
      const level = Math.min(i, 3);
      const text = el.textContent.replace(/\s+/g, ' ').trim();
      const rotted = decay(text, level);
      if (rotted === text) return;
      el.textContent = rotted;
      ctx.mark(el);
    });
  }
};

export const TEXT_ANOMALIES = [T01, T02, T03, T04, T05, T06, T07, T08];
