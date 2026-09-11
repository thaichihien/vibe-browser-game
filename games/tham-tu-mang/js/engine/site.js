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
    /* The fake site's OWN links have to work — chapters 2 and 3 are multi-page, and a blog
       whose post titles do not open the post is not a blog. They are marked `data-goto` and
       routed through a page swap; the browser is still never allowed to navigate, so the run
       survives. Everything else stays sealed.
       preventDefault only stops the browser: anomaly handlers on the same link still run,
       which is what R06 depends on. */
    const nav = e.composedPath().find((n) => n.dataset?.goto);
    if (nav) {
      e.preventDefault();
      shadow.dispatchEvent(new CustomEvent('site:goto', { detail: nav.dataset.goto }));
      return;
    }
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

/**
 * Mount EVERY page of the chapter at once, and navigate by showing one of them.
 *
 * The alternative — re-rendering a page each time the player navigates to it — loses three
 * things at once, and all three are load-bearing:
 *
 *   1. **Anomaly assignment must be fixed for the whole run** (spec §3.3). Re-rendering means
 *      re-running apply(), and an anomaly that picks its word or its position from `rng` would
 *      land somewhere else the second time. A player who cannot go back and check a suspicion
 *      cannot play carefully.
 *   2. **Reactive traces would evaporate.** R01's comment and R06's changed label exist only in
 *      the DOM; navigating away and back would erase evidence the player had already earned.
 *   3. **reconcile() could not run.** It drops anomalies that failed to attach, and it runs once
 *      at start — with one page mounted it would drop every anomaly belonging to the others and
 *      quietly shrink the evidence count.
 *
 * Hidden pages cost nothing: targets() skips anything `checkVisibility()` calls hidden, so they
 * offer no hit targets, and their IntersectionObservers do not fire until the page is shown.
 */
export function mount(host, pages, baseHref) {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  shadow.innerHTML =
    `<link rel="stylesheet" href="${baseHref}${pages[0].css}">` +
    pages.map((p) => `<div class="tt-page" data-page="${p.id}">${p.html}</div>`).join('');
  sealNavigation(shadow);
  showPage(shadow, pages[0].id);
  return shadow;
}

/** display:none rather than [hidden], which a site stylesheet can override without meaning to. */
export function showPage(shadow, pageId) {
  for (const el of shadow.querySelectorAll('[data-page]')) {
    el.style.display = el.dataset.page === pageId ? '' : 'none';
  }
}

export function pageElement(shadow, pageId) {
  return shadow.querySelector(`[data-page="${pageId}"]`);
}

/** Which page an element lives on — the results panel needs it to navigate before scrolling. */
export function pageIdOf(el) {
  return el?.closest('[data-page]')?.dataset.page ?? null;
}

/** Slot lookup is PER PAGE: `paragraph[2]` means the third paragraph of that page, not of the
    chapter. The director assigns pageId alongside the index, and the two have to agree. */
export function slotElement(shadow, pageId, type, nth) {
  const page = pageElement(shadow, pageId);
  return page?.querySelectorAll(`[data-slot="${type}"]`)[nth] ?? null;
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
 * Can the player actually SEE this, right now?
 *
 * A rect is not enough. Chrome lays out the contents of a closed <details> and gives them
 * real, non-zero rects at the position they would occupy if it were open — the collapsed FAQ
 * answers in chapter 1 report 26×18 boxes sitting in what looks like blank page. Without this
 * check the lasso resolves against things nobody can see, which breaks the game in both
 * directions at once: circling apparently empty space silently SCORES an anomaly the player
 * never saw, and the aim ring outlines nothing while they draw. A claim has to be about
 * something on screen.
 *
 * The anomaly is not lost — opening the accordion is ordinary read-mode exploration, and
 * targets() is recomputed at the start of every stroke, so it becomes circleable the moment
 * it is on screen.
 */
function isVisible(el) {
  if (typeof el.checkVisibility !== 'function') return true;   // older engines: rects only
  return el.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true });
}

/**
 * Every element the lasso can resolve against, as plain numbers for hittest.js.
 * A captured anomaly stays in the list so re-circling it is a no-op rather than a heart.
 */
export function targets(shadow) {
  const out = [];
  let n = 0;
  for (const el of shadow.querySelectorAll('[data-anom], [data-catch]')) {
    if (!isVisible(el)) continue;                       // collapsed / hidden — see isVisible
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
