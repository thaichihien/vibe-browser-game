/* Họ IMAGE — chỉ khả thi vì ảnh là ảnh thật và URL có tham số. Mỗi dị thường ở đây sẽ cần
   một tệp ảnh thứ hai làm bằng tay nếu ảnh là tệp tĩnh, và không cái nào khả thi với emoji. */

import { pick } from '../engine/rng.js';

/** Thêm tham số vào một URL đã ghim mà không làm mất cái ghim. */
function greyscaled(src) {
  if (src.includes('loremflickr.com')) {
    return src.includes('/g/') ? src : src.replace('loremflickr.com/', 'loremflickr.com/g/');
  }
  if (src.includes('picsum.photos')) {
    return src.includes('?') ? `${src}&grayscale` : `${src}?grayscale`;
  }
  return src;
}

export const I01 = {
  id: 'I01', family: 'IMAGE', label: 'Một tấm ảnh đến từ năm khác', slots: ['photo'], weight: 3,
  apply(ctx) {
    const figure = ctx.slot.closest('figure') ?? ctx.slot.parentElement;
    const img = figure?.querySelector('img');
    if (!img) return;

    /* Chỉ đen trắng thôi thì KHÔNG đủ lạ — người chơi đọc nó ra là một lựa chọn thiết kế,
       và họ đúng: rất nhiều trang thật để một tấm ảnh đen trắng giữa một dải ảnh màu.

       Nên tấm ảnh này không chỉ mất màu, nó còn ngả sang màu của một tấm ảnh cũ hơn hẳn:
       ố vàng, tương phản gắt, hơi tối. Ba tấm bên cạnh chụp tháng trước, còn tấm này trông
       như được quét lại từ một cuốn album. Cùng một khuôn hình, cùng một chú thích, nhưng
       sai mất vài chục năm. Cái đó thì không đọc ra là thiết kế được nữa.

       Việc mất màu vẫn do CDN làm (ảnh TỰ NÓ về đen trắng, chịu được soi kỹ); phần ngả màu
       do CSS, nên nó chồng lên trên chứ không thay thế. */
    const entry = pick(ctx.rng, ctx.flavour);
    img.src = greyscaled(img.getAttribute('src'));
    img.style.filter = entry.filter;
    ctx.mark(img);
    if (!entry.rotate) return;

    /* Và xoay hẳn đi. Ảnh ố vàng thôi thì vẫn còn giải thích được là một lựa chọn thiết kế;
       một bức ảnh phong cảnh nằm nghiêng ba mươi lăm độ — hoặc gần như lộn ngược — thì không.

       XOAY RUỘT ẢNH, KHÔNG XOAY CÁI KHUNG. Bản đầu xoay cả thẻ <img>, nên trên màn hình hiện
       ra một hình chữ nhật nằm chéo với nền trang lòi ra bốn góc: cái đó đọc ra là TRANG BỊ VỠ
       chứ không phải là tấm ảnh bị sai, mà trang vỡ thì người chơi bỏ qua. Giờ thì ô ảnh vẫn
       vuông vắn đúng chỗ của nó, đúng cỡ của nó, và chỉ có tấm ảnh BÊN TRONG là nằm nghiêng.
       Bố cục không suy suyển một pixel; chỉ có thế giới trong khung hình là sai.

       Cách làm, không cần thêm thẻ nào và không cần overflow:hidden ở đâu cả:
         · phóng to ảnh lên đúng hệ số k đủ để bản xoay phủ kín ô — thiếu một chút là hở góc;
         · rồi cắt bằng clip-path một hình bốn cạnh, tính TRONG HỆ TOẠ ĐỘ CHƯA XOAY của ảnh.
       clip-path cắt trước, transform xoay sau, nên nếu lấy ảnh ngược của ô ảnh qua phép xoay
       (tức xoay ô đi −góc rồi thu lại 1/k) thì sau khi xoay, phần còn thấy được khớp đúng
       từng pixel với ô ảnh ban đầu.

       Đo bằng offsetWidth/offsetHeight chứ KHÔNG bằng getBoundingClientRect: rect trả về
       khung đã-biến-đổi, nên lần đo thứ hai sẽ đo nhầm chính cái transform mình vừa đặt.

       ResizeObserver lo hai việc cùng lúc: đổi cỡ cửa sổ giữa ván, và trường hợp lúc apply()
       ô ảnh còn 0×0 — ở chương nhiều trang, mọi trang được gắn cùng lúc còn trang chưa mở thì
       đang display:none, nên đo ngay lúc đó sẽ ra một hệ số vô nghĩa. */
    /* Trần phóng to. Muốn bản xoay phủ kín ô ảnh thì phải phóng lên, và cái giá đó phụ thuộc
       tỉ lệ khung: ô vuông thì rẻ, ô dài ngoẵng thì đắt khủng khiếp. Một tấm toàn cảnh 3:1
       xoay 69° cần phóng 3,16 lần — tức là cắt còn một mẩu nhỏ, mờ nhoè, và người chơi đọc ra
       là ẢNH HỎNG chứ không phải ảnh bị xoay. Nên góc phải chiều theo khung: nếu góc tác giả
       viết ra quá đắt, kéo nó dần về phía mốc rẻ gần nhất (0° hoặc 180°) cho tới khi vừa trần.
       Một đường chân trời nghiêng 17° vẫn sai rành rành; một mẩu ảnh vỡ thì không nói gì cả. */
    const CEILING = 1.8;
    const zoomFor = (deg, w, h) => {
      const rad = deg * Math.PI / 180;
      const ac = Math.abs(Math.cos(rad));
      const as = Math.abs(Math.sin(rad));
      return Math.max((w * ac + h * as) / w, (w * as + h * ac) / h);
    };

    const angleFor = (w, h) => {
      const want = entry.rotate;
      if (zoomFor(want, w, h) <= CEILING) return want;
      const norm = ((want % 360) + 360) % 360;
      const anchor = Math.abs(norm - 180) < 90 ? 180 : 0;
      let deg = anchor;
      for (let t = 1; t <= 60; t++) {
        const trial = want + (anchor - want) * (t / 60);
        if (zoomFor(trial, w, h) <= CEILING) { deg = trial; break; }
      }
      /* Nếu kéo mãi mà chỉ còn gần 0° thì thôi không xoay nữa cũng bằng không có dị thường.
         180° thì LÚC NÀO cũng rẻ — hệ số đúng bằng 1 với mọi khung — nên đó là lối thoát:
         ảnh lộn ngược hẳn, không mất một pixel nào. */
      const off = Math.abs(Math.sin(deg * Math.PI / 180));
      return off < Math.sin(8 * Math.PI / 180) ? 180 : deg;
    };

    const paint = () => {
      const w = img.offsetWidth;
      const h = img.offsetHeight;
      if (!w || !h) return;

      const deg = angleFor(w, h);
      const rad = deg * Math.PI / 180;
      const cs = Math.cos(rad);
      const sn = Math.sin(rad);
      const k = zoomFor(deg, w, h);

      // Góc của ô ảnh, đưa ngược về hệ toạ độ của chính thẻ <img> trước khi xoay.
      const at = (dx, dy) => {
        const x = w / 2 + (dx * cs + dy * sn) / k;
        const y = h / 2 + (-dx * sn + dy * cs) / k;
        return `${x.toFixed(2)}px ${y.toFixed(2)}px`;
      };

      img.style.transformOrigin = 'center center';
      img.style.transform = `rotate(${deg.toFixed(2)}deg) scale(${k.toFixed(4)})`;
      img.style.clipPath =
        `polygon(${at(-w / 2, -h / 2)}, ${at(w / 2, -h / 2)}, ${at(w / 2, h / 2)}, ${at(-w / 2, h / 2)})`;

      /* clip-path giấu được PIXEL nhưng không thu lại VÙNG CUỘN: trình duyệt vẫn tính khung
         đã-biến-đổi vào phạm vi cuộn của trang, nên tấm ảnh phóng 1,8 lần làm cả trang cuộn
         ngang được dù không có gì thò ra để mà nhìn thấy. Một trang tự nhiên cuộn ngang thì
         đọc ra là trang vỡ, và tệ hơn: thanh cuộn ấy là một cái tell không ai đặt vào đó.

         Cắt ở ngay thẻ <figure>, và cắt TỪ TRONG dị thường chứ không phải trong site.css.
         Luật "không overflow:hidden ở thẻ cha của data-slot" vẫn còn nguyên giá trị cho S06
         và E01 — nhưng hai đứa đó không bao giờ bám vào figcaption của ảnh, và mỗi phần tử
         slot chỉ nhận đúng một dị thường, nên cái figure này chắc chắn không còn ai khác. */
      const frame = ctx.slot.closest('figure') ?? img.parentElement;
      if (frame) {
        frame.style.overflow = 'hidden';
        frame.style.overflow = 'clip';      // không tạo hộp cuộn; bản cũ không hiểu thì bỏ qua
      }
    };

    paint();
    if (typeof ResizeObserver === 'function') new ResizeObserver(paint).observe(img);
  }
};

