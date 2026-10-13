/* Pure sizing and coordinate maths for the pixel pipeline, kept THREE-free so tests pin it. */

/** Integer upscale for a stage of cssW × cssH: chunky on big screens, never below 2. */
export function pickScale(cssW, cssH) {
  const s = Math.floor(Math.min(cssW / 400, cssH / 300));
  return Math.max(2, Math.min(4, s));
}

/** Low-res render size for that stage and scale (at least 1×1). */
export function lowRes(cssW, cssH, scale) {
  return { w: Math.max(1, Math.floor(cssW / scale)), h: Math.max(1, Math.floor(cssH / scale)) };
}

/** Board square → world; square centres sit on integer coordinates, (4,3) at the origin. */
export const cellToWorld = (row, col) => ({ x: col - 3, z: row - 4 });
// `+ 0` turns Math.round's −0 (for −0.5 < v < 0) into a plain 0.
export const worldToCell = (x, z) => ({ row: Math.round(z + 4) + 0, col: Math.round(x + 3) + 0 });

/**
 * A click ray is intersected twice: with the board plane (y = 0) and with the river surface.
 * If the y = 0 hit is a solid square, the ray struck that tile's top first and it wins — even
 * when the water-level hit, further along the ray, is a river square (the camera-facing banks).
 * Only when the y = 0 hit is over the river cut did the ray fall through to the water, and then
 * the water-level hit names the river square actually clicked.
 */
export function resolvePick(groundCell, groundIsWater, waterCell, waterCellIsWater) {
  if (groundCell && !groundIsWater) return groundCell;
  if (waterCell && waterCellIsWater) return waterCell;
  return groundCell ?? null;
}
