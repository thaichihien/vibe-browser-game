/* SănĐồCũ.vn — chợ đồ cũ, mười bốn trang. Bản SẠCH: không có dị thường nào ở đây.

   MƯỜI HAI TẤM ẢNH CỐ TÌNH KHÔNG ĂN NHẬP VỚI NHAU. Mỗi món do một người khác chụp, ánh sáng
   khác, nền khác, độ nét khác — đó đúng là cái mà một sàn đồ cũ thật trông như thế, và nó là
   lớp nguỵ trang tốt nhất trong cả trò chơi: ở một trang mà mọi tấm ảnh đều lệch nhau, một
   tấm ảnh sai sẽ không nhô ra nữa (spec §5.3).

   MỖI MÓN CÓ MỘT TRANG RIÊNG, không phải một trang dùng chung đổi nội dung. Bắt buộc phải thế:
   dị thường bám vào phần tử DOM có thật lúc ván bắt đầu, nên nếu một trang chi tiết bị ghi đè
   nội dung mỗi lần bấm sang món khác thì dị thường hoặc bị xoá, hoặc còn lại trên một món
   không phải món của nó. Nội dung tĩnh từ đầu là điều kiện để dị thường sống được.

   Mười hai trang đó khai `optional: true` (xem ch3-san-do-cu.js): chúng vẫn nhận dị thường
   bình thường, chỉ là không được BẢO ĐẢM có — 6–8 dị thường không rải nổi cho mười bốn trang,
   và một sàn mà món nào cũng có gì đó sai thì không còn là một cái sàn nữa.

   GIỎ HÀNG LÀ TRẠNG THÁI THẬT, ĐI XUYÊN TRANG. Bấm "bỏ vào giỏ" ở bất kỳ trang món nào thì
   trang giỏ phải có thêm một dòng, con số trên mọi thanh điều hướng phải đổi, và tạm tính
   phải cộng lại. Không có phần đó thì R02 chẳng có gì để nấp: nếu giỏ vốn không bao giờ đổi
   thì bất cứ thay đổi nào cũng là dị thường. */

import { picsum, portrait, imgHtml } from '../../js/engine/img.js';

const TINT = '#c9c2b6';

const photo = (id, alt, w, h) =>
  imgHtml({ src: picsum({ w, h, id }), alt, w, h, tint: TINT });

const face = (set, n, alt) =>
  imgHtml({ src: portrait({ set, n }), alt, w: 128, h: 128, tint: TINT, cls: 'face' });

/* Mười hai món. `cap` là chú thích viết THEO tấm ảnh — ảnh chọn trước, chữ viết sau.
   `cat` dùng cho bộ lọc; `q` là các câu hỏi cho trang chi tiết. */
