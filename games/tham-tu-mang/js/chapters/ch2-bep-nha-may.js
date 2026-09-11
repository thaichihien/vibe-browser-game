/* Chương 2 — Bếp Nhà Mây. Blog nấu ăn cá nhân, hai trang. Ngữ vực: người đã mất.
   Spec §5.2. Chương đầu tiên có nhiều hơn một trang, và là chương duy nhất mà một dị thường
   chỉ có nghĩa nhờ một thứ nằm ở TRANG KHÁC: T08 đặt tên Mây lên bài viết ba ngày trước, còn
   ô tưởng niệm nói Mây mất năm 2021. Người chơi phải tự nối hai chỗ đó lại.

   Không có slot `nav` (blog cá nhân chỉ có một dòng tiêu đề), nên S07, E01 trên nav và R06
   không bao giờ rơi vào đây. Bù lại: chín bình luận, một ô gửi bình luận, và ba khuôn mặt. */

export const CH2 = {
  id: 'ch2-bep-nha-may',
  title: 'BẾP NHÀ MÂY',
  slug: 'ch2-bep-nha-may',
  subtitle: 'Blog nấu ăn · hai trang',
  briefing: 'Một blog nấu ăn do em gái của người đã lập ra nó viết tiếp.',
  /* Năm trang, nên khoảng bốc phải đủ để mỗi trang có ít nhất một thứ — đạo diễn đảm bảo
     điều đó, và nếu min < số trang thì nó buộc phải thêm ngoài số đã bốc, làm con số BẰNG
     CHỨNG trôi khỏi khoảng mà chương tự khai. Spec §5.2 phác 5–7 khi chương mới có hai trang. */
  min: 6,
  max: 8,
  exclude: [],
  force: [],

  pages: [
    {
      id: 'index',
      slots: {
        'post-title': 4,
        // 4 ngày trên thẻ bài + 4 dòng tháng trong ô Lưu trữ ở thanh bên.
        date: 8,
        photo: 4,
        paragraph: 2,
        footer: 1
      }
    },
    {
      id: 'post',
      slots: {
        'post-title': 1,
        byline: 1,
        date: 5,          // 1 ngày đăng + 4 dòng tháng ở thanh bên
        paragraph: 4,
        photo: 1,
        avatar: 3,
        comment: 9,
        'comment-form': 1,
        footer: 1
      }
    },

    /* Ba bài ngắn còn lại trên trang chủ. Mọi thẻ bài viết đều mở ra được, và mọi trang đều
       là chỗ dị thường có thể rơi vào — một trang mở ra được nhưng không bao giờ bẩn thì
       người chơi vẫn phải quét nó, mà quét thì có thể mất máu. */
    /* Bài nào cũng có ô gửi bình luận, kể cả bài chưa ai bình luận — blog thật thì như vậy,
       và nó cho R01 thêm chỗ để rơi vào. `post-banh` cố ý KHÔNG có slot `comment` nào: một bài
       chưa có ai bình luận là thứ bình thường nhất trên một blog nhỏ, và trạng thái rỗng cũng
       phải trông bình thường. */
    { id: 'post-cho',  slots: { 'post-title': 1, date: 5, photo: 1, paragraph: 2, comment: 3, 'comment-form': 1, footer: 1 } },
    { id: 'post-toi',  slots: { 'post-title': 1, date: 5, photo: 1, paragraph: 2, comment: 2, 'comment-form': 1, footer: 1 } },
    { id: 'post-banh', slots: { 'post-title': 1, date: 5, photo: 1, paragraph: 2, 'comment-form': 1, footer: 1 } }
  ],

  flavour: {
    // T01 — một câu bị thay bằng lời nguyền, cùng giọng, cùng nhịp với đoạn quanh nó.
    T01: [
      'Chị viết công thức này bằng bút chì, nên có chỗ mờ. Chỗ mờ nhất là chỗ chị dặn đừng nấu vào ban đêm.',
      'Tôi nấu lại đúng như trong sổ. Bếp vẫn còn ấm từ hôm trước, dù cả tuần nay không ai bật.',
      'Món này ăn hai người là vừa. Tôi vẫn dọn hai cái chén, và vẫn phải rửa cả hai.'
    ],

    // T02 — viết lại khi cuộn ngược. Bản sau PHẢI dài hơn hẳn và đổi giọng (spec §6 T02).
    T02: [
      {
        before: 'Mẹ tôi dạy tôi công thức này từ hồi tôi còn bé.',
        after: 'Mẹ tôi chưa bao giờ nấu món này. Tôi không biết tôi học nó ở đâu. Tôi đã nấu nó ba lần trong tuần này.'
      },
      {
        before: 'Chị tôi mất năm 2021, và tôi tiếp tục viết blog này.',
        after: 'Chị tôi mất năm 2021. Tôi tiếp tục viết blog này. Có những bài tôi không nhớ mình đã viết lúc nào, và chữ trong đó không giống chữ tôi.'
      }
    ],

    // T03 — con số tụt dần rồi thôi không còn là một con số nữa.
    T03: [
      { text: 'Đã có {n} người lưu công thức này.', start: 12 },
      { text: 'Còn {n} người đang đọc bài này cùng bạn.', start: 9 }
    ],

    // T04 — chỉ những điều trình duyệt biết THẬT. Xem FACTS trong anomalies/text.js.
    T04: [
      { fact: 'tz', text: 'Cảm ơn bạn đã ghé bếp từ {v}. Chị tôi cũng ở múi giờ đó.' },
      { fact: 'screen', text: 'Trang này vừa khít {v}. Đúng bằng màn hình bạn đang nhìn.' },
      { fact: 'cores', text: 'Máy của bạn có {v} lõi. Bạn không cần nhiều thế đâu, để đọc một công thức.' },
      { fact: 'lang', text: 'Bản {v} đang được chuẩn bị riêng. Chúng tôi biết bạn cần nó.' }
    ],

    // T05 — rê chuột lên thì trang nói ngược lại chính nó.
    T05: [
      'tấm này chụp sau khi chị đã mất bốn tháng',
      'người trong ảnh không phải người viết bài này',
      'món này chưa ai ăn thử',
      'bếp trong ảnh đã tháo dỡ từ năm 2021'
    ],

    /* T07 — một mốc thời gian không thể tồn tại.
       Hai hình dạng ở chương này: ngày đăng trên bài (dd/mm/yyyy) và dòng tháng trong ô Lưu
       trữ ("Tháng 3, 2026"). Kho chữ tách theo hình dạng, không bao giờ trộn — một cái ngày
       đặt vào chỗ dòng tháng thì đọc ra là dữ liệu rác chứ không phải là mốc không tồn tại. */
    T07: {
      date: ['31/02/2026', '00/00/0000', '14/03/2027', '32/13/2021', '14/03/1826'],
      // Tháng 13 và tháng 0 thì không có; 2031 thì chưa tới, mà lưu trữ không lưu được
      // tương lai; 1826 thì blog chưa ra đời.
      month: ['Tháng 13, 2026', 'Tháng 0, 2026', 'Tháng 3, 2031', 'Tháng 12, 1826']
    },

    // T08 — chữ ký của người không còn nữa, đối chiếu với ô tưởng niệm ở thanh bên.
    T08: [
      { name: 'Mây', when: '3 ngày trước' },
      { name: 'Mây', when: 'vừa xong' },
      { name: 'Mây', when: 'hôm qua' }
    ],

    // S01 — một chữ đổi font. Chữ lấy TỪ CHÍNH đoạn văn đó; ở đây chỉ khai các họ phông.
    // Phải là phông CÓ TÊN và đủ dấu tiếng Việt — xem ghi chú dài ở ch1-lumiere.js.
    S01: [
      { family: '"Courier New", "American Typewriter", Courier', spacing: '0.12em' },
      { family: 'Papyrus, "Brush Script MT", "Segoe Print"', spacing: '0.04em' },
      { family: '"Brush Script MT", "Savoye LET", "Segoe Script"', spacing: '0.02em', style: 'italic' },
      { family: '"Chalkboard SE", "Comic Sans MS", "Marker Felt"', spacing: '0.03em' }
    ],

    // S05 — chú thích tự tin mô tả một tấm ảnh khác.
    S05: [
      'Ảnh: nồi canh chua chị nấu hôm 30 Tết',
      'Ảnh: bếp nhà cũ, trước khi sửa',
      'Ảnh: chị Mây và mẹ, chụp năm 2019'
    ],

    // S06 — dòng chữ rời khỏi trang, mỗi lần bị nhìn lại thì đi thêm một đoạn.
    S06: [
      { step: 18, max: 96 },
      { step: 12, max: 72 }
    ],

    // M01 / M03 — chuyển động dưới ngưỡng chắc chắn.
    M01: [{ max: 6 }],
    M03: [
      { scale: 1.045, seconds: 3.2 },
      { scale: 1.038, seconds: 2.6 }
    ],

    // E01 — cái nút không thuộc về đâu cả.
    E01: [
      { label: 'GỬI CHO CHỊ', dialog: 'Đã gửi. Chị chưa đọc.' },
      { label: 'IN RA', dialog: 'Máy in đã in bài này 41 lần rồi.' },
      { label: 'ĐỪNG LƯU', dialog: 'Đã lưu.' }
    ],

    // E04 — một dòng chân trang không trang nào có.
    E04: [
      'Bài viết cuối cùng: 12/12/2021 — và mọi bài sau đó',
      'Số người đang đọc: 1 (bạn) và 1',
      'Bản quyền © 1994–2021 Mây'
    ],

    // E05 — con trỏ sai chỗ.
    E05: [
      { cursor: 'not-allowed' },
      { cursor: 'crosshair' },
      { cursor: 'help' },
      { cursor: 'progress' }
    ],

    // R01 — bỏ trống ô tên rồi gửi. Bình luận lên, nhưng không phải của bạn.
    R01: [
      { name: 'Mây', when: 'vừa xong', text: 'Không sao đâu. Chị vẫn ở đây mà.' },
      { name: 'Mây', when: 'vừa xong', text: 'Em nêm hơi nhạt. Lần sau thêm một muỗng nữa.' },
      { name: 'Mây', when: 'vừa xong', text: 'Em nhớ tắt bếp trước khi đi ngủ nhé.' }
    ],

    // I01 / I03 / I04 — ảnh của năm khác, hai cái tên chung một khuôn mặt, ảnh mờ dần.
    I01: [
      { filter: 'sepia(0.55) contrast(1.32) brightness(0.88) saturate(1.4)' },
      { filter: 'sepia(0.38) contrast(1.45) brightness(0.82)' }
    ],
    I03: [
      { a: { name: 'Thuỳ Dung' }, b: { name: 'Lan Chi' } }
    ],
    I04: [{ note: 'mờ dần mỗi lần vào khung nhìn' }]
  }
};
