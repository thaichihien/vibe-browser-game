/* Chương 2 — Bếp Nhà Mây. Blog nấu ăn cá nhân, hai trang. Ngữ vực: người đã mất.
   Spec §5.2. Chương đầu tiên có nhiều hơn một trang, và là chương duy nhất mà một dị thường
   chỉ có nghĩa nhờ một thứ nằm ở TRANG KHÁC: T08 đặt tên Mây lên bài viết ba ngày trước, còn
   ô tưởng niệm nói Mây mất năm 2021. Người chơi phải tự nối hai chỗ đó lại.

   Không có slot `nav` (blog cá nhân chỉ có một dòng tiêu đề), nên S07, E01 trên nav và R06
   không bao giờ rơi vào đây. Bù lại: chín bình luận, một ô gửi bình luận, và ba khuôn mặt. */

import { picsum } from '../engine/img.js';

/* Ảnh thay thế của I02 — đã ghim, và đã được xem tận mắt. Kích thước rộng rãi để cùng một
   URL dùng được cho cả ảnh lớn lẫn ảnh trong lưới. */
const swap = (id) => picsum({ w: 1800, h: 1350, id });

export const CH2 = {
  id: 'ch2-bep-nha-may',
  title: 'BẾP NHÀ MÂY',
  slug: 'ch2-bep-nha-may',
  subtitle: 'Blog nấu ăn · năm trang',
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
      'Món này ăn hai người là vừa. Khi tôi nấu ăn một mình, tôi vẫn phải ra dọn hai cái chén và không hiểu tại sao.'
    ],

    // T02 — viết lại khi cuộn ngược. Bản sau PHẢI dài hơn hẳn và đổi giọng (spec §6 T02).
    T02: [
      {
        before: 'Mẹ tôi dạy tôi công thức này từ hồi tôi còn bé.',
        after: 'Mẹ tôi chưa bao giờ nấu món này. Tôi không biết tôi học nó ở đâu. Tôi đã nấu nó ba lần trong tuần này.'
      },
      {
        before: 'Chị tôi mất năm 2021, và tôi tiếp tục viết blog này.',
        after: 'Chị tôi mất năm 2021. Tôi tiếp tục viết blog này. Có những bài tôi không nhớ mình đã viết lúc nào, và nội dung trong đó không giống của tôi.'
      }
    ],

    // T03 — con số tụt dần rồi thôi không còn là một con số nữa.
    T03: [
      { text: 'Đã có {n} người lưu công thức này.', start: 12 },
      { text: 'Còn {n} người đang đọc bài này cùng bạn.', start: 9 }
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
      date: ['31/20/2026', '00/00/0000', '14/03/2027', '32/13/2021', '14/03/1826'],
      // Tháng 13 và tháng 0 thì không có; 2031 thì chưa tới, mà lưu trữ không lưu được
      // tương lai; 1826 thì blog chưa ra đời.
      month: ['Tháng 13, 2026', 'Tháng 0, 2026', 'Tháng 3, 3031', 'Tháng 12, 1726']
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

    /* S05 — chú thích không khớp với tấm ảnh.
       Chú thích phải LẠ, không chỉ là "tả một tấm ảnh khác": một cái tên sai thì người chơi
       đọc ra là người bán/biên tập viên cẩu thả, còn một câu không thuộc về thế giới này thì
       không giải thích được bằng sự cẩu thả.

       RÀNG BUỘC NỘI DUNG (spec §3.4): S05 rơi được cả vào slot `avatar`, tức là ngay cạnh ảnh
       một người có thật. Không câu nào được mô tả người trong ảnh là đã chết, mất tích, hay bị
       hại. Chúng nói về hoàn cảnh tấm ảnh, không nói về người trong đó. */
    S05: [
      'Ảnh: mâm cơm dọn cho ba người. Nhà này có hai người.',
      'Ảnh: gian bếp lúc 3 giờ 40 sáng. Bếp đang bật.',
      'Ảnh: chụp bằng máy của chị, sau khi máy đã hỏng.',
      'Ảnh: chị tôi vào ngày chị ra đi.'
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
      'Bài viết cuối cùng: 12/12/2021 — lời nguyền vẫn ở đó',
      'Blog về những công thức món ăn không được nấu',
      'Mây sẽ trở lại vào một ngày nào đó'
    ],

    // E02 — một ô nhập không có lý do gì để tồn tại trong ô gửi bình luận.
    E02: [
      'Bạn đang ở một mình chứ?',
      'Tên người đã chết ở đây',
      'Nhóm máu'
    ],

    // E05 — con trỏ sai chỗ.
    E05: [
      { cursor: 'help' },
      { cursor: 'wait' },
      { cursor: 'not-allowed' }
    ],

    // R01 — bỏ trống ô tên rồi gửi. Bình luận lên, nhưng không phải của bạn.
    R01: [
      { name: 'Mây', when: 'vừa xong', text: 'Không sao đâu. Chị vẫn ở đây mà.' },
      { name: 'Mây', when: 'vừa xong', text: 'Em nêm hơi nhạt. Lần sau thêm một muỗng nữa.' },
      { name: 'Mây', when: 'vừa xong', text: 'Em nhớ tắt bếp trước khi đi ngủ nhé.' }
    ],

    /* I02 — ảnh đổi khi bạn quay lại, chú thích thì không. Ba tấm dưới đây đã được xem tận
       mắt. Chúng không cần đáng sợ — cái đáng sợ là dòng chú thích bên dưới vẫn tả đúng tấm
       ảnh mà bạn đã không còn nhìn thấy nữa. */
    I02: [
      { src: swap(137) },
      { src: swap(44) },
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
    I03: [
      { a: { name: 'Thuỳ Dung' }, b: { name: 'Lan Chi' } }
    ],
    I04: [{ note: 'mờ dần mỗi lần vào khung nhìn' }]
  }
};
