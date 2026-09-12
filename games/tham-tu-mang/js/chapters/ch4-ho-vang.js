/* Chương 4 — Khu du lịch sinh thái HỒ VẮNG. Một trang dài, ngữ vực NGƯỜI LẠ. Spec §5.4.

   Chương này khác ba chương trước ở chỗ nỗi sợ KHÔNG phải là một người: không có ma, không
   có người đã mất, không có con gì trong kho. Thứ sai ở đây là bầu trời, khoảng cách, ánh
   sáng và những con số bị đếm lệch — và vì thế trang sạch phải tự dựng sẵn lời giải thích
   bình thường cho tất cả những thứ đó (khu nghỉ thật sự mất sóng, trời thật sự tối, một khách
   đã viết sẵn rằng mùa này hay có vệ tinh bay qua). Dị thường không cần hét lên; nó chỉ cần
   đứng cạnh một lời giải thích hợp lý và không chịu vừa vào đó.

   Nhà của bốn dị thường mới:
     R04  đặt cho nhiều khách hơn số người   — ô đặt phòng nhận quá trần rồi tách khách/người
     T09  toạ độ tự đi chỗ khác              — khối bản đồ, chỗ duy nhất trong game có slot `map`
     M06  có gì đó bay trong một tấm ảnh     — bảy tấm ảnh, nhiều nhất trong cả sáu chương
     E03  thanh menu có thêm một mục         — trang duy nhất có nav mà chưa chương nào dùng hết

   Năm mươi hai chỗ bám trên một trang, nên khoảng bốc cao hơn chương 1 (36 chỗ, bốc 6–8):
   quét một trang dài hơn thì tốn công hơn, và 6 dị thường sẽ trôi mất trong đó. */

import { picsum } from '../engine/img.js';

/* Ảnh thay thế của I02 — đều đã ghim và đều đã được xem tận mắt. Chúng không cần đáng sợ:
   cái đáng sợ là chú thích bên dưới KHÔNG đổi theo. Xin kích thước rộng rãi để cùng một URL
   dùng được cho cả ảnh hero lẫn ảnh trong lưới. */
const swap = (id) => picsum({ w: 1800, h: 1350, id });

