/* Trang bán hàng LUMIÈRE — bản SẠCH. Không có dị thường nào ở đây; đạo diễn sẽ thêm vào
   lúc chạy. data-slot = chỗ dị thường có thể bám. data-catch = nội dung bình thường mà
   khoanh nhầm vào thì mất máu.

   Số lượng data-slot ở đây PHẢI khớp chính xác với CH1.pages[0].slots — có test đối chiếu.
   Nếu trang có ít hơn khai báo, đạo diễn sẽ đặt dị thường vào một phần tử không tồn tại.

   ẢNH — vì sao picsum chứ không phải loremflickr (xem thêm js/engine/img.js):
   loremflickr in một dải ghi công và một huy hiệu giấy phép lên MỌI khung ảnh, nên cả trang
   đọc ra là "ảnh cào về", không phải "ảnh của thương hiệu này" — mà tiền đề của trò chơi là
   trang web phải qua được mắt người chơi như một trang thật. Từ khoá của nó cũng không đáng
   tin: bốn "chân dung" của chương này hoá ra là một người, một sạp báo, một người chụp từ xa
   ba mươi mét, và một bóng người đen trắng cầm máy ảnh — I03 (hai cái tên, một khuôn mặt)
   coi như chết. picsum không đóng dấu và ảnh được tuyển; chân dung lấy từ randomuser.

   CHÚ THÍCH ĐƯỢC VIẾT THEO ẢNH, không phải ngược lại. Ảnh đã ghim nên nó là một tấm ảnh cụ
   thể, đã được xem tận mắt; chú thích sạch phải mô tả đúng nó, vì chính sự khớp đó mới làm
   cho S05 (chú thích không khớp) có cái để lệch khỏi. */

import { picsum, portrait, imgHtml } from '../../js/engine/img.js';

const TINT = '#d8c3b0';

/* Ảnh yêu cầu ở kích thước gấp đôi chỗ hiển thị: màn hình retina, và CSS đã cắt bằng
   object-fit nên tỉ lệ nguồn không cần khớp tuyệt đối. */
const photo = (id, alt, w, h) =>
  imgHtml({ src: picsum({ w, h, id }), alt, w, h, tint: TINT });

const face = (n, alt) =>
  imgHtml({ src: portrait({ set: 'women', n }), alt, w: 128, h: 128, tint: TINT, cls: 'face' });

