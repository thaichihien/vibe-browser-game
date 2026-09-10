/* Chương 1 — LUMIÈRE. Trang bán kem dưỡng ẩm. Chương hướng dẫn: ép S07 (emoji lạc loài),
   dị thường dễ thấy nhất trong thư viện, để người chơi học động tác khoanh trên một thứ
   không thể nhầm. Spec §5.1. */

export const CH1 = {
  id: 'ch1-lumiere',
  title: 'LUMIÈRE',
  slug: 'ch1-lumiere',
  subtitle: 'Kem dưỡng ẩm · trang bán hàng',
  min: 5,
  max: 6,
  exclude: [],
  force: ['S07'],

  pages: [{
    id: 'index',
    slots: {
      nav: 1,
      'hero-title': 1,
      paragraph: 4,
      price: 1,
      cta: 1,
      photo: 4,
      avatar: 2,
      'feature-icon': 3,
      faq: 1,
      footer: 1,
      newsletter: 1
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
    S01: [
      { family: 'cursive' },
      { family: 'fantasy' },
      { family: 'monospace' },
      { family: '"Courier New", monospace' }
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

    // M01 / M03 — chuyển động không cần lời, nhưng vẫn giữ pool để đồng nhất hình dạng.
    M01: [{ max: 6 }],
    M03: [{ scale: 1.012 }],

    // I01 / I03 — ảnh mất màu, và hai cái tên chung một khuôn mặt.
    I01: [{ note: 'grayscale' }],
    I03: [
      { a: { name: 'Ngọc Anh', age: 28 }, b: { name: 'Thu Hà', age: 41 } },
      { a: { name: 'Mỹ Linh', age: 33 }, b: { name: 'Bảo Trân', age: 26 } }
    ]
  }
};
