export function renderHud(run) {
  document.getElementById('hud-chapter').textContent = run.chapter.title;
  document.getElementById('hud-hearts').textContent =
    '♥'.repeat(run.hearts) + '♡'.repeat(Math.max(0, 3 - run.hearts));
  document.getElementById('hud-found').textContent = String(run.found.size);
  document.getElementById('hud-total').textContent = String(run.total);
}
