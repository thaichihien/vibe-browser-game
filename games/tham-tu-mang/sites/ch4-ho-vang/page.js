/* Khu du lịch sinh thái HỒ VẮNG — bản SẠCH. Không có dị thường nào ở đây; đạo diễn thêm vào
   lúc chạy. data-slot = chỗ dị thường có thể bám. data-catch = nội dung bình thường, khoanh
   nhầm vào thì mất máu.

   Số lượng data-slot ở đây PHẢI khớp chính xác với CH4.pages[0].slots — có test đối chiếu.

   NGỮ VỰC: NGƯỜI LẠ (spec §5.4). Chương này không có ma và không có người đã mất. Nỗi sợ ở
   đây là bầu trời, khoảng cách, ánh sáng, và những thứ bị đếm sai. Trang sạch phải TỰ NÓ dựng
   sẵn những cái cớ bình thường cho tất cả những thứ đó: khu nghỉ thật sự không có sóng điện
   thoại, trời thật sự tối, và một khách đánh giá đã nói sẵn rằng mùa này hay có vệ tinh bay
   qua. Nhờ vậy dị thường không cần phải hét lên — nó chỉ cần đứng cạnh một lời giải thích
   hợp lý và không chịu vừa vào đó.

   CHÚ THÍCH ĐƯỢC VIẾT THEO ẢNH, không phải ngược lại (§3.4). Mọi ảnh dưới đây đã được xem
   tận mắt trước khi viết chú thích: chính sự khớp đó mới cho S05 (chú thích không khớp) một
   cái gì đó để lệch khỏi. */

import { picsum, portrait, imgHtml } from '../../js/engine/img.js';

const TINT = '#8ea79c';

const photo = (id, alt, w, h) =>
  imgHtml({ src: picsum({ w, h, id }), alt, w, h, tint: TINT });

const face = (set, n, alt) =>
  imgHtml({ src: portrait({ set, n }), alt, w: 128, h: 128, tint: TINT, cls: 'face' });

/** dd/mm/yyyy -> Date, hoặc null. Trang tự nhận ngày bằng chữ vì <input type="date"> vẽ theo
    ngôn ngữ GIAO DIỆN của trình duyệt: một người Việt dùng Chrome bản tiếng Anh sẽ thấy
    mm/dd/yyyy giữa một trang tiếng Việt, và đó là chỗ duy nhất trang để lộ mình không thật. */
function parseVi(text) {
  const m = String(text).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m.map(Number);
  const date = new Date(y, mo - 1, d);
  if (date.getDate() !== d || date.getMonth() !== mo - 1) return null;
  return date;
}

