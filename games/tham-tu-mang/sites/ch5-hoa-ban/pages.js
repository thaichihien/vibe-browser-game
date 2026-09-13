/* Trường Tiểu học Hoa Ban — năm trang. Bản SẠCH: không có dị thường nào ở đây.

   NGỮ VỰC: GIỌNG CƠ QUAN (spec §5.5). Chương này không có ma, không có quái vật, không có
   người lạ. Thứ đáng sợ duy nhất là một bộ máy hành chính viết ra những điều không thể đúng
   bằng đúng cái giọng bình thản mà nó vẫn dùng để thông báo lịch nghỉ Tết.

   MỘT LUẬT TUYỆT ĐỐI: KHÔNG CÓ CHUYỆN GÌ XẢY RA VỚI TRẺ EM TRÊN MÀN HÌNH. Không ảnh nào ở
   đây có mặt một đứa trẻ — bảy tấm đều là hành lang, cầu thang, cửa sổ, hội trường, đồng hồ,
   một lọ hoa, một bảng ký hiệu. Không chú thích nào, không thông báo nào được mô tả một học
   sinh là mất tích hay bị hại (spec §3.4). Nỗi sợ nằm ở chỗ nhà trường ĐẾM SAI và không ai
   thấy đó là chuyện lạ.

   VÌ SAO NĂM TRANG. Trang chủ của một trường tiểu học thật bao giờ cũng chỉ là cái cổng: bốn
   dòng tin mới nhất, một thư ngỏ, vài tấm ảnh. Mọi thứ đáng đọc nằm ở trang trong — danh sách
   thông báo đầy đủ, một văn bản ký tên đóng dấu, trang giới thiệu có bảng số liệu. Dồn tất cả
   vào một trang thì nó thôi không còn giống một trang trường học nữa.

   BẢNG SỐ LIỆU Ở TRANG GIỚI THIỆU LÀ CHỖ BÁM CỦA T10, và nó được viết cho khớp TUYỆT ĐỐI:
   mỗi hàng có số học sinh chia hết cho số lớp ra đúng sĩ số trung bình đã ghi, cột nào cộng
   lại cũng đúng dòng tổng, và đoạn văn phía trên nhắc lại đúng con số ấy một lần nữa. Ba chỗ
   đồng ý với nhau; T10 chỉ cần sửa một ô là cả ba cùng gãy. Nếu bảng sạch mà đã tự mâu thuẫn
   thì dị thường chẳng có gì để lệch khỏi.

   Ô "Lịch sử nhà trường" nhắc tên thầy Nguyễn Văn Đệ, hiệu trưởng 1998–2012, là NỘI DUNG SẠCH
   và không bao giờ được mang data-slot — nó là cây thước cho T08, giống ô tưởng niệm ở chương
   2 và dòng tài khoản đã đóng ở chương 3. */

import { picsum, portrait, imgHtml } from '../../js/engine/img.js';

const TINT = '#b9c3d4';

const photo = (id, alt, w, h) =>
  imgHtml({ src: picsum({ w, h, id }), alt, w, h, tint: TINT });

/* Chân dung lấy từ randomuser, và ở chương này CHỈ SỐ ẢNH LÀ MỘT LỰA CHỌN CÓ CÂN NHẮC, không
   phải một con số bốc bừa: kho ảnh đó chủ yếu là người phương Tây, mà một trang trường tiểu
   học ở Sơn La có ảnh hiệu trưởng tóc vàng thì tự nó đã là thứ khiến người chơi nghi ngờ cả
   trang — nghi sai chỗ, vì đó không phải dị thường ai đặt vào. Ba chỉ số dưới đây đã được xem
   tận mắt và chọn cho hợp với nơi chốn. */
const face = (set, n, alt) =>
  imgHtml({ src: portrait({ set, n }), alt, w: 128, h: 128, tint: TINT, cls: 'face' });

/* `slot` phát ra data-slot hay không tuỳ trang: khung chung (thanh điều hướng, thanh bên,
   chân trang) có mặt ở cả năm trang, nhưng ô đếm lượt truy cập chỉ được khai một lần. */
const slot = (on, name) => (on ? ` data-slot="${name}"` : '');

