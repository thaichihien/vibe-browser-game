/* Bếp Nhà Mây — blog nấu ăn cá nhân, hai trang. Bản SẠCH: không có dị thường nào ở đây.

   Ô TƯỞNG NIỆM Ở THANH BÊN LÀ NỘI DUNG SẠCH VÀ LUÔN LUÔN CÓ MẶT. Nó không phải dị thường và
   không bao giờ được biến thành dị thường. Nó là thứ khiến T08 (chữ ký của người không còn
   nữa) có nghĩa: một cái tên trên bài viết ba ngày trước chỉ sai khi người chơi đã đọc ở chỗ
   khác rằng người đó mất năm 2021. Ở những ván không bốc trúng T08, ô ấy chỉ là một chi tiết
   buồn — trang web phải buồn được mà không cần phải sai (spec §5.2).

   KHÔNG CÓ SLOT `nav`. Một blog cá nhân chỉ có một dòng tiêu đề, nên E01 và S07 không bao giờ
   xuất hiện ở chương này; đổi lại nó có chín bình luận, thứ mà không chương nào khác có.

   ẢNH: chọn trước, viết chú thích sau — đúng thứ tự mà chương 1 phải học bằng một lần làm
   sai. Món trong ảnh 488 là một bát gỏi bắp cải tím với ớt và rau mùi, nên bài viết là một
   bài gỏi. Spec §5.2 phác là canh chua cá lóc; ảnh không có con cá nào, và chú thích phải
   khớp với tấm ảnh chứ không phải với bản phác. */

import { picsum, portrait, imgHtml } from '../../js/engine/img.js';

const TINT = '#cbbba4';

const photo = (id, alt, w, h) =>
  imgHtml({ src: picsum({ w, h, id }), alt, w, h, tint: TINT });

const face = (set, n, alt) =>
  imgHtml({ src: portrait({ set, n }), alt, w: 128, h: 128, tint: TINT, cls: 'face' });

/* Thanh bên, dùng chung cho cả năm trang.

   Ô TƯỞNG NIỆM không mang slot nào và không bao giờ được mang: T08 đo cái tên trên bài viết
   ĐỐI CHIẾU với dòng "1994 – 2021" ở đây, nên nếu đạo diễn viết lại được chính dòng đó thì dị
   thường mất mốc để đo. Nó cũng là cái bẫy đắt nhất trang: thứ nặng cảm xúc nhất mà không bao
   giờ là đáp án — "buồn" không có nghĩa là "sai".

   Ô LƯU TRỮ thì ngược lại: bốn dòng tháng là slot `date` thật. Trước đây cả thanh bên chỉ
   toàn data-catch, tức là một vùng chỉ có thể phạt chứ không bao giờ thưởng. Và vì thanh bên
   giống hệt nhau ở cả năm trang, một dòng tháng sai ở MỘT trang là thứ chỉ lộ ra khi người
   chơi đối chiếu hai trang với nhau — đúng kiểu kinh dị đối chiếu mà chương này được dựng quanh. */
const memorial = `
  <aside class="side">
    <div class="side-box memo" data-catch>
      <h3 data-catch>Tưởng nhớ Mây</h3>
      <p data-catch>1994 – 2021</p>
      <p data-catch>Bếp này là của Mây. Chúng tôi giữ lại mọi thứ như cũ, kể cả những chỗ
        chị viết sai chính tả.</p>
    </div>
    <div class="side-box" data-catch>
      <h3 data-catch>Lưu trữ</h3>
      <ul class="archive">
        <li data-slot="date" data-catch>Tháng 3, 2026 <span class="n">(4)</span></li>
        <li data-slot="date" data-catch>Tháng 2, 2026 <span class="n">(6)</span></li>
        <li data-slot="date" data-catch>Tháng 1, 2026 <span class="n">(3)</span></li>
        <li data-slot="date" data-catch>Tháng 12, 2021 <span class="n">(1)</span></li>
      </ul>
    </div>
  </aside>`;

