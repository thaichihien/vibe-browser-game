/* Vẽ vòng khoanh. Vòng tròn ngân sách (budget ring) hiện ra ngay từ pixel đầu tiên, nên
   giới hạn kích thước được truyền đạt bằng chính nét vẽ chứ không phải bằng hình phạt. */

import { strokeVerdict, MAX_W, MAX_H, bounds } from '../engine/hittest.js';

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

  function draw() {
    clear();
    if (!anchor) return;

    // Budget ring — how large this loop is allowed to get.
    ctx.save();
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = 'rgba(233, 229, 223, 0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(anchor.x - MAX_W / 2, anchor.y - MAX_H / 2, MAX_W, MAX_H);
    ctx.restore();

    if (points.length < 2) return;
    const b = bounds(points);
    const over = b.w > MAX_W || b.h > MAX_H;
    ctx.save();
    ctx.strokeStyle = over ? '#d4553f' : '#4fa88b';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
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
      hooks.onPreview(snapshot, toViewport(points), strokeVerdict(points));
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
