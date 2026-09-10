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
