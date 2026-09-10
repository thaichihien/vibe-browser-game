/* Kho hồ sơ. Stage 3 thêm khoá chương và hiển thị hạng đầy đủ. */

import { CHAPTERS } from '../chapters/index.js';
import { rankFor } from '../storage.js';

export function renderMenu(host, onPick) {
  host.innerHTML = `
    <h1 class="menu-title">THÁM TỬ MẠNG</h1>
    <p class="menu-sub">Mở một trang web. Tìm những thứ không nên ở đó. Ba trái tim.</p>
    <div id="cases"></div>`;

  const list = host.querySelector('#cases');
  CHAPTERS.forEach((chapter, i) => {
    const button = document.createElement('button');
    button.className = 'case';
    button.type = 'button';
    button.innerHTML = `
      <span class="case-no">HỒ SƠ ${String(i + 1).padStart(2, '0')}</span>
      <span>
        <span class="case-name">${chapter.title}</span><br>
        <span class="case-sub">${chapter.subtitle}</span>
      </span>
      <span class="case-rank">${rankFor(chapter.id)}</span>`;
    button.addEventListener('click', () => onPick(chapter));
    list.appendChild(button);
  });
}
