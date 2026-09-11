/* Đạo diễn — chọn 5..8 dị thường cho một lượt chơi. Spec §3.3.
   Ràng buộc: ≥3 họ, ≤2 mỗi họ, mỗi phần tử slot chỉ một dị thường, mỗi trang ít nhất một.
   Cách đi vòng tròn qua các họ (round-robin) thoả cả "≤2 mỗi họ" lẫn "≥3 họ" một cách tự
   nhiên, thay vì chọn ngẫu nhiên rồi phải sửa chữa. */

import { mulberry32, range, shuffle } from './rng.js';
import { ANOMALIES, byId } from './registry.js';

/**
 * Những trang BẮT BUỘC phải bẩn.
 *
 * Luật cũ là "mọi trang đều phải có ít nhất một dị thường", và nó đúng khi một chương có hai
 * hay ba trang. Chương 3 có mười bốn: một trang danh sách, mười hai trang món hàng, một trang
 * giỏ. Không thể rải 6–8 dị thường cho mười bốn trang, mà cũng KHÔNG NÊN: một sàn rao vặt mà
 * món nào cũng có gì đó sai thì không còn là một sàn rao vặt nữa.
 *
 * Nên một trang có thể tự khai `optional: true`. Trang tuỳ chọn vẫn nhận dị thường bình
 * thường ở bước lấp — nó chỉ không được BẢO ĐẢM có. Lý do của luật cũ vẫn được giữ ở chỗ
 * quan trọng nhất: những trang người chơi chắc chắn sẽ đi qua thì không bao giờ sạch trơn.
 */
function mustBeDirty(chapter) {
  return chapter.pages.filter((p) => !p.optional);
}

function slotBudget(chapter) {
  const budget = new Map();          // "pageId:slotType" -> số phần tử của loại đó
  for (const page of chapter.pages) {
    for (const [type, n] of Object.entries(page.slots)) budget.set(`${page.id}:${type}`, n);
  }
  return budget;
}

/**
 * Chọn một chỗ trống cho dị thường này, hoặc null nếu không còn chỗ nào hợp lệ.
 *
 * Mỗi VỊ TRÍ còn trống là một lựa chọn riêng, không phải mỗi LOẠI slot. Bản trước chỉ sinh ra
 * đúng một lựa chọn cho mỗi loại, với nth = số đã dùng, nên dị thường đầu tiên bám vào một
 * loại luôn rơi đúng vào phần tử thứ nhất: trong ba emoji thì cái lạ luôn là cái đầu tiên, ván
 * nào cũng vậy. Người chơi học được quy luật đó nhanh hơn nhiều so với học cách quan sát.
 */
function claimSlot(anomaly, budget, used, rng, preferPage = null) {
  const options = [];
  for (const [key, total] of budget) {
    const sep = key.indexOf(':');
    const pageId = key.slice(0, sep);
    const type = key.slice(sep + 1);
    if (preferPage && pageId !== preferPage) continue;
    if (!anomaly.slots.includes(type)) continue;
    // I03 cần ít nhất hai avatar trên trang để có hai cái tên chung một khuôn mặt.
    if (anomaly.needs && (anomaly.needs[type] || 0) > total) continue;

    const taken = used.get(key) ?? new Set();
    for (let nth = 0; nth < total; nth++) {
      if (taken.has(nth)) continue;
      options.push({ pageId, type, key, nth });
    }
  }
  if (!options.length) return null;

  const chosen = shuffle(rng, options)[0];
  if (!used.has(chosen.key)) used.set(chosen.key, new Set());
  used.get(chosen.key).add(chosen.nth);
  return chosen;
}

/**
 * @param {string|null} preferPage  thử trang này trước
 * @param {boolean} strict          nếu true, KHÔNG được rơi sang trang khác
 */
function place(anomaly, budget, used, rng, picks, preferPage = null, strict = false) {
  let slot = preferPage ? claimSlot(anomaly, budget, used, rng, preferPage) : null;
  if (!slot && !strict) slot = claimSlot(anomaly, budget, used, rng, null);
  if (!slot) return false;
  picks.push({
    id: anomaly.id, family: anomaly.family,
    page: slot.pageId, slot: slot.type, nth: slot.nth
  });
  return true;
}

