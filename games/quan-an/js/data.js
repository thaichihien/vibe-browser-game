/* Menu, shop catalogue, missions and restaurant tiers.

   Every price is đồng and is meant to survive a sanity check by somebody who
   actually shops for a quán: ghế nhựa chân inox run 150k–650k a piece, a 4-seat
   inox set 2–3,5tr, a waiter 6–8tr a month (≈220–300k a day), a cook 9–15tr.
   DOM-free — imported by the test harness. */

/* ── the menu ─────────────────────────────────────────────────────────────
   Prices are what these actually cost in 2026: bánh mì 13–25k, bún/hủ tiếu/
   bánh canh 30–45k, phở 40–55k, cơm tấm 35–50k, a full cơm bình dân 50–100k,
   and the seafood a nhà hàng puts on a lazy susan running into the hundreds.

   kind  'main' is what a guest actually orders; 'drink' and 'dessert' ride
         along beside it and never turn up on their own.
   cat   groups the menu in the shop, so 58 recipes stay findable.
   cook  seconds at one stove with no upgrades.
   tier  0 comes with the quán; 1 is the everyday board; 2 needs Quán phố;
         3 is what a nhà hàng puts on. Guests order toward the top of what
         the quán has, which is what makes an expensive recipe worth buying. */
export const DISHES = [
  /* ── tier 0: the three the quán already knows ──────────────────────────*/
  { id: 'tra-da',        name: 'Trà đá',                 emoji: '🧊', price:   3000, cook:  1.2, unlock:        0, tier: 0, kind: 'drink',   cat: 'uong'  },
  { id: 'banh-mi',       name: 'Bánh mì thịt',           emoji: '🥖', price:  25000, cook:  3.3, unlock:        0, tier: 0, kind: 'main',    cat: 'banh'  },
  { id: 'com-tam',       name: 'Cơm tấm sườn bì',        emoji: '🍚', price:  45000, cook:  6.0, unlock:        0, tier: 0, kind: 'main',    cat: 'kho'   },

  /* ── đồ uống ───────────────────────────────────────────────────────────*/
  { id: 'nuoc-ngot',     name: 'Nước ngọt lon',          emoji: '🥤', price:  15000, cook:  0.8, unlock:   700000, tier: 1, kind: 'drink',   cat: 'uong'  },
  { id: 'tra-chanh',     name: 'Trà chanh',              emoji: '🍋', price:  12000, cook:  1.5, unlock:   600000, tier: 1, kind: 'drink',   cat: 'uong'  },
  { id: 'ca-phe-sua',    name: 'Cà phê sữa đá',          emoji: '☕', price:  22000, cook:  2.1, unlock:   900000, tier: 1, kind: 'drink',   cat: 'uong'  },
  { id: 'nuoc-mia',      name: 'Nước mía',               emoji: '🧃', price:  15000, cook:  1.5, unlock:  1100000, tier: 1, kind: 'drink',   cat: 'uong'  },
  { id: 'bia-hoi',       name: 'Bia hơi',                emoji: '🍺', price:  18000, cook:  1.0, unlock:  1400000, tier: 1, kind: 'drink',   cat: 'uong'  },
  { id: 'sinh-to-bo',    name: 'Sinh tố bơ',             emoji: '🥑', price:  35000, cook:  3.0, unlock:  2200000, tier: 1, kind: 'drink',   cat: 'uong'  },
  { id: 'tra-sua',       name: 'Trà sữa trân châu',      emoji: '🧋', price:  35000, cook:  2.7, unlock:  2500000, tier: 1, kind: 'drink',   cat: 'uong'  },

  /* ── bánh & xôi ────────────────────────────────────────────────────────*/
  { id: 'banh-bao',      name: 'Bánh bao',               emoji: '🥟', price:  20000, cook:  3.0, unlock:   800000, tier: 1, kind: 'main',    cat: 'banh'  },
  { id: 'xoi-man',       name: 'Xôi mặn',                emoji: '🍙', price:  25000, cook:  3.5, unlock:   900000, tier: 1, kind: 'main',    cat: 'banh'  },
  { id: 'banh-cuon',     name: 'Bánh cuốn',              emoji: '🫓', price:  30000, cook:  5.0, unlock:  1300000, tier: 1, kind: 'main',    cat: 'banh'  },
  { id: 'banh-xeo',      name: 'Bánh xèo',               emoji: '🥞', price:  45000, cook:  7.5, unlock:  2600000, tier: 1, kind: 'main',    cat: 'banh'  },
  { id: 'banh-khot',     name: 'Bánh khọt',              emoji: '🧇', price:  45000, cook:  7.0, unlock:  2900000, tier: 1, kind: 'main',    cat: 'banh'  },

  /* ── món nước ──────────────────────────────────────────────────────────*/
  { id: 'chao-long',     name: 'Cháo lòng',              emoji: '🥣', price:  35000, cook:  5.4, unlock:  1500000, tier: 1, kind: 'main',    cat: 'nuoc'  },
  { id: 'pho-ga',        name: 'Phở gà',                 emoji: '🍜', price:  50000, cook:  6.6, unlock:  1100000, tier: 1, kind: 'main',    cat: 'nuoc'  },
  { id: 'pho-bo',        name: 'Phở bò tái nạm',         emoji: '🍲', price:  55000, cook:  7.2, unlock:  1200000, tier: 1, kind: 'main',    cat: 'nuoc'  },
  { id: 'mien-ga',       name: 'Miến gà',                emoji: '🍝', price:  45000, cook:  6.0, unlock:  1900000, tier: 1, kind: 'main',    cat: 'nuoc'  },
  { id: 'bun-rieu',      name: 'Bún riêu cua',           emoji: '🍅', price:  45000, cook:  6.3, unlock:  2100000, tier: 1, kind: 'main',    cat: 'nuoc'  },
  { id: 'hu-tieu',       name: 'Hủ tiếu Nam Vang',       emoji: '🍥', price:  50000, cook:  6.6, unlock:  2400000, tier: 1, kind: 'main',    cat: 'nuoc'  },
  { id: 'mi-quang',      name: 'Mì Quảng',               emoji: '🥘', price:  50000, cook:  6.8, unlock:  2800000, tier: 1, kind: 'main',    cat: 'nuoc'  },
  { id: 'banh-canh',     name: 'Bánh canh cua',          emoji: '🦀', price:  55000, cook:  7.0, unlock:  3000000, tier: 1, kind: 'main',    cat: 'nuoc'  },
  { id: 'bun-bo',        name: 'Bún bò Huế',             emoji: '🌶️', price:  55000, cook:  7.2, unlock:  3200000, tier: 1, kind: 'main',    cat: 'nuoc'  },
  { id: 'bun-mam',       name: 'Bún mắm',                emoji: '🥫', price:  55000, cook:  7.4, unlock:  3400000, tier: 1, kind: 'main',    cat: 'nuoc'  },

  /* ── cơm & bún khô ─────────────────────────────────────────────────────*/
  { id: 'com-suon-trung',name: 'Cơm sườn trứng ốp',      emoji: '🥚', price:  50000, cook:  6.0, unlock:  1600000, tier: 1, kind: 'main',    cat: 'kho'   },
  { id: 'bun-cha',       name: 'Bún chả Hà Nội',         emoji: '🍢', price:  50000, cook:  6.6, unlock:  1500000, tier: 1, kind: 'main',    cat: 'kho'   },
  { id: 'bun-thit-nuong',name: 'Bún thịt nướng',         emoji: '🍡', price:  45000, cook:  6.0, unlock:  1700000, tier: 1, kind: 'main',    cat: 'kho'   },
  { id: 'mi-xao-bo',     name: 'Mì xào bò',              emoji: '🥡', price:  55000, cook:  6.3, unlock:  2300000, tier: 1, kind: 'main',    cat: 'kho'   },
  { id: 'com-ga',        name: 'Cơm gà xối mỡ',          emoji: '🍛', price:  55000, cook:  7.2, unlock:  2600000, tier: 1, kind: 'main',    cat: 'kho'   },
  { id: 'bun-dau',       name: 'Bún đậu mắm tôm',        emoji: '🧆', price:  55000, cook:  6.9, unlock:  2700000, tier: 1, kind: 'main',    cat: 'kho'   },
  { id: 'com-rang',      name: 'Cơm rang dưa bò',        emoji: '🍱', price:  48000, cook:  5.7, unlock:  2800000, tier: 1, kind: 'main',    cat: 'kho'   },

  /* ── món thêm ──────────────────────────────────────────────────────────*/
  { id: 'trung-chien',   name: 'Trứng chiên',            emoji: '🍳', price:  25000, cook:  2.7, unlock:   600000, tier: 1, kind: 'main',    cat: 'them'  },
  { id: 'rau-muong',     name: 'Rau muống xào tỏi',      emoji: '🥬', price:  30000, cook:  3.0, unlock:   700000, tier: 1, kind: 'main',    cat: 'them'  },
  { id: 'dau-hu',        name: 'Đậu hũ nhồi thịt',       emoji: '🫘', price:  35000, cook:  4.5, unlock:  1200000, tier: 1, kind: 'main',    cat: 'them'  },
  { id: 'goi-cuon',      name: 'Gỏi cuốn tôm thịt',      emoji: '🌯', price:  35000, cook:  3.6, unlock:  1400000, tier: 1, kind: 'main',    cat: 'them'  },
  { id: 'nem-ran',       name: 'Nem rán (chả giò)',      emoji: '🍤', price:  40000, cook:  5.1, unlock:  1800000, tier: 1, kind: 'main',    cat: 'them'  },
  { id: 'canh-chua',     name: 'Canh chua cá',           emoji: '🍍', price:  45000, cook:  6.0, unlock:  2000000, tier: 1, kind: 'main',    cat: 'them'  },

  /* ── món chính, Quán phố trở lên ───────────────────────────────────────*/
  { id: 'banh-flan',     name: 'Bánh flan',              emoji: '🍮', price:  20000, cook:  1.8, unlock:  3000000, tier: 2, kind: 'dessert', cat: 'trang' },
  { id: 'che-ba-mau',    name: 'Chè ba màu',             emoji: '🍧', price:  25000, cook:  2.4, unlock:  3500000, tier: 2, kind: 'dessert', cat: 'trang' },
  { id: 'thit-kho',      name: 'Thịt kho tàu',           emoji: '🍖', price:  65000, cook:  9.0, unlock:  4200000, tier: 2, kind: 'main',    cat: 'chinh' },
  { id: 'bo-kho',        name: 'Bò kho bánh mì',         emoji: '🥙', price:  70000, cook:  9.6, unlock:  4500000, tier: 2, kind: 'main',    cat: 'chinh' },
  { id: 'suon-xao',      name: 'Sườn xào chua ngọt',     emoji: '🍯', price:  85000, cook:  9.6, unlock:  4800000, tier: 2, kind: 'main',    cat: 'chinh' },
  { id: 'ca-kho',        name: 'Cá kho tộ',              emoji: '🐟', price:  95000, cook: 10.2, unlock:  5500000, tier: 2, kind: 'main',    cat: 'chinh' },
  { id: 'ga-nuong',      name: 'Gà nướng mật ong',       emoji: '🍗', price: 165000, cook: 12.6, unlock:  6500000, tier: 2, kind: 'main',    cat: 'chinh' },
  { id: 'muc-chien',     name: 'Mực chiên giòn',         emoji: '🦑', price: 145000, cook: 10.5, unlock:  7200000, tier: 2, kind: 'main',    cat: 'chinh' },
  { id: 'heo-quay',      name: 'Heo quay giòn bì',       emoji: '🥓', price: 155000, cook: 12.0, unlock:  7600000, tier: 2, kind: 'main',    cat: 'chinh' },
  { id: 'ca-loc-nuong',  name: 'Cá lóc nướng trui',      emoji: '🐠', price: 165000, cook: 13.8, unlock:  8000000, tier: 2, kind: 'main',    cat: 'chinh' },
  { id: 'tom-rang',      name: 'Tôm rang me',            emoji: '🦐', price: 175000, cook: 10.8, unlock:  8500000, tier: 2, kind: 'main',    cat: 'chinh' },
  { id: 'vit-quay',      name: 'Vịt quay',               emoji: '🦆', price: 175000, cook: 13.2, unlock:  8800000, tier: 2, kind: 'main',    cat: 'chinh' },
  { id: 'bo-luc',        name: 'Bò lúc lắc',             emoji: '🫔', price: 185000, cook: 11.4, unlock:  9000000, tier: 2, kind: 'main',    cat: 'chinh' },

  /* ── đặc sản & lẩu, Nhà hàng trở lên ───────────────────────────────────*/
  { id: 'lau-ga-la-e',   name: 'Lẩu gà lá é',            emoji: '🍵', price: 320000, cook: 14.4, unlock: 13500000, tier: 3, kind: 'main',    cat: 'dacbiet' },
  { id: 'lau-thai',      name: 'Lẩu Thái hải sản',       emoji: '🫕', price: 385000, cook: 15.0, unlock: 15000000, tier: 3, kind: 'main',    cat: 'dacbiet' },
  { id: 'so-diep',       name: 'Sò điệp nướng mỡ hành',  emoji: '🦪', price: 280000, cook: 12.6, unlock: 16500000, tier: 3, kind: 'main',    cat: 'dacbiet' },
  { id: 'bo-nuong-tang', name: 'Bò nướng tảng',          emoji: '🥩', price: 480000, cook: 16.8, unlock: 19000000, tier: 3, kind: 'main',    cat: 'dacbiet' },
  { id: 'cua-rang',      name: 'Cua rang me',            emoji: '🥮', price: 450000, cook: 16.2, unlock: 22000000, tier: 3, kind: 'main',    cat: 'dacbiet' },
  { id: 'ca-song',       name: 'Cá song hấp Hồng Kông',  emoji: '🐡', price: 620000, cook: 18.0, unlock: 24000000, tier: 3, kind: 'main',    cat: 'dacbiet' },
  { id: 'tom-hum',       name: 'Tôm hùm nướng phô mai',  emoji: '🦞', price: 850000, cook: 19.2, unlock: 28000000, tier: 3, kind: 'main',    cat: 'dacbiet' }
];

