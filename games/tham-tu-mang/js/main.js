/* Điểm vào duy nhất. boot() được gọi từ index.html — không đụng DOM ở tầng import,
   nếu không bộ test "every module imports" sẽ hỏng. */

import { renderMenu } from './ui/menu.js';
import { isMuted, setMuted, recordClear } from './storage.js';
import { plan } from './engine/director.js';
import { mount, targets, slotElement } from './engine/site.js';
import { newRun, observerFor } from './state.js';
import { resolve, giveUp, reconcile } from './engine/run.js';
import { initMode } from './ui/mode.js';
import { initLasso } from './ui/lasso.js';
import { toast } from './ui/toast.js';
import { renderHud } from './ui/hud.js';
import { showOverlay } from './ui/overlay.js';
import { beep } from './audio.js';
import { byId } from './engine/registry.js';
import { mulberry32 } from './engine/rng.js';
import { PAGE_INDEX } from '../sites/ch1-lumiere/page.js';

const PAGES = { 'ch1-lumiere': { index: PAGE_INDEX } };

const FEEDBACK = {
  CAPTURED:  ['BẰNG CHỨNG ĐÃ GHI', 'good'],
  WRONG:     ['KHÔNG CÓ GÌ Ở ĐÂY', 'bad'],
  ALREADY:   ['ĐÃ GHI RỒI', 'void'],
  TOO_SMALL: ['VÒNG CHƯA KHÉP', 'void'],
  TOO_BIG:   ['VÙNG KHOANH QUÁ RỘNG', 'void']
};

