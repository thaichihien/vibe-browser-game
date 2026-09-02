/* Twenty-six anachronisms. Consumables load into satchel slots before a battle and
   cost the unit's turn to use; relics are permanent and always on.
   Prices run 190–5000 ⧗ against 12–70 a win, so the shop is a long game. */

export const CONSUMABLES = [
  { id: 'noodles',      icon: '🥫', name: 'Mì gói',           price: 190,  target: null,   desc: 'Hồi 15% máu cho cả đội.' },
  { id: 'paperclip',    icon: '🪤', name: 'Kẹp giấy',         price: 210,  target: 'foe',  desc: 'Hút 30 nộ từ một kẻ địch.' },
  { id: 'energy',       icon: '🥤', name: 'Nước tăng lực',    price: 220,  target: 'ally', desc: 'Hồi 35% máu cho một đồng đội.' },
  { id: 'extinguisher', icon: '🧯', name: 'Bình chữa cháy',   price: 240,  target: null,   desc: 'Xoá mọi hiệu ứng cháy, cả đội +30% WRD trong 3 lượt.' },
  { id: 'ducttape',     icon: '🩹', name: 'Băng keo',         price: 260,  target: 'ally', desc: 'Giải mọi hiệu ứng bất lợi và hồi 15% máu.' },
  { id: 'gel',          icon: '🧪', name: 'Gel năng lượng',   price: 260,  target: 'ally', desc: '+30% PWR cho một đồng đội trong 4 lượt.' },
  { id: 'icepack',      icon: '🧊', name: 'Túi chườm đá',     price: 280,  target: null,   desc: 'Hồi sinh một đồng đội đã gục ở 30% máu.' },
  { id: 'coldbrew',     icon: '☕', name: 'Cà phê lạnh',      price: 300,  target: 'ally', desc: '+50 nộ cho một đồng đội.' },
  { id: 'ziptie',       icon: '🪝', name: 'Dây rút nhựa',     price: 320,  target: 'foe',  desc: 'Làm choáng một kẻ địch một lượt.' },
  { id: 'firecracker',  icon: '🧨', name: 'Pháo',             price: 330,  target: null,   desc: '120 sát thương cố định lên toàn bộ địch — bỏ qua giáp và khiêu khích.' },
  { id: 'sunglasses',   icon: '🕶️', name: 'Kính râm',         price: 350,  target: null,   desc: 'Cả đội +25% GRD và WRD trong 3 lượt.' },
  { id: 'balloon',      icon: '🎈', name: 'Bong bóng',        price: 400,  target: 'foe',  desc: 'Đẩy một kẻ địch xuống cuối dòng lượt.' },
  { id: 'pencil',       icon: '✏️', name: 'Bút chì',          price: 480,  target: 'ally', desc: 'Vẽ lại chỉ số: quay ±20% cho từng chỉ số, giữ kết quả tốt hơn.' },
  { id: 'powerbank',    icon: '🔋', name: 'Sạc dự phòng',     price: 540,  target: 'ally', desc: 'Một đồng đội được hành động thêm một lượt.' },
  { id: 'phone',        icon: '📱', name: 'Điện thoại',       price: 700,  target: null,   desc: 'Tra cứu địch: thấy trước nước đi của chúng trong 3 lượt.' },
  { id: 'stopwatch',    icon: '⏱️', name: 'Đồng hồ bấm giờ',  price: 900,  target: null,   desc: 'Đóng băng dòng lượt — cả đội bạn đi trước mọi kẻ địch.' }
];

export const RELICS = [
  { id: 'backpack', icon: '🎒', name: 'Ba lô lớn hơn',    price: 1200, desc: 'Thêm ô túi thứ tư.' },
  { id: 'watch',    icon: '⌚', name: 'Đồng hồ đeo tay',  price: 1400, desc: 'Thắng mọi thế hoà tốc độ, +5% SPD cho cả đội.' },
  { id: 'torch',    icon: '🔦', name: 'Đèn pin',          price: 1500, desc: 'Hiện hệ và quan hệ khắc chế của địch ngay trên thanh máu.' },
  { id: 'gps',      icon: '🧭', name: 'GPS',              price: 1600, desc: 'Xem trước sát thương chính xác trước khi xác nhận.' },
  { id: 'gloves',   icon: '🧤', name: 'Găng tay bảo hộ',  price: 1700, desc: '+8% PWR vĩnh viễn cho cả đội.' },
  { id: 'card',     icon: '💳', name: 'Thẻ tín dụng',     price: 1800, desc: 'Giá cửa hàng giảm 20%.' },
  { id: 'helmet',   icon: '🪖', name: 'Mũ bảo hiểm',      price: 1900, desc: 'Cả đội +10% GRD và WRD ngay từ đầu trận.' },
  { id: 'marker',   icon: '🖊️', name: 'Bút lông dầu',     price: 2400, desc: 'Đánh dấu đồng đội: cả đội bắt đầu trận với 25 nộ.' },
  { id: 'camera',   icon: '📸', name: 'Máy ảnh',          price: 2600, desc: 'Chụp lại thời đại: xem lại mã trận đã thắng để chơi lại.' },
  { id: 'hourglass',icon: '⌛', name: 'Đồng hồ cát',      price: 5000, desc: 'Mỗi trận một lần, hoàn tác lượt vừa rồi.' }
];

export const SHOP = [...CONSUMABLES, ...RELICS];
export const byId = (id) => SHOP.find(i => i.id === id);
export const SATCHEL_SLOTS = 3;
