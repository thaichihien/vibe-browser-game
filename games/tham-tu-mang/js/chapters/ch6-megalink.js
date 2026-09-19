/* Chương 6 — MegaLink, bảng trạng thái hệ thống. Ba trang. Chương kết. Spec §5.6.

   KHÔNG MỘT TẤM ẢNH NÀO, nên cả họ IMAGE không đặt chân vào được — và đó là một lựa chọn về
   giọng điệu đúng bằng một lựa chọn về sự thật. Sau năm chương toàn ảnh, trang cuối cùng
   không có gì để nhìn: chỉ còn chữ, màu và chuyển động.

   ĐÂY LÀ CHƯƠNG CHẬT NHẤT TRONG CẢ TRÒ CHƠI, và con số đó cần được nói thẳng ra: năm họ
   (thiếu IMAGE) nhân trần "≤2 mỗi họ" là sức chứa đúng 10, bằng đúng khoảng bốc tối đa. Một
   ván bốc ra 10 thì BẮT BUỘC phải lấy đủ 2 từ cả năm họ, không còn một chỗ xoay nào. Nó chạy
   được — nhưng bất kỳ thay đổi nào sau này làm hụt một họ ở đây sẽ vỡ trước tiên, và bộ test
   canh đúng chỗ đó.

   Vì sự chật ấy mà M05 (trang tự cuộn ngược) được dựng cùng chương này: không có nó, họ MOTION
   ở đây chỉ còn đúng M01 và M03 — vừa khít trần, không dư một cái nào.

   TRANG NÀY TỰ NÓ ĐÃ ĐỘNG ĐẬY: con số độ trễ nhảy hai giây một lần. Đó là nguỵ trang THẬT cho
   họ MOTION — ở năm chương trước, cái gì nhúc nhích cũng đáng ngờ; ở đây thì không.

   Ô "tài khoản kỹ thuật đã thu hồi" ở trang lịch sử là NỘI DUNG SẠCH và không bao giờ được
   mang data-slot: nó là cây thước cho T08. */

