/* Chương 1 — LUMIÈRE. Trang bán kem dưỡng ẩm. Chương hướng dẫn: ép S07 (emoji lạc loài),
   dị thường dễ thấy nhất trong thư viện, để người chơi học động tác khoanh trên một thứ
   không thể nhầm. Spec §5.1. */

export const CH1 = {
  id: 'ch1-lumiere',
  title: 'LUMIÈRE',
  slug: 'ch1-lumiere',
  subtitle: 'Kem dưỡng ẩm · trang bán hàng',
  // Trang đã dài ra đáng kể, nên số dị thường tăng theo: quét hết một trang lớn mất công hơn,
  // và với 36 chỗ bám thì 5 dị thường trôi mất trong đó.
  min: 6,
  max: 8,
  exclude: [],
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
      'Ngưng sử dụng nếu thấy kích ứng. Ngưng sử dụng nếu thấy nó ấm khi bạn không cầm.'
    ],

    // T02 — viết lại khi cuộn ngược. Bản sau PHẢI dài hơn hẳn (xem test §6 T02).
    T02: [
      {
        before: 'Sản phẩm phù hợp với mọi loại da.',
        after: 'Sản phẩm phù hợp với mọi loại da. Kể cả da không còn ở trên người.'
      },
      {
        before: 'Chúng tôi cam kết hoàn tiền trong 30 ngày.',
        after: 'Chúng tôi cam kết hoàn tiền trong 30 ngày. Chưa ai kịp dùng hết 30 ngày để đòi.'
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

    // S05 — chú thích tự tin mô tả một tấm ảnh khác.
    S05: [
      'Ảnh: bạn Ngọc Anh sau 4 tuần sử dụng',
      'Ảnh: phòng thí nghiệm của chúng tôi tại Đà Lạt',
      'Ảnh: mẻ hoa cúc La Mã thu hoạch tháng trước'
    ],

    // S07 — emoji lạc loài giữa ✨🌿💧🧴.
    S07: ['🩸', '🕳️', '👁️', '🦷'],

    // E01 — cái nút không thuộc về đâu cả.
    E01: [
      { label: 'GỌI LẠI', dialog: 'Chúng tôi chưa từng gọi cho bạn lần nào.' },
      { label: 'ĐỪNG BẤM', dialog: 'Cảm ơn bạn đã bấm.' },
      { label: 'XÁC NHẬN LẦN NỮA', dialog: 'Lần này thì đã được ghi nhận.' }
    ],

    // E04 — một dòng chân trang không trang nào có.
    E04: [
      'Bản quyền © 1834–2026 LUMIÈRE',
      'Số người đang xem: 1 (bạn) và 4',
      'GPKD số 03:17 — cấp lúc 03:17'
    ],

    // R05 — đăng ký nhận tin, và hoá ra bạn đã đăng ký từ lâu.
    R05: [
      { since: '14/08/2011', unsub: 'KHÔNG THỂ' },
      { since: '02/02/2009', unsub: 'KHÔNG THỂ' }
    ],

    // T04 — chỉ những điều trình duyệt biết thật. Xem FACTS trong anomalies/text.js.
    T04: [
      { fact: 'tz', text: 'Chúng tôi rất vui được phục vụ khách hàng ở khu vực {v}.' },
      { fact: 'screen', text: 'Trang này hiển thị đẹp nhất ở {v}. Đúng bằng màn hình của bạn.' },
      { fact: 'cores', text: 'Máy của bạn có {v} lõi. Chúng tôi chỉ cần một.' },
      { fact: 'lang', text: 'Bản {v} đang được chuẩn bị riêng. Chúng tôi biết bạn cần nó.' }
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
    T07: ['26:79', '09:-30', '08^2:00', '24:60', '19:∞', '0:-00'],

    // R06 — bấm vào thì trình duyệt đi tìm một thứ bạn không gõ, và chỗ vừa bấm đổi chữ.
    R06: [
      { q: 'demon summon', label: 'TRIỆU HỒI' },
      { q: 'demon summon ritual', label: 'GỌI VỀ' },
      { q: 'how to summon a demon', label: 'ĐÃ GỌI RỒI' }
    ],

    // E05 — con trỏ sai chỗ.
    E05: [
      { cursor: 'not-allowed' },
      { cursor: 'crosshair' },
      { cursor: 'help' },
      { cursor: 'progress' }
    ],

    // M01 / M03 — chuyển động không cần lời, nhưng vẫn giữ pool để đồng nhất hình dạng.
    M01: [{ max: 6 }],
    // 1,012 trong 4 giây là dưới ngưỡng nhìn thấy — người chơi báo là không thấy gì cả.
    M03: [
      { scale: 1.045, seconds: 3.2 },
      { scale: 1.038, seconds: 2.6 }
    ],

    // I01 / I03 / I04 — ảnh mất màu, hai cái tên chung một khuôn mặt, và ảnh mờ dần.
    // I01 — CDN trả ảnh đen trắng, rồi CSS đẩy nó thành một tấm ảnh của mấy chục năm trước.
    I01: [
      { filter: 'sepia(0.55) contrast(1.32) brightness(0.88) saturate(1.4)' },
      { filter: 'sepia(0.38) contrast(1.45) brightness(0.82)' }
    ],
    I04: [{ note: 'mờ dần mỗi lần vào khung nhìn' }],
    I03: [
      { a: { name: 'Ngọc Anh', age: 28 }, b: { name: 'Thu Hà', age: 41 } },
      { a: { name: 'Mỹ Linh', age: 33 }, b: { name: 'Bảo Trân', age: 26 } }
    ]
  }
};
