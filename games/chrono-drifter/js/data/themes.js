/* The eras. Nothing crosses an era boundary — a knight never meets a
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
import wuxia from './themes/wuxia.js';
import tamquoc from './themes/tamquoc.js';
import daiviet from './themes/daiviet.js';
import taydu from './themes/taydu.js';
import diaphu from './themes/diaphu.js';
import arab from './themes/arab.js';
import cthulhu from './themes/cthulhu.js';
import noir from './themes/noir.js';
import daidich from './themes/daidich.js';
import comong from './themes/comong.js';
import bautroi from './themes/bautroi.js';

export const ERAS = [fantasy, cyber, space, sail, egypt, japan, west, waste, norse, steam, stone, atlantis,
                     wuxia, tamquoc, daiviet, taydu, diaphu, arab, cthulhu, noir, daidich, comong, bautroi];
export const byKey = (k) => ERAS.find(e => e.key === k);
