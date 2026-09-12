/* Chương 3 — SănĐồCũ.vn. Chợ đồ cũ, ba trang. Ngữ vực: thương mại điện tử. Spec §5.3.

   Chương của KHỐI LƯỢNG. Mười hai tấm ảnh do mười hai người chụp, mười hai cái tên món, mười
   hai cái giá — ở một trang mà mọi thứ vốn đã lệch nhau, một thứ lệch thêm sẽ không nhô ra.
   Đây cũng là nơi T06 (quên dần cách viết tiếng Việt) có lưới đủ dày để rữa dần mà không bị
   bắt ngay ở mục thứ hai.

   Nhà của R02 (giỏ tự thêm một món) — dị thường đầu tiên bắc qua hai trang: bấm ở trang sản
   phẩm, bằng chứng nằm ở trang giỏ hàng.

   Dòng "tài khoản của Hạnh đã ngừng hoạt động" ở trang giỏ hàng là NỘI DUNG SẠCH và luôn có
   mặt, giống ô tưởng niệm của chương 2: nó là cái mốc cho T08. */

import { picsum } from '../engine/img.js';

/* Ảnh thay thế của I02 — đã ghim, và đã được xem tận mắt. Kích thước rộng rãi để cùng một
   URL dùng được cho cả ảnh lớn lẫn ảnh trong lưới. */
