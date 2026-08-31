/* The retinue: the only way the player commands anything.

   There is no drag-select and no unit portraits. Soldiers become yours by being
   walked up to, and they take orders as one body. Everything you leave behind
   keeps fighting on its own. */

import { ORDERS, ENLIST_RANGE, FOLLOW_GAP, clamp, dist, rnd } from './config.js';
import { queryHash } from './units.js';
import { Sound } from './audio.js';

/* A loose wedge behind the king rather than a rigid block — three ranks, spread
   wider as the retinue grows, so twenty soldiers do not become one blob. */
export function formationSlot(i, n) {
  const rank = Math.floor(i / 5);
  const inRank = i % 5;
  const width = Math.min(5, n - rank * 5);
  const offset = (inRank - (width - 1) / 2) * FOLLOW_GAP;
  return { x: offset, y: (rank + 1) * FOLLOW_GAP * 0.9 };
}

function reslot(kd) {
  kd.retinue.forEach((u, i) => { u.slot = formationSlot(i, kd.retinue.length); });
}

/* ── enlisting ────────────────────────────────────────────────────────────── */

export function enlist(G, kd) {
  const k = kd.king;
  if (!k || !k.alive) return 0;
  const room = kd.retinueCap - kd.retinue.length;
  if (room <= 0) {
    if (kd.isPlayer) { Sound.deny(); G.hooks.onNotice?.('Đoàn tùy tùng đã đầy'); }
    return 0;
  }

  const near = queryHash(G.hash, k.x, k.y, ENLIST_RANGE, G.scratch);
  const candidates = near
    .filter(u => u.alive && u.kd === kd.id && u.kind === 'unit'
                 && u.cls !== 'worker' && !u.courier && !u.inRetinue
                 && dist(k, u) <= ENLIST_RANGE)
    .sort((a, b) => dist(k, a) - dist(k, b))
    .slice(0, room);

  for (const u of candidates) {
    u.inRetinue = true;
    u.order = ORDERS.FOLLOW;
    u.goal = null;
    kd.retinue.push(u);
  }
  reslot(kd);

  if (candidates.length) {
    if (kd.isPlayer) Sound.enlist();
    G.hooks.onNotice?.(`Chiêu mộ ${candidates.length} quân · ${kd.retinue.length}/${kd.retinueCap}`);
  } else if (kd.isPlayer) {
    Sound.deny();
    G.hooks.onNotice?.('Không có quân nào ở gần');
  }
  return candidates.length;
}

export function dismiss(G, kd) {
  if (!kd.retinue.length) { if (kd.isPlayer) Sound.deny(); return; }
  const n = kd.retinue.length;
  for (const u of kd.retinue) {
    u.inRetinue = false;
    u.order = ORDERS.HOLD;
    u.post = { x: u.x, y: u.y };
    u.slot = null;
  }
  kd.retinue.length = 0;
  if (kd.isPlayer) { Sound.order(); G.hooks.onNotice?.(`Giải tán ${n} quân`); }
}

/* drop anyone who died or was otherwise removed */
export function pruneRetinue(kd) {
  const before = kd.retinue.length;
  kd.retinue = kd.retinue.filter(u => u.alive && u.inRetinue);
  if (kd.retinue.length !== before) reslot(kd);
}

/* ── the four orders ──────────────────────────────────────────────────────── */

export function command(G, kd, order) {
  const k = kd.king;
  if (!k || !k.alive) return;
  if (!kd.retinue.length) {
    if (kd.isPlayer) { Sound.deny(); G.hooks.onNotice?.('Chưa có ai trong đoàn tùy tùng'); }
    return;
  }

  const troops = [...kd.retinue];
  const ahead = { x: k.x + Math.cos(k.face) * 620, y: k.y + Math.sin(k.face) * 620 };

  if (order === ORDERS.ATTACK) {
    for (const u of troops) {
      u.inRetinue = false; u.slot = null;
      u.order = ORDERS.ATTACK;
      u.goal = { x: ahead.x + rnd(-40, 40), y: ahead.y + rnd(-40, 40) };
      u.post = null;
    }
    kd.retinue.length = 0;
    notify(G, kd, `⚔ ${troops.length} quân xung phong`);

  } else if (order === ORDERS.HOLD) {
    /* leaving a garrison: they stand where they are and defend it */
    for (const u of troops) {
      u.inRetinue = false; u.slot = null;
      u.order = ORDERS.HOLD;
      u.post = { x: u.x, y: u.y };
      u.goal = null;
    }
    kd.retinue.length = 0;
    notify(G, kd, `🛡 ${troops.length} quân trấn giữ tại đây`);

  } else if (order === ORDERS.HOME) {
    const home = kd.castle;
    if (!home) { if (kd.isPlayer) Sound.deny(); return; }
    for (const u of troops) {
      u.inRetinue = false; u.slot = null;
      u.order = ORDERS.HOME;
      u.goal = { x: home.x + rnd(-70, 70), y: home.y + 110 + rnd(-40, 40) };
      u.post = null;
    }
    kd.retinue.length = 0;
    notify(G, kd, `🏠 ${troops.length} quân rút về lâu đài`);

  } else if (order === ORDERS.SCOUT) {
    /* fan out: each scout gets its own bearing, so this actually explores */
    troops.forEach((u, i) => {
      const a = (i / troops.length) * Math.PI * 2;
      u.inRetinue = false; u.slot = null;
      u.order = ORDERS.SCOUT;
      u.goal = {
        x: clamp(k.x + Math.cos(a) * 1500, 80, G.world.px - 80),
        y: clamp(k.y + Math.sin(a) * 1500, 80, G.world.px - 80)
      };
      u.post = null;
    });
    kd.retinue.length = 0;
    notify(G, kd, `🔎 ${troops.length} quân tỏa đi do thám`);
  }
}

function notify(G, kd, text) {
  if (!kd.isPlayer) return;
  Sound.order();
  G.hooks.onNotice?.(text);
}
