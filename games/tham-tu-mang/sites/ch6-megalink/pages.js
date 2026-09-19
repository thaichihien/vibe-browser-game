/* MegaLink — Trạng thái hệ thống. Ba trang. Bản SẠCH: không có dị thường nào ở đây.

   KHÔNG CÓ MỘT TẤM ẢNH NÀO. Một bảng trạng thái dịch vụ thì không có ảnh, nên cả họ IMAGE
   không đặt chân vào được chương này — và đó là một lựa chọn về giọng điệu đúng bằng một lựa
   chọn về sự thật: sau năm chương toàn ảnh, trang cuối cùng không có gì để NHÌN cả. Chỉ còn
   chữ, màu, và chuyển động.

   VÌ SAO BA TRANG (spec §5.6 phác một trang). Một bảng trạng thái thật đúng là một trang —
   nhưng nó chưa bao giờ chỉ có một trang: bấm vào một sự cố là mở ra dòng thời gian đầy đủ
   của sự cố đó, và bên cạnh luôn có trang lịch sử liệt kê những lần hỏng trước. Quan trọng
   hơn, hai dị thường mạnh nhất của chương chỉ cắn được trên dòng thời gian ấy: T07 (mốc thời
   gian không thể tồn tại — "khắc phục lúc 03:04, bắt đầu lúc 03:12") và T08 (chữ ký của người
   không còn ở đó). Nhồi tất cả vào trang chủ thì bảng trạng thái thôi không còn giống bảng
   trạng thái nữa, và hai dị thường kia mất chỗ đứng.

   TRANG NÀY TỰ NÓ ĐÃ ĐỘNG ĐẬY. Con số độ trễ nhảy hai giây một lần, và đó là NGUỴ TRANG thật
   cho họ MOTION: ở năm chương trước, bất cứ thứ gì nhúc nhích đều đáng ngờ; ở đây thì không.

   Ô "tài khoản kỹ thuật đã thu hồi" ở trang lịch sử là NỘI DUNG SẠCH và không bao giờ được
   mang data-slot — nó là cây thước cho T08, giống ô tưởng niệm ở chương 2. */

/* Không có ảnh, nên không import img.js. Đây là module trang duy nhất trong cả trò chơi
   không chạm tới mạng. */

const slot = (on, name) => (on ? ` data-slot="${name}"` : '');

/* Thanh uptime 90 ngày. Là NỘI DUNG SẠCH và cố ý không phải chỗ bám: nó không có chữ để đọc,
   nên mọi dị thường dạng chữ đặt lên đây đều vô hình, mà một chỗ bám không đọc được thì chỉ
   có thể lấy máu của người chơi chứ không bao giờ thưởng. Vài ngày vàng rải rác là có thật —
   chúng khớp với các sự cố ở trang lịch sử. */
const bar = (dips) => {
  const cells = [];
  for (let d = 0; d < 90; d += 1) cells.push(`<i class="${dips.includes(d) ? 'dip' : ''}"></i>`);
  return `<span class="bar" aria-hidden="true">${cells.join('')}</span>`;
};

const SERVICES = [
  { name: 'Truyền dẫn quốc tế',              up: '99,94%', dips: [76, 77] },
  { name: 'Truyền dẫn trong nước',            up: '99,99%', dips: [] },
  { name: 'Phân giải tên miền (DNS)',         up: '99,88%', dips: [2, 3] },
  { name: 'Thư điện tử',                      up: '99,97%', dips: [41] },
  { name: 'Trung tâm dữ liệu Hà Nội',         up: '99,91%', dips: [18, 19] },
  { name: 'Trung tâm dữ liệu TP. Hồ Chí Minh', up: '100,00%', dips: [] },
  { name: 'Cổng thanh toán',                  up: '99,96%', dips: [11] },
  { name: 'API công khai',                    up: '99,93%', dips: [43, 44] }
];

/* Mỗi dòng dịch vụ mang ba cái móc mà R03 cần khi nó nhân bản một dòng: tên, chỉ số, và dòng
   trạng thái. Xem hợp đồng ở anomalies/reactive.js — dị thường dùng chung không biết gì về
   CSS của chương này, nó chỉ biết ba thuộc tính data-row-*. */
