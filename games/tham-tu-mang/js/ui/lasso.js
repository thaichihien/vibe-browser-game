/* Vẽ vòng khoanh. Chỉ vẽ đúng một thứ: chính nét của người chơi.
   Cả hai luật — trần kích thước và phải khép vòng — vẫn được truyền đạt bằng chính nét vẽ
   chứ không phải bằng hình phạt, nhưng bằng MÀU của nét: xám khi vòng chưa khép, xanh khi
   đã đủ khép, đỏ khi vượt trần. */

import { strokeVerdict, MAX_W, MAX_H, bounds, isClosed } from '../engine/hittest.js';

/**
 * hooks.onStart()                      -> snapshot handed back to the other two hooks
 * hooks.onPreview(snapshot, pts, verdict)  live, while drawing
 * hooks.onStroke(snapshot, pts, verdict)   on release
 *
 * The snapshot exists so the target list is measured ONCE per stroke: what the preview
 * outlined is exactly what gets scored, even though a couple of anomalies drift or breathe.
 */
export function initLasso(canvas, mode, hooks) {
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let points = [];
  let anchor = null;
  let snapshot = null;
  let queued = false;

  /* The canvas lives inside #viewport-wrap, which is `hidden` until a chapter starts — so at
     boot clientWidth is 0 and a canvas sized then stays 0x0, silently swallowing every stroke.
     Size it lazily instead: whenever the element's box no longer matches the backing store. */
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return false;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return true;
  }
  resize();
  window.addEventListener('resize', resize);

  const clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height);

  /* Trace the stroke as an OPEN path.
     The first version called closePath() before stroke(), which draws a straight chord from
     the cursor back to the anchor — a hard line cutting across the page that follows the
     cursor the whole way round. Players read it as part of what they were drawing, and it is
     not: it is the renderer guessing at a shape they have not finished making yet. */
  function trace() {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  }

  function draw() {
    clear();
    if (!anchor || points.length < 2) return;

    /* Only the stroke. No budget rectangle, no closing-tolerance ring.
       Both rules are still communicated by the drawing rather than by punishment — that was
       always the point — but through the COLOUR OF THE LINE ITSELF rather than through extra
       dashed furniture drawn over the page. Two guide shapes plus the stroke turned every
       capture into a diagram, and the player is supposed to be looking at the website. */
    const b = bounds(points);
    const over = b.w > MAX_W || b.h > MAX_H;
    const closed = isClosed(points);

    /* The claimed area, shown by filling rather than by drawing the closing line. fill()
       closes the path implicitly, so the player sees the region the loop would take without
       a chord being painted across their stroke. */
    if (closed && !over) {
      ctx.save();
      ctx.fillStyle = 'rgba(53, 138, 112, 0.13)';
      trace();
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // A light halo under the line: the sites run from cream (Ch1) to a black dashboard (Ch6),
    // and a single flat colour disappears into one end or the other.
    trace();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 5;
    ctx.stroke();
    /* Grey while the loop is still open, green once it would close, red past the budget.
       This line is now the ONLY tell for either rule, so it has to be legible before the
       player has any reason to know the rules exist. */
    ctx.strokeStyle = over ? '#c2452f' : closed ? '#358a70' : 'rgba(46, 55, 69, 0.78)';
    ctx.lineWidth = 2.5;
    trace();
    ctx.stroke();
    ctx.restore();
  }

  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  /** Canvas-local points -> viewport points, which is what getBoundingClientRect speaks. */
  const toViewport = (pts) => {
    const r = canvas.getBoundingClientRect();
    return pts.map((p) => ({ x: p.x + r.left, y: p.y + r.top }));
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (!mode.isCapture()) return;
    resize();                       // the wrap may have become visible since the last stroke
    drawing = true;
    anchor = local(e);
    points = [anchor];
    snapshot = hooks.onStart?.() ?? null;
    canvas.setPointerCapture(e.pointerId);
    draw();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    points.push(local(e));
    draw();

    // Preview costs a pass over every target, so run it at most once per frame.
    if (queued || !hooks.onPreview) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (!drawing) return;
      hooks.onPreview(snapshot, toViewport(points),
        strokeVerdict(points, undefined, { requireClosed: false }));
    });
  });

  function finish(e) {
    if (!drawing) return;
    drawing = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* already gone */ }

    const stroke = toViewport(points);
    const verdict = strokeVerdict(points);
    const snap = snapshot;
    points = [];
    anchor = null;
    snapshot = null;
    clear();

    hooks.onStroke(snap, stroke, verdict);
  }

  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);

  return { resize };
}