export const DISH = Object.fromEntries(DISHES.map(d => [d.id, d]));
export const STARTER_DISHES = DISHES.filter(d => d.unlock === 0).map(d => d.id);

/* how the shop lays the recipe list out */
export const MENU_CATS = [
  { id: 'uong',    name: 'Đồ uống',        emoji: '🥤' },
  { id: 'banh',    name: 'Bánh & xôi',     emoji: '🥖' },
  { id: 'nuoc',    name: 'Món nước',       emoji: '🍜' },
  { id: 'kho',     name: 'Cơm & bún khô',  emoji: '🍚' },
  { id: 'them',    name: 'Món thêm',       emoji: '🥬' },
  { id: 'chinh',   name: 'Món chính',      emoji: '🍖' },
  { id: 'trang',   name: 'Tráng miệng',    emoji: '🍮' },
  { id: 'dacbiet', name: 'Đặc sản & lẩu',  emoji: '🦞' }
];

/* Guests order toward the best the quán does. Without this a nhà hàng cao cấp
   would still be shifting mostly rau muống, and every expensive recipe would be
   a worse buy than the one before it. */
export function orderWeight(dish, levelN) {
  if (dish.tier > tierCeiling(levelN)) return 0.12;   // still possible, just rare
  return 1 + dish.tier * 1.6;
}

