/* Luật tính điểm. Thuần tuý: nhận sẵn danh sách mục tiêu thay vì tự đọc DOM, nên luật máu
   kiểm thử được mà không cần trình duyệt. Spec §4.3.

   Hai kết quả duy nhất tốn máu: khoanh trúng nội dung sạch, và khoanh không trúng gì.
   Vòng quá nhỏ, quá rộng, hoặc CHƯA KHÉP LẠI đều bị loại TRƯỚC khi dò trúng, nên chúng không
   hé lộ gì về trang và không thể dùng để dò tìm. Một nét vẽ dở dang là một cử chỉ người chơi
   chưa làm xong; khép nó lại hộ họ tức là tính điểm một lời khai họ chưa hề đưa ra. */

import { nearestEnclosed, VOID_VERDICTS } from './hittest.js';

/**
 * Đối chiếu kế hoạch với thực tế sau khi đã áp dụng xong.
 *
 * Một dị thường có thể lặng lẽ không gắn được vào đâu cả — S01 từng như thế, vì nó tìm một
 * chữ không hề có trong trang. Khi đó BẰNG CHỨNG đếm tới một con số không bao giờ đạt được
 * và chương trở nên bất khả thắng, mà trên màn hình không có gì báo hiệu. Ở đây ta bỏ những
 * dị thường không hiện diện, để lượt chơi luôn thắng được.
 *
 * Họ REACTIVE được miễn: chúng cố tình chỉ hiện ra sau khi người chơi thử nghiệm, nên lúc
 * này chưa có mặt trong DOM là đúng chứ không phải hỏng.
 *
 * @param {object} run
 * @param {Set<string>} presentIds  id đã thực sự gắn được vào DOM
 * @param {(id: string) => object|null} lookup
 * @returns {string[]} những id đã bị loại
 */
export function reconcile(run, presentIds, lookup) {
  const dropped = [];
  run.picks = run.picks.filter((pick) => {
    if (presentIds.has(pick.id) || lookup(pick.id)?.deferred) return true;
    dropped.push(pick.id);
    return false;
  });
  run.total = run.picks.length;
  return dropped;
}

/**
 * Ghi tên dị thường lên một phần tử — và KHÔNG BAO GIỜ ghi đè lên dị thường khác.
 *
 * Vì sao cần: hầu hết dị thường chỉ đụng vào đúng chỗ bám của mình, và đạo diễn đã bảo đảm
 * mỗi phần tử slot chỉ nhận một dị thường. Nhưng vài cái cố tình với RA NGOÀI chỗ bám —
 * I03 đánh dấu cả tấm ảnh của avatar bên cạnh, I04 đi từ figcaption sang thẻ <img> — nên hai
 * dị thường vẫn có thể cùng trỏ vào một phần tử dù đạo diễn không hề sai.
 *
 * Bản đầu gán thẳng `el.dataset.anom = id`, và cái gán thứ hai ĐÈ MẤT cái thứ nhất. Hậu quả
 * không hề nhỏ, đã bắt được trên máy thật:
 *   · chương 4 hạt 13 — I03 chỉ còn MỘT tấm ảnh mang dấu, tức là cặp "hai cái tên một khuôn
 *     mặt" lại phân biệt được, đúng thứ mà I03 tồn tại để chống;
 *   · chương 5 hạt 5 — I03 đè mất I04, reconcile() loại I04 khỏi lượt chơi, nhưng tấm ảnh
 *     VẪN mờ dần trước mắt người chơi. Khoanh vào đó thì nhận "ĐÃ GHI RỒI" và không có gì
 *     xảy ra: một dị thường nhìn thấy được mà vĩnh viễn không khoanh được.
 *
 * Nên ở đây nó từ chối và trả về null. Dị thường gọi nó phải tự xử: hoặc tìm phần tử khác,
 * hoặc bỏ cuộc — bỏ cuộc thì reconcile() loại nó đi một cách sạch sẽ và lượt chơi vẫn thắng
 * được, còn hơn là để lại một mục BẰNG CHỨNG không bao giờ đạt tới.
 *
 * @returns {Element|null} chính phần tử đó nếu ghi được, null nếu chỗ đã có chủ.
 */
export function claimMark(el, id) {
  if (!el) return null;
  const taken = el.dataset.anom;
  if (taken && taken !== id) return null;
  el.dataset.anom = id;
  el.setAttribute('data-catch', '');
  return el;
}

/**
 * Bỏ cuộc — kết thúc lượt chơi ngay và mở toàn bộ đáp án.
 * Không phải là thua vì hết máu: máu còn lại giữ nguyên, nhưng lượt này không tính hạng,
 * vì nếu bỏ cuộc mà vẫn được xếp hạng thì "xem đáp án" trở thành nước đi tối ưu.
 */
export function giveUp(run) {
  if (run.over) return false;
  run.over = true;
  run.won = false;
  run.gaveUp = true;
  return true;
}

export function resolve(run, stroke, verdict, targetList) {
  if (run.over) return { outcome: 'ALREADY' };
  // Voided before any hit-testing: too short, past the budget ring, or a loop that never came
  // back to where it started. None costs a heart and none reveals anything about the page.
  if (VOID_VERDICTS.includes(verdict)) return { outcome: verdict };

  const hit = nearestEnclosed(stroke, targetList);

  if (hit && hit.anomaly) {
    if (run.found.has(hit.anomId)) return { outcome: 'ALREADY', anomId: hit.anomId };
    run.found.add(hit.anomId);
    if (run.found.size >= run.total) { run.over = true; run.won = true; }
    return { outcome: 'CAPTURED', anomId: hit.anomId };
  }

  run.hearts -= 1;
  if (run.hearts <= 0) { run.hearts = 0; run.over = true; run.won = false; }
  return { outcome: 'WRONG' };
}
