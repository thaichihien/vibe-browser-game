/* One stage: build it from its script, step it, decide when it's over.
 *
 * Crazy Arcade's monster mode is Stage 1 → Stage 2 → Boss, and the first two
 * end when every monster is dead. This module is the only place that knows the
 * difference, and the difference is two lines in checkOutcome().
 *
 * Nothing here spawns anything at random. The stage's `monsters` array in
 * data/chapters.js is the level design, and this just instantiates it.
 */

import { createState } from './state.js';
import { createPlayer, updatePlayers } from './players.js';
import { updateBalloons } from './balloons.js';
import { spawnMonster, updateMonsters, aliveMonsters, wakeMonsters } from './minions.js';
import { createBoss, updateBoss } from './boss.js';
import { updateTelegraphs } from './abilities.js';
import { BOSSES } from '../data/bosses.js';

/* `carried` is the per-player stat block from the previous stage of this raid —
 * items persist inside a raid and reset between them. `run` carries the score
 * totals forward, because the rank is measured across all three stages. */
export function createStage(chapter, stageIndex, { carried = [], seats = 2, rand, run } = {}) {
  const spec = chapter.stages[stageIndex];
  const state = createState(spec.map, { rand });

  state.chapter = chapter;
  state.stageIndex = stageIndex;
  state.spec = spec;
  state.theme = chapter.theme;
  state.banner = null;
  state.over = 0;
  /* Totals for the D→SS rank, summed across the whole raid. */
  state.run = run || { kills: 0, time: 0, deaths: 0 };

  const spawns = [state.marks.p1, state.marks.p2];
  for (let i = 0; i < seats; i++) {
    if (!spawns[i]) continue;
    /* Lives are deliberately not carried: a player who ran out sits out the
     * rest of the stage and comes back whole for the next one. */
    state.players.push(createPlayer(i, spawns[i], carried[i]));
  }

  for (const m of spec.monsters || []) spawnMonster(state, m);

  if (spec.boss) {
    const def = BOSSES[spec.boss];
    state.boss = createBoss(def, state.marks, state, seats === 1);
    state.banner = { text: def.name, life: 2.2, max: 2.2 };
  }
  return state;
}

export function updateStage(state, dt, intents) {
  if (state.outcome) return;
  state.t += dt;
  state.run.time += dt;

  const killsBefore = state.kills;
  const deathsBefore = state.deaths;

  updatePlayers(state, dt, intents);
  updateBalloons(state, dt);
  updateMonsters(state, dt);
  updateTelegraphs(state);
  updateBoss(state, dt);
  wakeMonsters(state, 'time', state.t);

  state.run.kills += state.kills - killsBefore;
  state.run.deaths += state.deaths - deathsBefore;

  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);
  if (state.banner) {
    state.banner.life -= dt;
    if (state.banner.life <= 0) state.banner = null;
  }
  for (const f of state.fx) f.life -= dt;
  state.fx = state.fx.filter(f => f.life > 0);

  checkOutcome(state, dt);
}

function checkOutcome(state, dt) {
  const won = state.spec.boss
    ? (state.boss && state.boss.dead)
    : aliveMonsters(state).length === 0;

  /* Everyone out of lives ends the stage: retry it from the start, boss HP
   * reset. Nothing is carried over from a failed attempt except the clock. */
  const lost = state.players.length > 0 && state.players.every(p => p.down);

  if (!won && !lost) { state.over = 0; return; }
  state.over += dt;
  if (state.over >= (won ? 1.0 : 0.9)) state.outcome = won ? 'clear' : 'fail';
}

/* What the next stage of this raid inherits. */
export function carryFrom(state) {
  return state.players.map(p => ({
    stats: { ...p.stats },
    actives: p.actives.map(a => ({ kind: a.kind, cd: 0 })),
  }));
}

export function remaining(state) {
  return state.spec.boss ? (state.boss && !state.boss.dead ? 1 : 0) : aliveMonsters(state).length;
}