/* the highest dish tier a quán of this level sells comfortably */
export function tierCeiling(levelN) {
  return levelN >= 4 ? 3 : levelN >= 3 ? 2 : 1;
}

export function weightedPick(dishes, levelN, rnd = Math.random) {
  let total = 0;
  for (const d of dishes) total += orderWeight(d, levelN);
  let roll = rnd() * total;
  for (const d of dishes) { roll -= orderWeight(d, levelN); if (roll <= 0) return d; }
  return dishes[dishes.length - 1];
}

/* the same weighting, applied to stove time instead of money */
export function weightedAvgCook(dishes, levelN) {
  let total = 0, weight = 0;
  for (const d of dishes) {
    const w = orderWeight(d, levelN);
    total += d.cook * w; weight += w;
  }
  return weight ? total / weight : 0;
}

/* the bill a group of `size` runs up, averaged over what they might order */
export function weightedAvgPrice(dishes, levelN) {
  let total = 0, weight = 0;
  for (const d of dishes) {
    const w = orderWeight(d, levelN);
    total += d.price * w; weight += w;
  }
  return weight ? total / weight : 0;
}

/* ── the shop ─────────────────────────────────────────────────────────────
   effect keys, all optional and all additive unless noted:
     tables      +1 seating group
     waiters     +1 NPC phục vụ            wage: đồng per day
     chefs       +1 parallel stove
     cookSpeed   fraction knocked off cook time (multiplicative, capped)
     carry       +1 plate the waiter can hold
     passSlots   +1 cooked plate the hatch can hold
     comfort     +fraction of patience on every waiting state
     charm       +fraction of tip
     draw        +fraction of arrivals
     menuSpeed   fraction knocked off the time guests spend deciding
     payFast     fraction knocked off the payment interaction
     autoPay     bills settle themselves (thu ngân) */