export const GOODS = [
  { key: 'may-anh', img: 250, cat: 'Điện tử',
    title: 'Máy ảnh phim Canon AE-1, còn hộp', price: 2400000,
    cap: 'Thân máy và ống kính, chụp trong nhà',
    cond: 'Đã dùng · còn tốt', area: 'Q. Bình Thạnh', date: '12/03/2026',
    seller: { name: 'Dũng', set: 'men', n: 26, since: 2019, rate: 148 },
    desc: ['Máy của ba tôi để lại, còn hộp giấy và dây đeo gốc. Màn trập êm, đo sáng còn ăn. Ống kính 50mm f1.8 có vài bụi nhỏ bên trong, chụp không ảnh hưởng.',
           'Ưu tiên xem hàng trực tiếp ở Bình Thạnh. Không giao dịch qua trung gian, không giữ hàng nếu chưa cọc.'],
    q: [{ who: 'Hồng Nhung', set: 'women', n: 48, when: '2 ngày trước', ask: 'Máy còn dùng pin loại gì vậy anh? Em sợ khó kiếm.', ans: 'Pin LR44, ngoài tiệm ảnh nào cũng có bạn nhé.' },
        { who: 'Lê Vĩnh', set: 'men', n: 49, when: '5 ngày trước', ask: 'Hộp giấy còn nguyên tem không anh?', ans: 'Tem bong một góc, còn lại nguyên.' }] },

  { key: 'may-danh-chu', img: 486, cat: 'Đồ sưu tầm',
    title: 'Máy đánh chữ Olympia, gõ còn tốt', price: 1850000,
    cap: 'Máy đánh chữ đen, nền trắng',
    cond: 'Đã dùng · gõ còn tốt', area: 'Q.3', date: '09/03/2026',
    seller: { name: 'Trâm', set: 'women', n: 44, since: 2021, rate: 41 },
    desc: ['Máy của cô tôi để lại. Vành phím còn đủ, ruy băng mới thay năm ngoái nên chữ còn đậm. Vỏ có vài vết xước ở cạnh dưới, không ảnh hưởng gì tới việc gõ.',
           'Nặng khoảng sáu ký nên tôi không ship, bạn tới lấy giúp mình.'],
    q: [{ who: 'Quốc Bảo', set: 'men', n: 4, when: '4 ngày trước', ask: 'Còn ruy băng thay thế không chị?', ans: 'Mình còn một cuộn chưa mở, tặng kèm luôn.' }] },

  { key: 'dong-ho', img: 175, cat: 'Gia dụng',
    title: 'Đồng hồ treo tường mặt lớn', price: 320000,
    cap: 'Mặt số lớn, kim đen',
    cond: 'Đã dùng · chạy đúng', area: 'Q. Tân Bình', date: '07/03/2026',
    seller: { name: 'Khoa', set: 'men', n: 49, since: 2020, rate: 63 },
    desc: ['Treo phòng khách nhà mình bốn năm, chạy đúng giờ, không kêu tích tắc to. Đổi nội thất nên thanh lý.',
           'Đã thay pin mới. Mặt kính không nứt, viền nhựa có ố nhẹ ở phía sau.'],
    q: [{ who: 'Mai Anh', set: 'women', n: 35, when: '6 ngày trước', ask: 'Đường kính bao nhiêu vậy bạn?', ans: 'Khoảng 30cm bạn nhé.' }] },

  { key: 'xe-ba-banh', img: 146, cat: 'Đồ chơi',
    title: 'Xe ba bánh trẻ em, sơn còn nguyên', price: 450000,
    cap: 'Xe ba bánh đỏ dựng cạnh tường',
    cond: 'Đã dùng · sơn còn nguyên', area: 'Q. Gò Vấp', date: '05/03/2026',
    seller: { name: 'Nga', set: 'women', n: 2, since: 2022, rate: 27 },
    desc: ['Con mình lớn rồi nên để lại. Xe còn chắc, bánh không rơ, sơn gần như chưa tróc chỗ nào.',
           'Có thể gấp gọn bỏ cốp xe hơi. Mình ở Gò Vấp, ship nội thành được.'],
    q: [{ who: 'Thu Trang', set: 'women', n: 8, when: '1 tuần trước', ask: 'Bé mấy tuổi đạp vừa vậy chị?', ans: 'Nhà mình cho bé từ hai tuổi rưỡi là đạp được rồi.' }] },

  { key: 'ghe-cam', img: 534, cat: 'Đồ gỗ',
    title: 'Ghế gỗ bọc nỉ cam', price: 780000,
    cap: 'Ghế cam bên bàn gỗ sáng',
    cond: 'Đã dùng · nỉ còn sạch', area: 'Q.7', date: '04/03/2026',
    seller: { name: 'Bình', set: 'men', n: 4, since: 2018, rate: 210 },
    desc: ['Ghế mua ở cửa hàng nội thất Bắc Âu, dùng hai năm ở bàn làm việc. Chân gỗ còn chắc, nỉ không rách, có một vết mờ ở mép trái.',
           'Bán vì đổi sang ghế công thái học. Bạn tới xem thoải mái.'],
    q: [{ who: 'Diễm My', set: 'women', n: 27, when: '3 ngày trước', ask: 'Chiều cao mặt ngồi bao nhiêu ạ?', ans: 'Khoảng 45cm, ngồi bàn cao 75cm là vừa.' }] },

  { key: 'loa-ban', img: 529, cat: 'Điện tử',
    title: 'Loa bàn, bán một chiếc', price: 690000,
    cap: 'Loa tròn đặt trên bàn làm việc',
    cond: 'Đã dùng · tiếng còn trong', area: 'Q. Phú Nhuận', date: '02/03/2026',
    seller: { name: 'Dũng', set: 'men', n: 26, since: 2019, rate: 148 },
    desc: ['Bán lẻ một chiếc vì chiếc còn lại đã hỏng màng. Chiếc này tiếng còn trong, không rè ở âm lượng vừa.',
           'Có dây nguồn, không còn hộp. Nghe thử tại nhà mình được.'],
    q: [{ who: 'Hải Đăng', set: 'men', n: 36, when: '5 ngày trước', ask: 'Loa này công suất bao nhiêu vậy anh?', ans: 'Ghi trên đế là 15W, mình chưa đo lại.' }] },

  { key: 'sach-cu', img: 24, cat: 'Sách',
    title: 'Sách cũ, bản in 1998', price: 90000,
    cap: 'Sách mở, giấy đã ngả vàng',
    cond: 'Đã dùng · giấy ngả vàng', area: 'Q.1', date: '01/03/2026',
    seller: { name: 'Trâm', set: 'women', n: 44, since: 2021, rate: 41 },
    desc: ['Bản in 1998, giấy đã ngả vàng đều, gáy còn chắc, không mất trang nào. Có ghi chú bút chì ở vài trang đầu, tẩy được.',
           'Bán kèm bao sách nilon cũ nếu bạn cần.'],
    q: [{ who: 'Nhật Minh', set: 'men', n: 49, when: '1 tuần trước', ask: 'Có bị ẩm mốc gì không chị?', ans: 'Không bạn, mình để tủ kính nên giấy khô ráo.' }] },

  { key: 'den-ban', img: 157, cat: 'Gia dụng',
    title: 'Đèn bàn kim loại, cần gập', price: 540000,
    cap: 'Đèn bàn kim loại, nền trắng',
    cond: 'Đã dùng · còn sáng tốt', area: 'Q. Gò Vấp', date: '27/02/2026',
    seller: { name: 'Hạnh', set: 'women', n: 17, since: 2017, rate: 92 },
    desc: ['Đèn cần gập bằng kim loại, khớp còn chặt, giữ nguyên vị trí khi gập. Dùng bóng đui E27 thường.',
           'Sơn có tróc nhẹ ở khớp giữa. Mình để ở Gò Vấp, bạn qua lấy giúp.'],
    q: [{ who: 'Phương Uyên', set: 'women', n: 48, when: '2 tuần trước', ask: 'Chị còn giữ bóng kèm theo không?', ans: 'Còn một bóng led 9W, mình tặng luôn.' }] },

  { key: 'ca-men', img: 30, cat: 'Gia dụng',
    title: 'Ca men tráng sứ, có sứt một chỗ', price: 60000,
    cap: 'Ca men in chữ, đặt ngoài nắng',
    cond: 'Đã dùng · sứt một chỗ', area: 'Q. Bình Thạnh', date: '25/02/2026',
    seller: { name: 'Nga', set: 'women', n: 2, since: 2022, rate: 27 },
    desc: ['Ca men cũ, in chữ còn rõ. Có một chỗ sứt bằng đầu đũa ở miệng ca, không sắc, vẫn uống bình thường.',
           'Hợp để cắm bút hoặc trồng cây nhỏ hơn là uống nước.'],
    q: [{ who: 'Tuấn Kiệt', set: 'men', n: 4, when: '2 tuần trước', ask: 'Dung tích chừng bao nhiêu ml vậy chị?', ans: 'Khoảng 350ml bạn nhé.' }] },

  { key: 'but-chi-mau', img: 533, cat: 'Đồ chơi',
    title: 'Bộ bút chì màu, thiếu hai cây', price: 110000,
    cap: 'Bút chì màu xếp thành hàng',
    cond: 'Đã dùng · thiếu hai cây', area: 'Q. Tân Phú', date: '22/02/2026',
    seller: { name: 'Khoa', set: 'men', n: 49, since: 2020, rate: 63 },
    desc: ['Bộ 36 cây, còn 34. Các cây còn lại đều dài trên hai phần ba, ruột không gãy.',
           'Hộp thiếc còn nguyên nắp, có móp nhẹ ở góc.'],
    q: [{ who: 'Bảo Ngân', set: 'women', n: 35, when: '3 tuần trước', ask: 'Thiếu hai màu nào vậy bạn?', ans: 'Thiếu trắng và vàng nhạt.' }] },

  { key: 'bo-dung-cu', img: 491, cat: 'Dụng cụ',
    title: 'Bộ dụng cụ cầm tay', price: 850000,
    cap: 'Kìm, búa và tua vít bày trên gỗ',
    cond: 'Đã dùng · đủ món', area: 'Q.12', date: '20/02/2026',
    seller: { name: 'Bình', set: 'men', n: 4, since: 2018, rate: 210 },
    desc: ['Gồm búa, hai kìm, bộ tua vít sáu cây và thước dây. Thép còn sáng, không rỉ, tay cầm không nứt.',
           'Dọn xưởng nên bán cả bộ, không tách lẻ.'],
    q: [{ who: 'Hữu Phước', set: 'men', n: 36, when: '3 tuần trước', ask: 'Có bán riêng bộ tua vít không anh?', ans: 'Mình bán nguyên bộ thôi bạn.' }] },

  { key: 'khung-anh', img: 834, cat: 'Đồ gỗ',
    title: 'Ba khung ảnh gỗ cỡ A4', price: 240000,
    cap: 'Ba khung ảnh treo trên tường sáng',
    cond: 'Đã dùng · kính còn nguyên', area: 'Q.2', date: '18/02/2026',
    seller: { name: 'Hạnh', set: 'women', n: 17, since: 2017, rate: 92 },
    desc: ['Ba khung gỗ sồi cỡ A4, kính còn nguyên, có đủ móc treo phía sau. Bán cả ba, không tách lẻ.',
           'Gỗ có vân đẹp, một khung xước nhẹ ở cạnh dưới.'],
    q: [{ who: 'Lan Chi', set: 'women', n: 44, when: '1 tháng trước', ask: 'Khung treo dọc hay ngang được cả chứ ạ?', ans: 'Cả hai bạn nhé, móc sau xoay được.' }] }
];