export const I03 = {
  id: 'I03', family: 'IMAGE', label: 'Hai cái tên, một khuôn mặt', slots: ['avatar'], weight: 3, needs: { avatar: 2 },
  apply(ctx) {
    const all = ctx.root.querySelectorAll('[data-slot="avatar"]');
    if (all.length < 2) return;

    const mine = ctx.slot;
    const other = [...all].find((el) => el !== mine);
    const srcImg = other.closest('figure')?.querySelector('img');
    const dstImg = mine.closest('figure')?.querySelector('img');
    if (!srcImg || !dstImg) return;

    // Hai cái tên, hai độ tuổi, một khuôn mặt.
    dstImg.src = srcImg.getAttribute('src');

    /* ĐÁNH DẤU CẢ HAI. Sau khi tráo thì hai tấm ảnh giống hệt nhau, nên không có cách nào
       — không một cách nào — để người chơi biết tấm nào là bản gốc và tấm nào là bản bị
       tráo vào. Nếu chỉ đánh dấu một tấm thì người chơi nhìn ra đúng dị thường, khoanh
       đúng cái mình nhìn ra, và mất một trái tim vì đã chọn nhầm nửa của một cặp không
       phân biệt được. Cả hai cùng mang data-anom="I03", mà run.found lưu theo ID dị thường
       chứ không theo phần tử, nên khoanh cái nào cũng ghi được một lần, và khoanh nốt cái
       kia trả về ĐÃ GHI RỒI thay vì trừ máu. */
    ctx.mark(dstImg);
    ctx.mark(srcImg);
  }
};

