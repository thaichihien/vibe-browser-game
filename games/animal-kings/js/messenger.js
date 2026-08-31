/* Couriers.

   Nothing that happens off-screen becomes a popup. It becomes an event, and an
   event becomes a runner who has to physically cross the map and reach the king
   before the king knows anything about it.

   Two things follow from that, and they are the entire point:
     · distance is latency — a raid on a far outpost reaches you late by exactly
       as much as it is far away;
     · a courier can be killed, and then the news simply never arrives. */

import { COURIER, clamp, dist, rnd } from './config.js';
import { onScreen } from './camera.js';
import { nextId } from './entities.js';
import { marchTo } from './combat.js';
import { burst, ring, floatText } from './fx.js';
import { Sound } from './audio.js';

/* higher priority overtakes whatever is queued */
export const NEWS = {
  built:     { icon: '🔨', pri: 1 },
  blocked:   { icon: '🚧', pri: 2 },
  spotted:   { icon: '👁', pri: 3 },
  lost:      { icon: '💀', pri: 4 },
  attacked:  { icon: '🔥', pri: 5 },
  razed:     { icon: '💥', pri: 6 },
  kingSeen:  { icon: '👑', pri: 7 }
};

export function makeCourierState() {
  return { queue: [], live: 0, cooldown: 0, log: [], seen: new Map() };
}

/* Raise an event. Anything the king can already see needs no messenger — he is
   looking at it. */
export function report(G, kd, kind, x, y, text, key = null) {
  if (!kd.isPlayer) return;
  const M = G.messages;
  const spec = NEWS[kind] || NEWS.built;

  if (onScreen(G.cam, x, y, 120)) return;

  /* one runner per subject per stretch of time — a base under attack should not
     send thirty identical boys */
  if (key) {
    const last = M.seen.get(key) || -99;
    if (G.time - last < 22) return;
    M.seen.set(key, G.time);
  }

  M.queue.push({ kind, icon: spec.icon, pri: spec.pri, x, y, text, at: G.time });
  M.queue.sort((a, b) => b.pri - a.pri);
  if (M.queue.length > 8) M.queue.length = 8;
}

export function updateMessengers(G, dt) {
  const M = G.messages;
  const kd = G.player;
  if (!kd.king || !kd.king.alive) return;

  M.cooldown -= dt;
  if (M.queue.length && M.live < COURIER.maxLive && M.cooldown <= 0) {
    const news = M.queue.shift();
    M.cooldown = COURIER.cooldown;
    M.live++;
    G.actors.push(makeCourier(G, kd, news));
  }

  for (let i = G.couriers.length - 1; i >= 0; i--) {
    const c = G.couriers[i];
    if (!c.alive) {
      /* killed en route: the news dies with him, and the king never learns it */
      G.couriers.splice(i, 1);
      M.live--;
      burst(G.fx, c.x, c.y, '#ff5470', 12, 130, '📜');
      continue;
    }
    const k = kd.king;
    if (dist(c, k) < 64) { deliver(G, c); G.couriers.splice(i, 1); M.live--; continue; }
    c.bob += dt * 14;
    marchTo(G, c, k, dt, c.speed);
  }
}

function makeCourier(G, kd, news) {
  const c = {
    id: nextId(), kind: 'unit', cls: 'courier', courier: true,
    kd: kd.id, kingdom: kd, news,
    x: clamp(news.x, 30, G.world.px - 30), y: clamp(news.y, 30, G.world.px - 30),
    vx: 0, vy: 0, face: 0, radius: COURIER.radius,
    hp: COURIER.hp, maxHp: COURIER.hp, speed: COURIER.speed,
    dmg: 0, range: 0, atkEvery: 9, atkCd: 0, armor: 0, pop: 0,
    glyph: '🐦', badge: '📜', name: 'Liên lạc',
    alive: true, state: 'run', inRetinue: false, order: 'courier',
    target: null, post: null, node: null, site: null, home: null,
    bob: 0, idleT: 0, wander: null
  };
  G.couriers.push(c);
  return c;
}

function deliver(G, c) {
  const M = G.messages;
  const line = { ...c.news, delivered: G.time, travel: G.time - c.news.at };
  M.log.unshift(line);
  if (M.log.length > 40) M.log.length = 40;

  c.alive = false;
  ring(G.fx, c.x, c.y, '#ffc247', 8, 60, 0.5, 2);
  floatText(G.fx, c.x, c.y - 26, c.news.icon, '#ffe08a', 1.1, 20);
  Sound.courier();
  G.hooks.onNews?.(line);
}