export const CATEGORIES = [...new Set(GOODS.map((g) => g.cat))].sort();

const money = (n) => `${n.toLocaleString('vi-VN')}₫`;

/* `slot` phát ra data-slot hay không tuỳ trang: markup của mười hai trang món là như nhau,
   nhưng chỉ trang đầu khai đủ slot. Nếu cả mười hai cùng khai thì kho slot của các trang chi
   tiết áp đảo trang danh sách, và gần như mọi dị thường sẽ nằm sau một cú bấm. */
const slot = (on, name) => (on ? ` data-slot="${name}"` : '');

const nav = (rich) => `
<header class="bar">
  <span class="brand" data-catch><a href="#" data-goto="listing">SănĐồCũ<span class="dot">.vn</span></a></span>
  <form class="find" data-find>
    <input type="search" name="q" placeholder="Tìm món bạn cần…" aria-label="Tìm kiếm" data-catch>
    <button type="submit" data-catch>TÌM</button>
  </form>
  <nav${slot(rich, 'nav')} data-catch>
    <a href="#" data-goto="listing">ĐANG BÁN</a><a href="#">NGƯỜI BÁN</a><a href="#">TRỢ GIÚP</a>
  </nav>
  <a class="cart-link" href="#" data-goto="cart" data-catch>GIỎ HÀNG (<b data-cart-count>1</b>)</a>
</header>`;

