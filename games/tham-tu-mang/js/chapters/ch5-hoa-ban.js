/* Chương 5 — Trường Tiểu học Hoa Ban. Năm trang, ngữ vực GIỌNG CƠ QUAN. Spec §5.5.

   Chương khó nhất về mặt giọng điệu, và nó có đúng một luật: KHÔNG CÓ CHUYỆN GÌ XẢY RA VỚI
   TRẺ EM TRÊN MÀN HÌNH. Không dị thường nào ở đây được mô tả một học sinh là mất tích, bị hại
   hay đã chết. Toàn bộ nỗi sợ nằm ở chỗ nhà trường GHI LẠI cái gì và ghi bằng giọng nào: một
   ngày tháng không tồn tại, một phép cộng không khép lại, một thông báo gửi cho phụ huynh của
   những em không có trong danh sách. Giọng hành chính làm hết phần việc.

   Nhà của T10 (bảng số liệu không cộng lại được) — dị thường đầu tiên không nằm ở chữ mà nằm
   ở SỐ HỌC, và là dị thường duy nhất đòi người chơi tự làm một phép tính.

   KHÔNG CÓ DỊ THƯỜNG PHẢN ỨNG. Đây là một bảng tin chỉ để đọc: không ô nhập, không giỏ hàng,
   không ô tìm kiếm, không phiếu đặt chỗ. R06 về mặt kỹ thuật vừa với slot `nav` và `cta` của
   chương, nên nó phải nằm trong `exclude` để giữ đúng tính cách ấy (spec §6.1). Đổi lại,
   chương này có năm họ còn lại với sức chứa 10 so với khoảng bốc tối đa 9.

   Ô "Lịch sử nhà trường" ở trang giới thiệu là NỘI DUNG SẠCH và không bao giờ được mang
   data-slot: nó là cây thước cho T08, giống ô tưởng niệm của chương 2. */

import { picsum } from '../engine/img.js';

/* Ảnh ghim cho I02 (ảnh đổi khi bạn quay lại) — đã được xem tận mắt, và không tấm nào có mặt
   một đứa trẻ. Kích thước rộng rãi để cùng một URL dùng được cho mọi ô ảnh của trang. */
const swap = (id) => picsum({ w: 1800, h: 1350, id });

