/* Gắn trang giả vào shadow root. Vì sao shadow root: CSS của trang giả dùng selector trần
   (h1 {}, nav a {}) mà không được phép chạm tới HUD. Vì sao KHÔNG dùng elementFromPoint để
   dò trúng: nó không xuyên qua ranh giới shadow — ta đọc rect của các phần tử đã biết. */

/**
 * The fake site must never navigate the real browser.
 *
 * Its markup is honest markup — real <a href="#"> links, a real <form> with a real submit
 * button — because anything less would read as a mock-up. But a submit reloads the document
 * and destroys the run in progress, and a link jumps the page out from under the player.
 * Both are sealed here, in the capture phase, so anomaly handlers still see their events:
 * preventDefault stops the browser, not the other listeners.
 */
const SEALED = new WeakSet();

function sealNavigation(shadow) {
  // mount() reuses the shadow root across replays; its listeners survive innerHTML, so
  // without this the seals would stack up one set per chapter started.
  if (SEALED.has(shadow)) return;
  SEALED.add(shadow);

  shadow.addEventListener('click', (e) => {
    const link = e.composedPath().find((n) => n.tagName === 'A' && n.hasAttribute('href'));
    if (link) e.preventDefault();
  }, true);

  shadow.addEventListener('submit', (e) => e.preventDefault(), true);

  // A submit button outside any form, or one whose form was replaced by an anomaly.
  shadow.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.composedPath().some((n) => n.tagName === 'INPUT')) {
      e.preventDefault();
    }
  }, true);
}

export function mount(host, page, baseHref) {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<link rel="stylesheet" href="${baseHref}${page.css}">${page.html}`;
  sealNavigation(shadow);
  return shadow;
}

export function slotElement(shadow, type, nth) {
  return shadow.querySelectorAll(`[data-slot="${type}"]`)[nth] ?? null;
}

/**
 * Where a target can be hit — one point per RENDERED LINE OF TEXT, not the element's centre.
 *
 * A block element's border box spans the whole column. A one-line <p> therefore has its
 * geometric centre out in the empty margin to the right of its words, so a player circling
 * the sentence they can see would miss it, while circling blank space would score. Ranges
 * give the tight text rects instead, one per line, so every visible line is circleable.
 * Replaced elements (an <img>, an empty node) have no text rects and fall back to their box.
 */
function hitGeometry(el) {
  const points = [];
  const rects = [];
  const take = (r) => {
    rects.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    points.push({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  };

  try {
    const range = el.ownerDocument.createRange();
    range.selectNodeContents(el);
    for (const r of range.getClientRects()) {
      if (r.width < 2 || r.height < 2) continue;
      take(r);
    }
  } catch { /* detached node — fall through to the box */ }

  if (!points.length) {
    const r = el.getBoundingClientRect();
    if (r.width || r.height) take(r);
  }
  return { points, rects };
}

/**
 * Every element the lasso can resolve against, as plain numbers for hittest.js.
 * A captured anomaly stays in the list so re-circling it is a no-op rather than a heart.
 */
export function targets(shadow) {
  const out = [];
  let n = 0;
  for (const el of shadow.querySelectorAll('[data-anom], [data-catch]')) {
    const { points, rects } = hitGeometry(el);
    if (!points.length) continue;                       // hidden markers are not targets
    out.push({
      id: el.dataset.anom ? `anom:${el.dataset.anom}:${n++}` : `catch:${n++}`,
      anomaly: Boolean(el.dataset.anom),
      anomId: el.dataset.anom ?? null,
      el,
      points,
      rects
    });
  }
  return out;
}
