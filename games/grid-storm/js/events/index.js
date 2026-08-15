/* The event registry and the picker.
   Adding an event means importing it into one of the three lists — the
   scheduler in game.js never names an event directly (except the first one). */

import { BARRAGE } from './barrage.js';
import { SETPIECE, expand } from './setpiece.js';
import { MODIFIER } from './modifier.js';
import { ARENA } from './arena.js';

export const FIRST_EVENT = expand;
export const EVENTS = [...BARRAGE, ...SETPIECE, ...ARENA, ...MODIFIER];

/* Weighted pick that avoids what is already running and what just ran. */
export function pickEvent(activeIds, recentIds, allowSolo) {
  let pool = EVENTS.filter(d =>
    !activeIds.includes(d.id) &&
    !recentIds.includes(d.id) &&
    (allowSolo || !d.solo));

  // if we filtered ourselves into a corner, forget the history
  if (!pool.length) pool = EVENTS.filter(d => !activeIds.includes(d.id) && (allowSolo || !d.solo));
  if (!pool.length) return null;

  const total = pool.reduce((s, d) => s + (d.weight || 1), 0);
  let roll = Math.random() * total;
  for (const d of pool) {
    roll -= (d.weight || 1);
    if (roll <= 0) return d;
  }
  return pool[pool.length - 1];
}