const svcRow = (s) => `
      <div class="svc" data-title="${s.name.toLowerCase()}">
        <span class="svc-name" data-row-title data-catch>${s.name}</span>
        ${bar(s.dips)}
        <span class="up" data-row-meta data-catch>${s.up}</span>
        <span class="badge ok" data-slot="tile" data-row-note data-catch>Hoạt động bình thường</span>
      </div>`;

const head = (findable) => `
<header class="bar-top">
  <span class="logo" data-catch><a href="#" data-goto="index">MegaLink</a><em>status</em></span>
  <form class="find"${slot(findable, 'search')} data-find data-catch>
    <input type="search" name="q" placeholder="Tìm dịch vụ…" aria-label="Tìm dịch vụ" data-catch>
    <button type="submit" data-catch>TÌM</button>
  </form>
  <nav data-slot="nav" data-catch>
    <a href="#" data-goto="index">Hiện tại</a>
    <a href="#" data-goto="lich-su">Lịch sử sự cố</a>
    <a href="#">Tài liệu API</a>
    <a href="#">Hỗ trợ</a>
  </nav>
</header>`;

const foot = () => `
<footer data-slot="footer" data-catch>
  <span>MegaLink JSC · Giấy phép ICP số 27/GP-BTTTT</span>
  <span>Trang trạng thái này được cập nhật tự động mỗi 60 giây</span>
</footer>`;

const INCIDENTS = [
  { id: '4471', date: '12/09/2026', title: 'Gián đoạn phân giải tên miền khu vực miền Bắc',
    state: 'Đã khắc phục', took: '2 giờ 28 phút', to: 'su-co-4471' },
  { id: '4468', date: '03/09/2026', title: 'Suy giảm hiệu năng cổng thanh toán',
    state: 'Đã khắc phục', took: '41 phút' },
  { id: '4465', date: '27/08/2026', title: 'Bảo trì theo kế hoạch — trung tâm dữ liệu Hà Nội',
    state: 'Hoàn tất', took: '3 giờ 00 phút' },
  { id: '4460', date: '14/08/2026', title: 'Mất kết nối truyền dẫn quốc tế hướng Hồng Kông',
    state: 'Đã khắc phục', took: '1 giờ 06 phút' },
  { id: '4457', date: '02/08/2026', title: 'Lỗi xác thực trên API công khai',
    state: 'Đã khắc phục', took: '18 phút' }
];

const incRow = (n) => `
        <li class="inc" data-slot="incident" data-catch>
          <span class="inc-when" data-slot="date" data-catch>${n.date}</span>
          <a class="inc-title" href="#" data-goto="${n.to ?? 'su-co-4471'}" data-catch>#${n.id} — ${n.title}</a>
          <span class="inc-state" data-catch>${n.state} · ${n.took}</span>
        </li>`;