/** Một bình luận không có ảnh đại diện. [data-who]/[data-when] là hợp đồng markup cho T08. */
const cmt = (who, when, text) => `
        <li class="cmt" data-slot="comment" data-catch>
          <div class="cmt-body"><b data-who>${who}</b>
            <span class="cmt-when" data-when>${when}</span>
            <p data-catch>${text}</p></div>
        </li>`;

/**
 * Khu bình luận, dùng chung cho cả bốn bài.
 *
 * Bài nào cũng có ô gửi bình luận, kể cả bài chưa ai bình luận — một blog thật thì như vậy,
 * và nó cho R01 thêm chỗ để rơi vào. Danh sách `[data-comments]` LUÔN tồn tại kể cả khi rỗng,
 * vì R01 nối bình luận của Mây vào đúng nó; nếu bài không có danh sách thì dị thường lặng lẽ
 * không gắn được vào đâu.
 *
 * Dòng "chưa có bình luận nào" ẩn đi bằng CSS `:has(.cmt)` chứ không bằng JS, nên nó tự biến
 * mất dù bình luận đến từ nhánh sạch hay từ R01 — không cần hai chỗ cùng nhớ xoá nó.
 */
const comments = (list) => `
    <section class="comments">
      <h2 data-catch>${list.length ? `${list.length} bình luận` : 'Bình luận'}</h2>
      <ul class="cmt-list" data-comments>
        <li class="cmt-none" data-catch>Chưa có bình luận nào.</li>${list.join('')}
      </ul>

      <div class="cmt-form" data-slot="comment-form" data-catch>
        <h3 data-catch>Để lại bình luận</h3>
        <form>
          <input type="text" name="ten" placeholder="Tên của bạn (không bắt buộc)"
                 aria-label="Tên của bạn" data-catch>
          <textarea name="noidung" rows="3" placeholder="Viết gì đó…"
                    aria-label="Nội dung" required data-catch></textarea>
          <button type="submit" data-catch>GỬI</button>
        </form>
      </div>
    </section>`;

/**
 * Cách một trang bài viết cư xử khi chưa có dị thường nào: gửi bình luận thì bình luận phải lên.
 *
 * Một ô bình luận nuốt mất thứ người ta vừa gõ tự nó đã là dị thường — mà lại là dị thường
 * không ai đặt vào đó. Nó cũng giết luôn R01: nếu nhánh sạch im lặng thì bất cứ bình luận
 * nào hiện ra cũng đều là dị thường, và người chơi không cần đọc xem nó ký tên ai.
 */
const commentBehaviour = (pageId) => function behaviour(shadow) {
  const page = shadow.querySelector(`[data-page="${pageId}"]`);
  const form = page?.querySelector('.cmt-form form');
  const list = page?.querySelector('[data-comments]');
  if (!form || !list) return;

  const body = form.querySelector('[name="noidung"]');
  const name = form.querySelector('[name="ten"]');

  const VI_THIEU = 'Bạn chưa viết gì cả.';
  body.addEventListener('invalid', () => {
    body.setCustomValidity('');
    if (body.validity.valueMissing) body.setCustomValidity(VI_THIEU);
  });
  body.addEventListener('input', () => body.setCustomValidity(''));

  form.addEventListener('submit', () => {
    if (!body.value.trim()) return;
    const text = body.value.trim();
    const who = name.value.trim() || 'Ẩn danh';

    /* Hoãn một nhịp rồi mới xem cờ: R01 cũng nghe sự kiện submit này, và nếu nó đã trả lời
       thay thì nhánh sạch phải đứng im. Đăng cả hai thì người chơi đọc ra là lỗi, không phải
       là dị thường. Đợi hết lượt gọi đồng bộ nên thứ tự đăng ký listener không còn quan trọng. */
    setTimeout(() => {
      if (form.dataset.handled) { delete form.dataset.handled; return; }

      const li = document.createElement('li');
      li.className = 'cmt';
      li.setAttribute('data-catch', '');
      li.innerHTML =
        `<div class="cmt-body"><b data-who></b> ` +
        `<span class="cmt-when" data-when>vừa xong</span><p></p></div>`;
      li.querySelector('b').textContent = who;
      li.querySelector('p').textContent = text;
      list.appendChild(li);

      name.value = '';
      body.value = '';
    }, 0);
  });
};