export const CH6 = {
  id: 'ch6-megalink',
  title: 'MEGALINK',
  slug: 'ch6-megalink',
  subtitle: 'Bảng trạng thái hệ thống · ba trang',
  briefing: 'Bảng trạng thái dịch vụ của một nhà cung cấp hạ tầng mạng.',
  min: 8,
  max: 10,
  /* M07 (rê chuột qua thì đổi cỡ) chỉ dành cho chương 3, 4 và 5 — xem ghi chú ở
     anomalies/motion.js. Chương này khai nó trong exclude để đạo diễn không bao giờ mời. */
  exclude: ['M06', 'M07'],
  force: [],

  pages: [
    {
      id: 'index',
      slots: {
        nav: 1, search: 1, 'hero-title': 1, notice: 2, date: 3,
        tile: 9, paragraph: 3, incident: 2, subscribe: 1, footer: 1
      }
    },
    {
      id: 'lich-su',
      slots: { nav: 1, paragraph: 2, incident: 5, date: 5, table: 1, footer: 1 }
    },
    {
      id: 'su-co-4471',
      slots: {
        nav: 1, notice: 5, date: 1, hours: 1, paragraph: 2,
        byline: 2, cta: 1, footer: 1
      }
    }
  ],

  flavour: {
    /* T01 — một câu bị thay bằng một câu khác, cùng giọng kỹ thuật, cùng nhịp. Giọng của
       chương này là giọng của một đội vận hành viết báo cáo: bình thản, chính xác, và hoàn
       toàn không thấy có gì bất thường trong điều mình vừa viết ra. */
    T01: [
      'Hệ thống giám sát chạy tự động, không cần người trực. Ca trực đêm đã ngừng từ tháng 4 và số liệu vẫn tiếp tục được gửi về.',
      'Toàn bộ lưu lượng đi qua bốn điểm giám sát. Điểm thứ năm không nằm trong tài liệu nào của chúng tôi, và nó cũng đang gửi số liệu về.',
      'Chúng tôi cam kết công bố mọi sự cố trong vòng 15 phút. Có những sự cố được công bố trước khi chúng xảy ra.'
    ],

    // T02 — viết lại khi cuộn ngược. Bản sau PHẢI dài hơn hẳn và đổi giọng (spec §6 T02).
    T02: [
      {
        before: 'Không ghi nhận sự cố nào đang diễn ra.',
        after: 'Không ghi nhận sự cố nào đang diễn ra. Từ 03:00 sáng nay hệ thống giám sát không còn ghi nhận được gì nữa, nên về mặt kỹ thuật câu trên vẫn đúng.'
      },
      {
        before: 'Trang trạng thái này được cập nhật tự động mỗi 60 giây.',
        after: 'Trang trạng thái này được cập nhật tự động mỗi 60 giây. Lần cập nhật thủ công gần nhất là tháng 2 năm 2024. Chúng tôi không rõ ai đã đặt lịch cho nó chạy tiếp.'
      }
    ],

    /* T03 — con số tụt dần rồi thôi không còn là một con số nữa. Chỗ đắt nhất của nó trong cả
       trò chơi: ô độ trễ vốn đã nhảy sẵn hai giây một lần, nên một con số đang tụt không nhô
       ra khỏi nền động ấy — người chơi phải ĐỌC mới thấy nó tụt đi đâu. */
    T03: [
      { text: 'Độ trễ trung bình: {n} ms', start: 41 },
      { text: 'Số phiên đang kết nối tới cụm Hà Nội: {n}', start: 412 },
      { text: 'Số điểm giám sát đang phản hồi: {n}', start: 4 }
    ],

    // T06 — dòng thời gian sự cố rữa dần: mục đầu tiếng Việt hoàn hảo, mục cuối trơ phụ âm.
    T06: [{ span: 4 }, { span: 3 }],

    /* T07 — một mốc thời gian không thể tồn tại. Hai hình dạng trên trang này: ngày sự cố
       (dd/mm/yyyy) và khoảng giờ của sự cố (HH:MM – HH:MM). Chỉ vế SAU của khoảng giờ bị
       thay, nên dòng đọc ra là "bắt đầu 03:12, khắc phục xong lúc 03:04" — một sự cố kết thúc
       trước khi nó bắt đầu, đúng ví dụ spec §6 T07 dành cho chương này. */
    T07: {
      time: ['03:04', '02:59', '25:40', '05:-40', '03:12'],
      date: ['31/02/2026', '00/00/0000', '12/09/2027', '32/13/2026']
    },

    /* T08 — chữ ký của người không còn ở đó, đối chiếu với ô "Ghi chú vận hành" ở trang lịch
       sử: tài khoản kỹ thuật của anh Trần Vũ Hải đã thu hồi ngày 30/06/2024. Một bản cập nhật
       trong sự cố tháng 9 năm 2026 mang tên anh chỉ thành dị thường khi người chơi đã đọc một
       chỗ khác, trên một trang khác. */
    T08: [
      { name: 'Trần Vũ Hải' },
      { name: 'Trần Vũ Hải', when: 'tự động' },
      { name: 'Trần Vũ Hải', when: 'đã xác nhận' }
    ],

    /* T10 — bảng tổng hợp 90 ngày không cộng lại được. `delta` là số phút gián đoạn bị cộng
       thêm vào MỘT ô: đủ để hàng đó thôi khớp với tỉ lệ hoạt động đã ghi và cột thôi khớp với
       dòng tổng, đủ nhỏ để không ai nhìn ra bằng mắt. */
    T10: [
      { delta: 9 },
      { delta: 17 },
      { delta: 26 }
    ],

    // S01 — một chữ đổi phông. Chữ lấy TỪ CHÍNH đoạn văn đó; ở đây chỉ khai các họ phông.
    // Phải là phông CÓ TÊN và đủ dấu tiếng Việt — xem ghi chú dài ở ch1-lumiere.js.
    S01: [
      { family: '"Courier New", "American Typewriter", Courier', spacing: '0.12em' },
      { family: 'Papyrus, "Brush Script MT", "Segoe Print"', spacing: '0.04em' },
      { family: '"Brush Script MT", "Savoye LET", "Segoe Script"', spacing: '0.02em', style: 'italic' },
      { family: '"Chalkboard SE", "Comic Sans MS", "Marker Felt"', spacing: '0.03em' },
      { family: 'Luminari, Papyrus, "Trattatello"', spacing: '0.08em' }
    ],

    /* S03 — bôi đen một dòng thì dưới nó hiện ra một câu chưa ai viết lên trang. Chương kết là
       chỗ của nó: đến đây người chơi đã học đủ mọi động tác khác, và đây là động tác cuối cùng
       chưa dị thường nào đòi tới. */
    S03: [
      'không còn ai đọc trang này ngoài bạn',
      'mọi thứ vẫn bình thường vì đã không còn ai đo nữa',
      'điểm giám sát thứ năm vẫn đang gửi số liệu về'
    ],

    // S06 — một dòng chữ rời khỏi trang, mỗi lần bị bỏ lại thì đi thêm một đoạn.
    S06: [
      { step: 18, max: 96 },
      { step: 12, max: 72 }
    ],

    // S07 — emoji lạc loài. Cả trang chỉ có chữ, số và ba màu trạng thái, nên một cái emoji
    // trong dãy huy hiệu "Hoạt động bình thường" là thứ không thể nhầm được.
    S07: ['🩸', '🕳️', '👁️', '🦷', '👽', '🌚', '🧿', '🃏', '🪬'],

    // M01 / M03 — chuyển động dưới ngưỡng chắc chắn, nấp sau con số độ trễ vốn đã nhảy sẵn.
    M01: [{ max: 6 }],
    M03: [
      { scale: 1.045, seconds: 3.2 },
      { scale: 1.038, seconds: 2.6 }
    ],

    // E01 — cái nút không thuộc về đâu cả, viết bằng đúng giọng bảng điều khiển nội bộ.
    E01: [
      { label: 'ĐO LẠI', dialog: 'Không có gì để đo. Đã ngừng đo từ 03:00.' },
      { label: 'XÁC NHẬN BÌNH THƯỜNG', dialog: 'Đã xác nhận. Lần thứ 4.471.' },
      { label: 'TẮT GIÁM SÁT', dialog: 'Giám sát đã tắt từ trước khi bạn mở trang này.' }
    ],

    /* M05 — trang tự lùi lại một đoạn, để lại một cái vết mang chữ của riêng nó. */
    M05: [
      { lift: 40, text: 'Bản ghi này đã bị xoá khỏi nhật ký.' },
      { lift: 56, text: 'Cụm máy chủ vẫn trả lời sau khi đã tắt điện.' },
      { lift: 32, text: 'Không ai đặt lịch cho tác vụ đang chạy.' }
    ],

    // E02 — một ô nhập không có lý do gì để tồn tại trong ô đăng ký nhận thông báo.
    E02: [
      'Tên người sẽ nhận thư thay bạn',
      'Bạn đang ở múi giờ nào?',
      'Số sự cố bạn chưa được thông báo'
    ],

    // E03 — thanh menu có thêm một mục, và mục đó đi tới một chỗ không có trong tài liệu nào.
    E03: [
      { label: 'Điểm giám sát 5', miss: 'Tôi không tìm thấy trang đó. Tôi đã tìm rất lâu.' },
      { label: 'Nhật ký nội bộ', miss: 'Trang này chỉ mở cho tài khoản đã thu hồi.' },
      { label: 'Trạng thái thật', miss: 'Không có trang nào ở đây cả. Nhưng bạn vừa bấm vào nó.' }
    ],

    // E04 — một dòng chân trang không trang nào có.
    E04: [
      'Số sự cố chưa được công bố: 12',
      'Bản quyền © 2011–2026 · và các quý chưa được kết sổ',
      'Máy chủ tạo ra trang này không còn trong danh sách tài sản'
    ],

    // E05 — con trỏ sai chỗ.
    E05: [
      { cursor: 'help' },
      { cursor: 'wait' },
      { cursor: 'not-allowed' }
    ],

    /* R03 — gõ tên một dịch vụ MegaLink không có, và bảng vẫn tìm ra đúng một dòng. Không ảnh,
       nên kho chữ này không có `src`: R03 tự gỡ thẻ <img> khi trang không có ảnh nào. */
    R03: [
      {
        title: 'Dịch vụ thứ chín',
        meta: '—',
        note: 'Không có trong hợp đồng nào'
      },
      {
        title: 'Điểm giám sát 5 (không công bố)',
        meta: '100,00%',
        note: 'Chưa từng được bật, chưa từng được tắt'
      },
      {
        title: 'Kênh bạn vừa tìm',
        meta: '0,00%',
        note: 'Đang chờ người chịu trách nhiệm'
      }
    ],

    // R05 — đăng ký nhận thông báo, và hoá ra bạn đã đăng ký từ lâu.
    R05: [
      { since: '14/08/2011', unsub: 'KHÔNG THỂ' },
      { since: '02/02/2009', unsub: 'KHÔNG THỂ' }
    ],

    // R06 — bấm vào thì trình duyệt đi tìm một thứ bạn không gõ, và chỗ vừa bấm đổi chữ.
    R06: [
      { q: 'megalink monitoring node 5', label: 'ĐÃ TÌM' },
      { q: 'what is still sending data', label: 'ĐỪNG HỎI' },
      { q: 'megalink incident 4471 full log', label: 'KHÔNG CÓ NHẬT KÝ NÀO' }
    ]
  }
};