const foot = (rich) => `
<footer${slot(rich, 'footer')} data-catch>
  <span>SănĐồCũ.vn — sàn rao vặt đồ đã qua sử dụng</span>
  <span>Người bán tự chịu trách nhiệm về món hàng</span>
</footer>`;

const card = (g) => `
    <article class="good" data-title="${g.title.toLowerCase()}" data-cat="${g.cat}" data-price="${g.price}">
      <figure>
        ${photo(g.img, g.cap, 560, 560)}
        <figcaption data-slot="photo" data-catch>${g.cap}</figcaption>
      </figure>
      <h3><a href="#" data-goto="${g.key}" data-slot="product-title" data-catch>${g.title}</a></h3>
      <span class="price" data-slot="price" data-catch>${money(g.price)}</span>
      <span class="sub" data-catch>${g.cond} · ${g.area}</span>
    </article>`;

const qaRow = (q, rich) => `
      <li class="qa-row"${slot(rich, 'comment')} data-catch>
        <figure class="qa-face">
          ${face(q.set, q.n, 'Ảnh người hỏi')}
          <figcaption${slot(rich, 'avatar')} data-catch><b data-who>${q.who}</b>
            <span class="when" data-when>${q.when}</span></figcaption>
        </figure>
        <div class="qa-body">
          <p data-catch>${q.ask}</p>
          <p class="ans" data-catch><b>Trả lời:</b> ${q.ans}</p>
        </div>
      </li>`;

