/* Thứ tự chương = đường cong độ khó, và cũng là thứ tự mở khoá. Stage 3 thêm chương vào đây. */

import { CH1 } from './ch1-lumiere.js';
import { CH2 } from './ch2-bep-nha-may.js';
import { CH3 } from './ch3-san-do-cu.js';
import { CH4 } from './ch4-ho-vang.js';
import { isCleared } from '../storage.js';

export const CHAPTERS = [CH1, CH2, CH3, CH4];

export const chapterById = (id) => CHAPTERS.find((c) => c.id === id) ?? null;

/**
 * Cờ gỡ lỗi: thêm `?unlock=1` vào URL thì mọi chương đều mở.
 *
 * Đọc LÚC GỌI chứ không phải lúc import — file này được tests/ import trực tiếp trong môi
 * trường không có DOM, và một tham chiếu `location` ở tầng top level sẽ làm hỏng cả bộ test.
 * Nó chỉ mở khoá để xem; tiến độ đã lưu không bị đụng tới, nên tắt cờ đi là mọi thứ trở lại
 * đúng như cũ.
 */
export function unlockAllRequested() {
  if (typeof location === 'undefined') return false;
  try { return new URLSearchParams(location.search).get('unlock') === '1'; }
  catch { return false; }
}

/**
 * Chương đầu luôn mở; chương N mở khi chương N−1 đã phá xong (spec §5).
 *
 * DOM-free và không đọc trạng thái ở đâu ngoài tham số, nên test gọi thẳng được: truyền vào
 * một hàm "đã phá chưa" giả lập là kiểm tra được toàn bộ luật mở khoá mà không cần localStorage.
 */
export function unlockedUpTo(cleared = isCleared) {
  if (unlockAllRequested()) return CHAPTERS.length;
  let n = 1;
  while (n < CHAPTERS.length && cleared(CHAPTERS[n - 1].id)) n += 1;
  return n;
}

export function isUnlocked(chapterId, cleared = isCleared) {
  const i = CHAPTERS.findIndex((c) => c.id === chapterId);
  return i >= 0 && i < unlockedUpTo(cleared);
}