export const CH6_INDEX = {
  id: 'index',
  css: 'site.css',

  /**
   * Cách trang CƯ XỬ khi chưa có dị thường nào.
   *
   * Hai việc, và cả hai đều phải thật. Con số độ trễ nhảy mỗi hai giây trong một khoảng hẹp:
   * nếu nó đứng im thì mọi chuyển động trên trang đều là dị thường, và người chơi không cần
   * đọc, chỉ cần thấy có gì đó nhúc nhích. Ô tìm kiếm lọc thật danh sách dịch vụ và tự khai
   * kết quả bằng sự kiện `site:filtered` — đó là hợp đồng R03 lắng nghe (xem chương 3).
   */
  behaviour(shadow) {
    const page = shadow.querySelector('[data-page="index"]');
    if (!page) return;

    /* Độ trễ: dao động quanh 41 ms. Không random hoàn toàn — một con số nhảy loạn đọc ra là
       hỏng; một con số rung nhẹ quanh một mức đọc ra là đang được đo thật. */
    const out = page.querySelector('[data-latency]');
    if (out) {
      let v = 41;
      setInterval(() => {
        /* Có dị thường ngồi trên con số này thì nhánh sạch ĐỨNG IM. Nếu không, T03 viết ra
           một câu rồi hai giây sau bộ đếm ghi đè lại, và cứ thế giằng nhau — người chơi đọc
           ra là trang hỏng chứ không phải là con số đang tụt khỏi việc là một con số. */
        if (out.dataset.anom) return;
        v = Math.min(47, Math.max(36, v + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.35 ? 2 : 1)));
        out.textContent = `${v} ms`;
      }, 2000);
    }

    const rows = [...page.querySelectorAll('.svc')];
    const empty = page.querySelector('[data-empty]');
    const countOut = page.querySelector('[data-result-count]');
    const searches = [...shadow.querySelectorAll('[data-find] input')];

    /* Bỏ dấu trước khi so — người Việt gõ "truyen dan" ra "truyền dẫn" là chuyện thường, và
       trạng thái RỖNG của ô tìm kiếm chính là cò súng của R03: nếu một câu tìm hợp lý cũng ra
       rỗng thì người chơi vấp phải dị thường chứ không phải nghĩ ra nó (xem chương 3). */
    const phang = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

    function apply() {
      const typed = searches.find((s) => s.value.trim());
      const q = phang((typed ? typed.value : '').trim());
      let shown = 0;
      for (const r of rows) {
        const ok = !q || phang(r.dataset.title).includes(q);
        r.style.display = ok ? '' : 'none';
        if (ok) shown += 1;
      }
      if (countOut) countOut.textContent = String(shown);
      if (empty) empty.hidden = shown > 0;
      page.dispatchEvent(new CustomEvent('site:filtered', { detail: { shown, query: q } }));
    }

    for (const s of searches) {
      s.addEventListener('input', apply);
      s.form.addEventListener('submit', apply);   // sealNavigation() đã chặn điều hướng
    }
    apply();
  },

  html: `
${head(true)}
<main class="shell">
  <section class="banner ok" data-catch>
    <h1 data-slot="hero-title" data-catch>Tất cả hệ thống hoạt động bình thường</h1>
    <p class="banner-sub" data-slot="notice" data-catch>Không ghi nhận sự cố nào đang diễn ra.</p>
    <p class="banner-when" data-catch>Cập nhật lần cuối:
      <span data-slot="date" data-catch>14/09/2026</span> lúc 09:41 (GMT+7)</p>
  </section>

  <section class="live">
    <div class="metric">
      <span class="metric-lbl" data-catch>Độ trễ trung bình</span>
      <b class="metric-val" data-slot="tile" data-latency data-catch>41 ms</b>
    </div>
    <p data-slot="paragraph" data-catch>
      Số đo lấy từ bốn điểm giám sát đặt tại Hà Nội, Đà Nẵng, TP. Hồ Chí Minh và Singapore,
      trung bình trượt trong 60 giây gần nhất.
    </p>
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2 data-catch>Trạng thái dịch vụ</h2>
      <span class="count" data-catch><b data-result-count>8</b> dịch vụ</span>
    </div>
    <p data-slot="paragraph" data-catch>
      Thanh bên phải mỗi dòng là 90 ngày gần nhất, mỗi vạch một ngày. Vạch vàng là ngày có
      suy giảm hiệu năng; mọi ngày như vậy đều có sự cố tương ứng trong lịch sử.
    </p>
    <div class="svc-list" data-grid>${SERVICES.map(svcRow).join('')}
    </div>
    <p class="empty" data-empty hidden data-catch>Không tìm thấy dịch vụ nào khớp.</p>
  </section>

  <section class="panel">
    <h2 data-catch>Sự cố gần đây</h2>
    <ul class="inc-list">${INCIDENTS.slice(0, 2).map(incRow).join('')}
    </ul>
    <p class="more"><a href="#" data-goto="lich-su" data-catch>Xem toàn bộ lịch sử sự cố →</a></p>
  </section>

  <section class="panel sub-box" data-slot="subscribe" data-catch>
    <h2 data-catch>Nhận thông báo sự cố</h2>
    <p class="sub-lead" data-slot="paragraph" data-catch>
      Chúng tôi gửi thư ngay khi một dịch vụ đổi trạng thái, và một thư tổng kết khi sự cố
      khép lại. Không quảng cáo, không chuyển cho bên thứ ba.
    </p>
    <form class="sub-form">
      <input type="email" placeholder="Địa chỉ email" aria-label="Địa chỉ email" required data-catch>
      <button type="submit" data-catch>ĐĂNG KÝ</button>
    </form>
    <p class="sub-note" data-slot="notice" data-catch>Huỷ đăng ký bất cứ lúc nào bằng liên kết ở cuối thư.</p>
  </section>
</main>
${foot()}`
};