/**
 * Đếm lại số món và cộng lại tạm tính từ CHÍNH các dòng đang có trong giỏ.
 *
 * Không làm bước này thì giỏ ba dòng mà tạm tính vẫn là giá của một dòng, và người chơi đọc
 * ra là trang web cộng sai — tức là một cái LỖI, thứ mà người ta bỏ qua. Dị thường mạnh hơn
 * nhiều khi mọi con số đều khớp: không có gì hỏng cả, chỉ là trong giỏ có một món bạn chưa
 * từng bấm vào. (R02 gọi lại phần đếm này sau khi chèn dòng của nó — xem reactive.js.)
 */
export function retotal(shadow) {
  const cart = shadow.querySelector('[data-cart]');
  const out = shadow.querySelector('[data-cart-total]');
  if (!cart) return;

  const lines = [...cart.querySelectorAll('li')];
  const sum = lines.reduce((n, li) => {
    const raw = li.querySelector('[data-line-price]')?.textContent ?? '';
    return n + Number(raw.replace(/\D/g, '') || 0);
  }, 0);

  if (out) out.textContent = `${sum.toLocaleString('vi-VN')}₫`;
  for (const n of shadow.querySelectorAll('[data-cart-count]')) {
    n.textContent = String(lines.length);
  }
}

/**
 * Bỏ vào giỏ thì giỏ phải đổi — dòng mới ở trang giỏ, con số trên MỌI thanh điều hướng, và
 * tạm tính cộng lại. Đây là nhánh SẠCH; R02 cũng nghe đúng cái nút này và thêm dòng thứ hai
 * của riêng nó. Hai bên không tranh nhau vì chúng thêm hai dòng khác nhau — dị thường chính
 * là cái dòng thừa kia, chứ không phải việc có gì đó xảy ra.
 */
function addToCart(g) {
  return function behaviour(shadow) {
    const page = shadow.querySelector(`[data-page="${g.key}"]`);
    const button = page?.querySelector('[data-add-to-cart]');
    const cart = shadow.querySelector('[data-cart]');
    if (!button || !cart) return;

    let added = false;
    button.addEventListener('click', () => {
      if (added) return;
      added = true;

      const model = cart.querySelector('[data-slot="cart-line"]') ?? cart.firstElementChild;
      const line = model.cloneNode(true);
      line.removeAttribute('data-slot');
      line.querySelector('[data-line-title]').textContent = g.title;
      line.querySelector('[data-line-price]').textContent = money(g.price);
      line.querySelector('[data-line-note]').textContent = `Người bán: ${g.seller.name} · ${g.area}`;
      cart.appendChild(line);

      button.textContent = 'ĐÃ Ở TRONG GIỎ';
      button.disabled = true;
      retotal(shadow);
    });
  };
}

/**
 * Một trang món hàng. Markup giống hệt nhau cho cả mười hai; chỉ `rich` quyết định trang nào
 * khai thêm slot (xem ghi chú ở `slot`).
 */
const productPage = (g, rich = false) => ({
  id: g.key,
  css: 'site.css',
  behaviour: addToCart(g),
  html: `
${nav(rich)}
<main class="shell single">
  <a class="back" href="#" data-goto="listing" data-catch>← Về danh sách</a>

  <div class="detail">
    <figure class="shot">
      ${photo(g.img, g.cap, 900, 900)}
      <figcaption data-slot="photo" data-catch>${g.cap}</figcaption>
    </figure>

    <div class="detail-copy">
      <h1 data-slot="product-title" data-catch>${g.title}</h1>
      <span class="price big" data-slot="price" data-catch>${money(g.price)}</span>
      <span class="meta"${slot(rich, 'date')} data-catch>Đăng ngày ${g.date} · ${g.area} · ${g.cond}</span>

      <p data-slot="paragraph" data-catch>${g.desc[0]}</p>
      <p${slot(rich, 'paragraph')} data-catch>${g.desc[1]}</p>

      <button class="buy" data-slot="cta" data-catch data-add-to-cart>BỎ VÀO GIỎ</button>

      <figure class="seller" data-catch>
        ${face(g.seller.set, g.seller.n, 'Ảnh người bán')}
        <figcaption${slot(rich, 'avatar')} data-catch><b>${g.seller.name}</b><br>
          <span data-catch>${g.area} · bán từ ${g.seller.since} · ${g.seller.rate} đánh giá</span></figcaption>
      </figure>
    </div>
  </div>

  <section class="qa">
    <h2 data-catch>Hỏi người bán</h2>
    <ul class="qa-list">${g.q.map((q) => qaRow(q, rich)).join('')}
    </ul>
  </section>
</main>
${foot(rich)}`
});

