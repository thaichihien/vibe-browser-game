/* localStorage. Mọi truy cập đều bọc try/catch — chế độ riêng tư ném lỗi khi ghi. */

const KEY_PROGRESS = 'thamTuMang.progress';
const KEY_MUTED = 'thamTuMang.muted';

const ORDER = { '—': 0, B: 1, A: 2, S: 3 };

export function rankOf(hearts) {
  if (hearts >= 3) return 'S';
  if (hearts === 2) return 'A';
  if (hearts === 1) return 'B';
  return '—';
}

export function load() {
  try { return JSON.parse(localStorage.getItem(KEY_PROGRESS)) ?? {}; } catch { return {}; }
}

export function save(progress) {
  try { localStorage.setItem(KEY_PROGRESS, JSON.stringify(progress)); } catch { /* private mode */ }
}

export function rankFor(chapterId) {
  return load()[chapterId]?.rank ?? '—';
}

export function isCleared(chapterId) {
  return rankFor(chapterId) !== '—';
}

/** Chỉ ghi đè khi hạng mới tốt hơn — một lượt tệ không xoá mất thành tích cũ. */
export function recordClear(chapterId, hearts) {
  const progress = load();
  const rank = rankOf(hearts);
  const prev = progress[chapterId];
  if (!prev || ORDER[rank] > ORDER[prev.rank]) progress[chapterId] = { rank, hearts };
  save(progress);
  return rank;
}

export function isMuted() {
  try { return localStorage.getItem(KEY_MUTED) === '1'; } catch { return false; }
}

export function setMuted(on) {
  try { localStorage.setItem(KEY_MUTED, on ? '1' : '0'); } catch { /* private mode */ }
}
