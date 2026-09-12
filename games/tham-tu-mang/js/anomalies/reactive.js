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

      /* Cờ cho nhánh sạch biết mà đứng im — cùng hợp đồng với R01. Trước đây nhánh sạch tự dò
         [data-anom] trong khung, mà E02 cũng rơi vào slot newsletter và cái ô nhập thừa của nó
         cũng mang data-anom: thành ra trên những ván chỉ có E02, ô đăng ký nuốt mất cú bấm rồi
         im bặt. Một biểu mẫu không trả lời là một dị thường KHÔNG AI ĐẶT VÀO ĐÓ. */
      form.dataset.handled = '1';

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

/* ── R01: bình luận gửi đi, nhưng không phải của bạn ───────────────────
   Bỏ trống ô tên rồi gửi. Bình luận lên thật — nhưng không phải dưới tên "Ẩn danh", và
   không phải nội dung bạn vừa gõ. Nó lên dưới tên Mây, và nó trả lời một câu bạn chưa hề nói.

   Chỉ bắn khi ô tên TRỐNG, nên nó nằm sau một thao tác mà người chơi phải tự nghĩ ra: gửi
   một bình luận không ký tên. Ai điền tên đầy đủ sẽ không bao giờ thấy nó, và đó là chủ ý —
   họ vẫn còn sáu dị thường khác, còn người tò mò thì được thưởng. */
export const R01 = {
  id: 'R01', family: 'REACTIVE', label: 'Bình luận lên dưới một cái tên khác',
  slots: ['comment-form'], weight: 3,
  deferred: true,
  apply(ctx) {
    const entry = pick(ctx.rng, ctx.flavour);
    const form = ctx.slot.querySelector('form');
    const list = ctx.root.querySelector('[data-comments]');
    if (!form || !list) return;

    form.addEventListener('submit', () => {
      const name = form.querySelector('[name="ten"]');
      const body = form.querySelector('[name="noidung"]');
      if (!body || !body.value.trim()) return;      // chưa gõ gì thì chưa có gì xảy ra
      if (name && name.value.trim()) return;        // có ký tên -> bình luận bình thường
      if (list.querySelector('[data-anom="R01"]')) return;

      /* Cờ cho nhánh sạch biết mà đứng im. Nếu không có nó, trang sẽ đăng CẢ HAI: bình luận
         thật của người chơi và bình luận của Mây — và "có thêm một cái" thì đọc ra là lỗi,
         không phải là dị thường. Xem behaviour() trong sites/ch2-bep-nha-may/pages.js. */
      form.dataset.handled = '1';

      const li = document.createElement('li');
      li.className = 'cmt';
      li.innerHTML =
        `<div class="cmt-body"><b data-who>${entry.name}</b> ` +
        `<span class="cmt-when" data-when>${entry.when}</span>` +
        `<p></p></div>`;
      li.querySelector('p').textContent = entry.text;
      list.appendChild(li);

      if (name) name.value = '';
      body.value = '';
      ctx.mark(li);
    });
  }
};

/* ── R02: giỏ hàng tự thêm một món ─────────────────────────────────────
   Bỏ một món vào giỏ. Giỏ hiện món của bạn — và một món nữa bạn không hề bấm. Cùng người
   bán. Và ô địa chỉ nhận hàng đã được điền sẵn, bằng địa chỉ của người bán.

   Dị thường ĐẦU TIÊN bắc qua hai trang: cái nút ở trang sản phẩm, còn bằng chứng nằm ở
   trang giỏ hàng. Nó nghe qua ctx.shadow nhưng chỉ đánh dấu thứ nằm trong ctx.root — nếu
   đánh dấu một phần tử ở trang khác thì bằng chứng bị tính vào một trang mà nó không ở đó.

   Dòng hàng mới được NHÂN BẢN từ một dòng có sẵn rồi đổi chữ: tự dựng kiểu dáng thì nó sẽ
   khác hàng xóm một chút, và người chơi nhận ra nó bằng mắt thay vì bằng cách đọc. */
