/* The satchel. Modern junk is the only edge that travels with a Drifter, which is
   why the shop sells an energy drink into a dragon fight. Using one costs the
   unit's turn — that is the price. DOM-free. */

import { living, ULT_FULL, healScale, applyStat } from './combat.js';

/**
 * Apply a consumable. Returns the events to animate, or null if it cannot be used.
 * `targetUid` is required for items whose `target` is 'ally' or 'foe'.
 */
export function useItem(state, actor, item, targetUid) {
  const ev = [];
  const by = id => state.units.find(u => u.uid === id);
  const allies = living(state, actor.side);
  const foes = living(state, actor.side === 'ally' ? 'foe' : 'ally');
  const t = targetUid ? by(targetUid) : null;

  ev.push({ t: 'log', text: `${actor.n} dùng ${item.icon} ${item.name}.` });
  // no turn is spent: reaching into the satchel does not move the battle clock, so
  // it cannot age the flee window, the era-event schedule or the fatigue cap

  switch (item.id) {
    case 'noodles':   for (const a of allies) heal(a, Math.round(a.max * .15 * healScale(state)), ev); break;
    case 'paperclip': { const f = t || foes[0]; const n = Math.min(f.charge, 30); f.charge -= n;
                        actor.charge = Math.min(ULT_FULL, actor.charge + n);
                        ev.push({ t: 'note', tgt: f.uid, text: `−${n} NỘ` }); break; }
    case 'energy':    heal(t, Math.round(t.max * .35 * healScale(state)), ev); break;
    case 'extinguisher': for (const a of allies) { a.dots = []; applyStat(a, 'wrd', 30, 3); ev.push({ t: 'note', tgt: a.uid, text: 'DẬP LỬA' }); } break;
    case 'ducttape':  t.buffs = t.buffs.filter(b => b.pct > 0); t.dots = []; t.marked = 0;
                      heal(t, Math.round(t.max * .15 * healScale(state)), ev); ev.push({ t: 'note', tgt: t.uid, text: 'GIẢI TRẠNG THÁI' }); break;
    case 'gel':       applyStat(t, 'pwr', 30, 4); ev.push({ t: 'buff', tgt: t.uid, label: 'Gel năng lượng' }); break;
    case 'icepack':   { const fallen = state.units.find(u => u.side === actor.side && !u.alive);
                        if (!fallen) return null;
                        fallen.alive = true; fallen.hp = Math.round(fallen.max * .3);
                        ev.push({ t: 'revive', tgt: fallen.uid, n: fallen.hp }); break; }
    case 'coldbrew':  t.charge = Math.min(ULT_FULL, t.charge + 50); ev.push({ t: 'note', tgt: t.uid, text: '+50 NỘ' }); break;
    case 'ziptie':    { const f = t || foes[0]; f.stunned = 1; ev.push({ t: 'note', tgt: f.uid, text: 'TRÓI CHẶT' }); break; }
    case 'firecracker': for (const f of foes) {              // area damage ignores taunt
                        f.hp -= 120; ev.push({ t: 'dmg', tgt: f.uid, n: 120, el: 'EMBER', em: 1, crit: false });
                        if (f.hp <= 0) { f.hp = 0; f.alive = false; ev.push({ t: 'death', tgt: f.uid }); } } break;
    case 'sunglasses': for (const a of allies) { applyStat(a, 'grd', 25, 3); applyStat(a, 'wrd', 25, 3); ev.push({ t: 'buff', tgt: a.uid, label: 'Kính râm' }); } break;
    case 'balloon':   { const f = t || foes[0]; f.gauge = Math.min(f.gauge, -600); ev.push({ t: 'note', tgt: f.uid, text: 'BAY VỀ CUỐI HÀNG' }); break; }
    case 'pencil':    { const keys = ['pwr', 'grd', 'wrd', 'spd'];
                        for (const k of keys) {
                          const a = state.rng() * .4 + .8, b = state.rng() * .4 + .8;
                          t[k] = Math.max(1, Math.round(t[k] * Math.max(a, b)));   // keep the better draw
                        }
                        ev.push({ t: 'note', tgt: t.uid, text: 'VẼ LẠI CHỈ SỐ' }); break; }
    case 'powerbank': t.extraTurns += 1; ev.push({ t: 'note', tgt: t.uid, text: 'THÊM MỘT LƯỢT' }); break;
    case 'phone':     state.scouted = 3; ev.push({ t: 'note', tgt: actor.uid, text: 'TRA CỨU ĐỊCH' }); break;
    case 'stopwatch': for (const a of allies) a.gauge = 999; for (const f of foes) f.gauge = Math.min(f.gauge, 0);
                      ev.push({ t: 'note', tgt: actor.uid, text: 'ĐÓNG BĂNG DÒNG LƯỢT' }); break;
    default: return null;
  }
  return ev;
}

function heal(u, n, ev) {
  if (!u || !u.alive) return;
  const before = u.hp;
  u.hp = Math.min(u.max, u.hp + n);
  ev.push({ t: 'heal', tgt: u.uid, n: Math.round(u.hp - before) });
}