export const SHOP = [
  /* bàn ghế — one per free anchor, bought in order */
  { id: 'ban-go-1',   cat: 'table', name: 'Bộ bàn gỗ 4 ghế',          emoji: '🪑', price:   4800000, note: 'Gỗ cao su, khách ngồi lâu hơn.',          eff: { tables: 1, comfort: 0.03 }, minLevel: 2 },
  { id: 'ban-go-2',   cat: 'table', name: 'Bộ bàn gỗ cao cấp',        emoji: '🪑', price:   7500000, note: 'Gỗ sồi, đệm ghế bọc nỉ.',                 eff: { tables: 1, comfort: 0.04, charm: 0.02 }, minLevel: 3 },
  { id: 'ban-vip',    cat: 'table', name: 'Bàn VIP có vách ngăn',     emoji: '🪑', price:  12000000, note: 'Khoang riêng, khách sộp thích ngồi.',     eff: { tables: 1, comfort: 0.05, charm: 0.05 }, minLevel: 3 },

  /* nhân sự — hiring fee up front, lương trừ mỗi ngày */
  { id: 'pv-part',   cat: 'staff', name: 'Phục vụ bán thời gian', emoji: '🧑', price:  1500000, wage: 220000, note: 'Sinh viên chạy ca, 25k/giờ.',              eff: { waiters: 1 } },
  { id: 'pv-full',   cat: 'staff', name: 'Phục vụ toàn thời gian', emoji: '🧑', price:  3000000, wage: 300000, note: 'Làm cả ngày, quen mặt khách.',            eff: { waiters: 1 }, minLevel: 2 },
  { id: 'phu-bep',   cat: 'staff', name: 'Phụ bếp',                emoji: '🧑‍🍳', price: 3500000, wage: 320000, note: 'Sơ chế sẵn, bếp chính nấu nhanh hơn.',   eff: { cookSpeed: 0.12 }, minLevel: 2 },
  { id: 'dau-bep',   cat: 'staff', name: 'Đầu bếp',                emoji: '👩‍🍳', price: 8000000, wage: 500000, note: 'Mở thêm một bếp nấu song song.',         eff: { chefs: 1 }, minLevel: 2 },
  { id: 'thu-ngan',  cat: 'staff', name: 'Thu ngân',               emoji: '🧾', price:  3000000, wage: 280000, note: 'Khách tự ra quầy trả tiền.',              eff: { autoPay: 1 }, minLevel: 3 },
  { id: 'bao-ve',    cat: 'staff', name: 'Bảo vệ giữ xe',          emoji: '🛵', price:  2500000, wage: 250000, note: 'Có chỗ để xe, khách ghé đông hơn.',       eff: { draw: 0.10 }, minLevel: 3 },
  { id: 'pv-full-2', cat: 'staff', name: 'Phục vụ toàn thời gian (2)', emoji: '🧑', price: 3400000, wage: 320000, note: 'Ca chiều tối cần thêm người.',        eff: { waiters: 1 }, minLevel: 3 },
  { id: 'bep-truong',cat: 'staff', name: 'Bếp trưởng',             emoji: '👨‍🍳', price: 20000000, wage: 900000, note: 'Bếp thứ ba, và cả bếp chạy nhanh hơn.', eff: { chefs: 1, cookSpeed: 0.15 }, minLevel: 4 },

  /* bếp & dụng cụ */
  { id: 'bep-gas',   cat: 'kitchen', name: 'Bếp gas công nghiệp đôi', emoji: '🔥', price:  2400000, note: 'Lửa khè, xào nhanh hơn hẳn.',        eff: { cookSpeed: 0.10 } },
  { id: 'xe-day',    cat: 'kitchen', name: 'Xe đẩy bưng món',         emoji: '🛒', price:  1800000, note: 'Bưng được 3 dĩa một lượt.',          eff: { carry: 1 } },
  { id: 'noi-pho',   cat: 'kitchen', name: 'Nồi phở điện 50L',        emoji: '🍲', price:  4500000, note: 'Nước dùng lúc nào cũng sôi.',        eff: { cookSpeed: 0.12 }, minLevel: 2 },
  { id: 'tu-lanh',   cat: 'kitchen', name: 'Tủ lạnh 200L',            emoji: '🧊', price:  5900000, note: 'Trữ đồ sẵn, hatch rộng thêm.',       eff: { cookSpeed: 0.08, passSlots: 1 }, minLevel: 2 },
  { id: 'khay-4',    cat: 'kitchen', name: 'Khay bưng 4 ngăn',        emoji: '🍽️', price:  4200000, note: 'Bưng được 4 dĩa một lượt.',         eff: { carry: 1 }, minLevel: 3, needs: 'xe-day' },
  { id: 'tu-dong',   cat: 'kitchen', name: 'Tủ đông 500L',            emoji: '🧊', price:  9500000, note: 'Nhập hàng theo tuần, đỡ hụt món.',   eff: { cookSpeed: 0.10 }, minLevel: 3 },
  { id: 'lo-nuong',  cat: 'kitchen', name: 'Lò nướng công nghiệp',    emoji: '🍞', price: 12000000, note: 'Gà nướng ra lò gấp đôi tốc độ.',     eff: { cookSpeed: 0.12 }, minLevel: 3 },
  { id: 'may-rua',   cat: 'kitchen', name: 'Máy rửa chén công nghiệp',emoji: '🧼', price: 18000000, note: 'Chén dĩa quay vòng liên tục.',       eff: { passSlots: 2, cookSpeed: 0.05 }, minLevel: 4 },
  { id: 'bep-tu',    cat: 'kitchen', name: 'Bếp từ công nghiệp',      emoji: '⚡', price: 26000000, note: 'Nhiệt lên trong hai giây.',          eff: { cookSpeed: 0.15 }, minLevel: 4 },

  /* trang trí & tiện nghi */
  { id: 'cay-canh',  cat: 'decor', name: 'Cây cảnh trang trí',     emoji: '🪴', price:    380000, note: 'Kim tiền với trầu bà, mát mắt.',      eff: { comfort: 0.03, draw: 0.02 } },
  { id: 'quat-tuong',cat: 'decor', name: 'Quạt treo tường',        emoji: '🌀', price:    650000, note: 'Trưa Sài Gòn không có quạt là chịu.', eff: { comfort: 0.05 } },
  { id: 'den-trang', cat: 'decor', name: 'Đèn trang trí',          emoji: '💡', price:    750000, note: 'Đèn vàng, ảnh chụp lên màu.',         eff: { charm: 0.03 } },
  { id: 'tranh',     cat: 'decor', name: 'Tranh treo tường',       emoji: '🖼️', price:  1200000, note: 'Tranh phố cổ, khách hay hỏi mua.',    eff: { charm: 0.04 } },
  { id: 'loa',       cat: 'decor', name: 'Loa nhạc Bluetooth',     emoji: '🔊', price:   1400000, note: 'Nhạc nhè nhẹ, khách ngồi thoải mái.', eff: { comfort: 0.05 } },
  { id: 'wifi',      cat: 'decor', name: 'Wifi + ổ cắm mỗi bàn',   emoji: '📶', price:   2800000, note: 'Dân văn phòng kéo nhau tới.',         eff: { draw: 0.06, comfort: 0.02 }, minLevel: 2 },
  { id: 'bien-led',  cat: 'decor', name: 'Biển hiệu LED',          emoji: '🪧', price:   3200000, note: 'Tối đến là cả phố nhìn thấy quán.',   eff: { draw: 0.12 }, minLevel: 2 },
  { id: 'ca-canh',   cat: 'decor', name: 'Bể cá cảnh',             emoji: '🐠', price:   6500000, note: 'Trẻ con đứng xem, cha mẹ ngồi lâu.',  eff: { charm: 0.06, comfort: 0.03 }, minLevel: 2 },
  { id: 'menu-tv',   cat: 'decor', name: 'Menu bảng điện tử',      emoji: '📺', price:   7500000, note: 'Khách chọn món nhanh hơn hẳn.',       eff: { menuSpeed: 0.30 }, minLevel: 3 },
  { id: 'toilet',    cat: 'decor', name: 'Nhà vệ sinh sạch sẽ',    emoji: '🚻', price:   8500000, note: 'Thứ khách nhớ lâu nhất về một quán.', eff: { comfort: 0.08, draw: 0.04 }, minLevel: 3 },
  { id: 'may-lanh',  cat: 'decor', name: 'Máy lạnh 1.5HP',         emoji: '❄️', price:   9800000, note: 'Từ đây quán không còn là quán vỉa hè.', eff: { comfort: 0.12, draw: 0.05 }, minLevel: 3 },
  { id: 'pos',       cat: 'decor', name: 'Máy tính tiền POS',      emoji: '🧾', price:   3500000, note: 'In bill cái tách, khỏi bấm máy tính.', eff: { payFast: 0.40 }, minLevel: 3 },
  { id: 'vach-go',   cat: 'decor', name: 'Vách ngăn gỗ + rèm',     emoji: '🪟', price:  11000000, note: 'Mỗi bàn thành một góc riêng.',        eff: { comfort: 0.10, charm: 0.04 }, minLevel: 4 },
  { id: 'san-go',    cat: 'decor', name: 'Sàn gỗ công nghiệp',     emoji: '🟫', price:  15000000, note: 'Lát lại toàn bộ mặt sàn.',            eff: { charm: 0.08, draw: 0.06 }, minLevel: 4 },
  { id: 'den-chum',  cat: 'decor', name: 'Đèn chùm pha lê',        emoji: '✨', price:  28000000, note: 'Khách bước vào là biết giá món ăn.',  eff: { charm: 0.15 }, minLevel: 4 }
];