export const R02 = {
  id: 'R02', family: 'REACTIVE', label: 'Bỏ một món vào giỏ, giỏ tự thêm một món thứ hai',
  slots: ['cart-line'], weight: 3,
  deferred: true,
  apply(ctx) {
    const entry = pick(ctx.rng, ctx.flavour);
    /* MỌI nút bỏ vào giỏ, không phải cái đầu tiên. Chương 3 có mười hai trang món, mỗi trang
       một cái nút; bản đầu chỉ nghe querySelector() nên nó chỉ bắn khi người chơi mua đúng
       món đầu tiên trong DOM — mua bất cứ món nào khác thì dị thường lặng lẽ không xảy ra,
       mà bảng BẰNG CHỨNG thì vẫn đếm nó. */
    const triggers = [...ctx.shadow.querySelectorAll('[data-add-to-cart]')];
    const list = ctx.slot.parentElement;
    if (!triggers.length || !list) return;

    let fired = false;
    const onAdd = () => {
      if (fired) return;
      fired = true;

      const line = ctx.slot.cloneNode(true);
      line.removeAttribute('data-slot');        // chỗ bám đã dùng xong, bản sao không nhận nữa
      const title = line.querySelector('[data-line-title]');
      const price = line.querySelector('[data-line-price]');
      const note = line.querySelector('[data-line-note]');
      if (title) title.textContent = entry.title;
      if (price) price.textContent = entry.price;
      if (note) note.textContent = entry.seller;
      list.appendChild(line);

      // Địa chỉ giao hàng tự điền — bằng địa chỉ của người bán, không phải của bạn.
      const addr = ctx.root.querySelector('[data-ship-address]');
      if (addr) addr.value = entry.address;

      /* Đếm lại số món và cộng lại tạm tính. Bỏ qua bước này thì giỏ có ba dòng mà nhãn ghi
         hai, và người chơi đọc ra là trang web đếm sai — tức là một cái LỖI, thứ mà người ta
         bỏ qua. Dị thường mạnh hơn nhiều khi mọi con số đều khớp: không có gì hỏng cả, chỉ là
         trong giỏ có một món bạn chưa từng bấm vào. */
      const total = ctx.root.querySelector('[data-cart-total]');
      if (total) {
        const sum = [...list.querySelectorAll('li')].reduce((n, li) => {
          const raw = li.querySelector('[data-line-price]')?.textContent ?? '';
          return n + Number(raw.replace(/\D/g, '') || 0);
        }, 0);
        total.textContent = `${sum.toLocaleString('vi-VN')}₫`;
      }
      for (const n of ctx.shadow.querySelectorAll('[data-cart-count]')) {
        n.textContent = String(list.querySelectorAll('li').length);
      }

      ctx.mark(line);
    };
    for (const t of triggers) t.addEventListener('click', onAdd);
  }
};

/* ── R04: trang xác nhận cho nhiều khách hơn bạn điền ──────────────────
   Điền hai cái ngày, để nguyên "2 khách", bấm KIỂM TRA PHÒNG TRỐNG. Trang trả lời đàng hoàng
   như mọi trang đặt phòng khác — "Còn phòng cho khoảng ngày này. Lễ tân sẽ gọi lại trong 30
   phút để xác nhận đặt phòng cho SÁU khách."

   Bạn điền hai. Nó xác nhận sáu. Nó không hỏi lại, không báo lỗi, không xin lỗi.

   Vì sao gắn vào lúc GỬI chứ không phải lúc gõ: đây là họ REACTIVE, và luật của họ là trang
   trung thực cho tới khi người chơi thử một thao tác thật. Gõ một con số vào ô rồi thấy nó
   đổi là chuyện của một widget; đặt phòng cho hai người rồi nhận về xác nhận cho sáu người
   là một việc đã xảy ra với bạn.

   Và nó có sẵn một cái thước ngay bên trên: dòng tóm tắt vẫn ghi "2 khách". Người chơi không
   cần nhớ mình đã gõ gì — hai con số cãi nhau trong cùng một khung, cách nhau bốn dòng.

   KHÔNG tự dựng lấy câu trả lời. Nó để nhánh sạch viết nguyên câu văn của trang rồi chỉ thay
   đúng con số trong <span data-guest-count>. Tự dựng thì câu chữ sẽ lệch đi một chút so với
   câu thật, và người chơi nhận ra dị thường bằng mắt thay vì bằng cách đọc — đúng cái lỗi mà
   R05 đã mắc một lần với font-size.

   Cũng vì thế nó KHÔNG cắm form.dataset.handled: nhánh sạch phải được chạy mỗi lần gửi, để
   gửi lại với số khách khác thì câu trả lời vẫn tươi. Cả hai cùng hoãn một nhịp bằng
   setTimeout(0), mà nhánh sạch đăng ký trước nên callback của nó xếp hàng trước — R04 luôn
   viết đè lên một câu vừa mới được viết xong. */
export const R04 = {
  id: 'R04', family: 'REACTIVE', label: 'Trang xác nhận đặt phòng cho nhiều khách hơn bạn điền',
  slots: ['booking-form'], weight: 3,
  deferred: true,
  apply(ctx) {
    const entry = pick(ctx.rng, ctx.flavour);
    const form = ctx.slot.querySelector('form');
    const guests = ctx.slot.querySelector('[data-guests]');
    if (!form || !guests) return;

    form.addEventListener('submit', () => {
      setTimeout(() => {
        const answer = ctx.slot.querySelector('[data-booking-answer]');
        const cell = answer?.querySelector('[data-guest-count]');
        // Trang chưa trả lời được (thiếu ngày) thì chưa có con số nào để thổi lên. Để dành
        // cho lần gửi sau chứ không bịa ra một dòng của riêng mình.
        if (!cell) return;

        const typed = Math.max(1, Number(guests.value || 1));
        cell.textContent = String(typed + (entry.gap ?? 1));

        /* Đánh dấu CẢ câu lẫn con số. Thứ người chơi đọc ra là cả câu, nên khoanh cả câu phải
           tính điểm; nhưng một vòng nhỏ ôm lấy đúng con số thì không bao lấy tâm của cả câu,
           nên nếu chỉ đánh dấu câu thì người chơi khoanh trúng thứ mình nhìn ra mà vẫn mất
           máu. run.found lưu theo ID nên khoanh cái nào cũng ghi được một lần (xem I03). */
        ctx.mark(answer);
        ctx.mark(cell);
      }, 0);
    });
  }
};

export const REACTIVE_ANOMALIES = [R01, R02, R04, R05, R06];
