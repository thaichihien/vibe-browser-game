/* The twelve eras. Nothing crosses an era boundary — a knight never meets a
   netrunner, and never stands beside a demon either, because sides are drawn from
   declared rival factions rather than an era-wide pool. */

import fantasy from './themes/fantasy.js';
import cyber from './themes/cyber.js';
import space from './themes/space.js';
import sail from './themes/sail.js';
import egypt from './themes/egypt.js';
import japan from './themes/japan.js';
import west from './themes/west.js';
import waste from './themes/waste.js';
import norse from './themes/norse.js';
import steam from './themes/steam.js';
import stone from './themes/stone.js';
import atlantis from './themes/atlantis.js';

export const ERAS = [fantasy, cyber, space, sail, egypt, japan, west, waste, norse, steam, stone, atlantis];
export const byKey = (k) => ERAS.find(e => e.key === k);
