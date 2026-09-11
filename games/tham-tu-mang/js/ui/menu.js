/* Kho hồ sơ. Chương bị khoá chỉ hiện một tiêu đề đã bôi đen — biết là còn thứ khác ở đó,
   không biết là thứ gì. */

import { CHAPTERS, unlockedUpTo, unlockAllRequested } from '../chapters/index.js';
import { rankFor } from '../storage.js';

export function renderMenu(host, onPick) {
  host.innerHTML = `
    <h1 class="menu-title">THÁM TỬ MẠNG</h1>
    <p class="menu-sub">Mở một trang web. Tìm những thứ không nên ở đó. Ba trái tim.</p>
    <div id="cases"></div>
    ${unlockAllRequested() ? '<p class="menu-debug">⚙ ?unlock=1 — mọi chương đang được mở để thử. Tiến độ đã lưu không bị đổi.</p>' : ''}`;

  const list = host.querySelector('#cases');
  const open = unlockedUpTo();

  CHAPTERS.forEach((chapter, i) => {
    const locked = i >= open;
    const button = document.createElement('button');
    button.className = locked ? 'case locked' : 'case';
    button.type = 'button';
    button.disabled = locked;
    button.innerHTML = `
      <span class="case-no">HỒ SƠ ${String(i + 1).padStart(2, '0')}</span>
      <span>
        <span class="case-name">${locked ? '████████' : chapter.title}</span><br>
        <span class="case-sub">${locked ? 'Chưa được cấp quyền xem' : chapter.subtitle}</span>
      </span>
      <span class="case-rank">${locked ? '🔒' : rankFor(chapter.id)}</span>`;
    if (!locked) button.addEventListener('click', () => onPick(chapter));
    list.appendChild(button);
  });
}
