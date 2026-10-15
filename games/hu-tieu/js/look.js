/* Every number that sets the look of the picture, in one place. The ?debug panel edits this
   object live and prints it as JSON; paste a tuned copy back over DEFAULTS to make it stick. */

export const DEFAULTS = {
  sky: 1.75,            // hemisphere (sky) light — the overall fill
  sun: 1.35,            // directional sun — highlights and cast shadows
  bands: [120, 200, 255], // toon shading steps 0–255: shadow side, mid, lit side
  brightness: 1.0,      // post: multiply every colour
  contrast: 1.0,        // post: push away from (>1) or toward (<1) mid-grey
  saturation: 1.3,      // post: 1 = as lit, >1 = more colourful
  colorLevels: 14,      // post: steps per colour channel (fewer = more posterised)
  dither: 0.6,          // post: strength of the 4×4 ordered dither
  outline: 0.78,        // post: how dark the ink line is (0 = none, 1 = solid ink)
  outlineDepth: 0.006,  // post: depth jump that counts as an edge (smaller = more lines)
  pixelRows: 300,       // rendered rows on screen — larger = smaller pixels
};

const KEY = 'huTieu.look';
const debug = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

function load() {
  if (!debug) return {};
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

/** The live values. Outside ?debug this is always exactly DEFAULTS. */
export const LOOK = { ...structuredClone(DEFAULTS), ...load() };

export function saveLook() {
  if (!debug) return;
  try { localStorage.setItem(KEY, JSON.stringify(LOOK)); } catch { /* storage blocked */ }
}
export function resetLook() {
  Object.assign(LOOK, structuredClone(DEFAULTS));
  try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
}
