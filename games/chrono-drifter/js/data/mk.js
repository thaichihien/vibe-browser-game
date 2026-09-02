/* Positional constructor so a character fits on two lines in the era files.
   Order: name, emoji, faction, tier, element, body size, HP, PWR, GRD, WRD, SPD, moves, ultimate. */
export const u = (n, e, faction, tier, el, sz, hp, pwr, grd, wrd, spd, mv, ult) =>
  ({ n, e, faction, tier, el, sz, hp, pwr, grd, wrd, spd, mv, ult });

/** Mooks are nameless, cheap and allowed to repeat inside one team. */
export const mook = (n, e, el, sz, hp, pwr, grd, wrd, spd, mv) =>
  ({ n, e, faction: '*', tier: 'grunt', el, sz, hp, pwr, grd, wrd, spd, mv });

/** One enormous thing. Owns the front rank alone. */
export const boss = (n, e, el, sz, hp, pwr, grd, wrd, spd, mv, ult) =>
  ({ n, e, faction: '*', tier: 'boss', el, sz, hp, pwr, grd, wrd, spd, mv, ult });
