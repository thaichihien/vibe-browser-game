/* Họ MOTION. Chuyển động phải ở dưới ngưỡng chắc chắn — đủ để thấy khi nhìn thẳng vào nó,
   không đủ để chắc chắn khi liếc qua. */

import { pick } from '../engine/rng.js';
import { transformable } from '../engine/site.js';

export const M01 = {
  id: 'M01', family: 'MOTION', label: 'Phần tử trôi theo con trỏ chuột', slots: ['avatar', 'tile', 'cta'], weight: 2,
  apply(ctx) {
    ctx.mark(ctx.slot);
    transformable(ctx.slot);             // thẻ <a> trần không nhận transform — xem site.js
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
    transformable(ctx.slot);             // thẻ <a> trần không nhận transform — xem site.js
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

/* ── M05: trang tự cuộn ngược lên một đoạn ─────────────────────────────
   Dị thường duy nhất trong cả thư viện chạm vào KHUNG NHÌN chứ không vào trang. Người chơi
   đang cuộn xuống, và trang bỗng lùi lại bốn mươi pixel — đúng một lần, rồi thôi.

   Một biến cố xảy ra đúng một lần thì không khoanh được: lúc người chơi kịp hiểu chuyện gì
   vừa xảy ra thì nó đã xong rồi. Nên nó để lại một VẾT: một bản sao mờ của chính khối vừa
   trôi qua, nằm lệch lên phía trên chỗ thật, như một khung hình bị kẹt lại. Cái vết ấy mới
   là thứ phải khoanh, và nó nằm đó vĩnh viễn.

   Mờ tới đâu là chuyện cân giữa hai cái sai. Spec phác 8%, nhưng 8% trên nền sáng thì gần như
   không thấy, mà một dị thường không tìm ra được không làm ván khó lên — nó làm ván không
   thắng nổi. 14% vẫn đọc ra là một cái bóng, và vẫn tìm được.

   CÁI VẾT ĐƯỢC DỰNG NGAY LÚC ÁP DỤNG, không đợi tới lúc người chơi cuộn tới. Bản đầu chỉ dựng
   nó bên trong IntersectionObserver, và thế là hỏng hẳn: reconcile() chạy ngay sau vòng áp
   dụng, lúc chưa ai cuộn đi đâu cả, nên nó không thấy dấu vết nào và loại M05 ra khỏi MỌI ván
   — dị thường này chưa từng xuất hiện lấy một lần.

   Nhưng dựng sẵn mà nhìn thấy được thì lại hoá ra cho không: người chơi bắt được cái bóng
   trước cả khi biến cố xảy ra. Nên nó nằm đó với visibility:hidden. reconcile() chỉ hỏi DOM
   có phần tử mang data-anom hay không nên vẫn đếm được nó, còn targets() lọc theo
   checkVisibility() nên nó CHƯA phải là mục tiêu khoanh được — không sinh ra mục tiêu ma,
   đúng bài học của mấy cái <details> đang đóng ở chương 1.

   Bản sao được TẨY SẠCH dấu vết dị thường trước khi dùng: khối gốc có thể đã bị một dị thường
   khác áp lên, mà một bản sao mang theo data-anom thì sẽ tính điểm cho thứ nằm ở chỗ khác.

   Nó nằm ngoài dòng chảy (position:absolute) nên không đẩy gì đi đâu cả — bố cục không suy
   suyển một pixel, chỉ có một cái bóng thừa ra. */
export const M05 = {
  id: 'M05', family: 'MOTION', label: 'Trang tự cuộn ngược lên, và để lại một vệt',
  slots: ['paragraph', 'notice', 'tile', 'incident'], weight: 2,
  apply(ctx) {
    const entry = pick(ctx.rng, ctx.flavour);
    const lift = entry.lift ?? 40;
    const host = ctx.slot.parentElement;
    if (!host) return;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    const scar = ctx.slot.cloneNode(true);
    for (const el of [scar, ...scar.querySelectorAll('*')]) {
      el.removeAttribute('data-slot');
      el.removeAttribute('data-anom');
      el.removeAttribute('style');
      el.classList.remove('evidence-ring', 'missed-ring', 'aim-ring');
    }

    /* Cái vết KHÔNG chép lại chữ của khối gốc nữa. Bản đầu để nguyên, nên nó chỉ là một bản
       mờ của đúng câu vừa đọc — mà thế thì người chơi đọc ra là trang vẽ trùng một lần, tức
       là một LỖI, và lỗi thì người ta bỏ qua. Giờ nó mang chữ của riêng nó: cùng phông, cùng
       cỡ, cùng chỗ, nhưng nói một câu mà trang này chưa bao giờ viết ra. Cái vết không phải
       là tàn dư của khối chữ — nó là thứ đã ở dưới khối chữ ấy. */
    scar.textContent = entry.text;
    scar.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;opacity:0.14;z-index:1;';
    host.appendChild(scar);
    ctx.mark(scar);

    /* Chỉ nổ sau khi người chơi đã tự cuộn một lần. Không có cái chốt này thì trên trang nào
       chỗ bám nằm sẵn trong khung nhìn, nó bắn ngay lúc trang vừa mở — và một cú nhảy trang
       lúc đang tải thì đọc ra là trang tải chưa xong, chứ không phải là trang vừa lùi lại.
       Có hẹn giờ dự phòng: nếu vì lý do gì mà không có cú cuộn nào, cái chốt vẫn tự mở, vì
       một dị thường không bao giờ hiện ra là một ván không thắng nổi. */
    let armed = false;
    let fired = false;
    const arm = () => {
      if (armed) return;
      armed = true;
      /* Quan sát LẠI, không chỉ bật cờ. IntersectionObserver chỉ gọi lại khi trạng thái giao
         nhau ĐỔI; nếu chỗ bám đã nằm sẵn trong khung nhìn từ lúc trang mở thì callback đã
         chạy một lần lúc chốt còn đóng, và sẽ không bao giờ chạy nữa. Quan sát lại thì nó
         phát một callback mới cho trạng thái hiện tại. */
      watch.unobserve(ctx.slot);
      watch.observe(ctx.slot);
    };
    window.addEventListener('scroll', arm, { once: true, passive: true });
    setTimeout(arm, 5000);

    // eslint-disable-next-line no-var — arm() tham chiếu watch trước khi nó được gán
    var watch = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting || fired || !armed) continue;
        /* Đo ở ĐÂY chứ không ở apply(): chương nhiều trang gắn mọi trang cùng một lúc, và
           trang chưa mở thì đang display:none, nên lúc áp dụng khung của nó là 0×0. */
        const w = ctx.slot.offsetWidth;
        if (!w) continue;
        fired = true;
        watch.disconnect();

        scar.style.left = `${ctx.slot.offsetLeft}px`;
        scar.style.top = `${ctx.slot.offsetTop - lift}px`;
        scar.style.width = `${w}px`;
        scar.style.visibility = 'visible';
        window.scrollBy({ top: -lift, behavior: 'smooth' });
      }
    }, { threshold: 0.4 });
    watch.observe(ctx.slot);
  }
};

