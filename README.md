# Browser Games

Một bộ sưu tập mini game viết bằng HTML/CSS/JavaScript thuần và vibe coding, chạy trực tiếp trên trình duyệt.

## Tổng quan

- Dự án là static site, không dùng framework và không có bước build.
- `index.html` là trang hub để truy cập tất cả game.
- Mỗi game nằm trong một file HTML riêng ở thư mục gốc.

## Danh sách game

- `grid-survival.html` - Di chuyển trên lưới và né tên lửa.
- `farmer-dream.html` - Trồng trọt và chăm sóc vật nuoi.
- `animal-catching.html` - Vẽ vòng tròn bắt con vật, tránh bắt sói.
- `jungle-king.html` - Ăn và tiến hóa để trở thành chúa tể rừng xanh.
- `attack-on-cursor.html` - Điều khiển con trỏ để tấn công căn cứ địch.
- `docker-battlefield.html` - Đặt container chiến thuật để phòng thủ.
- `survive-through-night.html` - Sinh tồn qua đêm và giữ lửa luôn cháy.

## Chạy local

Bạn có thể mở trực tiếp `index.html`, nhưng nên chạy qua local server để đảm bảo đường dẫn hoạt động ổn định.

### Cách 1: Python

```bash
python3 -m http.server 8000
```

Sau đó mở:

- <http://localhost:8000>

### Cách 2: VS Code Live Server

- Mở project trong VS Code/Cursor
- Chạy extension Live Server tại `index.html`

## Cấu trúc thư mục

```text
.
├── index.html
├── grid-survival.html
├── farmer-dream.html
├── animal-catching.html
├── jungle-king.html
├── attack-on-cursor.html
├── docker-battlefield.html
└── survive-through-night.html
```

## Tác giả

- `thaichihien`
