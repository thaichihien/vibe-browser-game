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

export const IMAGE_ANOMALIES = [I01, I03];