export const PAGE_INDEX = {
  id: 'index',
  css: 'site.css',

  /**
   * Cách trang này CƯ XỬ khi chưa có dị thường nào — trang thật thì phải làm gì đó khi bạn
   * bấm nút. Chỉ chạm DOM khi được gọi, không bao giờ ở tầng import (xem js/main.js).
   *
   * Vì sao phải có: một cái form nhận địa chỉ email rồi không phản hồi gì cả tự nó đã là một
   * dị thường — mà lại là dị thường KHÔNG AI ĐẶT VÀO ĐÓ. Tệ hơn, nó phá luôn R05: nếu bản
   * sạch im lặng thì bất cứ dòng xác nhận nào hiện ra cũng đều là dị thường, và người chơi
   * không cần đọc, chỉ cần thấy có chữ. Khi cả hai nhánh đều trả lời, người chơi buộc phải
   * đọc câu trả lời — mà "bạn đã đăng ký từ năm 2011" thì chỉ lộ ra khi có người đọc nó.
   */
  behaviour(shadow) {
    const section = shadow.querySelector('.news');
    const form = section?.querySelector('.news-form');
    const input = form?.querySelector('input');
    if (!form || !input) return;

    form.addEventListener('submit', () => {
      // sealNavigation() đã chặn điều hướng ở pha capture; ở đây chỉ còn việc trả lời.
      if (!input.checkValidity() || !input.value) return;
      const to = input.value;
      input.value = '';

      /* Hoãn một nhịp, KHÔNG phải cho đẹp: R05 cũng nghe sự kiện submit này. Đợi hết lượt
         gọi đồng bộ rồi mới xem trong khung này đã có ai trả lời chưa, thì thứ tự đăng ký
         listener không còn quan trọng nữa — nếu dị thường đã lên tiếng, bản sạch im lặng. */
      setTimeout(() => {
        if (section.querySelector('[data-anom]')) return;

        let note = section.querySelector('.news-ok');
        if (!note) {
          note = document.createElement('p');
          note.className = 'news-ok';
          // Nội dung bình thường, nên khoanh nhầm vào nó vẫn mất máu như mọi thứ khác.
          note.setAttribute('data-catch', '');
          section.appendChild(note);
        }
        note.textContent = `Cảm ơn bạn. Chúng tôi đã gửi thư xác nhận tới ${to}.`;
      }, 0);
    });
  },

  html: `
<header class="bar">
  <span class="brand" data-catch>LUMIÈRE</span>
  <nav data-slot="nav" data-catch>
    <a href="#">TRANG CHỦ</a><a href="#">SẢN PHẨM</a><a href="#">CÂU CHUYỆN</a>
    <a href="#">CỬA HÀNG</a><a href="#">LIÊN HỆ</a>
  </nav>
  <span class="bar-cta" data-catch>GIỎ HÀNG (0)</span>
</header>

<section class="hero">
  <div class="hero-copy">
    <span class="eyebrow" data-catch>Crème Originelle</span>
    <h1 data-slot="hero-title" data-catch>Dưỡng ẩm 72 giờ,<br>nhẹ như không có gì</h1>
    <p data-slot="paragraph" data-catch>
      Chiết xuất hoa cúc La Mã và dầu hạt nho ép lạnh. Không cồn, không hương liệu,
      không màu tổng hợp. Thẩm thấu trong 40 giây.
    </p>
    <div class="price" data-slot="price" data-catch>340.000₫ <s>420.000₫</s></div>
    <button class="buy" data-slot="cta" data-catch>THÊM VÀO GIỎ</button>
    <ul class="assure">
      <li data-catch>Giao trong 48 giờ</li>
      <li data-catch>Đổi trả 30 ngày</li>
      <li data-catch>Mẫu thử kèm mọi đơn</li>
    </ul>
  </div>
  <figure class="hero-shot">
    ${photo(365, 'Buổi sáng tại xưởng Đà Lạt', 1120, 840)}
    <figcaption data-slot="photo" data-catch>Ảnh chụp tại xưởng Đà Lạt</figcaption>
  </figure>
</section>

<section class="features">
  <div class="feat"><span class="ico" data-slot="feature-icon" data-catch>✨</span>
    <b data-catch>Cấp ẩm tức thì</b><span data-catch>Giữ nước suốt 72 giờ</span></div>
  <div class="feat"><span class="ico" data-slot="feature-icon" data-catch>🌿</span>
    <b data-catch>Thành phần thực vật</b><span data-catch>92% nguồn gốc tự nhiên</span></div>
  <div class="feat"><span class="ico" data-slot="feature-icon" data-catch>💧</span>
    <b data-catch>Không gây bít tắc</b><span data-catch>Đã kiểm nghiệm da liễu</span></div>
  <div class="feat"><span class="ico" data-slot="feature-icon" data-catch>🧴</span>
    <b data-catch>Kết cấu nhẹ</b><span data-catch>Không để lại màng nhờn</span></div>
  <div class="feat"><span class="ico" data-slot="feature-icon" data-catch>🌸</span>
    <b data-catch>Hương tự nhiên</b><span data-catch>Chỉ từ tinh dầu hoa</span></div>
  <div class="feat"><span class="ico" data-slot="feature-icon" data-catch>🤍</span>
    <b data-catch>Không thử trên động vật</b><span data-catch>Chứng nhận Leaping Bunny</span></div>
</section>

<section class="howto">
  <span class="eyebrow" data-catch>Hướng dẫn</span>
  <h2 data-catch>Cách dùng</h2>
  <p data-slot="paragraph" data-catch>
    Ba bước, sáng và tối. Một lượng bằng hạt đậu là đủ cho cả khuôn mặt và cổ.
  </p>
  <ol class="steps">
    <li data-catch><b>1</b> Làm sạch da và lau khô bằng khăn mềm.</li>
    <li data-catch><b>2</b> Lấy một lượng nhỏ, xoa ấm giữa hai lòng bàn tay.</li>
    <li data-catch><b>3</b> Vỗ nhẹ từ giữa mặt ra ngoài. Không kéo da.</li>
  </ol>
  <figure class="wide-shot">
    ${photo(691, 'Cốc trà bên giường vào buổi tối', 1600, 540)}
    <figcaption data-slot="photo" data-catch>Bước cuối cùng trong ngày</figcaption>
  </figure>
</section>

<section class="ingredients">
  <span class="eyebrow" data-catch>Thành phần</span>
  <h2 data-catch>Trong hũ có gì</h2>
  <p data-slot="paragraph" data-catch>
    Mỗi mẻ được ủ trong 11 ngày tại xưởng nhỏ của chúng tôi ở Đà Lạt. Chúng tôi không sản
    xuất nhiều hơn số lượng có thể tự tay kiểm tra.
  </p>
  <div class="ing-grid">
    <figure>${photo(492, 'Hoa cúc dại ngoài đồng', 640, 480)}
      <figcaption data-slot="photo" data-catch>Hoa cúc dại, thu hoạch tháng 3</figcaption></figure>
    <figure>${photo(674, 'Nho trên tay người thu hoạch', 640, 480)}
      <figcaption data-slot="photo" data-catch>Nho ép lấy dầu, thu tại Ninh Thuận</figcaption></figure>
    <figure>${photo(312, 'Rót dầu ép lạnh vào hũ', 640, 480)}
      <figcaption data-slot="photo" data-catch>Dầu ép lạnh, rót từng mẻ nhỏ</figcaption></figure>
    <figure>${photo(159, 'Giọt nước đọng trên lá', 640, 480)}
      <figcaption data-slot="photo" data-catch>Chiết xuất lá, cô ở nhiệt độ thấp</figcaption></figure>
  </div>
  <p class="inci" data-slot="paragraph" data-catch>
    Thành phần đầy đủ: Aqua, Glycerin, Vitis Vinifera Seed Oil, Chamomilla Recutita Extract,
    Squalane, Panthenol, Tocopherol, Xanthan Gum, Sodium Benzoate.
  </p>
</section>

<section class="compare">
  <span class="eyebrow" data-catch>Đối chiếu</span>
  <h2 data-catch>So với kem dưỡng thường</h2>
  <div class="cmp-card">
    <table class="cmp">
      <tr><th data-catch></th><th data-catch>LUMIÈRE</th><th data-catch>Kem thường</th></tr>
      <tr><td data-catch>Thời gian giữ ẩm</td><td data-catch>72 giờ</td><td data-catch>8–12 giờ</td></tr>
      <tr><td data-catch>Cồn khô</td><td data-catch>Không</td><td data-catch>Thường có</td></tr>
      <tr><td data-catch>Thẩm thấu</td><td data-catch>40 giây</td><td data-catch>3–5 phút</td></tr>
    </table>
  </div>
  <p class="fineprint" data-slot="paragraph" data-catch>
    Số liệu từ thử nghiệm nội bộ trên 42 tình nguyện viên trong 4 tuần, mùa khô 2025.
  </p>
  <div class="duo">
    <div class="price" data-slot="price" data-catch>Bộ đôi sáng &amp; tối: 590.000₫</div>
    <button class="buy ghost" data-slot="cta" data-catch>XEM BỘ ĐÔI</button>
  </div>
</section>

<section class="voices">
  <span class="eyebrow" data-catch>Phản hồi</span>
  <h2 data-catch>Khách hàng nói gì</h2>
  <p data-slot="paragraph" data-catch>
    Hơn 4.000 người đã dùng LUMIÈRE trong hai năm qua. Chúng tôi đọc từng lá thư gửi về.
  </p>
  <div class="voice-grid">
    <figure class="voice">
      ${face(2, 'Chân dung khách hàng')}
      <figcaption data-slot="avatar" data-catch><b>Ngọc Anh</b>, 28<br>
        <span data-catch>“Da mình vốn rất khô. Dùng ba tuần thì hết bong.”</span></figcaption>
    </figure>
    <figure class="voice">
      ${face(8, 'Chân dung khách hàng')}
      <figcaption data-slot="avatar" data-catch><b>Thu Hà</b>, 41<br>
        <span data-catch>“Không mùi, đúng thứ mình cần.”</span></figcaption>
    </figure>
    <figure class="voice">
      ${face(27, 'Chân dung khách hàng')}
      <figcaption data-slot="avatar" data-catch><b>Mỹ Linh</b>, 33<br>
        <span data-catch>“Mình để một hũ ở cơ quan, một hũ ở nhà.”</span></figcaption>
    </figure>
    <figure class="voice">
      ${face(17, 'Chân dung khách hàng')}
      <figcaption data-slot="avatar" data-catch><b>Bảo Trân</b>, 26<br>
        <span data-catch>“Chồng mình dùng chung, hết nhanh gấp đôi.”</span></figcaption>
    </figure>
  </div>
</section>

<section class="faq" data-slot="faq" data-catch>
  <span class="eyebrow" data-catch>Giải đáp</span>
  <h2 data-catch>Câu hỏi thường gặp</h2>
  <details><summary data-catch>Dùng được cho da nhạy cảm không?</summary>
    <p data-slot="paragraph" data-catch>Được. Sản phẩm không chứa cồn khô và hương liệu tổng
      hợp, đã kiểm nghiệm trên da nhạy cảm trong 4 tuần.</p></details>
  <details><summary data-catch>Bao lâu thì dùng hết một hũ?</summary>
    <p data-catch>Khoảng 8 tuần nếu dùng hai lần mỗi ngày.</p></details>
  <details><summary data-catch>Có dùng được khi mang thai không?</summary>
    <p data-slot="paragraph" data-catch>Công thức không chứa retinoid hay tinh dầu định hương.
      Dù vậy, hãy hỏi bác sĩ của bạn trước.</p></details>
  <details><summary data-catch>Bảo quản thế nào?</summary>
    <p data-catch>Nơi khô ráo, dưới 25°C, tránh ánh nắng trực tiếp.</p></details>
</section>

<section class="stores">
  <span class="eyebrow" data-catch>Cửa hàng</span>
  <h2 data-catch>Tìm chúng tôi</h2>
  <p data-slot="paragraph" data-catch>
    Ba cửa hàng, đều có góc thử sản phẩm. Nhân viên của chúng tôi không ăn hoa hồng theo
    doanh số, nên họ sẽ nói thật nếu sản phẩm không hợp với bạn.
  </p>
  <figure class="wide-shot">
    ${photo(42, 'Trong cửa hàng lúc sáng sớm', 1600, 540)}
    <figcaption data-slot="photo" data-catch>Cửa hàng Đà Lạt, buổi sáng</figcaption>
  </figure>
  <div class="store-grid">
    <div data-slot="hours" data-catch><b>Đà Lạt</b><br>12 Trần Hưng Đạo, P.10<br>08:00 – 20:00</div>
    <div data-slot="hours" data-catch><b>TP. Hồ Chí Minh</b><br>45 Nguyễn Huệ, Q.1<br>09:00 – 21:30</div>
    <div data-slot="hours" data-catch><b>Hà Nội</b><br>7 Nhà Thờ, Hoàn Kiếm<br>09:00 – 21:00</div>
  </div>
  <button class="buy ghost" data-slot="cta" data-catch>ĐẶT LỊCH THỬ SẢN PHẨM</button>
</section>

<section class="news" data-slot="newsletter" data-catch>
  <h2 data-catch>Nhận thư của chúng tôi</h2>
  <p class="news-lead" data-catch>Mỗi tháng một lá, viết bởi người pha chế, không phải phòng marketing.</p>
  <form class="news-form">
    <input type="email" placeholder="Email của bạn" aria-label="Email" required data-catch>
    <button type="submit" data-catch>ĐĂNG KÝ</button>
  </form>
  <p class="news-note" data-catch>Mỗi tháng một lá. Huỷ bất cứ lúc nào.</p>
</section>

<footer data-slot="footer" data-catch>
  <span>© 2026 LUMIÈRE · Đà Lạt, Lâm Đồng</span>
  <span>Chăm sóc khách hàng: 1900 8386</span>
  <span>Giấy CNĐKKD 5801234567</span>
</footer>`
};
