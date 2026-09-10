/* Lasso geometry — spec §4.2 and §4.3. This module decides whether the player loses a heart,
   so it is pure, DOM-free and heavily tested. All coordinates are viewport pixels. */

/** Below this, the gesture is a twitch or a stray click, not a circle. */
export const MIN_STROKE = 12;

/** The budget ring. A loop may not exceed this box — it is what guarantees one anomaly
    per circle, so a player cannot sweep the whole page in one stroke. */
export const MAX_W = 300;
export const MAX_H = 200;

export function bounds(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** Both rejections happen BEFORE any hit-testing, so neither leaks anything about the page. */
export function strokeVerdict(points, cap = { w: MAX_W, h: MAX_H }) {
  if (!points || points.length < 3) return 'TOO_SMALL';
  const b = bounds(points);
  if (b.w < MIN_STROKE && b.h < MIN_STROKE) return 'TOO_SMALL';
  if (b.w > cap.w || b.h > cap.h) return 'TOO_BIG';
  return 'OK';
}

/** Ray casting. Self-intersecting scribbles resolve by the even-odd rule, which is fine —
    the player drew a mess and gets a defensible answer rather than an exception. */
export function pointInPolygon(pt, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x, yi = points[i].y;
    const xj = points[j].x, yj = points[j].y;
    const straddles = (yi > pt.y) !== (yj > pt.y);
    if (straddles && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function centroid(points) {
  let x = 0, y = 0;
  for (const p of points) { x += p.x; y += p.y; }
  return { x: x / points.length, y: y / points.length };
}

export function pointInRect(pt, r) {
  return pt.x >= r.left && pt.x <= r.right && pt.y >= r.top && pt.y <= r.bottom;
}

/**
 * Score exactly one target — the enclosed element whose centre sits nearest the loop's
 * centroid. Even if a tight loop catches two neighbours, the claim resolves against the one
 * the player most plainly meant (spec §4.3).
 *
 * A target may offer SEVERAL hit points rather than one centre, and any of them counts. That
 * matters because a block element's border box is the full column width: a one-line paragraph's
 * geometric centre can sit in empty margin far to the right of its text, so circling the words
 * you can actually see would miss, and circling blank space would hit. Callers pass one point
 * per rendered line of text instead — see site.js.
 *
 * @param {{x:number,y:number}[]} points
 * @param {{id:string, anomaly:boolean, cx?:number, cy?:number, points?:{x,y}[]}[]} targets
 * @returns {object|null} the winning target, or null if the loop encloses nothing
 */
export function nearestEnclosed(points, targets) {
  const c = centroid(points);
  const hits = [];

  for (const t of targets) {
    const candidates = t.points ?? [{ x: t.cx, y: t.cy }];
    let d = Infinity;
    for (const p of candidates) {
      if (!pointInPolygon(p, points)) continue;
      d = Math.min(d, (p.x - c.x) ** 2 + (p.y - c.y) ** 2);
    }

    /* Scribbling ON something selects it. Players mark a thing by drawing over it far more
       often than by neatly encircling it, and requiring a target's own centre to fall inside
       the loop punished that. If the loop's centre lands on the target, that is a claim. */
    if (d === Infinity && t.rects?.some((r) => pointInRect(c, r))) d = 0;

    if (d !== Infinity) hits.push({ t, d });
  }
  if (!hits.length) return null;

  /* Anomalies outrank ordinary content. Anomalies are usually NESTED inside a clean target —
     S01's odd word is a <span> inside a <p data-catch>, E04's extra line sits in the footer —
     so circling the anomaly encloses its container too. Resolving purely by distance let the
     container win, because a paragraph's line centre sits mid-line while the odd word sits off
     to one side: the player circled the right thing and lost a heart for it. With the stroke
     size already capped, "something suspicious was inside your loop" is the claim they meant. */
  const anomalies = hits.filter((h) => h.t.anomaly);
  const pool = anomalies.length ? anomalies : hits;

  let best = pool[0];
  for (const h of pool) if (h.d < best.d) best = h;   // strict < keeps ties on the earlier target
  return best.t;
}
