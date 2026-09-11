/* Pickups, stat caps and the four equipped actives. */

import { CAP, ACTIVES, ANCHOR_TIME, ESCAPE_INVULN } from '../config.js';
import { shockwave } from './balloons.js';

const STAT_ITEMS = {
  balloon: p => bump(p.stats, 'balloons'),
  power:   p => bump(p.stats, 'power'),
  shoe:    p => bump(p.stats, 'speedTier'),
  kick:    p => { p.stats.kick = true; },
  throw:   p => { p.stats.throw = true; },
  heart:   p => { p.lives = Math.min(CAP.lives, p.lives + 1); },
};

function bump(stats, key) {
  const cap = key === 'speedTier' ? CAP.speedTier : CAP[key];
  stats[key] = Math.min(cap, stats[key] + 1);
}

/* Returns the pickup kind if it did anything, so the HUD can flash it. */
export function applyItem(p, kind) {
  if (STAT_ITEMS[kind]) { STAT_ITEMS[kind](p); return kind; }
  if (ACTIVES[kind]) { equip(p, kind); return kind; }
  return null;
}

/* Max two actives. Picking up one you already hold refreshes it off cooldown,
 * which makes a duplicate drop useful instead of dead. */
function equip(p, kind) {
  const held = p.actives.find(a => a.kind === kind);
  if (held) { held.cd = 0; return; }
  if (p.actives.length < 2) { p.actives.push({ kind, cd: 0 }); return; }
  p.actives[1] = { kind, cd: 0 };
}

export function tickActives(p, dt) {
  for (const a of p.actives) if (a.cd > 0) a.cd = Math.max(0, a.cd - dt);
}

/* Fire the active in `slot` (0 or 1). Returns the kind used, or null. */
export function useActive(state, p, slot) {
  const a = p.actives[slot];
  if (!a || a.cd > 0 || !p.alive) return null;

  switch (a.kind) {
    case 'needle':
      if (!p.bubble) return null;
      p.bubble = null;
      p.invuln = ESCAPE_INVULN;
      break;
    case 'shield':
      if (p.shield) return null;
      p.shield = true;
      break;
    case 'shockwave':
      if (p.bubble) return null;
      if (!shockwave(state, p)) return null;
      break;
    case 'anchor':
      if (p.bubble) return null;
      p.anchor = ANCHOR_TIME;
      break;
    default:
      return null;
  }
  a.cd = ACTIVES[a.kind].cd;
  state.fx.push({ kind: 'active', x: p.x, y: p.y, icon: ACTIVES[a.kind].icon, life: 0.6, max: 0.6 });
  return a.kind;
}