export const CH4 = {
  id: 'ch4-ho-vang',
  title: 'HỒ VẮNG',
  slug: 'ch4-ho-vang',
  subtitle: 'Khu du lịch sinh thái · một trang dài',
  briefing: 'Một khu nghỉ sinh thái ven hồ, cách Đà Lạt hai mươi bảy cây số.',
  min: 7,
  max: 9,
  exclude: [],
  force: [],

  pages: [{
    id: 'index',
    slots: {
      nav: 1,
      'hero-title': 1,
      paragraph: 7,
      cta: 3,
      photo: 4,
      tile: 4,
      'feature-icon': 4,
      price: 2,
      date: 3,
      hours: 3,
      'gallery-caption': 6,
      'booking-form': 1,
      notice: 5,
      map: 1,
      avatar: 3,
      comment: 3,
      footer: 1
    }
  }],

  flavour: {
    // T01 — một câu bị thay bằng lời nguyền, cùng giọng lễ tân, cùng nhịp với đoạn quanh nó.
    T01: [
      'Hồ sâu 4 mét ở khu vực trung tâm. Chúng tôi không được đo sâu hơn nữa. Có gì đó phía dưới',
      'Sóng điện thoại chỉ có ở đỉnh đồi phía bắc. Hãy giao tiếp, chúng tôi cần tìm hiểu về loài của bạn.',
      'Buổi tối xin quý khách đóng cửa sổ hướng hồ. Không phải vì muỗi.'
    ],

    // T02 — viết lại khi cuộn ngược. Bản sau PHẢI dài hơn hẳn và đổi giọng (spec §6 T02).
    T02: [
      {
        before: 'Hồ Vắng đón khách quanh năm.',
        after: 'Hồ Vắng đón khách quanh năm. Nhưng năm nay những vị khách ngoài không gian đã ghé thăm.'
      },
      {
        before: 'Chúng tôi không nhận quá ba mươi khách một đêm.',
        after: 'Chúng tôi không nhận quá ba mươi khách một đêm. Sáng 15 tháng 8 năm 2023 lễ tân đếm được ba mươi mốt người ăn sáng, và không ai nhận là mình tới muộn.'
      }
    ],

    // T03 — con số tụt dần rồi thôi không còn là một con số nữa.
    T03: [
      { text: 'Còn {n} phòng trống cho cuối tuần này.', start: 8 },
      { text: 'Khách đang lưu trú: {n}', start: 26 },
      { text: 'Đêm nay có {n} người ngủ lại bên hồ.', start: 14 }
    ],

    // T05 — rê chuột lên thì trang nói ngược lại chính nó.
    T05: [
      'tấm này chụp lúc 2 giờ sáng',
      'chỗ này không nhìn ra hồ được',
      'hôm đó khu nghỉ đóng cửa, không nhận khách',
      'người chụp không đi cùng đoàn nào'
    ],

    // T06 — danh sách nội quy rữa dần: mục đầu tiếng Việt hoàn hảo, mục cuối chỉ còn phụ âm.
    T06: [{ span: 4 }, { span: 5 }],

    /* T07 — một mốc thời gian không thể tồn tại. Hai hình dạng có mặt trên trang này: giờ mở
       cửa (HH:MM – HH:MM) ở ô "Giờ giấc" và ngày (dd/mm/yyyy) ở ba dòng ghi chú. Kho chữ tách
       theo hình dạng và không bao giờ trộn — một cái giờ đặt vào chỗ ngày tháng đọc ra là dữ
       liệu rác, mà dữ liệu rác thì người chơi bỏ qua. Chỉ vế SAU của khung giờ bị thay. */
    T07: {
      time: ['26:79', '24:60', '19:∞', '09:-30', '08^2:00'],
      date: ['31/02/2026', '00/00/0000', '14/03/2027', '32/13/2019']
    },

    /* T08 — chữ ký của người không còn ở đây nữa, đối chiếu với ô "Thông báo của lễ tân":
       Hoàng Vĩnh Sơn nhận phòng ngày 14/08/2023 và chưa làm thủ tục trả phòng. Ô đó là nội
       dung sạch và không bao giờ được mang data-slot — nếu đạo diễn sửa được nó thì nó đang
       dời chính cây thước mà dị thường này được đo bằng. */
    T08: [
      { name: 'Hoàng Vĩnh Sơn', when: 'vừa xong' },
      { name: 'Hoàng Vĩnh Sơn', when: 'hôm qua' },
      { name: 'Hoàng Vĩnh Sơn', when: '2 ngày trước' }
    ],

    /* T09 — toạ độ tự đi chỗ khác mỗi lần bị bỏ lại một mình.
       Bước 0 PHẢI trùng khít với cái đang có trong markup, để lần đọc đầu tiên không có gì
       đáng ngờ. Từ đó mỗi lần cuộn đi rồi cuộn lại là một bước: vài giây cung, rồi vài phút,
       rồi sang bán cầu khác, và bước cuối dừng ở một vĩ độ không tồn tại (không có 91°B) hoặc
       ở một thứ không còn là toạ độ nữa. Bước cuối là bước DỪNG — trôi mãi thì người chơi
       không bao giờ biết mình đã thấy đủ chưa. */
    T09: [
      {
        steps: [
          '11°56′24″B · 108°26′10″Đ',
          '11°56′41″B · 108°26′10″Đ',
          '11°58′02″B · 108°31′55″Đ',
          '12°47′19″B · 114°02′38″Đ',
          '41°09′06″B · 168°43′11″T',
          '91°04′22″B · 000°00′00″Đ'
        ]
      },
      {
        steps: [
          '11°56′24″B · 108°26′10″Đ',
          '11°56′24″B · 108°26′09″Đ',
          '11°56′24″B · 108°25′58″Đ',
          '11°56′24″B · 108°04′12″Đ',
          '11°56′24″B · 000°00′00″Đ',
          '11°56′24″B · —°—′—″'
        ]
      }
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

    /* S05 — chú thích không khớp với tấm ảnh, và phải LẠ chứ không chỉ là "tả một tấm khác":
       một cái tên sai thì đọc ra là biên tập viên cẩu thả, còn một câu không thuộc về thế
       giới này thì không giải thích được bằng sự cẩu thả.

       RÀNG BUỘC NỘI DUNG (spec §3.4): S05 rơi được cả vào slot `avatar`, tức là ngay cạnh ảnh
       một người có thật. Không câu nào được mô tả người trong ảnh là đã chết, mất tích hay bị
       hại. Chúng nói về HOÀN CẢNH tấm ảnh — giờ chụp, chỗ chụp, ánh sáng — không nói về người. */
    S05: [
      'Ảnh: bãi đỗ xe lúc 3 giờ sáng. Chụp lại một vật thể không xác định.',
      'Ảnh: nhà hàng nổi giữa hồ, đầu bếp đến từ ngoài không gian',
      'Ảnh: chụp từ đáy hồ nhìn lên.',
      'Ảnh: ánh sáng trong khung hình này không đến từ mặt trời.',
      'Ảnh: khu vực chụp lại 2 người đàn ông da màu xanh nhợt nhạt đang nhìn vào ống kính.'
    ],

    // S06 — một dòng chữ rời khỏi trang, mỗi lần bị bỏ lại thì đi thêm một đoạn.
    S06: [
      { step: 18, max: 96 },
      { step: 12, max: 72 }
    ],

    // S07 — emoji lạc loài giữa 🌲🛶🔥🌙.
    S07: ['👁️', '👽', '🌚', '🧿', '🃏', '🪬'],

    // M01 / M03 — chuyển động dưới ngưỡng chắc chắn.
    M01: [{ max: 6 }],
    M03: [
      { scale: 1.045, seconds: 3.2 },
      { scale: 1.038, seconds: 2.6 }
    ],

    /* M06 — một đốm sáng đi qua bên trong tấm ảnh. Toạ độ là tỉ lệ của chính khung ảnh, nên
       cùng một đường bay chạy được trên ảnh hero rộng lẫn ảnh vuông trong lưới. Chậm là bắt
       buộc: đủ để thấy khi nhìn thẳng, không đủ để chắc chắn khi liếc qua. */
    M06: [
      { seconds: 26, from: { x: 0.04, y: 0.80 }, to: { x: 0.94, y: 0.16 } },
      { seconds: 34, from: { x: 0.96, y: 0.62 }, to: { x: 0.08, y: 0.10 } },
      { seconds: 21, from: { x: 0.52, y: 0.96 }, to: { x: 0.56, y: 0.04 } }
    ],

    // E01 — cái nút không thuộc về đâu cả.
    E01: [
      { label: 'XIN CHÀO', dialog: 'Lời chào từ vũ trụ' },
      { label: 'GIAO TIẾP', dialog: 'Chúng tôi sẵn sàng thay thế loài của bạn ở trái đất' },
      { label: 'ĐỪNG RA HỒ', dialog: 'Cảm ơn quý khách đã ra hồ.' }
    ],

    // E02 — một ô nhập không có lý do gì để tồn tại trong phiếu đặt phòng.
    E02: [
      'Số người sẽ về cùng bạn',
      'Bạn có nhìn thấy nó không?',
      'Màu mắt',
      'Số đêm bạn dự định không ngủ'
    ],

    // E03 — thanh menu có thêm một mục, và mục đó đi tới một chỗ trang này không thể có.
    E03: [
      { label: 'KHU VỰC 4', miss: 'Tôi không tìm thấy trang đó. Tôi đã tìm rất lâu.' },
      { label: 'BẢN ĐỒ SAO', miss: 'Trang này chưa mở. Nó sẽ mở khi trời đủ tối.' },
      { label: 'LỐI XUỐNG ĐÁY HỒ', miss: 'Không có lối nào ở đây cả. Nhưng bạn vừa bấm vào nó.' }
    ],

    // E04 — một dòng chân trang không trang nào có.
    E04: [
      'Số khách đã nhận phòng và dưới đáy hồ: 4',
      'Toạ độ dự phòng: 91°04′22″B · 000°00′00″Đ',
      'Bản quyền © 1368–1726 · từ trước khi hồ có nước'
    ],

    // E05 — con trỏ sai chỗ.
    E05: [
      { cursor: 'help' },
      { cursor: 'wait' },
      { cursor: 'not-allowed' }
    ],

    /* R04 — trang xác nhận đặt phòng cho nhiều khách hơn số bạn điền.
       `gap` là số khách bị cộng thêm vào câu xác nhận: điền 2 thì nó xác nhận cho 3 đến 7.
       Nhỏ thì đọc ra như một lỗi cộng, lớn thì đọc ra như trang đang đếm cả những người bạn
       không đăng ký. Cả hai đều dùng được, nên kho chữ giữ đủ cả dải. */
    R04: [
      { gap: 1 },
      { gap: 2 },
      { gap: 3 },
      { gap: 4 },
      { gap: 5 }
    ],

    // R06 — bấm vào thì trình duyệt đi tìm một thứ bạn không gõ, và chỗ vừa bấm đổi chữ.
    R06: [
      { q: 'unidentified lights over a lake', label: 'ĐÃ THẤY' },
      { q: 'what came out of the water at night', label: 'ĐỪNG HỎI' },
      { q: 'UFO', label: 'KHÔNG CÓ AI MẤT TÍCH' }
    ],

    // I01 — ảnh mất màu rồi ngả sang màu của mấy chục năm trước, và treo lệch hẳn đi.
    I01: [
      { filter: 'sepia(0.55) contrast(1.32) brightness(0.88) saturate(1.4)', rotate: 35 },
      { filter: 'sepia(0.38) contrast(1.45) brightness(0.82)', rotate: 69 },
      { filter: 'sepia(0.5) contrast(1.28) brightness(0.9) saturate(1.3)', rotate: 176 }
    ],

    /* I02 — ảnh đổi khi bạn quay lại, chú thích thì không. Ba tấm dưới đây đã được xem tận
       mắt: một đường ống dẫn tới vùng sáng, một vùng đất tối dưới mặt trời chói, và một bờ
       nước xám mù. Không tấm nào cần đáng sợ — cái đáng sợ là dòng chú thích bên dưới vẫn
       tả đúng tấm ảnh mà bạn đã không còn nhìn thấy nữa. */
    I02: [
      { src: swap(137) },
      { src: swap(151) },
      { src: swap(44) }
    ],

    // I03 — hai cái tên, một khuôn mặt. apply() tự tráo ảnh giữa hai slot avatar trên trang;
    // kho chữ này chỉ ghi lại cặp tên mà nó sẽ nằm giữa.
    I03: [
      { a: { name: 'Trần Mỹ Duyên' }, b: { name: 'Phạm Ngọc Hà' } }
    ],

    // I04 — ảnh mờ thêm mỗi lần lọt vào khung nhìn, và không bao giờ trong lại.
    I04: [{ note: 'mờ dần mỗi lần vào khung nhìn' }]
  }
};