export const CH6_LICH_SU = {
  id: 'lich-su',
  css: 'site.css',
  html: `
${head(false)}
<main class="shell">
  <section class="panel">
    <h2 data-catch>Lịch sử sự cố</h2>
    <p data-slot="paragraph" data-catch>
      Toàn bộ sự cố và lịch bảo trì trong 90 ngày gần nhất. Mỗi mục dẫn tới dòng thời gian
      đầy đủ của sự cố đó, kèm các bản cập nhật đã gửi cho khách hàng.
    </p>
    <ul class="inc-list full">${INCIDENTS.map(incRow).join('')}
    </ul>

    <h3 data-catch>Tổng hợp 90 ngày</h3>
    <!-- BẢNG NÀY PHẢI TỰ KHỚP TUYỆT ĐỐI, vì nó là chỗ bám của T10. Mỗi hàng: số phút gián
         đoạn chia cho tổng số phút của 90 ngày (129.600) ra đúng tỉ lệ uptime đã ghi, và cột
         số phút cộng lại đúng dòng tổng. T10 chỉ cần sửa một ô là cả hai cùng gãy — mà nếu
         bảng sạch đã tự mâu thuẫn thì T10 không còn gì để lệch khỏi. Sửa số ở đây thì phải
         tính lại cả hàng lẫn dòng tổng. -->
    <table class="tally" data-slot="table" data-catch>
      <tr><th data-catch>Nhóm dịch vụ</th><th data-catch>Số sự cố</th>
        <th data-catch>Phút gián đoạn</th><th data-catch>Tỉ lệ hoạt động</th></tr>
      <tr><td data-catch>Truyền dẫn</td><td data-catch>1</td>
        <td data-n data-catch>66</td><td data-catch>99,949%</td></tr>
      <tr><td data-catch>Tên miền</td><td data-catch>1</td>
        <td data-n data-catch>148</td><td data-catch>99,886%</td></tr>
      <tr><td data-catch>Trung tâm dữ liệu</td><td data-catch>1</td>
        <td data-n data-catch>180</td><td data-catch>99,861%</td></tr>
      <tr><td data-catch>Thanh toán</td><td data-catch>1</td>
        <td data-n data-catch>41</td><td data-catch>99,968%</td></tr>
      <tr><td data-catch>API</td><td data-catch>1</td>
        <td data-n data-catch>18</td><td data-catch>99,986%</td></tr>
      <tr class="sum"><td data-catch>Tổng cộng</td><td data-catch>5</td>
        <td data-sum data-catch>453</td><td data-catch>99,930%</td></tr>
    </table>
    <p class="tbl-note" data-slot="paragraph" data-catch>
      Tỉ lệ hoạt động tính trên 129.600 phút của 90 ngày. Thời gian bảo trì theo kế hoạch vẫn
      được tính là gián đoạn, theo đúng cam kết dịch vụ.
    </p>

    <!-- NỘI DUNG SẠCH, không bao giờ được mang data-slot: đây là cây thước của T08. Một bản
         cập nhật ký tên anh Hải trên sự cố tháng này chỉ có nghĩa vì chỗ này đã nói tài khoản
         của anh bị thu hồi từ 2024. Ở những ván không bốc trúng T08, đây chỉ là một dòng dọn
         dẹp nội bộ buồn tẻ. -->
    <aside class="notice-box" data-catch>
      <b data-catch>Ghi chú vận hành</b>
      <p data-catch>Tài khoản kỹ thuật của anh Trần Vũ Hải đã được thu hồi ngày 30/06/2024 sau
        khi anh chuyển công tác. Các bản cập nhật cũ mang tên anh được giữ nguyên để không phá
        vỡ liên kết trong thư đã gửi.</p>
    </aside>
  </section>
</main>
${foot()}`
};

