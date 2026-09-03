/* One wheel for every era. Only the NAMES are reskinned — each era carries
   an `elNames` map and display tags are built at render time, so the same STRIKE
   reads "Lửa Rồng" in Giả Tưởng and "Xung EMP" in Cyberpunk. */

/** Six-element cycle: each beats the next. */
export const RING = ['STORM', 'TIDE', 'EMBER', 'VERDANT', 'FORGE', 'FROST'];

/** RADIANT and UMBRA sit outside the ring and savage each other both ways. */
export const PAIRED = ['RADIANT', 'UMBRA'];

/** STEEL is a true neutral: never boosted, never resisted. */
export const NEUTRAL = 'STEEL';

export const ELEMENTS = [...RING, ...PAIRED, NEUTRAL];

export const STRONG = 1.6;
export const WEAK = 0.7;

/** Damage multiplier for an attack of element `atk` landing on affinity `def`. */
export function mult(atk, def) {
  if (!atk || !def) return 1;
  if (atk === NEUTRAL || def === NEUTRAL) return 1;
  if (atk === 'RADIANT' && def === 'UMBRA') return STRONG;
  if (atk === 'UMBRA' && def === 'RADIANT') return STRONG;
  const i = RING.indexOf(atk), j = RING.indexOf(def);
  if (i < 0 || j < 0) return 1;
  if ((i + 1) % RING.length === j) return STRONG;
  if ((j + 1) % RING.length === i) return WEAK;
  return 1;
}

/** The glyph a move of this element throws across the stage. */
export const PROJECTILE = {
  EMBER: '🔥', TIDE: '💧', STORM: '⚡', VERDANT: '🍃', FORGE: '⚙️',
  FROST: '❄️', RADIANT: '✨', UMBRA: '🟣', STEEL: '💥'
};

/** The burst ring on impact. */
export const BURST = {
  EMBER: ['🔥', '✨', '💢'], TIDE: ['💧', '💦', '✨'], STORM: ['⚡', '✨', '💫'],
  VERDANT: ['🍃', '🌿', '✨'], FORGE: ['⚙️', '✨', '💢'], FROST: ['❄️', '🧊', '✨'],
  RADIANT: ['✨', '⭐', '💫'], UMBRA: ['🟣', '💜', '💫'], STEEL: ['💥', '💢', '✨']
};

/** Vietnamese label for an element in a given era, falling back to the code. */
export const elName = (era, el) => (era && era.elNames && era.elNames[el]) || el;

/** Each element gets one glyph of its own, so the wheel is memorable at a glance. */
export const EL_ICON = {
  EMBER: '🔥', TIDE: '🌊', STORM: '⚡', VERDANT: '🌿', FORGE: '⚙️',
  FROST: '❄️', RADIANT: '✨', UMBRA: '🌑', STEEL: '⚔️'
};

/** Elements that hit `el` for 1.6 — i.e. what this unit is afraid of. */
export function weakTo(el) {
  if (el === NEUTRAL) return [];
  if (el === 'RADIANT') return ['UMBRA'];
  if (el === 'UMBRA') return ['RADIANT'];
  const i = RING.indexOf(el);
  return i < 0 ? [] : [RING[(i - 1 + RING.length) % RING.length]];
}

/** Elements that `el` hits for 1.6. */
export function strongAgainst(el) {
  if (el === NEUTRAL) return [];
  if (el === 'RADIANT') return ['UMBRA'];
  if (el === 'UMBRA') return ['RADIANT'];
  const i = RING.indexOf(el);
  return i < 0 ? [] : [RING[(i + 1) % RING.length]];
}

/** Elements that only scratch `el` (0.7). */
export function resists(el) {
  if (el === NEUTRAL) return [];
  const i = RING.indexOf(el);
  return i < 0 ? [] : [RING[(i + 1) % RING.length]];
}
