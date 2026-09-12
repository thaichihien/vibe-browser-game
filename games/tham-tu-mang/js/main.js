/* Điểm vào duy nhất. boot() được gọi từ index.html — không đụng DOM ở tầng import,
   nếu không bộ test "every module imports" sẽ hỏng. */

import { renderMenu } from './ui/menu.js';
import { CHAPTERS } from './chapters/index.js';
import { isMuted, setMuted, recordClear } from './storage.js';
import { plan } from './engine/director.js';
import { mount, targets, slotElement, showPage, pageElement, pageIdOf, styleReady } from './engine/site.js';
import { nearestEnclosed } from './engine/hittest.js';
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
import { CH2_PAGES } from '../sites/ch2-bep-nha-may/pages.js';
import { CH3_PAGES } from '../sites/ch3-san-do-cu/pages.js';
import { PAGE_INDEX as CH4_INDEX } from '../sites/ch4-ho-vang/page.js';

/* Every page of a chapter, in order. pages[0] is where the player lands. */
const PAGES = {
  'ch1-lumiere': [PAGE_INDEX],
  'ch2-bep-nha-may': CH2_PAGES,
  'ch3-san-do-cu': CH3_PAGES,
  'ch4-ho-vang': [CH4_INDEX]
};

const FEEDBACK = {
  CAPTURED:   ['BẰNG CHỨNG ĐÃ GHI', 'good'],
  WRONG:      ['KHÔNG CÓ GÌ Ở ĐÂY', 'bad'],
  ALREADY:    ['ĐÃ GHI RỒI', 'void'],
  // 'VÒNG CHƯA KHÉP' nay dành đúng cho nghĩa đen của nó: nét vẽ không quay về chỗ bắt đầu.
  // Nét quá ngắn là chuyện khác — một cú giật tay hoặc một cú bấm lạc, nên nói thẳng như vậy.
  TOO_SMALL:  ['NÉT QUÁ NGẮN', 'void'],
  NOT_CLOSED: ['VÒNG CHƯA KHÉP', 'void'],
  TOO_BIG:    ['VÙNG KHOANH QUÁ RỘNG', 'void']
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

  /* Ngắm — viền phần tử SẼ bị tính điểm nếu người chơi thả tay bây giờ.
     Viền này cố tình trung tính: nó nói bạn đang khoanh CÁI GÌ, không nói cái đó có phải dị
     thường hay không. Nếu nó đổi màu theo đúng/sai thì trò chơi tự trả lời hộ người chơi. */
  let aimed = null;
  const setAim = (el) => {
    if (el === aimed) return;
    aimed?.classList.remove('aim-ring');
    aimed = el;
    aimed?.classList.add('aim-ring');
  };

  const lasso = initLasso(document.getElementById('lasso'), mode, {
    onStart: () => (run && !run.over && shadow ? targets(shadow) : null),

    onPreview: (snapshot, stroke, verdict) => {
      if (!snapshot || verdict !== 'OK') { setAim(null); return; }
      setAim(nearestEnclosed(stroke, snapshot)?.el ?? null);
    },

    onStroke: (snapshot, stroke, verdict) => {
      setAim(null);
      if (!run || run.over || !snapshot) return;

      // Resolve against the SAME list the preview used, so the outline the player saw is
      // the claim they made.
      const result = resolve(run, stroke, verdict, snapshot);
      const [message, kind] = FEEDBACK[result.outcome];

      if (result.outcome === 'CAPTURED') {
        for (const el of shadow.querySelectorAll(`[data-anom="${result.anomId}"]`)) {
          el.classList.add('evidence-ring');
        }
      }
      toast(message, kind);
      beep(kind);
      renderHud(run);
      if (run.over) finish();
    }
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

  async function startChapter(chapter) {
    const fromUrl = Number(new URLSearchParams(location.search).get('seed'));
    const seed = Number.isFinite(fromUrl) && fromUrl > 0 ? fromUrl : Date.now() % 2147483647;
    const built = plan(chapter, seed);

    screen.hidden = true;
    hud.hidden = false;
    wrap.hidden = false;

    // The <link> inside the shadow root resolves against the DOCUMENT, not against this
    // module — so the href is relative to games/tham-tu-mang/index.html, not to js/main.js.
    const pages = PAGES[chapter.id];
    shadow = mount(viewport, pages, `./sites/${chapter.slug}/`);

    /* The honest site first, anomalies on top of it — the same order the architecture states:
       sites are authored clean and mutated at run start. A page's behaviour() is how it
       answers ordinary interaction (a form that thanks you, a comment that posts); without
       it, a form that swallows what you typed and says nothing is an anomaly nobody placed. */
    for (const p of pages) p.behaviour?.(shadow);

    /* Đợi CSS của trang trước khi áp dị thường. Dị thường nào hỏi getComputedStyle mà hỏi
       trước lúc stylesheet nạp xong thì nhận về mặc định của thẻ, không phải kiểu dáng thật
       của trang — xem styleReady() trong engine/site.js. */
    await styleReady(shadow);

    run = newRun(chapter, seed, built.picks);

    const rng = mulberry32(seed ^ 0x5f3759df);
    for (const pick of built.picks) {
      const slot = slotElement(shadow, pick.page, pick.slot, pick.nth);
      if (!slot) continue;
      byId(pick.id).apply({
        // root is the PAGE, not the whole shadow root: I03 looks for a second avatar and must
        // not reach across to one on a page the player is not even looking at.
        root: pageElement(shadow, pick.page),
        /* …but a few anomalies are deliberately cross-page: R02 lives on the cart and has to
           hear a click on the product page. They get the whole document, and the rule for
           using it is that the TRIGGER may be anywhere while the EVIDENCE stays on ctx.root —
           an anomaly assigned to the cart that marks something on another page would be
           counted against a page it is not on. */
        shadow,
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

    /* The site's own links, routed rather than followed. Anomaly assignment does not change:
       every page is already mounted and already mutated, so this only swaps which one is on
       screen — go away and come back and it is the same page you left. */
    shadow.addEventListener('site:goto', (e) => {
      if (!run || !pages.some((p) => p.id === e.detail)) return;
      goToPage(e.detail);
    });

    showPage(shadow, run.page);
    lasso.resize();   // the wrap just became visible, so the canvas finally has a real box
    renderHud(run);
    const no = String(CHAPTERS.indexOf(chapter) + 1).padStart(2, '0');
    const scope = pages.length > 1
      ? `<p>Hồ sơ này có <b>${pages.length} trang</b>. Liên kết trên trang vẫn dùng được, và
         dị thường ở đâu thì nằm yên ở đó — đi rồi quay lại vẫn thấy đúng chỗ cũ.</p>`
      : '';
    showOverlay({
      title: `HỒ SƠ ${no} — ${chapter.title}`,
      body: `<p>${chapter.briefing} Có <b>${run.total}</b> thứ trong hồ sơ này không nên ở đó.</p>
             ${scope}
             <p><b>CHẾ ĐỘ ĐỌC</b> là mặc định: cuộn, bấm, gõ, bôi đen chữ — không mất máu.</p>
             <p>Bấm <b>CHẾ ĐỘ KHOANH</b> rồi kéo một vòng quanh thứ đáng ngờ. Khoanh trúng nội
             dung bình thường <b>hoặc khoanh vào khoảng trống</b> đều mất một trái tim.</p>`,
      cta: 'MỞ HỒ SƠ',
      onCta: () => {}
    });
  }

  function goToPage(pageId) {
    run.page = pageId;
    showPage(shadow, pageId);
    window.scrollTo(0, 0);
    lasso.resize();
  }

  /* Mở đáp án: mọi dị thường đều được viền lại — xanh nếu đã tìm ra, hổ phách nếu bỏ sót.
     Chạy ở MỌI kết cục, kể cả thắng, vì câu hỏi "mình đã bỏ sót cái gì" luôn đáng được trả
     lời. Đây là chỗ duy nhất trò chơi tiết lộ vị trí, và nó chỉ nói khi ván đã xong. */
  function reveal() {
    for (const pick of run.picks) {
      const ring = run.found.has(pick.id) ? 'evidence-ring' : 'missed-ring';
      // querySelectorAll, not querySelector: I03 marks both halves of the identical pair.
      for (const el of shadow.querySelectorAll(`[data-anom="${pick.id}"]`)) {
        el.classList.add(ring);
      }
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
        // It may live on a page the player is not currently looking at.
        const onPage = pageIdOf(el);
        if (onPage && onPage !== run.page) goToPage(onPage);
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