const footer = `
<footer data-slot="footer" data-catch>
  <span>Bếp Nhà Mây · viết ở Cần Thơ</span>
  <span>Công thức chép tay, không sao chép lại</span>
</footer>`;

export const CH2_INDEX = {
  id: 'index',
  css: 'site.css',
  html: `
<header class="blog-head">
  <span class="blog-name" data-catch>Bếp Nhà Mây</span>
  <span class="blog-tag" data-catch>Ghi lại những món Mây từng nấu</span>
</header>

<div class="wrap">
  <main class="feed">
    <p class="lead" data-slot="paragraph" data-catch>
      Chị tôi để lại một quyển sổ dày, chữ bé, nhiều chỗ nhoè. Tôi nấu lại từng món rồi chép
      lên đây, mỗi tuần một bài. Không có gì cầu kỳ, đúng như chị đã nấu.
    </p>

    <article class="post-card">
      <figure>
        ${photo(488, 'Bát gỏi bắp cải tím', 760, 570)}
        <figcaption data-slot="photo" data-catch>Bắp cải tím, ớt xanh, rau mùi — trộn xong là ăn</figcaption>
      </figure>
      <h2><a href="#" data-goto="post" data-slot="post-title" data-catch>Gỏi bắp cải tím trộn ớt xanh</a></h2>
      <span class="meta" data-slot="date" data-catch>14/03/2026</span>
      <p data-catch>Món chị hay làm vào những hôm nóng quá không ai muốn bật bếp. Giòn, chua,
        cay, và làm xong trong mười lăm phút.</p>
      <a class="more" href="#" data-goto="post" data-catch>Đọc tiếp →</a>
    </article>

    <article class="post-card">
      <figure>
        ${photo(292, 'Củ quả trên thớt gỗ', 760, 570)}
        <figcaption data-slot="photo" data-catch>Hành tím, cà rốt, củ cải và một nắm tiêu sọ</figcaption>
      </figure>
      <h2><a href="#" data-goto="post-cho" data-slot="post-title" data-catch>Đi chợ sớm: chọn củ cho nồi canh</a></h2>
      <span class="meta" data-slot="date" data-catch>07/03/2026</span>
      <p data-slot="paragraph" data-catch>Chị dặn đi chợ trước bảy giờ, lúc người ta vừa dỡ
        hàng xuống. Củ nào cầm lên thấy nặng tay hơn vẻ ngoài của nó thì lấy.</p>
      <a class="more" href="#" data-goto="post-cho" data-catch>Đọc tiếp →</a>
    </article>

    <article class="post-card">
      <figure>
        ${photo(999, 'Bát nhỏ trên bàn gỗ tối màu', 760, 570)}
        <figcaption data-slot="photo" data-catch>Nấu chậm, để trên bếp suốt buổi chiều</figcaption>
      </figure>
      <h2><a href="#" data-goto="post-toi" data-slot="post-title" data-catch>Bữa tối mùa lạnh, nấu chậm</a></h2>
      <span class="meta" data-slot="date" data-catch>28/02/2026</span>
      <p data-catch>Cần Thơ hiếm khi lạnh, nhưng có vài tuần trong năm trời trở. Những hôm đó
        chị nấu món này và để lửa liu riu từ ba giờ chiều.</p>
      <a class="more" href="#" data-goto="post-toi" data-catch>Đọc tiếp →</a>
    </article>

    <article class="post-card">
      <figure>
        ${photo(835, 'Bánh hạnh nhân và hoa thuỷ tiên', 760, 570)}
        <figcaption data-slot="photo" data-catch>Mẻ bánh hạnh nhân, nướng hơi quá tay một chút</figcaption>
      </figure>
      <h2><a href="#" data-goto="post-banh" data-slot="post-title" data-catch>Bánh hạnh nhân, mẻ đầu tiên trong năm</a></h2>
      <span class="meta" data-slot="date" data-catch>19/02/2026</span>
      <p data-catch>Công thức này không có trong sổ. Tôi tự mò, nên mẻ đầu hơi cháy cạnh.
        Chị chắc sẽ cười.</p>
      <a class="more" href="#" data-goto="post-banh" data-catch>Đọc tiếp →</a>
    </article>
  </main>

  ${memorial}
</div>
${footer}`
};