export function boot() {
  const screen = document.getElementById('screen');
  const hud = document.getElementById('hud');
  const wrap = document.getElementById('viewport-wrap');
  const viewport = document.getElementById('viewport');
  const muteBtn = document.getElementById('mute');

  const mode = initMode(document.getElementById('mode-toggle'));
  let run = null;
  let shadow = null;

  const paintMute = () => { muteBtn.textContent = isMuted() ? '♪̸' : '♪'; };
  paintMute();
  muteBtn.addEventListener('click', () => { setMuted(!isMuted()); paintMute(); });

  /* Một nút, hai vai. Trong lúc chơi: bỏ cuộc. Sau khi xong: mở lại bảng kết quả — vì bấm
     vào một dòng kết quả sẽ đóng bảng để cuộn tới chỗ đó, và người chơi phải quay lại được. */
  const giveUpBtn = document.getElementById('give-up');
  giveUpBtn.addEventListener('click', () => {
    if (!run) return;
    if (run.over) { showResults(); return; }
    if (!giveUp(run)) return;
    beep('bad');
    renderHud(run);
    finish();
  });

  const lasso = initLasso(document.getElementById('lasso'), mode, (stroke, verdict) => {
    if (!run || run.over) return;
    const result = resolve(run, stroke, verdict, targets(shadow));
    const [message, kind] = FEEDBACK[result.outcome];

    if (result.outcome === 'CAPTURED') {
      const el = shadow.querySelector(`[data-anom="${result.anomId}"]`);
      if (el) el.classList.add('evidence-ring');
    }
    toast(message, kind);
    beep(kind);
    renderHud(run);
    if (run.over) finish();
  });

  showMenu();

  function showMenu() {
    hud.hidden = true;
    wrap.hidden = true;
    document.getElementById('overlay').hidden = true;
    screen.hidden = false;
    mode.set(false);
    giveUpBtn.textContent = 'BỎ CUỘC';
    giveUpBtn.title = 'Kết thúc và xem toàn bộ đáp án';
    run = null;
    renderMenu(screen, startChapter);
  }

  function startChapter(chapter) {
    const fromUrl = Number(new URLSearchParams(location.search).get('seed'));
    const seed = Number.isFinite(fromUrl) && fromUrl > 0 ? fromUrl : Date.now() % 2147483647;
    const built = plan(chapter, seed);

    screen.hidden = true;
    hud.hidden = false;
    wrap.hidden = false;

    // The <link> inside the shadow root resolves against the DOCUMENT, not against this
    // module — so the href is relative to games/tham-tu-mang/index.html, not to js/main.js.
    shadow = mount(viewport, PAGES[chapter.id][chapter.pages[0].id], `./sites/${chapter.slug}/`);
    run = newRun(chapter, seed, built.picks);

    const rng = mulberry32(seed ^ 0x5f3759df);
    for (const pick of built.picks) {
      const slot = slotElement(shadow, pick.slot, pick.nth);
      if (!slot) continue;
      byId(pick.id).apply({
        root: shadow,
        slot,
        rng,
        flavour: chapter.flavour[pick.id],
        mark: (el) => { el.dataset.anom = pick.id; el.setAttribute('data-catch', ''); return el; },
        observe: observerFor(run)
      });
    }

    // An anomaly that failed to attach would make BẰNG CHỨNG count to an unreachable number.
    const present = new Set(
      [...shadow.querySelectorAll('[data-anom]')].map((el) => el.dataset.anom)
    );
    const dropped = reconcile(run, present, byId);
    if (dropped.length) {
      console.warn('[tham-tu-mang] anomalies failed to attach and were dropped:', dropped);
    }

    lasso.resize();   // the wrap just became visible, so the canvas finally has a real box
    renderHud(run);
    showOverlay({
      title: 'HỒ SƠ 01 — LUMIÈRE',
      body: `<p>Một trang bán kem dưỡng ẩm. Có <b>${run.total}</b> thứ trên trang này không
             nên ở đó.</p>
             <p><b>CHẾ ĐỘ ĐỌC</b> là mặc định: cuộn, bấm, gõ, bôi đen chữ — không mất máu.</p>
             <p>Bấm <b>CHẾ ĐỘ KHOANH</b> rồi kéo một vòng quanh thứ đáng ngờ. Khoanh trúng nội
             dung bình thường <b>hoặc khoanh vào khoảng trống</b> đều mất một trái tim.</p>`,
      cta: 'MỞ HỒ SƠ',
      onCta: () => {}
    });
  }

  /* Mở đáp án: mọi dị thường đều được viền lại — xanh nếu đã tìm ra, hổ phách nếu bỏ sót.
     Chạy ở MỌI kết cục, kể cả thắng, vì câu hỏi "mình đã bỏ sót cái gì" luôn đáng được trả
     lời. Đây là chỗ duy nhất trò chơi tiết lộ vị trí, và nó chỉ nói khi ván đã xong. */
  function reveal() {
    for (const pick of run.picks) {
      const el = shadow.querySelector(`[data-anom="${pick.id}"]`);
      if (!el) continue;
      el.classList.add(run.found.has(pick.id) ? 'evidence-ring' : 'missed-ring');
    }
  }

  function resultsHtml() {
    const rows = run.picks.map((pick) => {
      const found = run.found.has(pick.id);
      const label = byId(pick.id)?.label ?? pick.id;
      return `<li class="${found ? 'hit' : 'miss'}" data-anom-row="${pick.id}">
                <span class="mark">${found ? '✔' : '✘'}</span>
                <span class="what">${label}</span>
                <span class="where">${pick.slot}</span>
              </li>`;
    }).join('');
    return `<ul class="results">${rows}</ul>
            <p class="results-note">Bấm vào một dòng để cuộn tới chỗ đó trên trang.</p>`;
  }

  function showResults() {
    const title = run.won ? 'HOÀN THÀNH' : run.gaveUp ? 'ĐÃ BỎ CUỘC' : 'THẤT BẠI';
    const lead = run.won
      ? `<p>Bạn tìm được cả ${run.total} dấu vết. Còn ${run.hearts} trái tim.
         Hạng: <b>${run.rank}</b></p>`
      : run.gaveUp
        ? `<p>Bạn dừng ở ${run.found.size}/${run.total}. Đây là toàn bộ những gì có trên trang.</p>`
        : `<p>Hết máu ở ${run.found.size}/${run.total}. Đây là những gì bạn đã bỏ sót.</p>`;

    showOverlay({
      title,
      body: lead + resultsHtml(),
      cta: 'VỀ KHO HỒ SƠ',
      onCta: showMenu
    });

    // Cho phép soi lại từng cái: bấm một dòng thì cuộn tới đúng phần tử đó.
    for (const row of document.querySelectorAll('[data-anom-row]')) {
      row.addEventListener('click', () => {
        const el = shadow.querySelector(`[data-anom="${row.dataset.anomRow}"]`);
        if (!el) return;
        document.getElementById('overlay').hidden = true;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  function finish() {
    mode.set(false);
    reveal();
    // Bỏ cuộc không được xếp hạng — nếu có, "xem đáp án" sẽ là nước đi tối ưu.
    run.rank = run.won ? recordClear(run.chapter.id, run.hearts) : '—';
    giveUpBtn.textContent = 'KẾT QUẢ';
    giveUpBtn.title = 'Mở lại bảng kết quả';
    showResults();
  }
}
