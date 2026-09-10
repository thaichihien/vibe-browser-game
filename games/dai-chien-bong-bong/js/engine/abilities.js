/* Boss patterns — Crazy Arcade's, not a generic archetype list.
 *
 * Every pattern telegraphs on the grid before it resolves, and `cast()` is the
 * only way to fire one, so "it hit me with something I couldn't see" is not a
 * bug this game can have. What each king actually does:
 *
 *   🐙  spray   water in a ring around its own body — which is why you kill it
 *               by 걸치기, standing with your *centre* on a dry tile while your
 *               body overlaps its edge
 *       cannon  fires a jet down one lane, all the way across the map
 *       clone   splits into one real octopus and two fakes; only the real one
 *               ends the fight, but the fakes will still kill you on contact
 *   🐧  spray   the same ring
 *       hatch   lays eggs that walk, then hatch into fuzzies
 *       charge  barrels down a lane at a player
 *   🦭  drop    3×3 balloons anywhere on the map
 *       roll    rolls flat along an entire row, fast
 *               — and pointedly *no* spray, so standing beside it is safe
 */

import { TILE, TELEGRAPH_MIN, TELEGRAPH_FINAL } from '../config.js';
import { HARD, EMPTY } from './grid.js';
import { flood } from './balloons.js';
import { spawnMonster } from './minions.js';

export function covers(b, c, r) {
  return c >= b.c && c < b.c + b.size && r >= b.r && r < b.r + b.size;
}

export function bossCenter(b) {
  return { c: b.c + (b.size - 1) / 2, r: b.r + (b.size - 1) / 2 };
}

const alive = (state) => state.players.filter(p => p.alive && !p.down);

function pickTarget(state, boss) {
  const list = alive(state);
  if (!list.length) return null;
  const mid = bossCenter(boss);
  return list.sort((a, b) =>
    (Math.abs(a.x / TILE - mid.c) + Math.abs(a.y / TILE - mid.r)) -
    (Math.abs(b.x / TILE - mid.c) + Math.abs(b.y / TILE - mid.r)))[0];
}

const inside = (state, c, r) => state.grid.inBounds(c, r) && state.grid.at(c, r) !== HARD;

const dedupe = (tiles) => {
  const seen = new Set(), out = [];
  for (const t of tiles) {
    const k = t.r * 1000 + t.c;
    if (!seen.has(k)) { seen.add(k); out.push(t); }
  }
  return out;
};

