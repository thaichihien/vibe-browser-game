/* Chương 3 — SănĐồCũ.vn. Chợ đồ cũ, ba trang. Ngữ vực: thương mại điện tử. Spec §5.3.

   Chương của KHỐI LƯỢNG. Mười hai tấm ảnh do mười hai người chụp, mười hai cái tên món, mười
   hai cái giá — ở một trang mà mọi thứ vốn đã lệch nhau, một thứ lệch thêm sẽ không nhô ra.
   Đây cũng là nơi T06 (quên dần cách viết tiếng Việt) có lưới đủ dày để rữa dần mà không bị
   bắt ngay ở mục thứ hai.

   Nhà của R02 (giỏ tự thêm một món) — dị thường đầu tiên bắc qua hai trang: bấm ở trang sản
   phẩm, bằng chứng nằm ở trang giỏ hàng.

   Dòng "tài khoản của Hạnh đã ngừng hoạt động" ở trang giỏ hàng là NỘI DUNG SẠCH và luôn có
   mặt, giống ô tưởng niệm của chương 2: nó là cái mốc cho T08. */

export const CH3 = {
  id: 'ch3-san-do-cu',
  title: 'SĂNĐỒCŨ.VN',
  slug: 'ch3-san-do-cu',
  subtitle: 'Chợ đồ cũ · ba trang',
  briefing: 'Một sàn rao vặt đồ đã qua sử dụng.',
  min: 6,
  max: 7,
  exclude: [],
  force: [],

  pages: [
    {
      id: 'listing',
      slots: { nav: 1, paragraph: 1, photo: 12, 'product-title': 12, price: 12, footer: 1 }
    },

    /* Mười hai trang món hàng. `optional: true` — chúng vẫn nhận dị thường bình thường, chỉ
       là không được BẢO ĐẢM có. Không thể rải 6–8 dị thường cho mười bốn trang, mà cũng không
       nên: một sàn rao vặt mà món nào cũng có gì đó sai thì không còn là một cái sàn nữa.
       Chỉ trang đầu khai đủ slot — nếu cả mười hai cùng khai thì kho slot của các trang chi
       tiết áp đảo trang danh sách, và gần như mọi dị thường sẽ nằm sau một cú bấm, trong khi
       chính cái lưới mười hai món mới là lớp nguỵ trang của chương (spec §5.3). */
    {
      id: 'may-anh', optional: true,
      slots: {
        nav: 1, 'product-title': 1, price: 1, photo: 1, date: 1,
        avatar: 3, paragraph: 2, comment: 2, cta: 1, footer: 1
      }
    },
    { id: 'may-danh-chu', optional: true, slots: { 'product-title': 1, price: 1, photo: 1, paragraph: 1, cta: 1 } },
    { id: 'dong-ho', optional: true, slots: { 'product-title': 1, price: 1, photo: 1, paragraph: 1, cta: 1 } },
    { id: 'xe-ba-banh', optional: true, slots: { 'product-title': 1, price: 1, photo: 1, paragraph: 1, cta: 1 } },
    { id: 'ghe-cam', optional: true, slots: { 'product-title': 1, price: 1, photo: 1, paragraph: 1, cta: 1 } },
    { id: 'loa-ban', optional: true, slots: { 'product-title': 1, price: 1, photo: 1, paragraph: 1, cta: 1 } },
    { id: 'sach-cu', optional: true, slots: { 'product-title': 1, price: 1, photo: 1, paragraph: 1, cta: 1 } },
    { id: 'den-ban', optional: true, slots: { 'product-title': 1, price: 1, photo: 1, paragraph: 1, cta: 1 } },
    { id: 'ca-men', optional: true, slots: { 'product-title': 1, price: 1, photo: 1, paragraph: 1, cta: 1 } },
    { id: 'but-chi-mau', optional: true, slots: { 'product-title': 1, price: 1, photo: 1, paragraph: 1, cta: 1 } },
    { id: 'bo-dung-cu', optional: true, slots: { 'product-title': 1, price: 1, photo: 1, paragraph: 1, cta: 1 } },
    { id: 'khung-anh', optional: true, slots: { 'product-title': 1, price: 1, photo: 1, paragraph: 1, cta: 1 } },

    {
      id: 'cart',
      slots: {
        nav: 1, 'cart-line': 1, price: 1, 'shipping-form': 1, paragraph: 1, cta: 1, footer: 1
      }
    }
  ],

  flavour: {
    // T01 — một câu bị thay bằng lời nguyền, vẫn đúng giọng điều khoản của sàn.
    T01: [
      'Hàng đã qua sử dụng nên có dấu vết của người dùng trước. Một vài món còn giữ cả thói quen của họ.',
      'Chúng tôi không kiểm tra từng món. Có những món tự được rao lại sau khi đã bán xong.',
      'Xem kỹ ảnh trước khi chuyển tiền. Nếu trong ảnh có thêm một người, đừng mua món đó.'
    ],

    // T02 — viết lại khi đọc lần hai. Bản sau dài hơn hẳn và đổi giọng (spec §6 T02).
    T02: [
      {
        before: 'Người bán tự chịu trách nhiệm về tình trạng món hàng.',
        after: 'Người bán tự chịu trách nhiệm về tình trạng món hàng. Chúng tôi không liên lạc được với người bán này từ tháng trước, nhưng các món của anh ấy vẫn đang được đăng lên mỗi sáng.'
      },
      {
        before: 'Mỗi món trong giỏ là một giao dịch riêng với một người bán riêng.',
        after: 'Mỗi món trong giỏ là một giao dịch riêng. Có những món tự vào giỏ, và chúng tôi vẫn tính chúng là một giao dịch, vẫn gửi hoá đơn, vẫn chờ bạn trả tiền.'
      }
    ],

    // T03 — con số tụt dần rồi thôi không còn là một con số nữa. Spec §5.3: giữa mười hai
    // cái giá thì đây là chương khó thấy nó nhất.
    T03: [
      { text: 'Còn {n} người đang xem món này.', start: 12 },
      { text: 'Món này đã được bán {n} lần.', start: 9 }
    ],

    // T04 — chỉ những điều trình duyệt biết THẬT. Xem FACTS trong anomalies/text.js.
    T04: [
      { fact: 'tz', text: 'Đang hiển thị các món gần bạn, khu vực {v}.' },
      { fact: 'screen', text: 'Ảnh hiển thị rõ nhất ở {v}. Đúng bằng màn hình của bạn.' },
      { fact: 'cores', text: 'Máy của bạn có {v} lõi. Chúng tôi chỉ cần một để tìm bạn.' },
      { fact: 'lang', text: 'Bản {v} đang được chuẩn bị riêng. Chúng tôi biết bạn cần nó.' }
    ],

    // T05 — rê chuột lên thì trang nói ngược lại chính nó.
    T05: [
      'món này đã bị trả lại hai lần',
      'người bán không còn ở địa chỉ này',
      'ảnh chụp trước khi món này được tìm thấy',
      'người trong ảnh không phải người bán'
    ],

    // T06 — mục đầu tiếng Việt hoàn hảo, các mục sau rữa dần. `span` là số mục trong cửa sổ.
    T06: [{ span: 4 }, { span: 3 }],

    // T07 — một mốc thời gian không thể tồn tại. Chương này chỉ có ngày đăng (dd/mm/yyyy).
    T07: { date: ['31/02/2026', '00/00/0000', '12/03/2027', '12/03/1826', '32/13/2026'] },

    // T08 — chữ ký của người không còn nữa, đối chiếu với dòng ghi chú ở trang giỏ hàng.
    T08: [
      { name: 'Hạnh', when: 'vừa xong' },
      { name: 'Hạnh', when: '10 phút trước' },
      { name: 'Hạnh', when: 'hôm nay' }
    ],

    // S01 — một chữ đổi font. Phông CÓ TÊN và đủ dấu tiếng Việt (xem ghi chú ở ch1-lumiere.js).
    S01: [
      { family: '"Courier New", "American Typewriter", Courier', spacing: '0.12em' },
      { family: 'Papyrus, "Brush Script MT", "Segoe Print"', spacing: '0.04em' },
      { family: '"Brush Script MT", "Savoye LET", "Segoe Script"', spacing: '0.02em', style: 'italic' },
      { family: '"Chalkboard SE", "Comic Sans MS", "Marker Felt"', spacing: '0.03em' }
    ],

    // S05 — chú thích tự tin mô tả một món hoàn toàn khác.
    S05: [
      'Máy ảnh Canon AE-1, còn hộp',
      'Xe đạp mini Nhật, còn phanh',
      'Bộ ấm chén gốm Bát Tràng, đủ sáu chén',
      'Tủ gỗ hai cánh, đã tháo rời'
    ],

    // S06 — dòng chữ rời khỏi trang, mỗi lần bị nhìn lại thì đi thêm một đoạn.
    S06: [{ step: 18, max: 96 }, { step: 12, max: 72 }],

    // S07 — emoji lạc loài. Thanh điều hướng chỉ có chữ, nên một cái emoji ở đó là lạc hẳn.
    S07: ['🩸', '🕳️', '👁️', '🦷'],

    // M01 / M03 — chuyển động dưới ngưỡng chắc chắn.
    M01: [{ max: 6 }],
    M03: [{ scale: 1.045, seconds: 3.2 }, { scale: 1.038, seconds: 2.6 }],

    // E01 — cái nút không thuộc về đâu cả.
    E01: [
      { label: 'HỎI NGƯỜI BÁN CŨ', dialog: 'Người bán cũ không nhận câu hỏi nữa.' },
      { label: 'TRẢ LẠI', dialog: 'Món này đã được trả lại. Bạn vẫn đang giữ nó.' },
      { label: 'ĐỪNG MUA', dialog: 'Đã ghi nhận. Đơn hàng vẫn được tạo.' }
    ],

    // E02 — một ô nhập không có lý do gì để tồn tại trong biểu mẫu giao hàng.
    E02: [
      'Tên người sẽ nhận đồ của bạn',
      'Số người sẽ về cùng bạn',
      'Nhóm máu',
      'Ai giới thiệu bạn tới món này?'
    ],

    // E04 — một dòng chân trang không trang nào có.
    E04: [
      'Số món đang được rao lại sau khi đã bán: 214',
      'Số người đang xem trang này: 1 (bạn) và 3',
      'Bản quyền © 1961–2026 SănĐồCũ.vn'
    ],

    // E05 — con trỏ sai chỗ.
    E05: [{ cursor: 'not-allowed' }, { cursor: 'crosshair' }, { cursor: 'help' }, { cursor: 'progress' }],

    // R02 — bỏ một món vào giỏ, giỏ có thêm hai. Cùng người bán, và địa chỉ nhận hàng là của
    // chính người bán đó.
    R02: [
      {
        title: 'Hộp đựng máy ảnh, đã mở',
        price: '0₫',
        seller: 'Người bán: Dũng · Q. Bình Thạnh',
        address: '38/7 Nguyễn Văn Đậu, P.6, Q. Bình Thạnh'
      },
      {
        title: 'Dây đeo máy ảnh, còn mùi',
        price: '0₫',
        seller: 'Người bán: Dũng · Q. Bình Thạnh',
        address: '38/7 Nguyễn Văn Đậu, P.6, Q. Bình Thạnh'
      }
    ],

    // R06 — bấm vào thì trình duyệt đi tìm một thứ bạn không gõ, và chỗ vừa bấm đổi chữ.
    R06: [
      { q: 'demon summon', label: 'TRIỆU HỒI' },
      { q: 'who owned this before', label: 'AI TỪNG GIỮ' },
      { q: 'how to return a cursed object', label: 'TRẢ VỀ' }
    ],

    // I01 / I03 / I04 — ảnh của năm khác, hai cái tên chung một khuôn mặt, ảnh mờ dần.
    I01: [
      { filter: 'sepia(0.55) contrast(1.32) brightness(0.88) saturate(1.4)' },
      { filter: 'sepia(0.38) contrast(1.45) brightness(0.82)' }
    ],
    I03: [{ a: { name: 'Hồng Nhung' }, b: { name: 'Lê Vĩnh' } }],
    I04: [{ note: 'mờ dần mỗi lần vào khung nhìn' }]
  }
};