export const CH6_SU_CO = {
  id: 'su-co-4471',
  css: 'site.css',
  html: `
${head(false)}
<main class="shell">
  <section class="panel doc">
    <span class="tag done" data-catch>ĐÃ KHẮC PHỤC</span>
    <h2 data-slot="notice" data-catch>#4471 — Gián đoạn phân giải tên miền khu vực miền Bắc</h2>
    <p class="doc-meta" data-catch>Bắt đầu
      <span data-slot="date" data-catch>12/09/2026</span> ·
      <span data-slot="hours" data-catch>03:12 – 05:40</span> · Ảnh hưởng: Phân giải tên miền
      (DNS), Thư điện tử</p>

    <p data-slot="paragraph" data-catch>
      Một phần cụm máy chủ tên miền tại Hà Nội trả về kết quả rỗng cho các truy vấn từ mạng
      di động. Khách hàng dùng máy chủ tên miền của MegaLink ở khu vực miền Bắc có thể không
      mở được website trong khoảng thời gian nêu trên.
    </p>

    <h3 data-catch>Dòng thời gian</h3>
    <ul class="timeline">
      <!-- Chỗ bám nằm trên CÂU CHỮ chứ không trên cả dòng <li>: T01, T02, T06 và S01 đều gán
           thẳng textContent cho chỗ bám, nên bám vào <li> là xoá sạch cả giờ lẫn tên người ký
           trong đó. Bốn câu liền nhau cũng là bề mặt lý tưởng cho T06 (rữa dần).
           Giờ trong dòng thời gian là giờ trần "03:12" — cố ý KHÔNG khai là chỗ bám date:
           kho chữ của T07 chia theo hình dạng, mà một giờ trần không khớp hình dạng nào, nên
           T07 rơi vào đó sẽ lặng lẽ không bám được vào đâu. Khoảng giờ ở dòng tóm tắt phía
           trên mới là chỗ của nó. -->
      <li data-catch>
        <span class="tl-when" data-catch>03:12</span>
        <span class="tl-what" data-slot="notice" data-catch>Hệ thống giám sát ghi nhận tỉ lệ truy vấn thất bại vượt ngưỡng.</span>
        <span class="tl-who" data-slot="byline" data-catch><span data-who>Nguyễn Đình Khoa</span></span>
      </li>
      <li data-catch>
        <span class="tl-when" data-catch>03:25</span>
        <span class="tl-what" data-slot="notice" data-catch>Đang điều tra. Đã chuyển tải sang cụm dự phòng tại Đà Nẵng.</span>
        <span class="tl-who" data-catch>Nguyễn Đình Khoa</span>
      </li>
      <li data-catch>
        <span class="tl-when" data-catch>04:02</span>
        <span class="tl-what" data-slot="notice" data-catch>Đã xác định nguyên nhân: một bản ghi vùng được nạp thiếu sau lần đồng bộ lúc nửa đêm.</span>
        <span class="tl-who" data-slot="byline" data-catch><span data-who>Lê Thanh Tú</span></span>
      </li>
      <li data-catch>
        <span class="tl-when" data-catch>05:40</span>
        <span class="tl-what" data-slot="notice" data-catch>Đã nạp lại bản ghi vùng và theo dõi thêm 30 phút. Dịch vụ trở lại bình thường.</span>
        <span class="tl-who" data-catch>Lê Thanh Tú</span>
      </li>
    </ul>

    <h3 data-catch>Việc chúng tôi sẽ làm</h3>
    <p data-slot="paragraph" data-catch>
      Bổ sung bước đối chiếu số bản ghi sau mỗi lần đồng bộ, và hạ ngưỡng cảnh báo của hệ
      thống giám sát xuống một nửa. Báo cáo đầy đủ sẽ được gửi cho khách hàng doanh nghiệp
      trong vòng năm ngày làm việc.
    </p>

    <p class="back"><a href="#" data-goto="lich-su" data-slot="cta" data-catch>← Quay lại lịch sử sự cố</a></p>
  </section>
</main>
${foot()}`
};

export const CH6_PAGES = [CH6_INDEX, CH6_LICH_SU, CH6_SU_CO];