export const CH3_LISTING = {
  id: 'listing',
  css: 'site.css',

  /**
   * Tìm kiếm và bộ lọc, hoạt động thật.
   *
   * Cả hai chỉ ẨN/HIỆN thẻ hàng chứ không bao giờ VIẾT LẠI nội dung của chúng — viết lại thì
   * dị thường đang bám trên một thẻ sẽ bị xoá mất. Thẻ bị ẩn cũng thôi không còn là mục tiêu
   * khoanh được (targets() lọc theo checkVisibility), nên lọc đi rồi bỏ lọc là an toàn: dị
   * thường quay lại đúng chỗ cũ. Đây là thao tác ở CHẾ ĐỘ ĐỌC nên không bao giờ mất máu.
   */
  behaviour(shadow) {
    const page = shadow.querySelector('[data-page="listing"]');
    if (!page) return;

    const cards = [...page.querySelectorAll('.good')];
    const boxes = [...page.querySelectorAll('[data-cat-filter]')];
    const maxPrice = page.querySelector('[data-price-filter]');
    const priceOut = page.querySelector('[data-price-out]');
    const countOut = page.querySelector('[data-result-count]');
    const empty = page.querySelector('[data-empty]');
    const reset = page.querySelector('[data-reset]');
    // Thanh tìm kiếm có ở mọi trang, và tất cả đều lọc cái lưới duy nhất ở trang danh sách.
    const searches = [...shadow.querySelectorAll('[data-find] input')];

    const vnd = (n) => `${Number(n).toLocaleString('vi-VN')}₫`;

    function apply() {
      const typed = searches.find((s) => s.value.trim());
      const q = (typed ? typed.value : '').trim().toLowerCase();
      const cats = boxes.filter((b) => b.checked).map((b) => b.value);
      const cap = Number(maxPrice.value);
      let shown = 0;

      for (const c of cards) {
        const okText = !q || c.dataset.title.includes(q);
        const okCat = !cats.length || cats.includes(c.dataset.cat);
        const okPrice = Number(c.dataset.price) <= cap;
        const show = okText && okCat && okPrice;
        c.style.display = show ? '' : 'none';
        if (show) shown += 1;
      }

      if (priceOut) priceOut.textContent = vnd(cap);
      if (countOut) countOut.textContent = String(shown);
      if (empty) empty.hidden = shown > 0;
    }

    for (const b of boxes) b.addEventListener('change', apply);
    maxPrice.addEventListener('input', apply);
    for (const s of searches) {
      s.addEventListener('input', apply);
      // sealNavigation() đã chặn điều hướng; ở đây chỉ cần lọc lại.
      s.form.addEventListener('submit', apply);
    }
    if (reset) {
      reset.addEventListener('click', () => {
        for (const b of boxes) b.checked = false;
        maxPrice.value = maxPrice.max;
        for (const s of searches) s.value = '';
        apply();
      });
    }

    apply();
  },

  html: `
${nav(true)}
<main class="shell">
  <h1 data-catch>Đồ cũ đang bán gần bạn</h1>
  <p class="lead" data-slot="paragraph" data-catch>
    Hơn bốn nghìn món đang được rao. Ảnh do chính người bán chụp, nên chất lượng mỗi nơi một
    khác. Xem kỹ ảnh và hỏi người bán trước khi chuyển tiền.
  </p>

  <div class="board">
    <div>
      <p class="count" data-catch><b data-result-count>12</b> món đang hiển thị</p>
      <div class="grid">${GOODS.map(card).join('')}
      </div>
      <p class="empty" data-empty hidden data-catch>Không có món nào khớp với bộ lọc.</p>
    </div>

    <aside class="filters" data-catch>
      <h2 data-catch>Lọc kết quả</h2>

      <fieldset>
        <legend data-catch>Loại hàng</legend>${CATEGORIES.map((c) => `
        <label data-catch><input type="checkbox" value="${c}" data-cat-filter> ${c}</label>`).join('')}
      </fieldset>

      <fieldset>
        <legend data-catch>Giá tối đa</legend>
        <input type="range" min="60000" max="2400000" step="10000" value="2400000"
               aria-label="Giá tối đa" data-price-filter data-catch>
        <span class="price-out" data-price-out data-catch>2.400.000₫</span>
      </fieldset>

      <button type="button" class="reset" data-reset data-catch>XOÁ BỘ LỌC</button>
    </aside>
  </div>
</main>
${foot(true)}`
};