export const SHOP_BY_ID = Object.fromEntries(SHOP.map(s => [s.id, s]));

export const CATS = [
  { id: 'table',   name: 'Bàn ghế',   emoji: '🪑' },
  { id: 'staff',   name: 'Nhân sự',   emoji: '🧑‍🍳' },
  { id: 'kitchen', name: 'Bếp',       emoji: '🔥' },
  { id: 'decor',   name: 'Trang trí', emoji: '🪴' }
];

/* ── the shopfront ────────────────────────────────────────────────────────
   Bought from the sign shop down the street, and the only things in the game
   that are visible from outside. They pull people in off the pavement, which
   is what a biển hiệu is actually for. */
export const FACADE = [
  { id: 'bien-go',    name: 'Biển gỗ khắc tên',      emoji: '🪧', price:  1800000, draw: 0.04, note: 'Chữ khắc, sơn tay. Rẻ mà tử tế.' },
  { id: 'den-long',   name: 'Đèn lồng đỏ',           emoji: '🏮', price:  1200000, draw: 0.03, note: 'Treo hai bên cửa, tối lên là thấy từ đầu hẻm.' },
  { id: 'chau-cay',   name: 'Chậu cây trước cửa',    emoji: '🪴', price:   650000, draw: 0.02, note: 'Hai chậu cau kiểng cho ra dáng hàng quán.' },
  { id: 'bang-menu',  name: 'Bảng menu vỉa hè',      emoji: '📋', price:   900000, draw: 0.03, note: 'Khách đọc giá ngoài cửa rồi mới bước vào.' },
  { id: 'mai-hien',   name: 'Mái hiên vải bạt',      emoji: '⛱️', price:  4200000, draw: 0.05, note: 'Che nắng che mưa, kê thêm được bàn ngoài.' },
  { id: 'ghe-via-he', name: 'Bộ ghế nhựa vỉa hè',    emoji: '🪑', price:  1100000, draw: 0.04, note: 'Ngồi tràn ra vỉa hè mới đúng chất.' },
  { id: 'bien-led',   name: 'Biển LED chạy chữ',     emoji: '🪟', price:  6500000, draw: 0.08, note: 'Cả phố nhìn thấy tên quán bạn.', minLevel: 3 },
  { id: 'den-neon',   name: 'Đèn neon viền cửa',     emoji: '💫', price:  8800000, draw: 0.07, note: 'Xanh tím nhấp nháy, dân đi bar ghé.', minLevel: 3 },
  { id: 'cua-kinh',   name: 'Cửa kính khung nhôm',   emoji: '🚪', price: 15000000, draw: 0.09, note: 'Kín, mát, nhìn là biết quán có máy lạnh.', minLevel: 4 },
  { id: 'tuong-hoa',  name: 'Tường hoa giấy',        emoji: '🌸', price: 12000000, draw: 0.08, note: 'Người ta dừng lại chụp ảnh, rồi vào ăn.', minLevel: 4 }
];