export const I04 = {
  id: 'I04', family: 'IMAGE', label: 'Tấm ảnh mờ dần mỗi lần bạn nhìn nó',
  slots: ['photo', 'avatar'], weight: 2,
  apply(ctx) {
    const img = ctx.slot.closest('figure')?.querySelector('img');
    if (!img) return;
    ctx.mark(img);

    /* Dùng filter của CSS chứ không phải tham số ?blur= của CDN: loremflickr không có tham số
       đó, và đổi src mỗi lần nhìn sẽ khiến ảnh phải tải lại — ngoại tuyến là rơi thẳng về
       ảnh dự phòng. Nhìn là thứ làm nó mờ đi, và nó không bao giờ trong lại. */
    const STEPS = [0, 0.6, 1.4, 2.6];
    let step = 0;
    const seen = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        step = Math.min(step + 1, STEPS.length - 1);
        img.style.filter = `blur(${STEPS[step]}px)`;
      }
    }, { threshold: 0.5 });
    seen.observe(img);
  }
};

/* ── I02: tấm ảnh đổi khi bạn quay lại ─────────────────────────────────
   T02 dành cho ảnh. Bạn cuộn qua một tấm ảnh, đọc chú thích của nó, cuộn tiếp; lúc quay lại
   thì chú thích vẫn y nguyên còn tấm ảnh thì không phải tấm cũ nữa. Trang web không sửa lời
   nó đã viết, và cũng không nhận là đã đổi gì.

   Đổi LÚC KHÔNG AI NHÌN là toàn bộ điểm mấu chốt: một tấm ảnh nháy sang tấm khác trước mắt
   đọc ra là băng chuyền ảnh, là một thứ trang web cố ý làm. Một tấm chỉ khác đi sau khi bạn
   quay lưng thì không giải thích được bằng bất cứ tính năng nào.

   Ảnh mới được TẢI TRƯỚC. Nếu không, lúc đổi src sẽ có một nhịp trắng, và chính cái nháy đó
   tố cáo rằng ảnh vừa bị tráo — thay vì để người chơi tự nhận ra bằng cách nhớ. */
export const I02 = {
  id: 'I02', family: 'IMAGE', label: 'Tấm ảnh đổi khi bạn quay lại', slots: ['photo'], weight: 3,
  apply(ctx) {
    const figure = ctx.slot.closest('figure') ?? ctx.slot.parentElement;
    const img = figure?.querySelector('img');
    if (!img) return;
    const entry = pick(ctx.rng, ctx.flavour);
    ctx.mark(img);

    const warm = new Image();
    warm.src = entry.src;

    let away = false;
    let done = false;
    const watch = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) { away = true; continue; }
        if (!away || done) continue;
        done = true;
        // Chỉ ảnh đổi. Chú thích thì không — sự lệch giữa hai thứ mới là dị thường.
        img.src = entry.src;
        watch.disconnect();
      }
    }, { threshold: 0.3 });
    watch.observe(img);
  }
};

export const IMAGE_ANOMALIES = [I01, I02, I03, I04];