export function plan(chapter, seed, registry = ANOMALIES) {
  const rng = mulberry32(seed);
  const count = range(rng, chapter.min, chapter.max);

  const budget = slotBudget(chapter);
  const used = new Map();
  const picks = [];
  const takenIds = new Set();
  const familyCount = {};

  const bump = (family) => { familyCount[family] = (familyCount[family] || 0) + 1; };

  const eligible = registry.filter((a) => {
    if (chapter.exclude.includes(a.id)) return false;
    return chapter.pages.some((p) => a.slots.some((s) => (p.slots[s] || 0) > 0));
  });

  // 1. Forced anomalies first — the tutorial depends on S07 being present every time.
  for (const id of chapter.force || []) {
    const a = byId(id);
    if (!a || chapter.exclude.includes(id)) continue;
    if (place(a, budget, used, rng, picks)) { takenIds.add(id); bump(a.family); }
  }

  // 2. Round-robin across shuffled families, two passes. One pass guarantees breadth
  //    (>=3 families); the second fills to count without exceeding 2 per family.
  const byFamily = new Map();
  for (const a of eligible) {
    if (takenIds.has(a.id)) continue;
    if (!byFamily.has(a.family)) byFamily.set(a.family, []);
    byFamily.get(a.family).push(a);
  }
  const families = shuffle(rng, [...byFamily.keys()]);

  /* 2a. Phủ hết các trang TRƯỚC, mỗi trang một dị thường, vẫn đi vòng qua các họ để giữ bề
         rộng. Bước 3 ở cuối vẫn còn đó làm lưới an toàn, nhưng mỗi lần nó phải ra tay là một
         dị thường ĐƯỢC THÊM ngoài số đã bốc — với năm trang thì con số BẰNG CHỨNG trôi ra
         ngoài khoảng min..max mà chương tự khai. Phủ trước thì số bốc ra vẫn là số phải tìm. */
  for (const page of mustBeDirty(chapter)) {
    if (picks.length >= count) break;
    if (picks.some((p) => p.page === page.id)) continue;
    for (const family of families) {
      if ((familyCount[family] || 0) >= 2) continue;
      let placed = false;
      for (const a of shuffle(rng, byFamily.get(family))) {
        if (takenIds.has(a.id)) continue;
        if (!place(a, budget, used, rng, picks, page.id, true)) continue;
        takenIds.add(a.id);
        bump(family);
        placed = true;
        break;
      }
      if (placed) break;
    }
  }

  // 2b. Rồi mới lấp cho đủ count, không ràng buộc trang.
  for (let pass = 0; pass < 2 && picks.length < count; pass++) {
    for (const family of families) {
      if (picks.length >= count) break;
      if ((familyCount[family] || 0) >= 2) continue;
      for (const a of shuffle(rng, byFamily.get(family))) {
        if (takenIds.has(a.id)) continue;
        if (place(a, budget, used, rng, picks)) {
          takenIds.add(a.id);
          bump(family);
          break;
        }
      }
    }
  }

  /* 3. Every page must carry at least one, or a player can clear a page that was never dirty.
        KEEP TRYING until one actually lands. The first version picked a single candidate and
        gave up if it would not fit — and "eligible for the chapter" is not "eligible for THIS
        page": I03 needs two avatars, T08 needs a byline, and chapter 2's index page has
        neither. So on roughly 2% of seeds the fallback chose something that could not go
        there, placed nothing, and left a whole page clean. Chapter 1 has one page, so this
        step never ran and the bug could not appear until there was a second page. */
  for (const page of mustBeDirty(chapter)) {
    if (picks.some((p) => p.page === page.id)) continue;
    for (const a of shuffle(rng, eligible)) {
      if (takenIds.has(a.id)) continue;
      if ((familyCount[a.family] || 0) >= 2) continue;
      if (!place(a, budget, used, rng, picks, page.id, true)) continue;
      takenIds.add(a.id);
      bump(a.family);
      break;
    }
  }

  // `count` is the number ROLLED, not the number placed. Keeping them separate is what lets
  // the test catch under-placement — a director that promises six and places four produces a
  // chapter that cannot be won, and nothing on screen would say so.
  return { seed, count, picks };
}