const head = () => `
<div class="crest">
  <div class="crest-txt">
    <b data-catch>TRƯỜNG TIỂU HỌC HOA BAN</b>
    <span data-catch>Xã Chiềng Sinh · Thành phố Sơn La · Tỉnh Sơn La</span>
  </div>
  <span class="crest-est" data-catch>Thành lập năm 1998</span>
</div>

<!-- Dòng chữ chạy là NỘI DUNG SẠCH và cố ý không phải chỗ bám: nó đã tự chuyển động rồi, nên
     S06 (dòng chữ đang rời khỏi trang) đặt lên đây sẽ không ai nhìn ra, còn T06 (rữa dần) thì
     cần một danh sách chứ không phải một dòng đơn độc. Nó ở đây vì một trang trường học thật
     có một dòng như thế, và vì nó dạy người chơi rằng "động đậy" tự nó chưa phải là "sai". -->
<div class="runner" data-catch>
  <span>Chào mừng quý phụ huynh và các em học sinh bước vào năm học 2026–2027
    ★ Lễ khai giảng tổ chức lúc 7 giờ 00 ngày 05/09/2026 tại sân trường
    ★ Nhà trường không tổ chức dạy thêm dưới bất kỳ hình thức nào</span>
</div>

<nav data-slot="nav" data-catch>
  <a href="#" data-goto="index">Trang chủ</a>
  <a href="#" data-goto="gioi-thieu">Giới thiệu</a>
  <a href="#" data-goto="thong-bao">Thông báo</a>
  <a href="#" data-goto="hinh-anh">Hình ảnh</a>
  <a href="#">Liên hệ</a>
</nav>`;

const side = (rich) => `
<aside class="side">
  <div class="box">
    <h3 data-catch>LIÊN KẾT</h3>
    <ul>
      <li data-catch><a href="#">Sở GD&amp;ĐT tỉnh Sơn La</a></li>
      <li data-catch><a href="#">Phòng GD&amp;ĐT thành phố</a></li>
      <li data-catch><a href="#">Cổng thông tin điện tử tỉnh</a></li>
      <li data-catch><a href="#">Thư viện đề thi</a></li>
    </ul>
  </div>
  <div class="box">
    <h3 data-catch>LƯỢT TRUY CẬP</h3>
    <p class="hits"${slot(rich, 'tile')} data-catch>Tổng lượt truy cập: 40.213</p>
    <p class="online" data-catch>Đang trực tuyến: 3</p>
  </div>
  <div class="box">
    <h3 data-catch>LIÊN HỆ</h3>
    <p data-catch>Điện thoại: 0212 3852 114<br>
      Email: c1hoaban.sonla@moet.edu.vn</p>
  </div>
</aside>`;

const foot = () => `
<footer data-slot="footer" data-catch>
  <span>Trường Tiểu học Hoa Ban — Xã Chiềng Sinh, Thành phố Sơn La</span>
  <span>Chịu trách nhiệm nội dung: Ban Giám hiệu nhà trường</span>
  <span>Trang web hiển thị tốt nhất ở độ phân giải 1024×768</span>
</footer>`;

/* Mọi tiêu đề thông báo đều là LIÊN KẾT, nên chỗ bám `notice` phải nằm TRÊN thẻ <a> chứ không
   bọc quanh nó: T01, T02, T06 và S01 đều gán thẳng textContent cho chỗ bám, mà gán vào thẻ
   bọc ngoài thì thẻ <a> bên trong bị xoá sạch và cái tin ấy thành không mở ra được. */
const newsRow = (n) => `
      <tr>
        <td class="dt"><span data-slot="date" data-catch>${n.date}</span></td>
        <td><a href="#" data-goto="${n.to ?? 'thong-bao-13'}" data-slot="notice" data-catch>${n.title}</a></td>
      </tr>`;

const NEWS = [
  { date: '02/12/2026', title: 'Thông báo về lịch nghỉ Tết Nguyên đán năm 2027' },
  { date: '25/11/2026', title: 'Kế hoạch tổ chức Hội khoẻ Phù Đổng cấp trường' },
  { date: '18/11/2026', title: 'Hướng dẫn đăng ký ăn bán trú học kỳ II' },
  { date: '10/11/2026', title: 'Thông báo họp phụ huynh cuối học kỳ I' },
  { date: '03/11/2026', title: 'Kết quả kiểm tra giữa học kỳ I khối 4 và khối 5' },
  { date: '21/10/2026', title: 'Lịch tiêm chủng bổ sung cho học sinh toàn trường' },
  { date: '09/10/2026', title: 'Thông báo thu các khoản đầu năm học 2026–2027' },
  { date: '28/09/2026', title: 'Kế hoạch kiểm tra nền nếp đầu giờ và cuối buổi học' }
];