export const PAGE_INDEX = {
  id: 'index',
  css: 'site.css',

  /**
   * Cách trang CƯ XỬ khi chưa có dị thường nào.
   *
   * Ô đặt phòng phải trả lời thật: đổi số khách thì dòng tóm tắt đổi theo, và quá 6 khách
   * thì nó KẸP LẠI ở 6 — đúng như cái ghi chú ngay bên dưới đã hứa. Chính cái kẹp đó là thứ
   * R04 vi phạm; nếu bản sạch cũng nhận bừa thì "đặt cho 12 khách" chẳng còn là dị thường,
   * nó chỉ là một ô nhập không kiểm tra gì.
   *
   * Trần được đọc lại TỪ THUỘC TÍNH mỗi lần, không nhớ vào biến: R04 gỡ thuộc tính max ra,
   * nên bản sạch tự khắc thôi kẹp mà không cần biết gì về dị thường.
   */
  behaviour(shadow) {
    const form = shadow.querySelector('.book-form');
    const box = shadow.querySelector('.booking');
    if (!form || !box) return;

    const guests = form.querySelector('[data-guests]');
    const room = form.querySelector('select');
    const sum = box.querySelector('[data-booking-summary]');
    if (!guests || !room || !sum) return;

    const nights = () => {
      const a = parseVi(form.querySelector('[name="nhan"]')?.value ?? '');
      const b = parseVi(form.querySelector('[name="tra"]')?.value ?? '');
      if (!a || !b) return 0;
      return Math.max(0, Math.round((b - a) / 86400000));
    };

    const paint = () => {
      let n = Number(guests.value || 1);
      const max = Number(guests.getAttribute('max'));
      if (Number.isFinite(max) && max > 0 && n > max) { n = max; guests.value = String(max); }
      if (n < 1) n = 1;
      const d = nights();
      sum.textContent = [`${n} khách`, d ? `${d} đêm` : null, room.value]
        .filter(Boolean).join(' · ');
    };
    form.addEventListener('input', paint);
    form.addEventListener('change', paint);

    form.addEventListener('submit', () => {
      /* sealNavigation() đã chặn điều hướng ở pha capture; ở đây chỉ còn việc trả lời.

         Hoãn một nhịp để mọi listener của chính sự kiện này chạy xong đã. Dị thường nào muốn
         trả lời thay thì cắm cờ form.dataset.handled — KHÔNG dò [data-anom] trong khung nữa:
         E02 cũng rơi vào khung này và cái ô nhập thừa của nó cũng mang data-anom, nên phép dò
         ấy làm biểu mẫu câm bặt trên những ván chỉ có E02. Một biểu mẫu nuốt mất thao tác của
         người chơi rồi không nói gì là một dị thường KHÔNG AI ĐẶT VÀO ĐÓ. */
      setTimeout(() => {
        if (form.dataset.handled) return;
        let ok = box.querySelector('.book-ok');
        if (!ok) {
          ok = document.createElement('p');
          ok.className = 'book-ok';
          ok.setAttribute('data-booking-answer', '');
          ok.setAttribute('data-catch', '');
          box.appendChild(ok);
        }
        if (!nights()) {
          ok.textContent = 'Xin nhập ngày nhận và ngày trả phòng theo dạng dd/mm/yyyy.';
          return;
        }
        /* Số khách nằm riêng trong một <span data-guest-count>. R04 chỉ đổi đúng con số đó,
           nên câu văn quanh nó vẫn là câu văn của trang và hai nhánh không phân biệt được
           bằng mắt — cùng một bài học với .news-ok của R05 ở chương 1. */
        const count = document.createElement('span');
        count.setAttribute('data-guest-count', '');
        count.textContent = String(Math.max(1, Number(guests.value || 1)));
        ok.textContent = '';
        ok.append(
          'Còn phòng cho khoảng ngày này. Lễ tân sẽ gọi lại trong 30 phút để xác nhận đặt phòng cho ',
          count, ' khách.'
        );
      }, 0);
    });
  },


  /* Bố cục cố ý KHÔNG giống chương 1. Chương 1 là một trang bán hàng D2C: nền kem, tiêu đề
     serif, thẻ bo tròn có bóng đổ, lưới đều tăm tắp. Nếu chương 4 cũng như vậy thì người chơi
     đọc ra là "vẫn cái trang lúc nãy, đổi chữ", và cả tiền đề — mỗi hồ sơ là một trang web
     khác của một người khác — sụp xuống.

     Nên chương này mượn ngôn ngữ của một trang khu nghỉ boutique: ảnh tràn viền cao gần hết
     màn hình với thanh điều hướng trong suốt đè lên, tiêu đề sans mảnh chứ không phải serif,
     mục đánh số 01–07, KHÔNG bo góc và KHÔNG bóng đổ — chỉ có nét kẻ một pixel và khoảng
     trắng — rồi xen kẽ những dải nền tối. Ảnh phòng tràn hẳn ra mép trang, thư viện ảnh xếp
     lệch chứ không phải lưới 3×2. Cùng một bộ dị thường, một trang web hoàn toàn khác. */
  html: `
<section class="hero">
  <figure class="hero-shot">
    ${photo(128, 'Mặt hồ nhìn qua bãi sậy, núi phía xa', 2560, 1440)}
    <figcaption data-slot="photo" data-catch>Hồ Vắng nhìn từ bãi sậy phía đông</figcaption>
  </figure>
  <div class="scrim"></div>

  <header class="bar">
    <span class="brand" data-catch>HỒ VẮNG</span>
    <span class="brand-sub" data-catch>Khu du lịch sinh thái · Lâm Đồng</span>
    <nav data-slot="nav" data-catch>
      <a href="#">TRANG CHỦ</a><a href="#">PHÒNG &amp; GIÁ</a><a href="#">THƯ VIỆN ẢNH</a>
      <a href="#">ĐƯỜNG ĐI</a><a href="#">LIÊN HỆ</a>
    </nav>
    <span class="bar-cta" data-catch>0263 3861 204</span>
  </header>

  <div class="hero-copy">
    <span class="kicker" data-catch>Tà Nung · Lâm Đồng · từ 2016</span>
    <h1 data-slot="hero-title" data-catch>Một cái hồ, bốn mươi héc-ta rừng,<br>và không có sóng điện thoại</h1>
    <p data-slot="paragraph" data-catch>
      Hồ Vắng nằm cuối đường ĐT725, cách Đà Lạt 27 km. Chín nhà sàn gỗ, bốn phòng đôi và một
      bãi cắm trại trên đồi. Chúng tôi không nhận quá ba mươi khách một đêm, và chưa bao giờ
      định nhận nhiều hơn.
    </p>
    <div class="hero-act">
      <button class="cta-solid" data-slot="cta" data-catch>ĐẶT PHÒNG</button>
      <ul class="assure">
        <li data-catch>Nhận phòng từ 14:00</li>
        <li data-catch>Bữa sáng đã gồm trong giá</li>
        <li data-catch>Huỷ miễn phí trước 3 ngày</li>
      </ul>
    </div>
  </div>
</section>

<section class="strip">
  <span class="chip" data-slot="tile" data-catch>Nhiệt độ hôm nay: 19°C</span>
  <span class="chip" data-slot="tile" data-catch>Mực nước hồ: 4,1 m</span>
  <span class="chip" data-slot="tile" data-catch>Còn 8 phòng trống cho cuối tuần này</span>
  <span class="chip" data-slot="tile" data-catch>Khách đang lưu trú: 26</span>
</section>

<section class="band why">
  <div class="band-head">
    <span class="num" data-catch>01</span>
    <div>
      <h2 data-catch>Không có gì để làm, và đó là chủ ý</h2>
      <p data-slot="paragraph" data-catch>
        Ở đây không có hồ bơi vô cực, không có nhạc ngoài trời, không có chương trình team
        building. Có rừng, có hồ, và có một khoảng trời rất tối.
      </p>
    </div>
  </div>
  <div class="why-grid">
    <div class="why-card"><span class="ico" data-slot="feature-icon" data-catch>🌲</span>
      <b data-catch>Rừng thông 40 héc-ta</b><span data-catch>Đi bộ cả ngày không gặp ai</span></div>
    <div class="why-card"><span class="ico" data-slot="feature-icon" data-catch>🛶</span>
      <b data-catch>Chèo thuyền trên hồ</b><span data-catch>Kayak miễn phí cho khách lưu trú</span></div>
    <div class="why-card"><span class="ico" data-slot="feature-icon" data-catch>🔥</span>
      <b data-catch>Bếp than ngoài trời</b><span data-catch>Mỗi nhà sàn một bếp, than để sẵn</span></div>
    <div class="why-card"><span class="ico" data-slot="feature-icon" data-catch>🌙</span>
      <b data-catch>Trời tối thật sự</b><span data-catch>Không đèn đường trong bán kính 3 km</span></div>
  </div>
</section>

<section class="band rooms">
  <div class="band-head">
    <span class="num" data-catch>02</span>
    <div>
      <h2 data-catch>Chỗ ở</h2>
      <p data-slot="paragraph" data-catch>
        Nhà sàn dựng bằng gỗ thông tại chỗ, sửa lại năm 2023. Phòng đôi nằm trong dãy nhà
        chính, gần lễ tân nhất. Lều trại trên đồi chỉ mở khi trời khô.
      </p>
    </div>
  </div>

  <article class="room">
    <figure>${photo(76, 'Vách gỗ cũ với cửa sơn xanh và một chiếc xe đạp', 1400, 1050)}
      <figcaption data-slot="photo" data-catch>Nhà sàn gỗ số 4, hiên sau</figcaption></figure>
    <div class="room-copy">
      <b data-catch>Nhà sàn gỗ ven hồ</b>
      <p data-catch>Hai giường, hiên gỗ nhìn thẳng ra mặt nước, bếp than riêng. Ở được 4 khách.</p>
      <div class="price" data-slot="price" data-catch>1.250.000₫ / đêm</div>
    </div>
  </article>

  <article class="room flip">
    <figure>${photo(208, 'Cửa sổ ô vuông nhìn ra tán lá xanh từ trong phòng tối', 1400, 1050)}
      <figcaption data-slot="photo" data-catch>Phòng đôi hướng rừng, cửa sổ nhìn ra rặng thông</figcaption></figure>
    <div class="room-copy">
      <b data-catch>Phòng đôi hướng rừng</b>
      <p data-catch>Một giường lớn, bàn viết, nước nóng năng lượng mặt trời. Ở được 2 khách.</p>
      <div class="price" data-slot="price" data-catch>850.000₫ / đêm</div>
    </div>
  </article>

  <div class="rooms-foot">
    <p class="note" data-slot="date" data-catch>Bảng giá áp dụng từ ngày 01/09/2026.</p>
    <div class="hours-box">
      <b data-catch>Giờ giấc</b>
      <div class="hours" data-slot="hours" data-catch><span data-catch>Lễ tân</span> 06:00 – 22:00</div>
      <div class="hours" data-slot="hours" data-catch><span data-catch>Nhà hàng</span> 06:30 – 21:00</div>
      <div class="hours" data-slot="hours" data-catch><span data-catch>Bến thuyền</span> 05:30 – 18:00</div>
    </div>
  </div>
</section>

<section class="band gallery dark">
  <div class="band-head">
    <span class="num" data-catch>03</span>
    <div>
      <h2 data-catch>Hồ Vắng trong một năm</h2>
      <p data-slot="paragraph" data-catch>
        Phần lớn ảnh dưới đây do khách chụp và gửi lại cho chúng tôi. Chúng tôi giữ nguyên,
        không chỉnh màu, kể cả những tấm chụp hỏng.
      </p>
    </div>
  </div>
  <div class="gal">
    <figure>${photo(194, 'Sàn gỗ và một hòn đá, trời trắng xoá phía sau', 1600, 900)}
      <figcaption data-slot="gallery-caption" data-catch>Sàn gỗ bến thuyền, sương chưa tan lúc 6 giờ</figcaption></figure>
    <figure>${photo(149, 'Đèn thị trấn bên kia mặt nước trong đêm giông', 760, 570)}
      <figcaption data-slot="gallery-caption" data-catch>Giông đêm nhìn từ nhà sàn số 2. Đèn bên kia là thị trấn</figcaption></figure>
    <figure>${photo(190, 'Lối đá uốn khúc giữa rừng thân cây thẳng', 760, 570)}
      <figcaption data-slot="gallery-caption" data-catch>Lối đá trong rừng thông, dài 1,2 km</figcaption></figure>
    <figure>${photo(222, 'Mặt trời sau đám mây dày, đồi tối phía dưới', 760, 570)}
      <figcaption data-slot="gallery-caption" data-catch>Trời chiều trên đồi phía bắc, tháng Tư</figcaption></figure>
    <figure>${photo(187, 'Đồng cỏ phủ sương muối lúc rạng sáng', 760, 570)}
      <figcaption data-slot="gallery-caption" data-catch>Sương muối trên đồng cỏ phía tây, đầu tháng Giêng</figcaption></figure>
    <figure>${photo(230, 'Nhìn ra mặt hồ mờ sương từ dưới mái nhà thuyền', 2400, 700)}
      <figcaption data-slot="gallery-caption" data-catch>Nhìn ra hồ từ nhà thuyền, sau cơn mưa</figcaption></figure>
  </div>
  <div class="gal-foot">
    <p class="note" data-slot="date" data-catch>Ảnh do khách gửi về, cập nhật ngày 22/06/2026.</p>
    <button class="cta-ghost" data-slot="cta" data-catch>XEM TOÀN BỘ 240 ẢNH</button>
  </div>
</section>

<section class="band book">
  <div class="band-head">
    <span class="num" data-catch>04</span>
    <div>
      <h2 data-catch>Kiểm tra phòng trống</h2>
      <p data-slot="paragraph" data-catch>
        Chúng tôi không bán qua ứng dụng trung gian. Điền vào đây hoặc gọi thẳng cho lễ tân —
        người nhấc máy cũng là người dọn phòng cho bạn.
      </p>
    </div>
  </div>
  <div class="booking" data-slot="booking-form" data-catch>
    <form class="book-form">
      <label class="bk" data-catch><span data-catch>Ngày nhận phòng</span>
        <input type="text" name="nhan" placeholder="dd/mm/yyyy" aria-label="Ngày nhận phòng" data-catch></label>
      <label class="bk" data-catch><span data-catch>Ngày trả phòng</span>
        <input type="text" name="tra" placeholder="dd/mm/yyyy" aria-label="Ngày trả phòng" data-catch></label>
      <label class="bk" data-catch><span data-catch>Số khách</span>
        <input type="number" name="khach" min="1" max="6" value="2" aria-label="Số khách" data-guests data-catch></label>
      <label class="bk" data-catch><span data-catch>Loại chỗ ở</span>
        <select name="phong" aria-label="Loại chỗ ở" data-catch>
          <option>Nhà sàn gỗ ven hồ</option>
          <option>Phòng đôi hướng rừng</option>
          <option>Lều trại trên đồi</option>
        </select></label>
      <button type="submit" data-catch>KIỂM TRA PHÒNG TRỐNG</button>
    </form>
    <p class="book-sum" data-booking-summary data-catch>2 khách · Nhà sàn gỗ ven hồ</p>
    <p class="book-note" data-catch>Mỗi lượt đặt tối đa 6 khách. Đoàn đông hơn xin gọi lễ tân trước một ngày.</p>
  </div>
</section>

<section class="band rules">
  <div class="band-head">
    <span class="num" data-catch>05</span>
    <div><h2 data-catch>Năm điều chúng tôi xin nhắc</h2></div>
  </div>
  <ol class="rule-list">
    <li data-slot="notice" data-catch>Không mang loa và nhạc lớn ra khu vực ven hồ.</li>
    <li data-slot="notice" data-catch>Trẻ em dưới 12 tuổi phải có người lớn đi cùng khi xuống bến thuyền.</li>
    <li data-slot="notice" data-catch>Không bơi ra quá hàng phao vàng.</li>
    <li data-slot="notice" data-catch>Tắt bếp than trước 22 giờ và dội nước cho nguội hẳn.</li>
    <li data-slot="notice" data-catch>Không rời khỏi lối mòn có cắm biển sau khi trời tối.</li>
  </ol>
  <p class="note" data-slot="date" data-catch>Nội quy ban hành ngày 14/03/2019.</p>

  <!-- Ô này là NỘI DUNG SẠCH và không bao giờ được mang data-slot. T08 đo một chữ ký trên
       phần đánh giá bằng đúng cái tên ở đây; nếu đạo diễn sửa được dòng này thì nó đang dời
       chính cây thước. Ở những ván không bốc trúng T08, đây chỉ là một mẩu thông báo lễ tân
       buồn buồn — và trang phải buồn được mà không cần phải sai. -->
  <aside class="lost" data-catch>
    <b data-catch>Thông báo của lễ tân</b>
    <p data-catch>Khách Hoàng Vĩnh Sơn nhận phòng ngày 14/08/2023 và đến nay chưa làm thủ tục
      trả phòng. Hành lý của anh vẫn được giữ tại quầy. Ai có thông tin xin gọi 0263 3861 204.</p>
  </aside>
</section>

<section class="band where dark">
  <div class="band-head">
    <span class="num" data-catch>06</span>
    <div>
      <h2 data-catch>Tới đây thế nào</h2>
      <p data-slot="paragraph" data-catch>
        Từ Đà Lạt đi ĐT725 về hướng tây nam, qua ngã ba Tà Nung, rẽ trái ở cột mốc 27 km. Bốn
        cây số cuối là đường đất, xe gầm thấp đi được nếu trời không mưa.
      </p>
    </div>
  </div>
  <div class="mapbox" data-slot="map" data-catch>
    <svg class="map-art" viewBox="0 0 320 200" aria-hidden="true">
      <rect x="0" y="0" width="320" height="200" fill="#101a17"/>
      <path d="M0 148 C60 120 90 160 140 150 C200 138 250 168 320 152 L320 200 L0 200 Z" fill="#15221e"/>
      <ellipse cx="176" cy="96" rx="86" ry="46" fill="none" stroke="#6f8f88" stroke-width="1.2"/>
      <ellipse cx="176" cy="96" rx="70" ry="34" fill="none" stroke="#3d534d" stroke-width="1"/>
      <path d="M0 40 C70 46 96 82 150 96" fill="none" stroke="#b0803f" stroke-width="1.6" stroke-dasharray="6 5"/>
      <circle cx="150" cy="96" r="3.5" fill="#b0803f"/>
      <text x="159" y="93" font-size="9" fill="#cfd8d3" letter-spacing="1">HỒ VẮNG</text>
      <text x="6" y="34" font-size="8" fill="#7d8a85" letter-spacing="1">ĐT725</text>
    </svg>
    <ul class="map-facts">
      <li data-catch><span data-catch>Toạ độ</span> <b data-coords>11°56′24″B · 108°26′10″Đ</b></li>
      <li data-catch><span data-catch>Cách Đà Lạt</span> 27 km theo ĐT725</li>
      <li data-catch><span data-catch>Sân bay Liên Khương</span> 46 km</li>
      <li data-catch><span data-catch>Sóng điện thoại gần nhất</span> 3,4 km</li>
    </ul>
  </div>
  <figure class="wide-shot">
    ${photo(191, 'Đường nhựa uốn quanh vách núi, thung lũng phía dưới', 2400, 800)}
    <figcaption data-slot="photo" data-catch>Đoạn cuối đường đèo ĐT725 vào khu nghỉ</figcaption>
  </figure>
</section>

<section class="band reviews">
  <div class="band-head">
    <span class="num" data-catch>07</span>
    <div>
      <h2 data-catch>Ba đánh giá gần nhất</h2>
      <p data-slot="paragraph" data-catch>
        Chúng tôi đăng lại nguyên văn, kể cả những chỗ chê. Khách đã ở đủ một đêm mới được viết.
      </p>
    </div>
  </div>
  <div class="rev-grid">
    <article class="rev">
      <figure class="rev-face">${face('women', 12, 'Ảnh khách đánh giá')}
        <figcaption data-slot="avatar" data-catch>Nhà sàn số 4 · 2 đêm</figcaption></figure>
      <div data-slot="comment" data-catch>
        <p class="rev-head" data-catch><b data-who>Trần Mỹ Duyên</b>
          <span class="rev-when" data-when>3 tuần trước</span></p>
        <p data-catch>Hai đêm không có sóng điện thoại, và đó đúng là lý do tụi mình đi. Sáng
          sương xuống tận mép nước, đến chín giờ mới tan hết.</p>
      </div>
    </article>
    <article class="rev">
      <figure class="rev-face">${face('men', 32, 'Ảnh khách đánh giá')}
        <figcaption data-slot="avatar" data-catch>Phòng đôi · 1 đêm</figcaption></figure>
      <div data-slot="comment" data-catch>
        <p class="rev-head" data-catch><b data-who>Lê Quang Huy</b>
          <span class="rev-when" data-when>5 tuần trước</span></p>
        <p data-catch>Phòng hơi cũ nhưng sạch, nước nóng yếu vào sáng sớm. Bếp than để sẵn,
          nhân viên chỉ tận nơi. Đêm nghe rõ tiếng cá quẫy ngoài hồ.</p>
      </div>
    </article>
    <article class="rev">
      <figure class="rev-face">${face('women', 68, 'Ảnh khách đánh giá')}
        <figcaption data-slot="avatar" data-catch>Lều trại trên đồi · 2 đêm</figcaption></figure>
      <div data-slot="comment" data-catch>
        <p class="rev-head" data-catch><b data-who>Phạm Ngọc Hà</b>
          <span class="rev-when" data-when>2 tháng trước</span></p>
        <p data-catch>Đi hai người, ngủ lều trên đồi. Trời quang thì thấy sao rất rõ. Nhân
          viên bảo mùa này hay có vệ tinh bay qua nên đừng lạ.</p>
      </div>
    </article>
  </div>
  <button class="cta-ghost" data-slot="cta" data-catch>GỌI LỄ TÂN: 0263 3861 204</button>
</section>

<footer data-slot="footer" data-catch>
  <span>© 2026 Khu du lịch sinh thái Hồ Vắng · Tà Nung, Lâm Đồng</span>
  <span>Lễ tân: 0263 3861 204 · hovang.resort@gmail.com</span>
  <span>Giấy phép lưu trú số 58/GP-LĐ</span>
</footer>`
};