/**
 * Ba bài còn lại trên trang chủ. Chúng ngắn hơn bài chính, và đó là chuyện bình thường của
 * một blog thật — nhưng chúng PHẢI mở ra được. Ba cái thẻ bài viết bấm vào không có gì xảy ra
 * tự nó là một dị thường không ai đặt vào đó, và là loại tệ nhất: người chơi khoanh nó, mất
 * một trái tim, rồi bảng kết quả nói họ sai.
 *
 * Chú thích vẫn viết theo ảnh, và ảnh vẫn đúng tấm ảnh ở thẻ tương ứng trên trang chủ — thẻ
 * trên trang chủ chính là ảnh của bài, như mọi blog.
 */
const shortPost = ({ id, title, date, img, alt, caption, paras, said = [] }) => ({
  id,
  css: 'site.css',
  behaviour: commentBehaviour(id),
  html: `
<header class="blog-head">
  <span class="blog-name" data-catch><a href="#" data-goto="index">Bếp Nhà Mây</a></span>
  <span class="blog-tag" data-catch>Ghi lại những món Mây từng nấu</span>
</header>

<div class="wrap">
  <main class="single">
    <a class="back" href="#" data-goto="index" data-catch>← Về trang chủ</a>
    <h1 data-slot="post-title" data-catch>${title}</h1>
    <span class="meta" data-slot="date" data-catch>Đăng ngày ${date}</span>

    <figure class="hero">
      ${photo(img, alt, 1400, 700)}
      <figcaption data-slot="photo" data-catch>${caption}</figcaption>
    </figure>

    <p data-slot="paragraph" data-catch>${paras[0]}</p>
    <p data-slot="paragraph" data-catch>${paras[1]}</p>

    ${comments(said)}
  </main>

  ${memorial}
</div>
${footer}`
});

export const CH2_POST_CHO = shortPost({
  id: 'post-cho',
  title: 'Đi chợ sớm: chọn củ cho nồi canh',
  date: '07/03/2026',
  img: 292,
  alt: 'Hành tím, cà rốt và củ cải trên thớt gỗ',
  caption: 'Hành tím, cà rốt, củ cải và một nắm tiêu sọ',
  paras: [
    `Chị dặn đi chợ trước bảy giờ, lúc người ta vừa dỡ hàng xuống. Củ nào cầm lên thấy nặng
     tay hơn vẻ ngoài của nó thì lấy — nhẹ là đã để lâu, ruột bắt đầu xốp.`,
    `Tiêu sọ thì mua nguyên hạt, về nhà mới giã. Chị bảo tiêu xay sẵn thơm được ba ngày, sau
     đó chỉ còn cay chứ không còn thơm nữa.`
  ],
  said: [
    cmt('Quốc Thái', '4 ngày trước', 'Chợ chỗ mình bảy giờ là hết hàng ngon rồi. Chắc phải dậy sớm hơn nữa.'),
    cmt('Lan Chi', '5 ngày trước', 'Mẹo cầm thử cho nặng tay hay quá, trước giờ mình chỉ nhìn vỏ.'),
    cmt('Ngọc Diệp', '6 ngày trước', 'Tiêu giã tay đúng là thơm khác hẳn thật.')
  ]
});