export const CH5_INDEX = {
  id: 'index',
  css: 'site.css',
  html: `
${head()}
<div class="wrap">
  <main class="col">
    <div class="panel">
      <h2 data-catch>THÔNG BÁO MỚI NHẤT</h2>
      <table class="news">${NEWS.slice(0, 4).map(newsRow).join('')}
      </table>
      <p class="more"><a href="#" data-goto="thong-bao" data-slot="cta" data-catch>Xem tất cả thông báo →</a></p>
    </div>

    <div class="panel">
      <h2 data-catch>THƯ NGỎ CỦA HIỆU TRƯỞNG</h2>
      <figure class="portrait">
        ${face('women', 83, 'Ảnh Hiệu trưởng nhà trường')}
        <figcaption data-slot="avatar" data-catch><b>Trần Thị Bích Liên</b><br>
          <span data-catch>Hiệu trưởng</span></figcaption>
      </figure>
      <p data-slot="paragraph" data-catch>
        Kính thưa quý bậc phụ huynh, thưa các thầy cô giáo và các em học sinh thân mến. Năm học
        2026–2027 là năm thứ hai mươi chín nhà trường đón các em tới lớp. Tập thể sư phạm nhà
        trường xin hứa tiếp tục chăm lo cho từng em như chăm lo cho con em của chính mình.
      </p>
      <p data-slot="paragraph" data-catch>
        Nhà trường rất mong tiếp tục nhận được sự phối hợp chặt chẽ của quý phụ huynh trong
        việc đưa đón các em đúng giờ và nhắc các em không ở lại trường sau khi tan học.
      </p>
    </div>

    <div class="panel">
      <h2 data-catch>HÌNH ẢNH HOẠT ĐỘNG</h2>
      <div class="strip">
        <figure>${photo(290, 'Dãy nhà nhiều tầng có mái vòm, chụp từ dưới lên', 640, 480)}
          <figcaption data-slot="photo" data-catch>Khu hiệu bộ, chụp từ cổng phụ</figcaption></figure>
        <figure>${photo(311, 'Một chiếc ghế bên cửa sổ có rèm, ánh chiều', 640, 480)}
          <figcaption data-slot="photo" data-catch>Phòng học lớp 3A sau giờ tan học</figcaption></figure>
        <figure>${photo(305, 'Lọ hoa trắng đặt trên lan can ban công', 640, 480)}
          <figcaption data-slot="photo" data-catch>Hoa ban trước cửa phòng hội đồng</figcaption></figure>
      </div>
    </div>
  </main>
  ${side(true)}
</div>
${foot()}`
};

export const CH5_THONG_BAO = {
  id: 'thong-bao',
  css: 'site.css',
  html: `
${head()}
<div class="wrap">
  <main class="col">
    <div class="panel">
      <h2 data-catch>DANH SÁCH THÔNG BÁO</h2>
      <p data-slot="paragraph" data-catch>
        Toàn bộ văn bản do nhà trường ban hành trong học kỳ I năm học 2026–2027. Quý phụ huynh
        không nhận được thông báo bằng giấy xin liên hệ giáo viên chủ nhiệm của lớp.
      </p>
      <table class="news full">${NEWS.map(newsRow).join('')}
      </table>
    </div>
  </main>
  ${side(false)}
</div>
${foot()}`
};

