/* Chương 1 — LUMIÈRE. Trang bán kem dưỡng ẩm. Chương hướng dẫn: ép S07 (emoji lạc loài),
   dị thường dễ thấy nhất trong thư viện, để người chơi học động tác khoanh trên một thứ
   không thể nhầm. Spec §5.1. */

import { picsum } from '../engine/img.js';

/* Ảnh thay thế của I02 — đã ghim, và đã được xem tận mắt. Kích thước rộng rãi để cùng một
   URL dùng được cho cả ảnh lớn lẫn ảnh trong lưới. */
const swap = (id) => picsum({ w: 1800, h: 1350, id });

export const CH1 = {
  id: 'ch1-lumiere',
  title: 'LUMIÈRE',
  slug: 'ch1-lumiere',
  subtitle: 'Kem dưỡng ẩm · trang bán hàng',
  briefing: 'Một trang bán kem dưỡng ẩm.',
  // Trang đã dài ra đáng kể, nên số dị thường tăng theo: quét hết một trang lớn mất công hơn,
  // và với 36 chỗ bám thì 5 dị thường trôi mất trong đó.
  min: 6,
  max: 8,
  /* M06 (đốm sáng đi trong lòng tấm ảnh) chỉ thuộc về chương 4. Ở đó nó có nghĩa: khu nghỉ
     bên hồ, ngữ vực NGƯỜI LẠ, và cả trang đã dựng sẵn lời giải thích bình thường cho một
     ánh đèn trên trời. Rải nó ra mọi chương có ảnh thì nó thôi không còn là chuyện của bầu
     trời Hồ Vắng nữa, chỉ còn là một hiệu ứng dùng lại. */
  /* M07 (rê chuột qua thì đổi cỡ) chỉ dành cho chương 3, 4 và 5 — xem ghi chú ở
     anomalies/motion.js. Chương này khai nó trong exclude để đạo diễn không bao giờ mời. */
  exclude: ['M06', 'M07'],
  force: ['S07'],

  pages: [{
    id: 'index',
    slots: {
      nav: 1,
      'hero-title': 1,
      paragraph: 9,
      price: 2,
      cta: 3,
      photo: 7,
      avatar: 4,
      'feature-icon': 6,
      faq: 1,
      footer: 1,
      newsletter: 1,
      hours: 3
    }
  }],

  flavour: {
    // T01 — một câu bị thay bằng lời nguyền, cùng font, cùng nhịp.
    T01: [
      'Thoa đều lên da mặt mỗi tối, tránh vùng mắt. Đừng thoa lên gương. Gương sẽ thoa lại.',
      'Bảo quản nơi khô ráo, tránh ánh nắng trực tiếp. Nếu nắp tự mở, đừng đóng lại.',
      'Ngưng sử dụng nếu thấy kích ứng. Ngưng sử dụng nếu thấy nó đang khóc khi bạn không cầm.'
    ],

    // T02 — viết lại khi cuộn ngược. Bản sau PHẢI dài hơn hẳn (xem test §6 T02).
    T02: [
      {
        before: 'Sản phẩm phù hợp với mọi loại da.',
        after: 'Sản phẩm phù hợp với mọi loại da. Kể cả da không còn ở trên người.'
      },
      {
        before: 'Chúng tôi cam kết hoàn tiền trong 30 ngày.',
        after: 'Chúng tôi cam kết hoàn tiền trong 30 ngày. Liệu có ai sống đến 30 ngày để đòi.'
      }
    ],

    // T03 — con số tụt dần rồi thôi không còn là một con số nữa.
    T03: [
      { text: 'Còn {n} suất ưu đãi trong hôm nay.', start: 12 },
      { text: 'Đã có {n} người mua trong một giờ qua.', start: 9 }
    ],

    // S01 — một chữ đổi font. Chữ lấy TỪ CHÍNH đoạn văn đó (xem anomalies/style.js), nên ở
    // đây chỉ khai báo các họ phông; không có danh sách chữ cố định nào để lệch khỏi nội dung.
    //
    // Phải là phông CÓ TÊN và đủ dấu tiếng Việt. Dùng cursive/fantasy/monospace chung chung
    // thì trình duyệt hay rơi vào phông thiếu glyph, và chữ sẽ trông như bị lỗi hiển thị chứ
    // không phải như bị đặt sai phông — người chơi đọc ra "trang này hỏng", không phải
    // "chữ này sai", tức là dị thường mất sạch ý nghĩa.
    // Ba trong bốn phông của bản đầu HỎNG, và hỏng theo kiểu không nhìn ra được từ mã nguồn:
    //   · Consolas và Candara KHÔNG CÓ trên macOS, nên trình duyệt rơi thẳng về phông kế
    //     tiếp và "chữ sai phông" hiện ra bằng đúng phông của cả đoạn — dị thường vô hình.
    //   · Impact CÓ trên macOS nhưng KHÔNG có glyph tiếng Việt dựng sẵn (ệ ộ ữ ằ ặ ẩ ỡ ợ),
    //     nên nó thay phông giữa chừng và chữ trông như bị lỗi hiển thị.
    // Bốn phông dưới đây đã được đo trên máy thật: có mặt, và tự vẽ được toàn bộ dấu chồng.
    // Mỗi stack đi kèm một phông Windows đủ dấu ở vị trí thứ hai.
    //
    // Thân trang giờ là SANS, nên tương phản mạnh nhất là máy chữ và chữ viết tay — không
    // phải một sans khác hơi khác (đó chính là lý do Verdana/Candara đọc ra là "y như thường").
    S01: [
      { family: '"Courier New", "American Typewriter", Courier', spacing: '0.12em' },
      { family: 'Papyrus, "Brush Script MT", "Segoe Print"', spacing: '0.04em' },
      { family: '"Brush Script MT", "Savoye LET", "Segoe Script"', spacing: '0.02em', style: 'italic' },
      { family: '"Chalkboard SE", "Comic Sans MS", "Marker Felt"', spacing: '0.03em' },
      { family: 'Luminari, Papyrus, "Trattatello"', spacing: '0.08em' }
    ],

    /* S05 — chú thích không khớp với tấm ảnh.
       Chú thích phải LẠ, không chỉ là "tả một tấm ảnh khác": một cái tên sai thì người chơi
       đọc ra là người bán/biên tập viên cẩu thả, còn một câu không thuộc về thế giới này thì
       không giải thích được bằng sự cẩu thả.

       RÀNG BUỘC NỘI DUNG (spec §3.4): S05 rơi được cả vào slot `avatar`, tức là ngay cạnh ảnh
       một người có thật. Không câu nào được mô tả người trong ảnh là đã chết, mất tích, hay bị
       hại. Chúng nói về hoàn cảnh tấm ảnh, không nói về người trong đó. */
    S05: [
      'Ảnh: buổi lễ hiến cho chúa tể quỷ vào tháng Ba.',
      'Ảnh: căn phòng thứ sáu sáu và sáu.',
      'Ảnh: mẻ đầu tiên sau khi sát hại đủ 6 người.',
      'Ảnh: thứ còn lại trong nồi sau bảy bảy bốn mươi chín đêm ủ.'
    ],

    // S07 — emoji lạc loài giữa ✨🌿💧🧴.
    S07: ['🩸', '🕳️', '👁️', '🦷', '👽', '🌚', '🧿', '🃏', '🪬'],

    // S03 — bôi đen dòng tiêu đề thì dưới nó hiện ra một dòng chưa ai viết lên trang.
    S03: [
      'công thức này dành cho da của người còn sống',
      'mẻ tháng Ba ủ bằng một thứ khác',
      'đừng đọc dòng này hai lần'
    ],

    // E01 — cái nút không thuộc về đâu cả.
    E01: [
      { label: 'GỌI LẠI', dialog: 'Chúng tôi chưa từng gọi cho bạn lần nào.' },
      { label: 'ĐỪNG BẤM', dialog: 'Cảm ơn bạn đã bấm.' },
      { label: 'XÁC NHẬN LẦN NỮA', dialog: 'Lần này thì đã được ghi nhận.' }
    ],

    /* M05 — trang tự lùi lại một đoạn, để lại một cái vết mang chữ của riêng nó.
       Không phải bản sao câu vừa đọc: một câu mà trang này chưa bao giờ viết ra. */
    M05: [
      { lift: 40, text: 'Mẻ này không dành để bán.' },
      { lift: 56, text: 'Đừng soi gương trong vòng một giờ sau khi thoa.' },
      { lift: 32, text: 'Chúng tôi biết bạn đã mở lại trang này.' }
    ],

    // E04 — một dòng chân trang không trang nào có.
    E04: [
      'Bản quyền © 1529–1826 LUMIÈRE',
      'Sản phẩm tốt nhất cho bạn, cừu và quỷ',
      'Chúng tôi luôn hân hạnh cho đến ngày cuối cùng'
    ],

    // R05 — đăng ký nhận tin, và hoá ra bạn đã đăng ký từ lâu.
    R05: [
      { since: '14/08/2011', unsub: 'KHÔNG THỂ' },
      { since: '02/02/2009', unsub: 'KHÔNG THỂ' }
    ],


    // T05 — chú thích ẩn nói ngược lại chữ nhìn thấy. Chỉ hiện khi rê chuột lên.
    T05: [
      'cô ấy chưa rời phòng thử kể từ tháng 3',
      'ảnh này chụp sau khi cửa hàng đã đóng',
      'không ai trong ảnh còn làm ở đây',
      'chúng tôi không biết ai chụp tấm này'
    ],

    // S06 — không cần lời, nhưng pool điều khiển việc nó đi ra xa tới đâu và mỗi lần bao nhiêu.
    // (S04 `bóng đổ sai hướng` đã bị rút — xem ghi chú cuối anomalies/style.js.)
    S06: [
      { step: 18, max: 96 },
      { step: 12, max: 72 }
    ],

    // T07 — giờ đóng cửa không thể tồn tại. Giờ MỞ cửa giữ nguyên; chỉ vế sau sai.
    // Tách theo hình dạng của mốc: chương này chỉ có slot `hours`, nên chỉ cần kho `time`.
    T07: { time: ['26:79', '09:-30', '08^2:00', '24:60', '19:∞', '0:-00'] },

    // R06 — bấm vào thì trình duyệt đi tìm một thứ bạn không gõ, và chỗ vừa bấm đổi chữ.
    R06: [
      { q: 'demon summon', label: 'TRIỆU HỒI' },
      { q: 'demon summon ritual', label: 'GỌI VỀ' },
      { q: 'how to summon a demon', label: 'ĐÃ GỌI RỒI' }
    ],

    // E02 — một ô nhập không có lý do gì để tồn tại trong ô đăng ký nhận thư.
    E02: [
      'Nhóm máu',
      'Năm mất',
      'Đêm qua bạn mơ thấy gì?'
    ],

    // E05 — con trỏ sai chỗ.
    E05: [
      { cursor: 'help' },
      { cursor: 'wait' },
      { cursor: 'not-allowed' }
    ],

    // M01 / M03 — chuyển động không cần lời, nhưng vẫn giữ pool để đồng nhất hình dạng.
    M01: [{ max: 6 }],
    // 1,012 trong 4 giây là dưới ngưỡng nhìn thấy — người chơi báo là không thấy gì cả.
    M03: [
      { scale: 1.045, seconds: 3.2 },
      { scale: 1.038, seconds: 2.6 }
    ],

    // E03 — thanh menu có thêm một mục, và mục đó đi tới một chỗ trang này không thể có.
    E03: [
      { label: 'TẦNG HẦM', miss: 'Tôi không tìm thấy trang đó. Tôi đã tìm rất lâu.' },
      { label: 'PHÒNG SỐ 6', miss: 'Phòng đó không mở cho khách. Chưa bao giờ mở.' },
      { label: 'DANH SÁCH CŨ', miss: 'Danh sách đã được gỡ xuống. Tên của bạn thì chưa.' }
    ],

    /* I02 — ảnh đổi khi bạn quay lại, chú thích thì không. Ba tấm dưới đây đã được xem tận
       mắt. Chúng không cần đáng sợ — cái đáng sợ là dòng chú thích bên dưới vẫn tả đúng tấm
       ảnh mà bạn đã không còn nhìn thấy nữa. */
    I02: [
      { src: swap(137) },
      { src: swap(151) },
      { src: swap(117) }
    ],


    // I05 — hai chú thích khác nhau, một tấm ảnh. Không cần kho chữ: nó tráo ảnh có sẵn
    // trên trang, còn hai dòng chú thích thì giữ nguyên như tác giả đã viết.
    I05: [{ note: 'tráo một tấm ảnh thành bản sao của tấm khác trên cùng trang' }],

    I04: [{ note: 'mờ dần mỗi lần vào khung nhìn' }],
    I03: [
      { a: { name: 'Ngọc Anh', age: 28 }, b: { name: 'Thu Hà', age: 41 } },
      { a: { name: 'Mỹ Linh', age: 33 }, b: { name: 'Bảo Trân', age: 26 } }
    ]
  }
};