export const FACADE_BY_ID = Object.fromEntries(FACADE.map(f => [f.id, f]));

/* names offered when the quán changes hands */
export const NAME_SUGGESTIONS = [
  'Quán Cơm Nhà Làm', 'Quán Ăn Hai Lúa', 'Cơm Tấm Bà Tư', 'Quán Nhỏ Góc Phố',
  'Bếp Nhà Mình', 'Quán Ăn Sáu Miền', 'Hương Quê', 'Quán Ăn Cô Ba',
  'Tiệm Cơm Vỉa Hè', 'Quán Ăn Mẹ Nấu'
];

/* ── restaurant tiers, gated on tổng vốn đã đầu tư ────────────────────────
   Reaching Quán phố is the "medium" milestone and is priced to land roughly a
   month in at three ca a day. */
export const LEVELS = [
  { n: 1, name: 'Quán vỉa hè',       invested:         0, emoji: '🏚️', flow: 1.00, floor: '#b98a5c', wall: '#8a6647', accent: '#d9a441' },
  { n: 2, name: 'Quán bình dân',     invested:  25000000, emoji: '🏠', flow: 1.15, floor: '#c9a577', wall: '#7d6a52', accent: '#e0b354' },
  { n: 3, name: 'Quán phố',          invested:  70000000, emoji: '🏪', flow: 1.35, floor: '#d8c19b', wall: '#6b5f4e', accent: '#f0c95a' },
  { n: 4, name: 'Nhà hàng',          invested: 180000000, emoji: '🏨', flow: 1.60, floor: '#e3d6bd', wall: '#4e463c', accent: '#ffd873' },
  { n: 5, name: 'Nhà hàng cao cấp',  invested: 320000000, emoji: '🏛️', flow: 1.90, floor: '#efe6d6', wall: '#3a352f', accent: '#ffe9a3' }
];

