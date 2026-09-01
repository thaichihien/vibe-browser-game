/* The street outside — reachable only while the quán is open and quiet.

   A short block: your shopfront in the middle, a wholesale market, a sign shop
   and a pavement cafe either side, traffic on the road and neighbours walking
   past. Deliberately small; it is somewhere to go, not a second game.

   DOM-free, like the rest of the simulation. */

import { clamp, dist, pick } from './config.js';

export const ST_W = 32;
export const ST_H = 13;

/* rows, top to bottom: shopfronts, pavement, kerb, road, far pavement */
export const ROW = {
  SIGN: 1.4,        // where facades hang
  DOOR: 4.0,        // doorway line
  WALK_TOP: 4.9,
  WALK_BOTTOM: 7.4,
  KERB: 7.8,
  ROAD_TOP: 8.4,
  ROAD_BOTTOM: 11.2
};

/* Buildings along the block. `kind` drives what happens at the door; the quán
   itself is spliced in at build time so it can carry the player's own name. */
export const BUILDINGS = [
  { id: 'cho',    kind: 'market', x: 1,  w: 6, emoji: '🥬', name: 'Chợ đầu mối',
    sign: 'CHỢ ĐẦU MỐI', color: '#3f6b48', prompt: 'Vào chợ lấy hàng' },
  { id: 'bang',   kind: 'signs',  x: 8,  w: 5, emoji: '🪧', name: 'Tiệm bảng hiệu',
    sign: 'BẢNG HIỆU', color: '#5a4a7a', prompt: 'Xem bảng hiệu, mặt tiền' },
  { id: 'quan',   kind: 'home',   x: 13, w: 6, emoji: '🍜', name: '',
    sign: '', color: null, prompt: 'Vào quán' },
  { id: 'caphe',  kind: 'cafe',   x: 20, w: 5, emoji: '☕', name: 'Cà phê cóc',
    sign: 'CÀ PHÊ CÓC', color: '#6b4a2f', prompt: 'Ngồi làm ly cà phê' },
  { id: 'taphoa', kind: 'flavour', x: 26, w: 5, emoji: '🏪', name: 'Tạp hoá bà Năm',
    sign: 'TẠP HOÁ', color: '#7a5a3a', prompt: 'Ngó qua tạp hoá' }
];

export const PASSERBY_FACES = [
  '👩🏻', '👨🏽', '🧓🏻', '👦🏾', '👩🏿‍🦱', '🧑🏼', '👨🏻‍🦳', '👧🏼', '👳🏽', '🧕🏽'
];
export const VEHICLES = ['🛵', '🏍️', '🚲', '🚗', '🛺'];

export function createStreet(save, displayName) {
  const buildings = BUILDINGS.map(b =>
    b.kind === 'home'
      ? { ...b, name: displayName, sign: displayName.toUpperCase() }
      : { ...b });

  const street = {
    save, buildings,
    t: 0,
    player: { x: 16, y: ROW.WALK_TOP + 0.6, dir: 'd' },
    walkers: [],
    traffic: [],
    events: []
  };

  for (let i = 0; i < 7; i++) {
    street.walkers.push(makeWalker(Math.random() * ST_W));
  }
  for (let i = 0; i < 5; i++) {
    street.traffic.push(makeVehicle(Math.random() * ST_W));
  }
  Object.assign(street, API);
  return street;
}

function makeWalker(x) {
  const dir = Math.random() < 0.5 ? 1 : -1;
  return {
    face: pick(PASSERBY_FACES), x, dir,
    y: ROW.WALK_TOP + 0.2 + Math.random() * (ROW.WALK_BOTTOM - ROW.WALK_TOP - 0.4),
    speed: 0.9 + Math.random() * 0.7
  };
}

function makeVehicle(x) {
  const dir = Math.random() < 0.5 ? 1 : -1;
  return {
    emoji: pick(VEHICLES), x, dir,
    y: dir > 0 ? ROW.ROAD_TOP + 0.7 : ROW.ROAD_BOTTOM - 0.7,
    speed: 4 + Math.random() * 4
  };
}

const API = {

update(dt) {
  this.t += dt;
  for (const w of this.walkers) {
    w.x += w.dir * w.speed * dt;
    if (w.x < -2) { Object.assign(w, makeWalker(ST_W + 1), { dir: -1 }); }
    if (w.x > ST_W + 2) { Object.assign(w, makeWalker(-1), { dir: 1 }); }
  }
  for (const v of this.traffic) {
    v.x += v.dir * v.speed * dt;
    if (v.x < -3) { Object.assign(v, makeVehicle(ST_W + 2), { dir: -1, y: ROW.ROAD_BOTTOM - 0.7 }); }
    if (v.x > ST_W + 3) { Object.assign(v, makeVehicle(-2), { dir: 1, y: ROW.ROAD_TOP + 0.7 }); }
  }
},

/* The pavement is the only walkable strip: you cannot wander into the road or
   through a shopfront. */
movePlayer(ax, ay, dt, speed = 4.2) {
  if (!ax && !ay) return;
  const len = Math.hypot(ax, ay) || 1;
  const p = this.player;
  p.x = clamp(p.x + (ax / len) * speed * dt, 0.6, ST_W - 0.6);
  p.y = clamp(p.y + (ay / len) * speed * dt, ROW.WALK_TOP, ROW.WALK_BOTTOM);
  p.dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'r' : 'l') : (ay > 0 ? 'd' : 'u');
},

/* which doorway the player is standing in front of */
doorOf(b) { return { x: b.x + b.w / 2, y: ROW.DOOR + 0.9 }; },

targetFor() {
  let best = null, bestD = 1.9;
  for (const b of this.buildings) {
    const d = dist(this.player.x, this.player.y, this.doorOf(b).x, this.doorOf(b).y);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
},

interact() {
  const b = this.targetFor();
  if (!b) return null;
  this.events.push({ kind: 'enter', building: b.id, what: b.kind });
  return b.kind;
},

drainEvents() { const e = this.events; this.events = []; return e; }

};

/* ── the wholesale market run ─────────────────────────────────────────────
   A basket sweeps along the stalls; stop it on fresh produce. Pure logic so
   the reward curve can be tested without a canvas. */
export const MARKET_ROUNDS = 5;
export const MARKET_STALLS = 6;

export function makeMarketRound(rnd = Math.random) {
  const fresh = new Set();
  while (fresh.size < 3) fresh.add((rnd() * MARKET_STALLS) | 0);
  return { fresh: [...fresh].sort((a, b) => a - b) };
}

/* 0..5 good picks → how many ca of cheaper tiền chợ, and how much cheaper */
export function marketReward(hits) {
  const h = clamp(hits, 0, MARKET_ROUNDS);
  if (h <= 1) return { ca: 0, cut: 0 };
  return { ca: h - 1, cut: 0.03 + 0.02 * (h - 2) };
}