const swap = (id) => picsum({ w: 1800, h: 1350, id });

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
      'Hàng đã qua sử dụng nên có dấu vết của người dùng trước. Một vài món đồ vẫn còn giữ cả thói quen của họ.',
      'Chúng tôi không kiểm tra từng món. Có những món tự quay về chủ cũ sau khi đã bán xong.',
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

    /* S05 — chú thích không khớp với tấm ảnh.
       Chú thích phải LẠ, không chỉ là "tả một tấm ảnh khác": một cái tên sai thì người chơi
       đọc ra là người bán/biên tập viên cẩu thả, còn một câu không thuộc về thế giới này thì
       không giải thích được bằng sự cẩu thả.

       RÀNG BUỘC NỘI DUNG (spec §3.4): S05 rơi được cả vào slot `avatar`, tức là ngay cạnh ảnh
       một người có thật. Không câu nào được mô tả người trong ảnh là đã chết, mất tích, hay bị
       hại. Chúng nói về hoàn cảnh tấm ảnh, không nói về người trong đó. */
    S05: [
      'Ảnh: món hàng lúc nó còn vui vẻ.',
      'Ảnh: chụp lúc 4 giờ 12 sáng. Không ai bật đèn.',
      'Ảnh: thứ tìm thấy bên trong khi mở món hàng ra.',
      'Ảnh: kho hàng ở tầng dưới. Toà nhà không có tầng dưới.'
    ],

    // S06 — dòng chữ rời khỏi trang, mỗi lần bị nhìn lại thì đi thêm một đoạn.
    S06: [{ step: 18, max: 96 }, { step: 12, max: 72 }],

    // S07 — emoji lạc loài. Thanh điều hướng chỉ có chữ, nên một cái emoji ở đó là lạc hẳn.
    S07: ['🩸', '🕳️', '👁️', '🦷', '👽', '🌚', '🧿', '🃏', '🪬'],

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
      'Tên người chủ của món hàng này',
      'Số người sẽ về cùng bạn',
      'Nhóm máu',
      'Địa chủ cụ thể nhà hoặc phòng của bạn'
    ],

    // E04 — một dòng chân trang không trang nào có.
    E04: [
      'Mọi món trên sàn đều đã có chủ. Chúng tôi chỉ đang tìm lại họ.',
      'Hãy kiểm tra kĩ lại hàng và đừng trả lại cho chúng tôi',
      'Bản quyền © 1361–1526 SănĐồCũ.vn'
    ],

    // E05 — con trỏ sai chỗ.
    E05: [
      { cursor: 'help' },
      { cursor: 'wait' },
      { cursor: 'not-allowed' }
    ],

    /* R02 — bỏ một món vào giỏ thì giỏ có thêm HAI.
       Món thừa phải rõ ràng KHÔNG PHẢI của bạn. Bản đầu để nó là "hộp đựng máy ảnh" và "dây
       đeo máy ảnh" — phụ kiện hợp lý của đúng món đang xem, giá 0₫, cùng người bán — nên người
       chơi đọc ra là hàng tặng kèm, và một món tặng kèm thì không có gì sai cả. Giờ nó không
       phải hàng hoá: không ai bán nó, không ai gửi nó, và dòng người bán tự nói ra rằng nó
       không gỡ được. Vẫn để 0₫ để tạm tính không lệch — con số phải khớp, cái sai nằm ở chỗ
       trong giỏ có một thứ bạn chưa từng bấm vào. */
    R02: [
      {
        title: 'Một hộp không ghi gì bên ngoài',
        price: '0₫',
        seller: 'Người gửi: không rõ · tự thêm vào mọi giỏ hàng',
        address: '38/7 Nguyễn Văn Đậu, P.6, Q. Bình Thạnh'
      },
      {
        title: 'Đồ của người mua trước',
        price: '0₫',
        seller: 'Người gửi: không rõ · không gỡ khỏi giỏ được',
        address: '38/7 Nguyễn Văn Đậu, P.6, Q. Bình Thạnh'
      },
      {
        title: 'Thứ bạn để quên ở đây lần trước',
        price: '0₫',
        seller: 'Người gửi: không rõ · bạn đã nhận món này rồi',
        address: '38/7 Nguyễn Văn Đậu, P.6, Q. Bình Thạnh'
      }
    ],

    // R06 — bấm vào thì trình duyệt đi tìm một thứ bạn không gõ, và chỗ vừa bấm đổi chữ.
    R06: [
      { q: 'demon summon', label: 'TRIỆU HỒI' },
      { q: 'who owned this before', label: 'AI TỪNG GIỮ' },
      { q: 'how to return a cursed object', label: 'TRẢ VỀ' }
    ],

    // E03 — thanh menu có thêm một mục, và mục đó đi tới một chỗ trang này không thể có.
    E03: [
      { label: 'HÀNG KHÔNG BÁN', miss: 'Tôi không tìm thấy trang đó. Tôi đã tìm rất lâu.' },
      { label: 'KHO TẦNG DƯỚI', miss: 'Kho đó đã khoá. Chìa nằm bên trong.' },
      { label: 'ĐỒ CỦA BẠN', miss: 'Chưa có gì ở đây. Chúng tôi vẫn đang chờ.' }
    ],

    /* I02 — ảnh đổi khi bạn quay lại, chú thích thì không. Ba tấm dưới đây đã được xem tận
       mắt. Chúng không cần đáng sợ — cái đáng sợ là dòng chú thích bên dưới vẫn tả đúng tấm
       ảnh mà bạn đã không còn nhìn thấy nữa. */
    I02: [
      { src: swap(137) },
      { src: swap(117) },
      { src: swap(151) }
    ],

    /* M06 — một đốm sáng đi qua bên trong tấm ảnh. Toạ độ là tỉ lệ của chính khung ảnh nên
       cùng một đường bay chạy được trên mọi cỡ ảnh. */
    M06: [
      { seconds: 26, from: { x: 0.04, y: 0.80 }, to: { x: 0.94, y: 0.16 } },
      { seconds: 34, from: { x: 0.96, y: 0.62 }, to: { x: 0.08, y: 0.10 } },
      { seconds: 21, from: { x: 0.52, y: 0.96 }, to: { x: 0.56, y: 0.04 } }
    ],

    // I01 / I03 / I04 — ảnh của năm khác, hai cái tên chung một khuôn mặt, ảnh mờ dần.
    I01: [
      { filter: 'sepia(0.55) contrast(1.32) brightness(0.88) saturate(1.4)', rotate: 35 },
      { filter: 'sepia(0.38) contrast(1.45) brightness(0.82)', rotate: 69 },
      { filter: 'sepia(0.5) contrast(1.28) brightness(0.9) saturate(1.3)', rotate: 176 }
    ],
    I03: [{ a: { name: 'Hồng Nhung' }, b: { name: 'Lê Vĩnh' } }],
    I04: [{ note: 'mờ dần mỗi lần vào khung nhìn' }]
  }
};