export const CH2_POST_TOI = shortPost({
  id: 'post-toi',
  title: 'Bữa tối mùa lạnh, nấu chậm',
  date: '28/02/2026',
  img: 999,
  alt: 'Bát nhỏ trên bàn gỗ tối màu',
  caption: 'Nấu chậm, để trên bếp suốt buổi chiều',
  paras: [
    `Cần Thơ hiếm khi lạnh, nhưng có vài tuần trong năm trời trở. Những hôm đó chị nấu món
     này và để lửa liu riu từ ba giờ chiều, thỉnh thoảng ghé vào khuấy một vòng.`,
    `Không có bước nào khó. Cái khó duy nhất là đừng mở vung ra xem quá nhiều lần, mà tôi thì
     lần nào cũng mở.`
  ],
  said: [
    cmt('Thuỳ Dung', '1 tuần trước', 'Nhà mình cũng hay nấu kiểu này vào mấy hôm mưa.'),
    cmt('Trọng Nhân', '1 tuần trước', 'Mở vung nhiều thì lâu chín hơn đó bạn, mình bị hoài.')
  ]
});

export const CH2_POST_BANH = shortPost({
  id: 'post-banh',
  title: 'Bánh hạnh nhân, mẻ đầu tiên trong năm',
  date: '19/02/2026',
  img: 835,
  alt: 'Bánh hạnh nhân trên đĩa sẫm màu, cạnh hoa thuỷ tiên',
  caption: 'Mẻ bánh hạnh nhân, nướng hơi quá tay một chút',
  paras: [
    `Công thức này không có trong sổ. Tôi tự mò theo trí nhớ, nên mẻ đầu hơi cháy cạnh và
     hạnh nhân rang đậm hơn mức cần thiết.`,
    `Dù vậy cả nhà ăn hết trong một buổi chiều. Lần sau tôi sẽ hạ lửa xuống và rút ra sớm hơn
     năm phút.`
  ]
});

