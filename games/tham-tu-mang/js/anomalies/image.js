/* Họ IMAGE — chỉ khả thi vì ảnh là ảnh thật và URL có tham số. Mỗi dị thường ở đây sẽ cần
   một tệp ảnh thứ hai làm bằng tay nếu ảnh là tệp tĩnh, và không cái nào khả thi với emoji. */

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
  id: 'I01', family: 'IMAGE', label: 'Một tấm ảnh mất màu', slots: ['photo'], weight: 3,
  apply(ctx) {
    const figure = ctx.slot.closest('figure') ?? ctx.slot.parentElement;
    const img = figure?.querySelector('img');
    if (!img) return;
    // Ảnh tự nó về đen trắng — không phải filter CSS, nên nó chịu được soi kỹ.
    img.src = greyscaled(img.getAttribute('src'));
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
    ctx.mark(dstImg);
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