export const CH3_CART = {
  id: 'cart',
  css: 'site.css',

  behaviour(shadow) {
    const form = shadow.querySelector('[data-page="cart"] .ship form');
    if (!form) return;
    const addr = form.querySelector('[data-ship-address]');
    const VI = 'Bạn chưa điền địa chỉ nhận hàng.';
    addr.addEventListener('invalid', () => {
      addr.setCustomValidity('');
      if (addr.validity.valueMissing) addr.setCustomValidity(VI);
    });
    addr.addEventListener('input', () => addr.setCustomValidity(''));

    form.addEventListener('submit', () => {
      if (!addr.value.trim()) return;
      const note = form.parentElement.querySelector('[data-ship-ok]');
      note.textContent = 'Đã lưu địa chỉ. Người bán sẽ liên hệ trong 24 giờ.';
      note.hidden = false;
    });
  },

  html: `
${nav(true)}
<main class="shell single">
  <a class="back" href="#" data-goto="listing" data-catch>← Tiếp tục xem hàng</a>
  <h1 data-catch>Giỏ hàng</h1>
  <p class="lead" data-slot="paragraph" data-catch>
    Mỗi món trong giỏ là một giao dịch riêng với một người bán riêng. Chúng tôi không giữ
    tiền hộ, và không hoàn tiền thay người bán.
  </p>

  <ul class="cart" data-cart>
    <li data-slot="cart-line" data-catch>
      <span class="line-t" data-line-title>Đèn bàn kim loại, cần gập</span>
      <span class="line-n" data-line-note>Người bán: Hạnh · Q. Gò Vấp</span>
      <span class="line-p" data-line-price>540.000₫</span>
    </li>
  </ul>

  <p class="gone" data-catch>
    Tài khoản của <b>Hạnh</b> đã ngừng hoạt động từ tháng 02/2024. Món vẫn được giữ trong giỏ
    cho tới khi bạn gỡ ra.
  </p>

  <div class="total">
    <span data-catch>Tạm tính</span>
    <span class="price" data-slot="price" data-catch data-cart-total>540.000₫</span>
  </div>

  <section class="ship" data-slot="shipping-form" data-catch>
    <h2 data-catch>Địa chỉ nhận hàng</h2>
    <form>
      <input type="text" name="ten" placeholder="Họ và tên" aria-label="Họ và tên" data-catch>
      <input type="text" name="diachi" placeholder="Địa chỉ nhận hàng" aria-label="Địa chỉ nhận hàng"
             required data-ship-address data-catch>
      <input type="text" name="dienthoai" placeholder="Số điện thoại" aria-label="Số điện thoại" data-catch>
      <button type="submit" data-catch>LƯU ĐỊA CHỈ</button>
    </form>
    <p class="ship-ok" data-ship-ok hidden data-catch></p>
  </section>

  <button class="buy ghost" data-slot="cta" data-catch>TIẾN HÀNH ĐẶT MUA</button>
</main>
${foot(true)}`
};

/* Trang món đầu tiên khai đủ slot; mười một trang còn lại khai tối thiểu. */
export const CH3_PRODUCT_PAGES = GOODS.map((g, i) => productPage(g, i === 0));

export const CH3_PAGES = [CH3_LISTING, ...CH3_PRODUCT_PAGES, CH3_CART];