export const CH2_POST = {
  id: 'post',
  css: 'site.css',

  /**
   * Cách trang này cư xử khi chưa có dị thường nào: gửi bình luận thì bình luận phải lên.
   *
   * Một ô bình luận nuốt mất thứ người ta vừa gõ tự nó đã là dị thường — mà lại là dị thường
   * không ai đặt vào đó. Nó cũng giết luôn R01: nếu nhánh sạch im lặng thì bất cứ bình luận
   * nào hiện ra cũng đều là dị thường, và người chơi không cần đọc xem nó ký tên ai.
   */
  behaviour(shadow) {
    const page = shadow.querySelector('[data-page="post"]');
    const form = page?.querySelector('.cmt-form form');
    const list = page?.querySelector('[data-comments]');
    if (!form || !list) return;

    const body = form.querySelector('[name="noidung"]');
    const name = form.querySelector('[name="ten"]');

    const VI_THIEU = 'Bạn chưa viết gì cả.';
    body.addEventListener('invalid', () => {
      body.setCustomValidity('');
      if (body.validity.valueMissing) body.setCustomValidity(VI_THIEU);
    });
    body.addEventListener('input', () => body.setCustomValidity(''));

    form.addEventListener('submit', () => {
      if (!body.value.trim()) return;
      const text = body.value.trim();
      const who = name.value.trim() || 'Ẩn danh';

      /* Hoãn một nhịp rồi mới xem cờ: R01 cũng nghe sự kiện submit này, và nếu nó đã trả lời
         thay thì nhánh sạch phải đứng im. Đăng cả hai thì người chơi đọc ra là lỗi, không
         phải là dị thường. Đợi hết lượt gọi đồng bộ nên thứ tự đăng ký listener không còn
         quan trọng. */
      setTimeout(() => {
        if (form.dataset.handled) { delete form.dataset.handled; return; }

        const li = document.createElement('li');
        li.className = 'cmt';
        li.setAttribute('data-catch', '');
        li.innerHTML =
          `<div class="cmt-body"><b data-who></b> ` +
          `<span class="cmt-when" data-when>vừa xong</span><p></p></div>`;
        li.querySelector('b').textContent = who;
        li.querySelector('p').textContent = text;
        list.appendChild(li);

        name.value = '';
        body.value = '';
      }, 0);
    });
  },

  html: `
<header class="blog-head">
  <span class="blog-name" data-catch><a href="#" data-goto="index">Bếp Nhà Mây</a></span>
  <span class="blog-tag" data-catch>Ghi lại những món Mây từng nấu</span>
</header>

<div class="wrap">
  <main class="single">
    <a class="back" href="#" data-goto="index" data-catch>← Về trang chủ</a>

    <h1 data-slot="post-title" data-catch>Gỏi bắp cải tím trộn ớt xanh</h1>
    <p class="byline" data-slot="byline" data-catch>
      <b data-who>Hà Vy</b> <span class="cmt-when" data-when>3 ngày trước</span>
    </p>
    <span class="meta" data-slot="date" data-catch>Đăng ngày 14/03/2026</span>

    <figure class="hero">
      ${photo(488, 'Bát gỏi bắp cải tím với ớt và rau mùi', 1400, 700)}
      <figcaption data-slot="photo" data-catch>Trộn xong để mười phút cho ngấm, rồi ăn ngay</figcaption>
    </figure>

    <p data-slot="paragraph" data-catch>
      Đây là món đầu tiên tôi chép lại được trọn vẹn từ sổ của chị, vì nó gần như không có
      bước nào. Chị viết đúng bốn dòng, và dòng cuối chỉ là "đừng bóp mạnh tay".
    </p>

    <h2 data-catch>Nguyên liệu</h2>
    <ul class="ing">
      <li data-catch>Nửa bắp cải tím, thái sợi thật mỏng</li>
      <li data-catch>Một củ hành tím, thái lát</li>
      <li data-catch>Hai trái ớt xanh, ba trái ớt hiểm</li>
      <li data-catch>Một nắm rau mùi</li>
      <li data-catch>Nước mắm, đường, chanh — ba muỗng, hai muỗng, một trái</li>
    </ul>

    <p data-slot="paragraph" data-catch>
      Bắp cải tím ra màu rất nhanh, nên pha nước trộn trước rồi mới cho rau vào. Nếu trộn
      ngược lại, mười phút sau cả tô sẽ chuyển sang màu tím nhạt đều một cách khó chịu.
    </p>

    <h2 data-catch>Cách làm</h2>
    <ol class="steps">
      <li data-catch>Pha nước mắm, đường, nước cốt chanh cho tan hết đường.</li>
      <li data-catch>Bóp nhẹ bắp cải với một chút muối, để năm phút rồi vắt ráo.</li>
      <li data-catch>Trộn tất cả, để mười phút cho ngấm.</li>
      <li data-catch>Rắc rau mùi và ớt lên trên, không trộn thêm nữa.</li>
    </ol>

    <p data-slot="paragraph" data-catch>
      Chỗ ớt trong ảnh là nhiều hơn nhà tôi ăn được. Chị ăn cay giỏi hơn tôi nhiều, và mỗi
      lần tôi kêu cay thì chị lại bảo là tại tôi ăn chậm quá.
    </p>

    <p data-slot="paragraph" data-catch>
      Nếu nhà bạn có trẻ con, bỏ hết ớt hiểm đi và chỉ để ớt xanh cho thơm. Món này để tủ
      lạnh qua đêm vẫn ăn được, nhưng sẽ mềm và không còn giòn nữa.
    </p>

    <section class="comments">
      <h2 data-catch>9 bình luận</h2>
      <ul class="cmt-list" data-comments>

        <li class="cmt" data-slot="comment" data-catch>
          <figure class="cmt-face">
            ${face('women', 35, 'Ảnh người bình luận')}
            <figcaption data-slot="avatar" data-catch><b data-who>Thuỳ Dung</b>
              <span class="cmt-when" data-when>2 ngày trước</span></figcaption>
          </figure>
          <div class="cmt-body"><p data-catch>Mình làm theo tối qua, cả nhà khen. Cảm ơn bạn
            đã chép lại.</p></div>
        </li>

        <li class="cmt" data-slot="comment" data-catch>
          <div class="cmt-body"><b data-who>Quốc Thái</b>
            <span class="cmt-when" data-when>2 ngày trước</span>
            <p data-catch>Cho hỏi thay bắp cải trắng được không ạ? Chỗ mình không có bắp cải tím.</p></div>
        </li>

        <li class="cmt" data-slot="comment" data-catch>
          <figure class="cmt-face">
            ${face('men', 4, 'Ảnh người bình luận')}
            <figcaption data-slot="avatar" data-catch><b data-who>Minh Kha</b>
              <span class="cmt-when" data-when>3 ngày trước</span></figcaption>
          </figure>
          <div class="cmt-body"><p data-catch>Được chứ bạn, nhưng bắp cải trắng nhiều nước hơn,
            nhớ vắt kỹ.</p></div>
        </li>

        <li class="cmt" data-slot="comment" data-catch>
          <div class="cmt-body"><b data-who>Ngọc Diệp</b>
            <span class="cmt-when" data-when>3 ngày trước</span>
            <p data-catch>Đọc mấy bài ở đây tự nhiên thấy nhớ mẹ mình quá.</p></div>
        </li>

        <li class="cmt" data-slot="comment" data-catch>
          <figure class="cmt-face">
            ${face('women', 44, 'Ảnh người bình luận')}
            <figcaption data-slot="avatar" data-catch><b data-who>Lan Chi</b>
              <span class="cmt-when" data-when>4 ngày trước</span></figcaption>
          </figure>
          <div class="cmt-body"><p data-catch>Mình theo blog này từ hồi 2019. Mừng là vẫn còn
            người viết tiếp.</p></div>
        </li>

        <li class="cmt" data-slot="comment" data-catch>
          <div class="cmt-body"><b data-who>Hữu Phước</b>
            <span class="cmt-when" data-when>5 ngày trước</span>
            <p data-catch>Ba muỗng nước mắm là muỗng canh hay muỗng cà phê vậy bạn?</p></div>
        </li>

        <li class="cmt" data-slot="comment" data-catch>
          <div class="cmt-body"><b data-who>Hà Vy</b>
            <span class="cmt-when" data-when>5 ngày trước</span>
            <p data-catch>Muỗng canh bạn nhé. Trong sổ chị mình viết tắt nên mình cũng đoán mất
              một lúc.</p></div>
        </li>

        <li class="cmt" data-slot="comment" data-catch>
          <div class="cmt-body"><b data-who>Bảo Ngân</b>
            <span class="cmt-when" data-when>6 ngày trước</span>
            <p data-catch>Tô trong ảnh đẹp quá, mua ở đâu vậy ạ?</p></div>
        </li>

        <li class="cmt" data-slot="comment" data-catch>
          <div class="cmt-body"><b data-who>Trọng Nhân</b>
            <span class="cmt-when" data-when>1 tuần trước</span>
            <p data-catch>Lưu lại để cuối tuần làm. Cảm ơn blog.</p></div>
        </li>

      </ul>

      <div class="cmt-form" data-slot="comment-form" data-catch>
        <h3 data-catch>Để lại bình luận</h3>
        <form>
          <input type="text" name="ten" placeholder="Tên của bạn (không bắt buộc)"
                 aria-label="Tên của bạn" data-catch>
          <textarea name="noidung" rows="3" placeholder="Viết gì đó…"
                    aria-label="Nội dung" required data-catch></textarea>
          <button type="submit" data-catch>GỬI</button>
        </form>
      </div>
    </section>
  </main>

  ${memorial}
</div>
${footer}`
};

export const CH2_PAGES = [CH2_INDEX, CH2_POST, CH2_POST_CHO, CH2_POST_TOI, CH2_POST_BANH];