export function levelFor(invested) {
  let out = LEVELS[0];
  for (const l of LEVELS) if (invested >= l.invested) out = l;
  return out;
}

/* ── the apprenticeship ───────────────────────────────────────────────────
   Before the quán is yours, one ca is one day on the job, and the place grows
   around you: the old owner keeps adding tables and picks up a new recipe. It
   is also what paces the tutorial — you cannot buy your way past it. */
export const TUTORIAL_DAYS = 8;

/* Every day either hands you something or asks more of you, so no day is dead
   time. `target` steps up what a ca is expected to take — the quán is getting
   busier and the old owner's expectations rise with it. */
export const TUTORIAL_EVENTS = [
  { day: 3, kind: 'table', emoji: '🪑', title: 'Quán kê thêm bàn',
    text: 'Khách bắt đầu đông, chủ quán kê thêm một bộ bàn nhựa. Ba bàn để chạy.' },
  { day: 5, kind: 'recipe', id: 'pho-bo', emoji: '🍲', title: 'Bếp có món mới',
    text: 'Chủ quán ninh được nồi nước dùng ra hồn. Từ hôm nay quán bán Phở bò tái nạm.' },
  /* Day 5 raises the bar before day 6 brings the table to meet it, so this one
     stays gentle — the spike lands on a floor that has not grown yet. */
  { day: 5, kind: 'target', mult: 0.08, emoji: '📈', title: 'Chủ quán nâng chỉ tiêu',
    text: 'Có thêm món thì phải có thêm doanh thu — chỉ tiêu mỗi ca tăng 8%.' },
  { day: 6, kind: 'table', emoji: '🪑', title: 'Quán kê thêm bàn',
    text: 'Thêm một bộ bàn inox. Bốn bàn — đông hơn, và chạy mệt hơn.' },
  { day: 7, kind: 'table', emoji: '🪑', title: 'Quán kê thêm bàn',
    text: 'Bộ bàn thứ năm, kín chỗ mà chủ cũ định làm.' },
  { day: 8, kind: 'target', mult: 0.15, emoji: '📈', title: 'Chỉ tiêu ngày cuối',
    text: 'Ngày cuối học việc: chỉ tiêu mỗi ca tăng thêm 15%. Không đạt cũng không sao — nhưng đạt được thì đẹp.' }
];

