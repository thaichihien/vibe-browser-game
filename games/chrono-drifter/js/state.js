/* Everything that survives a battle. Two keys, per the house convention. */

import { RELICS } from './data/shop.js';

const SAVE = 'chronoDrifter.save';
const MUTED = 'chronoDrifter.muted';

const DEFAULT = {
  shards: 0,
  score: 0,
  best: 0,
  wins: 0,
  losses: 0,
  stock: {},        // consumable id -> count owned
  satchel: [],      // consumable ids loaded for the next battle
  relics: [],       // relic ids owned
  seen: []          // era keys the Drifter has visited
};

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
};

export const save = { ...DEFAULT, ...read(SAVE, {}) };
export const flush = () => write(SAVE, save);

export function reset() {
  Object.assign(save, structuredClone(DEFAULT));
  flush();
}

export const hasRelic = (id) => save.relics.includes(id);

export const isRelic = (id) => RELICS.some(r => r.id === id);

export function buy(item) {
  if (isRelic(item.id) && hasRelic(item.id)) return false;
  const price = priceOf(item);
  if (save.shards < price) return false;
  save.shards -= price;
  if (isRelic(item.id)) {
    save.relics.push(item.id);
  } else {
    save.stock[item.id] = (save.stock[item.id] || 0) + (hasRelic('backpack') ? 2 : 1);
    // an item you paid for should be usable without hunting for a loadout screen
    if (!save.satchel.includes(item.id) && save.satchel.length < satchelSize()) {
      save.satchel.push(item.id);
    }
  }
  flush();
  return true;
}

/** The credit card is the only thing that moves a price. */
export const priceOf = (item) => Math.round(item.price * (hasRelic('card') ? 0.8 : 1));

/** Five satchel slots, always. Using one costs the unit's turn, so five is plenty. */
export const SATCHEL_MAX = 5;
export const satchelSize = () => SATCHEL_MAX;

export function setSatchel(ids) {
  save.satchel = ids.slice(0, satchelSize());
  flush();
}

/** Spend one from stock when it is actually used in a battle. */
export function consume(id) {
  if (!save.stock[id]) return false;
  save.stock[id]--;
  if (!save.stock[id]) delete save.stock[id];
  flush();
  return true;
}

export function recordResult({ won, score, shards, eraKey, fled }) {
  save.score += score;
  save.best = Math.max(save.best, score);
  save.shards = Math.max(0, save.shards + shards);
  if (won) save.wins++; else save.losses++;
  if (fled) save.fled = (save.fled || 0) + 1;
  if (!save.seen.includes(eraKey)) save.seen.push(eraKey);
  flush();
}

export const muted = {
  get value() { return read(MUTED, false); },
  set value(v) { write(MUTED, !!v); }
};
