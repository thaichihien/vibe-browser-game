/* Họ IMAGE — chỉ khả thi vì ảnh là ảnh thật và URL có tham số. Mỗi dị thường ở đây sẽ cần
   một tệp ảnh thứ hai làm bằng tay nếu ảnh là tệp tĩnh, và không cái nào khả thi với emoji. */

import { pick } from '../engine/rng.js';

/* I01 `ảnh đến từ năm khác` đã bị RÚT theo yêu cầu của người chơi (18/09/2026).
   Nó làm một tấm ảnh mất màu, ngả vàng rồi xoay ruột ảnh bên trong khung. Cùng với nó, hàm
   greyscaled() và toàn bộ phần tính clip-path theo góc xoay cũng đi — không còn ai dùng.
   Chỗ của nó trong họ IMAGE do I05 (một tấm ảnh dùng hai lần) thế chỗ, để họ này vẫn đủ bốn
   thành viên: sức chứa của mỗi chương tính bằng số họ nhân hai, nên một họ hụt đi là cả
   khoảng bốc hụt theo. Xem spec §6 IMAGE. */

export const I03 = {
  id: 'I03', family: 'IMAGE', label: 'Hai cái tên, một khuôn mặt', slots: ['avatar'], weight: 3, needs: { avatar: 2 },
  apply(ctx) {
    const all = ctx.root.querySelectorAll('[data-slot="avatar"]');
    if (all.length < 2) return;

    const mine = ctx.slot;
    const dstImg = mine.closest('figure')?.querySelector('img');
    /* Ảnh của chính mình đã bị dị thường khác chiếm thì bỏ cuộc hẳn: reconcile() loại I03 ra
       một cách sạch sẽ, còn hơn là dựng một cặp mà chỉ một nửa khoanh được. */
    if (!dstImg || (dstImg.dataset.anom && dstImg.dataset.anom !== 'I03')) return;

    /* Bạn đồng hành phải là một avatar mà ảnh CHƯA có chủ. Bản đầu lấy bừa cái đầu tiên khác
       mình, nên khi I04 (ảnh mờ dần) đang ngồi đúng trên tấm đó thì một nửa của cặp mất dấu —
       và cặp "hai cái tên, một khuôn mặt" lại phân biệt được, đúng thứ I03 sinh ra để chống.
       Bắt được ở chương 4 hạt 13. */
    const free = (el) => {
      const img = el.closest('figure')?.querySelector('img');
      return img && (!img.dataset.anom || img.dataset.anom === 'I03');
    };
    const other = [...all].find((el) => el !== mine && free(el));
    const srcImg = other?.closest('figure')?.querySelector('img');
    if (!srcImg) return;

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
    /* Ảnh đã có dị thường khác ngồi lên (I03 với sang ảnh hàng xóm, I05 nhân đôi một tấm) thì
       bỏ cuộc. Cứ làm mờ mà không có dấu thì trên màn hình vẫn thấy ảnh mờ dần, nhưng khoanh
       vào đó chỉ nhận về "ĐÃ GHI RỒI" và không có gì xảy ra — một dị thường nhìn thấy được mà
       vĩnh viễn không khoanh được. Bắt được ở chương 5 hạt 5. */
    if (!ctx.mark(img)) return;

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

/* ── I05: một tấm ảnh được dùng hai lần ────────────────────────────────
   Hai chú thích khác nhau, tả hai chỗ khác nhau, và bên trên cả hai là ĐÚNG MỘT tấm ảnh.

   Đây là anh em của I03 ở phía ảnh chụp cảnh, và sự giống nhau đó là cố ý — nhưng hai cái nói
   hai câu khác hẳn. I03 nói: những người trên trang này không phải người thật. I05 nói: cái
   NƠI này không có thật, hoặc họ chỉ có đúng một tấm ảnh và đã đem dùng cho mọi thứ. Ở chương
   5 câu ấy nặng nhất — một ngôi trường chỉ có một tấm ảnh, dán cho cả sân trường lẫn lớp học.

   ĐÁNH DẤU CẢ HAI, cùng lý do với I03: sau khi tráo thì không còn cách nào phân biệt bản gốc
   với bản bị tráo vào, nên nếu chỉ đánh dấu một tấm thì người chơi nhìn ra đúng dị thường,
   khoanh đúng cái mình nhìn ra, rồi mất một trái tim vì đã chọn nhầm nửa của một cặp không
   phân biệt được. run.found lưu theo ID nên khoanh nửa nào cũng ghi được một lần, nửa kia
   trả về ĐÃ GHI RỒI.

   Chỉ nhận những tấm ảnh CHƯA có chủ — xem claimMark() trong engine/run.js. */
export const I05 = {
  id: 'I05', family: 'IMAGE', label: 'Một tấm ảnh được dùng hai lần',
  slots: ['photo', 'gallery-caption'], weight: 3,
  needs: { photo: 2, 'gallery-caption': 2 },
  apply(ctx) {
    const type = ctx.slot.dataset.slot;
    const all = [...ctx.root.querySelectorAll(`[data-slot="${type}"]`)];
    if (all.length < 2) return;

    const imgOf = (el) => el.closest('figure')?.querySelector('img') ?? null;
    const free = (el) => {
      const img = imgOf(el);
      return img && (!img.dataset.anom || img.dataset.anom === 'I05');
    };

    const dstImg = imgOf(ctx.slot);
    if (!dstImg || (dstImg.dataset.anom && dstImg.dataset.anom !== 'I05')) return;

    /* Bạn đồng hành phải là một tấm KHÁC HẲN về nội dung: nếu hai chỗ vốn đã dùng chung một
       URL thì hai chú thích đang nói về cùng một tấm ảnh thật, và chẳng có gì sai cả. So bằng
       src chứ không bằng vị trí. */
    const mineSrc = dstImg.getAttribute('src');
    const other = all.find((el) => el !== ctx.slot && free(el)
      && imgOf(el).getAttribute('src') !== mineSrc);
    const srcImg = other ? imgOf(other) : null;
    if (!srcImg) return;

    dstImg.src = srcImg.getAttribute('src');
    dstImg.setAttribute('alt', srcImg.getAttribute('alt') ?? '');
    ctx.mark(dstImg);
    ctx.mark(srcImg);
  }
};

export const IMAGE_ANOMALIES = [I02, I03, I04, I05];
