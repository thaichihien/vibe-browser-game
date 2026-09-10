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

export const IMAGE_ANOMALIES = [I01, I03, I04];