export const CH5 = {
  id: 'ch5-hoa-ban',
  title: 'TIỂU HỌC HOA BAN',
  slug: 'ch5-hoa-ban',
  subtitle: 'Trang trường học · năm trang',
  briefing: 'Trang thông tin của một trường tiểu học ở Sơn La.',
  min: 7,
  max: 9,
  /* R06 mở một tab đi tìm thứ bạn không gõ — một thao tác, tức là một dị thường PHẢN ỨNG.
     Chương này cố ý không có cái nào (spec §6.1). */
  exclude: ['R06'],
  force: [],

  pages: [
    {
      id: 'index',
      slots: {
        nav: 1, notice: 4, date: 4, paragraph: 2, avatar: 1,
        photo: 3, tile: 1, cta: 1, footer: 1
      }
    },
    {
      id: 'gioi-thieu',
      slots: { nav: 1, paragraph: 2, table: 1, date: 1, avatar: 3, footer: 1 }
    },
    {
      id: 'thong-bao',
      slots: { nav: 1, paragraph: 1, notice: 8, date: 8, footer: 1 }
    },
    {
      id: 'thong-bao-13',
      slots: { nav: 1, notice: 1, date: 1, paragraph: 3, byline: 1, cta: 1, footer: 1 }
    },
    {
      id: 'hinh-anh',
      slots: { nav: 1, paragraph: 1, 'gallery-caption': 4, footer: 1 }
    }
  ],

  flavour: {
    /* T01 — một câu bị thay bằng một câu khác, cùng giọng hành chính, cùng nhịp.
       Không câu nào nói rằng có chuyện gì xảy ra với một đứa trẻ. Cái đáng sợ là nhà trường
       coi những việc này là chuyện thủ tục bình thường. */
    T01: [
      'Đề nghị quý phụ huynh đưa đón các em đúng giờ. Các cháu là thứ cần thiết cho buổi lễ',
      'Nhà trường đã rà soát lại số lượng học sinh trong tháng này. Các đứa trẻ đã xứng đáng ở thiên đường.',
      'Các em không được ở lại trường sau 17 giờ. Sau giờ đó nhà trường được toàn quyền sử dụng các em.',
      'Cổng sau đã khoá từ năm 2019 và không mở lại. Đề nghị phụ huynh thôi không dùng lối đó nữa.'
    ],

    // T02 — viết lại khi cuộn ngược. Bản sau PHẢI dài hơn hẳn và đổi giọng (spec §6 T02).
    T02: [
      {
        before: 'Toàn trường có 442 học sinh, 26 giáo viên và 14 phòng học.',
        after: 'Toàn trường có 442 học sinh. 26 hội viên tôn thờ và 14 phòng tế. Chúng tôi đã chuẩn bị sẵn sàng cho buổi lễ.'
      },
      {
        before: 'Nhà trường tổ chức họp phụ huynh cuối học kỳ I tại phòng học của từng lớp.',
        after: 'Nhà trường tổ chức họp phụ huynh cuối học kỳ I tại phòng học của từng lớp. Riêng lớp 3A họp ở phòng hội đồng, vì phòng 3A đã được niêm phong từ tháng trước cho sự trở lại của Ngài'
      }
    ],

    // T03 — con số tụt dần rồi thôi không còn là một con số nữa. Ở đây nó là ô đếm lượt
    // truy cập ở thanh bên: thứ duy nhất trên trang vốn đã luôn đi lên.
    T03: [
      { text: 'Tổng lượt truy cập: {n}', start: 40213 },
      { text: 'Số người đang xem trang này: {n}', start: 12 },
      { text: 'Số học sinh có mặt lúc này: {n}', start: 442 }
    ],

    // T05 — rê chuột lên thì trang nói ngược lại chính nó.
    T05: [
      'ảnh này chụp vào ngày nghỉ, chỉ có giáo hội',
      'phòng trong ảnh đã niêm phong từ tháng 9',
      'người trong ảnh không có tên trong danh sách giáo viên',
      'buổi lễ triệu hồi Ngài'
    ],

    // T06 — danh sách thông báo rữa dần: mục đầu tiếng Việt hoàn hảo, mục cuối chỉ còn phụ âm.
    // Tám dòng thông báo xếp thành một cột là bề mặt tốt nhất trong cả game cho nó.
    T06: [{ span: 4 }, { span: 5 }],

    /* T07 — một mốc thời gian không thể tồn tại. Chương này chỉ có hình dạng `date`
       (dd/mm/yyyy) ở cột ngày của bảng thông báo và ở ngày ban hành văn bản.
       31/02 và 00/00 thì không có; 2027 thì chưa tới mà văn bản đã ban hành; 1998 thì trường
       vừa mới thành lập, chưa thể có thông báo họp phụ huynh cuối kỳ. */
    T07: {
      date: ['31/02/2026', '00/00/0000', '30/11/2027', '32/13/2026', '10/11/1998']
    },

    /* T08 — chữ ký của người không còn ở đó nữa, đối chiếu với ô "Lịch sử nhà trường":
       thầy Nguyễn Văn Đệ nghỉ hưu năm 2012. Một văn bản đề tháng 11 năm 2026 ký tên thầy là
       thứ chỉ trở thành dị thường khi người chơi đã đọc một chỗ KHÁC trên một trang KHÁC. */
    T08: [
      { name: 'Nguyễn Văn Đệ' },
      { name: 'Nguyễn Văn Đệ', when: 'ký thay' },
      { name: 'Nguyễn Văn Đệ', when: 'đã ký' }
    ],

    /* T10 — bảng số liệu không cộng lại được. `delta` là số học sinh bị cộng thêm vào MỘT ô.
       Đủ lớn để hàng đó thôi chia hết ra sĩ số trung bình đã ghi, đủ nhỏ để không ai nhìn ra
       bằng mắt — phải cộng lại mới thấy. */
    T10: [
      { delta: 3 },
      { delta: 7 },
      { delta: 11 }
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

    /* S05 — chú thích không khớp với tấm ảnh, và phải LẠ chứ không chỉ là "tả một tấm khác".
       RÀNG BUỘC NỘI DUNG (spec §3.4 và §5.5): S05 rơi được cả vào slot `avatar`, ngay cạnh
       ảnh một người có thật. Không câu nào được mô tả người trong ảnh là đã chết, mất tích
       hay bị hại — và ở chương này, không câu nào được nhắc tới một đứa trẻ như vậy dù chỉ
       gián tiếp. Chúng nói về hoàn cảnh tấm ảnh: giờ chụp, căn phòng, ánh sáng, phép đếm. */
    S05: [
      'Ảnh: phòng học thứ sáu trăm sáu mươi sáu.',
      'Ảnh: sân trường lúc 4 giờ 10 sáng, trong giờ hành chính.',
      'Ảnh: buổi chào cờ trước buổi hiến tế.',
      'Ảnh: chụp bằng máy của nhà trường, ghi lại cảnh Ngài trở lại.',
      'Ảnh: dãy hành lang tầng bốn. Khu này chỉ có ba tầng.'
    ],

    // S06 — một dòng chữ rời khỏi trang, mỗi lần bị bỏ lại thì đi thêm một đoạn.
    S06: [
      { step: 18, max: 96 },
      { step: 12, max: 72 }
    ],

    // S07 — emoji lạc loài. Trang này gần như không có biểu tượng nào, nên một cái emoji
    // giữa thanh điều hướng chữ nghĩa nghiêm trang là thứ không thể nhầm được.
    S07: ['🩸', '🕳️', '👁️', '🦷', '🌚', '🪬'],

    // M01 / M03 — chuyển động dưới ngưỡng chắc chắn.
    M01: [{ max: 6 }],
    M03: [
      { scale: 1.045, seconds: 3.2 },
      { scale: 1.038, seconds: 2.6 }
    ],

    // M06 — một đốm sáng đi qua bên trong tấm ảnh. Toạ độ là tỉ lệ của chính khung ảnh.
    M06: [
      { seconds: 26, from: { x: 0.04, y: 0.80 }, to: { x: 0.94, y: 0.16 } },
      { seconds: 34, from: { x: 0.96, y: 0.62 }, to: { x: 0.08, y: 0.10 } },
      { seconds: 21, from: { x: 0.52, y: 0.96 }, to: { x: 0.56, y: 0.04 } }
    ],

    // E01 — cái nút không thuộc về đâu cả, viết bằng đúng giọng biểu mẫu hành chính.
    E01: [
      { label: 'ĐIỂM DANH LẠI', dialog: 'Đã điểm danh lại. Đủ số lượng hiến tế.' },
      { label: 'BÁO VẮNG', dialog: 'Em đó không có trong danh sách lớp nào.' },
      { label: 'IN DANH SÁCH', dialog: 'Máy in đã in danh sách cho buổi lễ hiến tế.' }
    ],

    // E03 — thanh menu có thêm một mục, và mục đó đi tới một chỗ trường này không thể có.
    E03: [
      { label: 'Phòng 6-6-6', miss: 'Tôi không tìm thấy trang đó. Tôi đã tìm rất lâu.' },
      { label: 'Danh sách cũ', miss: 'Danh sách đã được gỡ xuống. Tên các em thì chưa.' },
      { label: 'Tầng bốn', miss: 'Không có lối nào lên đó cả. Nhưng bạn vừa bấm vào nó.' }
    ],

    // E04 — một dòng chân trang không trang nào có.
    E04: [
      'Số học sinh đã điểm danh hôm nay cho lễ hiến tế: 443',
      'Bản quyền © 2026 - ngày Ngài trở về với chúng con',
      'Trang này được cập nhật lần cuối vào một ngày thứ Ba'
    ],

    // E05 — con trỏ sai chỗ.
    E05: [
      { cursor: 'help' },
      { cursor: 'wait' },
      { cursor: 'not-allowed' }
    ],

    // I01 — ảnh mất màu rồi ngả sang màu của mấy chục năm trước, và ruột ảnh xoay hẳn đi.
    I01: [
      { filter: 'sepia(0.55) contrast(1.32) brightness(0.88) saturate(1.4)', rotate: 35 },
      { filter: 'sepia(0.38) contrast(1.45) brightness(0.82)', rotate: 69 },
      { filter: 'sepia(0.5) contrast(1.28) brightness(0.9) saturate(1.3)', rotate: 176 }
    ],

    /* I02 — ảnh đổi khi bạn quay lại, chú thích thì không. Ba tấm đã được xem tận mắt và
       không tấm nào có mặt một đứa trẻ: một bậc thang dẫn lên vùng sáng, một vùng đất tối
       dưới mặt trời chói, và một bờ nước xám mù. */
    I02: [
      { src: swap(276) },
      { src: swap(151) },
      { src: swap(44) }
    ],

    // I03 — hai cái tên, một khuôn mặt. Trang giới thiệu có ba ảnh Ban Giám hiệu, nên hai
    // trong ba người sẽ mang chung một gương mặt và cả hai cùng được đánh dấu.
    I03: [
      { a: { name: 'Trần Thị Bích Liên' }, b: { name: 'Phạm Thu Hà' } }
    ],

    // I04 — ảnh mờ thêm mỗi lần lọt vào khung nhìn, và không bao giờ trong lại.
    I04: [{ note: 'mờ dần mỗi lần vào khung nhìn' }]
  }
};
