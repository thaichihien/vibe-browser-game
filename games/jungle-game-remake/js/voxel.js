/* Voxel builder: fill a sparse grid with colours, then mesh only the faces that touch air,
   with per-corner ambient occlusion baked into the vertex colours. Pure JS on purpose — no
   THREE, no DOM — so the tests import it directly; mesh.js turns the arrays into geometry. */

const OFF = 512, SPAN = 1024;            // coordinates must stay within [-512, 511]
const key = (x, y, z) => ((x + OFF) * SPAN + (y + OFF)) * SPAN + (z + OFF);

/** Deterministic 0..1 hash of an integer triple — colour noise and scatter without Math.random. */
export function hash3(x, y, z, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^
    Math.imul(z | 0, 1440662683) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Each face: outward normal and its 4 corners, counter-clockwise seen from outside.
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];
// Brightness for 0..3 open neighbours around a corner. Kept light: shadows stay airy.
const AO = [0.64, 0.78, 0.9, 1];

export class VoxelGrid {
  constructor() { this.cells = new Map(); }

  set(x, y, z, color) {
    const k = key(x, y, z);
    if (color == null) this.cells.delete(k);
    else this.cells.set(k, { x, y, z, color });
    return this;
  }
  get(x, y, z) { return this.cells.get(key(x, y, z))?.color; }
  has(x, y, z) { return this.cells.has(key(x, y, z)); }
  get size() { return this.cells.size; }
  each(fn) { for (const v of this.cells.values()) fn(v); }

  /** Inclusive box. `color` is a hex number or (x,y,z) => hex|null (null leaves the cell alone). */
  box(x0, y0, z0, x1, y1, z1, color) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) {
          const c = typeof color === 'function' ? color(x, y, z) : color;
          if (c != null) this.set(x, y, z, c);
        }
    return this;
  }

  /** Solid ellipsoid; centres may be half-integers for even-width shapes. */
  ellipsoid(cx, cy, cz, rx, ry, rz, color) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
          const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
          if (d > 1) continue;
          const c = typeof color === 'function' ? color(x, y, z) : color;
          if (c != null) this.set(x, y, z, c);
        }
    return this;
  }

  merge(other) { other.each(v => this.set(v.x, v.y, v.z, v.color)); return this; }

  /** Copy reflected across the model's centre line: x → −1 − x (cells span [x, x+1]). */
  mirrorX() {
    const g = new VoxelGrid();
    this.each(v => g.set(-1 - v.x, v.y, v.z, v.color));
    return g;
  }

  mesh({ jitter = 0.05, seed = 7 } = {}) {
    const pos = [], nor = [], col = [], sway = [], idx = [];
    let minY = Infinity, maxY = -Infinity;
    for (const v of this.cells.values()) { minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y); }
    const spanY = maxY - minY + 1;
    const solid = (x, y, z) => this.cells.has(key(x, y, z));

    for (const v of this.cells.values()) {
      const { x, y, z } = v;
      const r = ((v.color >> 16) & 255) / 255;
      const g = ((v.color >> 8) & 255) / 255;
      const b = (v.color & 255) / 255;
      const shade = 1 + (hash3(x, y, z, seed) - 0.5) * 2 * jitter;

      for (const f of FACES) {
        const [nx, ny, nz] = f.n;
        if (solid(x + nx, y + ny, z + nz)) continue;
        const axis = nx ? 0 : ny ? 1 : 2;
        const u = (axis + 1) % 3, w = (axis + 2) % 3;
        const front = [x + nx, y + ny, z + nz];      // the layer of cells this face looks into
        const base = pos.length / 3;
        const ao = [];
        for (const c of f.c) {
          const su = c[u] ? 1 : -1, sw = c[w] ? 1 : -1;
          const a = [...front]; a[u] += su;
          const bb = [...front]; bb[w] += sw;
          const cc = [...front]; cc[u] += su; cc[w] += sw;
          const s1 = solid(...a) ? 1 : 0, s2 = solid(...bb) ? 1 : 0, s3 = solid(...cc) ? 1 : 0;
          const level = s1 && s2 ? 0 : 3 - (s1 + s2 + s3);
          ao.push(level);
          const k = AO[level] * shade;
          pos.push(x + c[0], y + c[1], z + c[2]);
          nor.push(nx, ny, nz);
          col.push(Math.min(1, r * k), Math.min(1, g * k), Math.min(1, b * k));
          sway.push((y + c[1] - minY) / spanY);
        }
        // flip the quad's diagonal so AO interpolates without the classic seam
        if (ao[0] + ao[2] > ao[1] + ao[3]) idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
        else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    return {
      positions: new Float32Array(pos), normals: new Float32Array(nor),
      colors: new Float32Array(col), sway: new Float32Array(sway),
      indices: new Uint32Array(idx), minY, maxY,
    };
  }
}
