/* Trạng thái một lượt chơi. Chỉ run.js được phép thay đổi hearts/found — dị thường thì không
   (spec §3.5): ctx.observe là kênh một chiều. */

export function newRun(chapter, seed, picks) {
  return {
    chapter,
    seed,
    picks,
    hearts: 3,
    total: picks.length,
    found: new Set(),
    page: chapter.pages[0].id,
    over: false,
    won: false,
    gaveUp: false
  };
}

/** Read-only view handed to anomalies through ctx.observe. */
export function observerFor(run) {
  return {
    get hearts() { return run.hearts; },
    get found() { return run.found.size; },
    get total() { return run.total; }
  };
}
