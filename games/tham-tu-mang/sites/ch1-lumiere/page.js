/* Trang bán hàng LUMIÈRE — bản SẠCH. Không có dị thường nào ở đây; đạo diễn sẽ thêm vào
   lúc chạy. data-slot = chỗ dị thường có thể bám. data-catch = nội dung bình thường mà
   khoanh nhầm vào thì mất máu. */

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
    <a href="#">TRANG CHỦ</a><a href="#">SẢN PHẨM</a><a href="#">CÂU CHUYỆN</a><a href="#">LIÊN HỆ</a>
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
  </div>
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
</section>

<section class="faq" data-slot="faq" data-catch>
  <h2 data-catch>Câu hỏi thường gặp</h2>
  <details><summary data-catch>Dùng được cho da nhạy cảm không?</summary>
    <p data-slot="paragraph" data-catch>Được. Sản phẩm không chứa cồn khô và hương liệu tổng
      hợp, đã kiểm nghiệm trên da nhạy cảm trong 4 tuần.</p></details>
  <details><summary data-catch>Bao lâu thì dùng hết một hũ?</summary>
    <p data-catch>Khoảng 8 tuần nếu dùng hai lần mỗi ngày.</p></details>
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
</footer>`
};