export const CH5_THONG_BAO_13 = {
  id: 'thong-bao-13',
  css: 'site.css',
  html: `
${head()}
<div class="wrap">
  <main class="col">
    <div class="panel doc">
      <p class="doc-org" data-catch>PHÒNG GD&amp;ĐT THÀNH PHỐ SƠN LA<br>
        <b>TRƯỜNG TIỂU HỌC HOA BAN</b></p>
      <p class="doc-no" data-catch>Số: 13/TB-THHB</p>
      <h2 data-slot="notice" data-catch>Thông báo họp phụ huynh cuối học kỳ I</h2>
      <p class="doc-date" data-catch>Sơn La, ngày <span data-slot="date" data-catch>10/11/2026</span></p>

      <p data-slot="paragraph" data-catch>
        Kính gửi quý bậc phụ huynh học sinh toàn trường. Thực hiện kế hoạch năm học, nhà trường
        tổ chức họp phụ huynh cuối học kỳ I vào lúc 7 giờ 30 ngày 30/11/2026 tại phòng học của
        từng lớp.
      </p>
      <p data-slot="paragraph" data-catch>
        Nội dung cuộc họp gồm: thông báo kết quả học tập và rèn luyện học kỳ I, phổ biến kế
        hoạch học kỳ II, và thống nhất các khoản thu theo quy định. Đề nghị quý phụ huynh có
        mặt đúng giờ và mang theo sổ liên lạc của các em.
      </p>
      <p data-slot="paragraph" data-catch>
        Trường hợp phụ huynh không thể tham dự, xin báo trước cho giáo viên chủ nhiệm để nhà
        trường bố trí gặp riêng vào buổi chiều cùng ngày. Nhà trường không nhận uỷ quyền cho
        người không có tên trong sổ liên lạc.
      </p>

      <p class="doc-sign" data-catch>
        <span class="doc-role" data-catch>HIỆU TRƯỞNG</span><br>
        <b data-slot="byline" data-catch><span data-who>Trần Thị Bích Liên</span></b>
      </p>

      <p class="back"><a href="#" data-goto="thong-bao" data-slot="cta" data-catch>← Quay lại danh sách thông báo</a></p>
    </div>
  </main>
  ${side(false)}
</div>
${foot()}`
};

export const CH5_GIOI_THIEU = {
  id: 'gioi-thieu',
  css: 'site.css',
  html: `
${head()}
<div class="wrap">
  <main class="col">
    <div class="panel">
      <h2 data-catch>GIỚI THIỆU NHÀ TRƯỜNG</h2>
      <p data-slot="paragraph" data-catch>
        Trường Tiểu học Hoa Ban được thành lập theo quyết định của Uỷ ban nhân dân thành phố
        Sơn La, đi vào hoạt động từ tháng 9 năm 1998. Trường nằm trên địa bàn xã Chiềng Sinh,
        cách trung tâm thành phố 6 km.
      </p>
      <p data-slot="paragraph" data-catch>
        Năm học 2026–2027, nhà trường có 442 học sinh, 26 giáo viên và 14 phòng học. Toàn bộ
        học sinh học hai buổi mỗi ngày, trong đó 318 em đăng ký ăn bán trú tại trường.
      </p>

      <h3 data-catch>Quy mô năm học 2026–2027</h3>
      <!-- BẢNG NÀY PHẢI TỰ KHỚP TUYỆT ĐỐI. Mỗi hàng: số học sinh chia số lớp ra đúng sĩ số
           trung bình đã ghi. Mỗi cột cộng lại ra đúng dòng "Toàn trường". Và đoạn văn ngay
           phía trên nhắc lại đúng 442 một lần nữa. Ba chỗ đồng ý với nhau, nên T10 chỉ cần
           sửa một ô là cả ba cùng gãy — mà nếu bảng sạch đã tự mâu thuẫn thì T10 không còn
           gì để lệch khỏi. Sửa số ở đây thì phải sửa lại cả ba chỗ. -->
      <table class="stats" data-slot="table" data-catch>
        <tr>
          <th data-catch>Khối</th><th data-catch>Số lớp</th>
          <th data-catch>Số học sinh</th><th data-catch>Sĩ số trung bình</th>
        </tr>
        <tr><td data-catch>Khối 1</td><td data-catch>3</td>
          <td data-n data-catch>96</td><td data-catch>32</td></tr>
        <tr><td data-catch>Khối 2</td><td data-catch>3</td>
          <td data-n data-catch>90</td><td data-catch>30</td></tr>
        <tr><td data-catch>Khối 3</td><td data-catch>3</td>
          <td data-n data-catch>99</td><td data-catch>33</td></tr>
        <tr><td data-catch>Khối 4</td><td data-catch>3</td>
          <td data-n data-catch>93</td><td data-catch>31</td></tr>
        <tr><td data-catch>Khối 5</td><td data-catch>2</td>
          <td data-n data-catch>64</td><td data-catch>32</td></tr>
        <tr class="sum"><td data-catch>Toàn trường</td><td data-catch>14</td>
          <td data-sum data-catch>442</td><td data-catch>31,6</td></tr>
      </table>
      <p class="tbl-note" data-catch>Số liệu chốt ngày <span data-slot="date" data-catch>15/09/2026</span>.</p>

      <h3 data-catch>Ban Giám hiệu và Tổng phụ trách</h3>
      <div class="staff">
        <figure>${face('women', 83, 'Ảnh Hiệu trưởng')}
          <figcaption data-slot="avatar" data-catch><b>Trần Thị Bích Liên</b><br>
            <span data-catch>Hiệu trưởng · phụ trách chung</span></figcaption></figure>
        <figure>${face('men', 90, 'Ảnh Phó hiệu trưởng')}
          <figcaption data-slot="avatar" data-catch><b>Nguyễn Hữu Thắng</b><br>
            <span data-catch>Phó hiệu trưởng · phụ trách chuyên môn</span></figcaption></figure>
        <figure>${face('women', 90, 'Ảnh Tổng phụ trách Đội')}
          <figcaption data-slot="avatar" data-catch><b>Phạm Thu Hà</b><br>
            <span data-catch>Tổng phụ trách Đội</span></figcaption></figure>
      </div>

      <!-- NỘI DUNG SẠCH, không bao giờ được mang data-slot: đây là cây thước của T08. Một
           chữ ký mang tên thầy Đệ trên văn bản đề năm nay chỉ có nghĩa vì chỗ này đã nói
           thầy nghỉ hưu từ 2012. Nếu đạo diễn sửa được dòng này thì nó đang dời cây thước.
           Ở những ván không bốc trúng T08, đây chỉ là một mẩu lịch sử nhà trường. -->
      <div class="history" data-catch>
        <h3 data-catch>Lịch sử nhà trường</h3>
        <p data-catch>Thầy Nguyễn Văn Đệ là hiệu trưởng đầu tiên, phụ trách nhà trường từ năm
          1998 đến khi nghỉ hưu năm 2012. Cô Trần Thị Bích Liên giữ chức hiệu trưởng từ tháng
          8 năm 2018 đến nay.</p>
      </div>
    </div>
  </main>
  ${side(false)}
</div>
${foot()}`
};

