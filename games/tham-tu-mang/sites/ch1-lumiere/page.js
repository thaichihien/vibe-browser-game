/* Trang bán hàng LUMIÈRE — bản SẠCH. Không có dị thường nào ở đây; đạo diễn sẽ thêm vào
   lúc chạy. data-slot = chỗ dị thường có thể bám. data-catch = nội dung bình thường mà
   khoanh nhầm vào thì mất máu.

   Số lượng data-slot ở đây PHẢI khớp chính xác với CH1.pages[0].slots — có test đối chiếu.
   Nếu trang có ít hơn khai báo, đạo diễn sẽ đặt dị thường vào một phần tử không tồn tại. */

import { flickr, imgHtml } from '../../js/engine/img.js';

const TINT = '#d8c3b0';
const photo = (kw, lock, alt, w, h) =>
  imgHtml({ src: flickr({ w, h, kw, lock }), alt, w, h, tint: TINT });

export const PAGE_INDEX = {
  id: 'index',
  css: 'site.css',
  html: `
<header class="bar">
  <span class="brand" data-catch>LUMIÈRE</span>
  <nav data-slot="nav" data-catch>
    <a href="#">TRANG CHỦ</a><a href="#">SẢN PHẨM</a><a href="#">CÂU CHUYỆN</a>
    <a href="#">CỬA HÀNG</a><a href="#">LIÊN HỆ</a>
  </nav>
</header>

<section class="hero">
  <div class="hero-copy">
    <h1 data-slot="hero-title" data-catch>Dưỡng ẩm 72 giờ,<br>nhẹ như không có gì</h1>
    <p data-slot="paragraph" data-catch>
      Chiết xuất hoa cúc La Mã và dầu hạt nho ép lạnh. Không cồn, không hương liệu,
      không màu tổng hợp. Thẩm thấu trong 40 giây.
    </p>
    <div class="price" data-slot="price" data-catch>340.000₫ <s>420.000₫</s></div>
    <button class="buy" data-slot="cta" data-catch>THÊM VÀO GIỎ</button>
  </div>
  <figure class="hero-shot">
    ${photo('skincare,cream', 21, 'Hũ kem dưỡng ẩm LUMIÈRE', 520, 380)}
    <figcaption data-slot="photo" data-catch>LUMIÈRE Crème Originelle, 50ml</figcaption>
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
  <h2 data-catch>Cách dùng</h2>
  <p data-slot="paragraph" data-catch>
    Ba bước, sáng và tối. Một lượng bằng hạt đậu là đủ cho cả khuôn mặt và cổ.
  </p>
  <ol class="steps">
    <li data-catch><b>1.</b> Làm sạch da và lau khô bằng khăn mềm.</li>
    <li data-catch><b>2.</b> Lấy một lượng nhỏ, xoa ấm giữa hai lòng bàn tay.</li>
    <li data-catch><b>3.</b> Vỗ nhẹ từ giữa mặt ra ngoài. Không kéo da.</li>
  </ol>
  <figure class="wide-shot">
    ${photo('hands,cream', 88, 'Thoa kem lên tay', 640, 240)}
    <figcaption data-slot="photo" data-catch>Kết cấu kem sau khi xoa ấm</figcaption>
  </figure>
</section>

<section class="ingredients">
  <h2 data-catch>Trong hũ có gì</h2>
  <p data-slot="paragraph" data-catch>
    Mỗi mẻ được ủ trong 11 ngày tại xưởng nhỏ của chúng tôi ở Đà Lạt. Chúng tôi không sản
    xuất nhiều hơn số lượng có thể tự tay kiểm tra.
  </p>
  <div class="ing-grid">
    <figure>${photo('chamomile', 34, 'Hoa cúc La Mã', 300, 220)}
      <figcaption data-slot="photo" data-catch>Hoa cúc La Mã, thu hoạch tháng 3</figcaption></figure>
    <figure>${photo('grapeseed,oil', 55, 'Dầu hạt nho', 300, 220)}
      <figcaption data-slot="photo" data-catch>Dầu hạt nho ép lạnh</figcaption></figure>
    <figure>${photo('laboratory,glass', 68, 'Xưởng bào chế', 300, 220)}
      <figcaption data-slot="photo" data-catch>Xưởng bào chế tại Đà Lạt</figcaption></figure>
    <figure>${photo('squalane,bottle', 29, 'Squalane thực vật', 300, 220)}
      <figcaption data-slot="photo" data-catch>Squalane từ ô liu, không nguồn động vật</figcaption></figure>
  </div>
  <p data-slot="paragraph" data-catch>
    Thành phần đầy đủ: Aqua, Glycerin, Vitis Vinifera Seed Oil, Chamomilla Recutita Extract,
    Squalane, Panthenol, Tocopherol, Xanthan Gum, Sodium Benzoate.
  </p>
</section>

<section class="compare">
  <h2 data-catch>So với kem dưỡng thường</h2>
  <table class="cmp">
    <tr><th data-catch></th><th data-catch>LUMIÈRE</th><th data-catch>Kem thường</th></tr>
    <tr><td data-catch>Thời gian giữ ẩm</td><td data-catch>72 giờ</td><td data-catch>8–12 giờ</td></tr>
    <tr><td data-catch>Cồn khô</td><td data-catch>Không</td><td data-catch>Thường có</td></tr>
    <tr><td data-catch>Thẩm thấu</td><td data-catch>40 giây</td><td data-catch>3–5 phút</td></tr>
  </table>
  <p data-slot="paragraph" data-catch>
    Số liệu từ thử nghiệm nội bộ trên 42 tình nguyện viên trong 4 tuần, mùa khô 2025.
  </p>
  <div class="price" data-slot="price" data-catch>Bộ đôi sáng &amp; tối: 590.000₫</div>
  <button class="buy ghost" data-slot="cta" data-catch>XEM BỘ ĐÔI</button>
</section>

<section class="voices">
  <h2 data-catch>Khách hàng nói gì</h2>
  <p data-slot="paragraph" data-catch>
    Hơn 4.000 người đã dùng LUMIÈRE trong hai năm qua. Chúng tôi đọc từng lá thư gửi về.
  </p>
  <figure class="voice">
    ${photo('portrait,woman', 12, 'Chân dung khách hàng', 96, 96)}
    <figcaption data-slot="avatar" data-catch><b>Ngọc Anh</b>, 28<br>
      <span data-catch>“Da mình vốn rất khô. Dùng ba tuần thì hết bong.”</span></figcaption>
  </figure>
  <figure class="voice">
    ${photo('portrait,person', 47, 'Chân dung khách hàng', 96, 96)}
    <figcaption data-slot="avatar" data-catch><b>Thu Hà</b>, 41<br>
      <span data-catch>“Không mùi, đúng thứ mình cần.”</span></figcaption>
  </figure>
  <figure class="voice">
    ${photo('portrait,smile', 73, 'Chân dung khách hàng', 96, 96)}
    <figcaption data-slot="avatar" data-catch><b>Mỹ Linh</b>, 33<br>
      <span data-catch>“Mình để một hũ ở cơ quan, một hũ ở nhà.”</span></figcaption>
  </figure>
  <figure class="voice">
    ${photo('portrait,man', 91, 'Chân dung khách hàng', 96, 96)}
    <figcaption data-slot="avatar" data-catch><b>Bảo Trân</b>, 26<br>
      <span data-catch>“Chồng mình dùng chung, hết nhanh gấp đôi.”</span></figcaption>
  </figure>
</section>

<section class="faq" data-slot="faq" data-catch>
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
  <h2 data-catch>Tìm chúng tôi</h2>
  <p data-slot="paragraph" data-catch>
    Ba cửa hàng, đều có góc thử sản phẩm. Nhân viên của chúng tôi không ăn hoa hồng theo
    doanh số, nên họ sẽ nói thật nếu sản phẩm không hợp với bạn.
  </p>
  <figure class="wide-shot">
    ${photo('shop,interior', 64, 'Cửa hàng LUMIÈRE', 640, 240)}
    <figcaption data-slot="photo" data-catch>Cửa hàng Đà Lạt, buổi sáng</figcaption>
  </figure>
  <div class="store-grid">
    <div data-catch><b>Đà Lạt</b><br>12 Trần Hưng Đạo, P.10<br>08:00 – 20:00</div>
    <div data-catch><b>TP. Hồ Chí Minh</b><br>45 Nguyễn Huệ, Q.1<br>09:00 – 21:30</div>
    <div data-catch><b>Hà Nội</b><br>7 Nhà Thờ, Hoàn Kiếm<br>09:00 – 21:00</div>
  </div>
  <button class="buy ghost" data-slot="cta" data-catch>ĐẶT LỊCH THỬ SẢN PHẨM</button>
</section>

<section class="news" data-slot="newsletter" data-catch>
  <h2 data-catch>Nhận thư của chúng tôi</h2>
  <form class="news-form">
    <input type="email" placeholder="Email của bạn" aria-label="Email" data-catch>
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