/* ── M07: mỗi lần con trỏ đi qua, nó lại đổi cỡ ────────────────────────
   Đưa chuột vào, phần tử nhích to ra một nấc — hoặc nhỏ đi một nấc. Đưa ra rồi đưa vào lại,
   nó nhích thêm một nấc nữa. Và nó KHÔNG BAO GIỜ trở lại cỡ cũ.

   Chỗ khác của nó so với cả họ MOTION: mọi dị thường chuyển động khác đều tự chạy, người chơi
   chỉ việc nhìn. Cái này chỉ động khi bị CHẠM VÀO, nên nó biến một thao tác vốn vô hại — rê
   chuột qua trang trong lúc đọc — thành thứ để lại hậu quả. Người chơi thường phát hiện ra nó
   theo đúng cái cách tệ nhất: quay lại một chỗ đã xem và thấy nó không còn như lúc nãy, mà
   không biết chắc tại mình nhớ sai hay tại nó đã khác.

   Nấc rời rạc chứ không phải phóng mượt: một chuyển tiếp mềm đọc ra là hiệu ứng giao diện —
   rất nhiều trang thật phóng nhẹ thẻ khi rê chuột. Một cú NHẢY cỡ, rồi đứng im ở cỡ mới, thì
   không trang nào làm thế cả.

   Hướng cố định cho mỗi lần đặt (to dần hoặc nhỏ dần), vì vừa to vừa nhỏ thì đọc ra là đang
   dao động, tức là một hiệu ứng. Một chiều duy nhất đọc ra là đang bị một cái gì đó kéo đi.

   CÓ TRẦN CỨNG. Không có trần thì đủ lần rê chuột là nó phình ra che mất hàng xóm hoặc teo
   lại tới mức không khoanh nổi — mà một dị thường không khoanh được thì không làm ván khó
   lên, nó làm ván không thắng nổi.

   transform-origin đặt ở mép trái-giữa chứ không phải tâm: phóng từ tâm thì chữ trong một
   dòng danh sách nhảy sang cả hai bên và đọc ra là trang vỡ; phóng từ mép trái thì dòng chữ
   giữ nguyên chỗ bắt đầu, chỉ có cỡ là khác. */
export const M07 = {
  id: 'M07', family: 'MOTION', label: 'Phần tử đổi cỡ mỗi lần con trỏ đi qua',
  slots: ['cta', 'avatar', 'price', 'tile'], weight: 2,
  apply(ctx) {
    const entry = pick(ctx.rng, ctx.flavour);
    const step = entry.step ?? 0.06;
    const max = entry.max ?? 4;
    const dir = entry.dir === 'down' ? -1 : 1;

    transformable(ctx.slot);             // thẻ <a> trần không nhận transform — xem site.js
    ctx.slot.style.transformOrigin = 'left center';
    ctx.slot.style.willChange = 'transform';
    ctx.mark(ctx.slot);

    let n = 0;
    ctx.slot.addEventListener('pointerenter', () => {
      if (n >= max) return;
      n += 1;
      ctx.slot.style.transform = `scale(${(1 + dir * step * n).toFixed(3)})`;
    });
  }
};

export const MOTION_ANOMALIES = [M01, M03, M05, M06, M07];