/* ── tutorial chain ───────────────────────────────────────────────────────
   `goal.type` is matched against the counters in state.progress; `shift`
   goals are checked against a single finished ca, not the running total. */
export const MISSIONS = [
  { id: 'm1', title: 'Lượt khách đầu tiên', desc: 'Phục vụ trọn vẹn một nhóm khách, từ lúc ngồi xuống tới lúc trả tiền.', goal: { type: 'groups', n: 1 }, reward: 200000 },
  { id: 'm2', title: 'Cầm phiếu cho quen tay', desc: 'Nhận 3 phiếu gọi món từ khách.', goal: { type: 'tickets', n: 3 }, reward: 250000 },
  { id: 'm3', title: 'Bưng bê', desc: 'Bưng 5 món từ bếp ra bàn.', goal: { type: 'plates', n: 5 }, reward: 300000 },
  { id: 'm4', title: 'Đủ tiền chợ', desc: 'Kết một ca với doanh thu từ 400.000₫ trở lên.', goal: { type: 'shiftRevenue', n: 400000 }, reward: 500000 },
  { id: 'm5', title: 'Nhanh tay', desc: 'Phục vụ 6 lượt khi vạch kiên nhẫn còn xanh.', goal: { type: 'green', n: 6 }, reward: 600000 },
  { id: 'm6', title: 'Không để ai bỏ đi', desc: 'Hoàn thành một ca mà không khách nào bỏ về giữa chừng.', goal: { type: 'cleanShift', n: 1 }, reward: 1000000 },
  { id: 'm7', title: 'Ca đông khách', desc: 'Phục vụ 10 nhóm khách trong cùng một ca.', goal: { type: 'shiftGroups', n: 10 }, reward: 1500000 },
  { id: 'mday', title: 'Đủ ngày công', desc: `Làm đủ ${TUTORIAL_DAYS} ngày ở quán — mỗi ca phục vụ là một ngày.`, goal: { type: 'days', n: TUTORIAL_DAYS }, reward: 1200000 },
  { id: 'm8', title: 'Gom vốn', desc: 'Tích lũy 5.000.000₫ trong két.', goal: { type: 'money', n: 5000000 }, reward: 2000000 },
  { id: 'm9', title: 'Sang tên quán', desc: 'Ký hợp đồng sang nhượng — từ đây quán là của bạn.', goal: { type: 'claim', n: 1 }, reward: 0 }
];

export const CLAIM_FEE = 3000000;   // phí sang nhượng, tính vào vốn đầu tư

/* ── who walks in ─────────────────────────────────────────────────────────*/
export const GROUP_KINDS = [
  { id: 'single', name: 'Khách lẻ',  size: 1, weight: 30 },
  { id: 'couple', name: 'Cặp đôi',   size: 2, weight: 34 },
  { id: 'family3',name: 'Gia đình',  size: 3, weight: 20 },
  { id: 'family4',name: 'Gia đình',  size: 4, weight: 16 }
];

/* Skin tones, hair and headwear all varied — a room full of the same yellow
   face reads as one repeated sprite rather than as a room full of people. */
export const ADULT_FACES = [
  '👩🏻', '👨🏽', '🧔🏾', '👩🏿‍🦱', '👱🏼‍♀️', '🧓🏻', '👳🏽', '👩🏼‍🦰', '👨🏿‍🦱', '👵🏻',
  '🧕🏽', '👨🏻‍🦳', '👩🏾', '🧑🏼', '👴🏽', '👩🏻‍🦳', '👨🏼', '🧑🏿', '👩🏽‍🦰', '👨🏾‍🦲',
  '👷🏻', '👮🏽', '🧑🏾‍🎓', '👩🏼‍💼', '👨🏿‍🌾', '🕵🏻', '👨🏽‍🎤', '👩🏿‍🏫'
];

export const KID_FACES = ['🧒🏻', '👦🏽', '👧🏾', '👦🏻', '👧🏼', '🧒🏿', '👦🏾', '👧🏿'];

/* Ordered alongside a main course, never instead of one. */
export const DRINK_IDS = DISHES.filter(d => d.kind === 'drink').map(d => d.id);
export const SIDE_IDS  = DISHES.filter(d => d.kind !== 'main').map(d => d.id);
export const MAIN_IDS  = DISHES.filter(d => d.kind === 'main').map(d => d.id);