export const PATTERNS = {
  /* A ring of water hugging the boss's own body. Short lead — it is meant to
   * punish standing squarely next to it, not to be dodged from across the map. */
  spray: {
    icon: '💦', name: 'Phun Nước', lead: 0.75,
    plan(state, boss) {
      const tiles = [];
      for (let r = boss.r - 1; r <= boss.r + boss.size; r++)
        for (let c = boss.c - 1; c <= boss.c + boss.size; c++) {
          if (covers(boss, c, r) || !inside(state, c, r)) continue;
          tiles.push({ c, r });
        }
      return tiles.length ? { tiles } : null;
    },
    resolve(state, boss, tel) {
      for (const t of tel.tiles) flood(state, t.c, t.r, -1, false);
      state.shake = Math.max(state.shake, 0.25);
    },
  },

  /* A jet fired from the boss down one lane, the whole width of the map. */
  cannon: {
    icon: '🎯', name: 'Bắn Pháo', lead: 0.9,
    plan(state, boss) {
      const p = pickTarget(state, boss);
      if (!p) return null;
      const mid = bossCenter(boss);
      const pc = state.grid.colOf(p.x), pr = state.grid.rowOf(p.y);
      const horiz = Math.abs(pc - mid.c) >= Math.abs(pr - mid.r);
      const tiles = [];
      if (horiz) {
        const dir = Math.sign(pc - mid.c) || 1;
        const r = Math.round(mid.r);
        for (let k = Math.floor(boss.size / 2) + 1; k < state.grid.cols; k++) {
          const c = Math.round(mid.c) + dir * k;
          if (!inside(state, c, r)) break;
          tiles.push({ c, r });
        }
      } else {
        const dir = Math.sign(pr - mid.r) || 1;
        const c = Math.round(mid.c);
        for (let k = Math.floor(boss.size / 2) + 1; k < state.grid.rows; k++) {
          const r = Math.round(mid.r) + dir * k;
          if (!inside(state, c, r)) break;
          tiles.push({ c, r });
        }
      }
      return tiles.length ? { tiles } : null;
    },
    resolve(state, boss, tel) {
      for (const t of tel.tiles) flood(state, t.c, t.r, -1, false);
    },
  },

  /* Splits into one real body and two fakes. The fakes have their own small
   * health, chase you, and kill on contact — but only the real one ends it. */
  clone: {
    icon: '👥', name: 'Phân Thân', lead: 1.0,
    plan(state, boss) {
      if (boss.cloned) return null;
      return { tiles: [{ c: boss.c + 1, r: boss.r + 1 }] };
    },
    resolve(state, boss) {
      if (boss.cloned) return;
      boss.cloned = true;
      const spots = [
        { c: 2, r: 2 },
        { c: state.grid.cols - 2 - boss.size, r: state.grid.rows - 2 - boss.size },
      ];
      for (const s of spots) {
        state.clones.push({
          def: boss.def, size: boss.size,
          c: s.c, r: s.r,
          x: (s.c + boss.size / 2) * TILE,
          y: (s.r + boss.size / 2) * TILE,
          hp: boss.def.cloneHp || 6,
          hpMax: boss.def.cloneHp || 6,
          step: null, dead: false, hitCd: new Map(), flash: 0, reaped: 0,
        });
      }
      state.shake = 0.6;
      state.banner = { text: 'PHÂN THÂN!', life: 1.6, max: 1.6 };
    },
  },

  /* Lays eggs. Leave one alone and you have made yourself a second monster. */
  hatch: {
    icon: '🥚', name: 'Đẻ Trứng', lead: 0.8,
    plan(state, boss) {
      const spots = [];
      const want = boss.def.eggs || 2;
      for (let r = boss.r - 2; r < boss.r + boss.size + 2 && spots.length < want; r++)
        for (let c = boss.c - 2; c < boss.c + boss.size + 2 && spots.length < want; c++) {
          if (covers(boss, c, r)) continue;
          if (!state.grid.inBounds(c, r) || state.grid.at(c, r) !== EMPTY) continue;
          spots.push({ c, r });
        }
      return spots.length ? { tiles: spots, data: { spots } } : null;
    },
    resolve(state, boss, tel) {
      for (const s of tel.data.spots) {
        spawnMonster(state, { kind: 'egg', c: s.c, r: s.r, move: 'chase' });
      }
    },
  },

  /* Runs down a lane. Contact is lethal like any other body in this game. */
  charge: {
    icon: '💨', name: 'Húc Thẳng', lead: 0.85,
    plan(state, boss) {
      const p = pickTarget(state, boss);
      if (!p) return null;
      const mid = bossCenter(boss);
      const pc = state.grid.colOf(p.x), pr = state.grid.rowOf(p.y);
      const dx = Math.abs(pc - mid.c) >= Math.abs(pr - mid.r) ? Math.sign(pc - mid.c) : 0;
      const dy = dx ? 0 : Math.sign(pr - mid.r);
      if (!dx && !dy) return null;
      const tiles = [];
      for (let k = 1; k <= 7; k++) {
        let blocked = false;
        for (let s = 0; s < boss.size; s++) {
          const c = dx ? (dx > 0 ? boss.c + boss.size - 1 : boss.c) + dx * k : boss.c + s;
          const r = dy ? (dy > 0 ? boss.r + boss.size - 1 : boss.r) + dy * k : boss.r + s;
          if (!state.grid.inBounds(c, r) || state.grid.at(c, r) === HARD) { blocked = true; break; }
          tiles.push({ c, r });
        }
        if (blocked) break;
      }
      return tiles.length ? { tiles, data: { dx, dy } } : null;
    },
    resolve(state, boss, tel) {
      boss.dash = { dx: tel.data.dx, dy: tel.data.dy, left: 7 };
      boss.mode = 'dash';
    },
  },

  /* Rolls flat along an entire row at speed. The only answer is to not be on
   * that row when it commits — which is why the seal's arena has long clear
   * rows and almost nothing to hide behind. */
  roll: {
    icon: '🌀', name: 'Lăn Ngang', lead: 1.1,
    plan(state, boss) {
      const p = pickTarget(state, boss);
      if (!p) return null;
      const tiles = [];
      for (let s = 0; s < boss.size; s++) {
        const r = boss.r + s;
        for (let c = 1; c < state.grid.cols - 1; c++) if (inside(state, c, r)) tiles.push({ c, r });
      }
      const dir = state.grid.colOf(p.x) >= boss.c ? 1 : -1;
      return tiles.length ? { tiles, data: { dx: dir, dy: 0 } } : null;
    },
    resolve(state, boss, tel) {
      boss.dash = { dx: tel.data.dx, dy: 0, left: 20, rolling: true };
      boss.mode = 'dash';
      state.shake = Math.max(state.shake, 0.4);
    },
  },

  /* 3×3 balloons dropped anywhere on the map, including on top of itself. */
  drop: {
    icon: '💧', name: 'Thả Bom', lead: 1.15,
    plan(state, boss) {
      const spots = [];
      const want = 2 + (boss.phase > 0 ? 1 : 0);
      for (let i = 0; i < want * 6 && spots.length < want; i++) {
        const c = 2 + Math.floor(state.rand() * (state.grid.cols - 4));
        const r = 2 + Math.floor(state.rand() * (state.grid.rows - 4));
        if (spots.some(s => Math.abs(s.c - c) < 3 && Math.abs(s.r - r) < 3)) continue;
        spots.push({ c, r });
      }
      const tiles = [];
      for (const s of spots)
        for (let r = s.r - 1; r <= s.r + 1; r++)
          for (let c = s.c - 1; c <= s.c + 1; c++)
            if (inside(state, c, r)) tiles.push({ c, r });
      return tiles.length ? { tiles: dedupe(tiles) } : null;
    },
    resolve(state, boss, tel) {
      for (const t of tel.tiles) flood(state, t.c, t.r, -1, false);
      state.shake = Math.max(state.shake, 0.35);
    },
  },
};

/* The single entry point. Plans the pattern, clamps its lead against the phase
 * floor, and queues it. */
export function cast(state, boss, kind) {
  const pat = PATTERNS[kind];
  if (!pat) return null;
  const plan = pat.plan(state, boss);
  if (!plan) return null;

  const floor = boss.phase >= 2 ? TELEGRAPH_FINAL : TELEGRAPH_MIN;
  const lead = Math.max(floor, boss.phase >= 2 ? pat.lead * 0.75 : pat.lead);

  const tel = { kind, lead, tiles: plan.tiles, data: plan.data || {}, at: state.t + lead, born: state.t, boss };
  state.telegraphs.push(tel);
  return tel;
}

export function updateTelegraphs(state) {
  if (!state.telegraphs.length) return;
  const due = state.telegraphs.filter(t => t.at <= state.t);
  if (!due.length) return;
  state.telegraphs = state.telegraphs.filter(t => t.at > state.t);
  for (const tel of due) PATTERNS[tel.kind].resolve(state, tel.boss, tel);
}