export const CH5_HINH_ANH = {
  id: 'hinh-anh',
  css: 'site.css',
  html: `
${head()}
<div class="wrap">
  <main class="col">
    <div class="panel">
      <h2 data-catch>HÌNH ẢNH NHÀ TRƯỜNG</h2>
      <p data-slot="paragraph" data-catch>
        Ảnh do giáo viên nhà trường chụp trong các buổi sinh hoạt và lễ khai giảng. Quý phụ
        huynh cần ảnh gốc xin liên hệ văn phòng nhà trường trong giờ hành chính.
      </p>
      <div class="album">
        <figure>${photo(276, 'Bậc thang đá dài dẫn lên vùng sáng trắng', 640, 480)}
          <figcaption data-slot="gallery-caption" data-catch>Cầu thang khu B, sáng thứ Hai đầu tuần</figcaption></figure>
        <figure>${photo(331, 'Bóng một người đứng trước vách kính lớn của sảnh', 640, 480)}
          <figcaption data-slot="gallery-caption" data-catch>Hội trường trước giờ khai giảng</figcaption></figure>
        <figure>${photo(357, 'Cận cảnh mặt đồng hồ kim loại', 640, 480)}
          <figcaption data-slot="gallery-caption" data-catch>Đồng hồ sảnh chính, vừa thay pin tháng trước</figcaption></figure>
        <figure>${photo(252, 'Các ký hiệu vẽ kỹ thuật xếp thành hàng trên nền trắng', 640, 480)}
          <figcaption data-slot="gallery-caption" data-catch>Bảng ký hiệu môn Mĩ thuật do cô Hà vẽ lại</figcaption></figure>
      </div>
    </div>
  </main>
  ${side(false)}
</div>
${foot()}`
};

export const CH5_PAGES = [CH5_INDEX, CH5_GIOI_THIEU, CH5_THONG_BAO, CH5_THONG_BAO_13, CH5_HINH_ANH];
