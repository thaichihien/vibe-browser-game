/* D → SS ranking.
 *
 * Crazy Arcade grades every monster-mode run on kills + total play time +
 * deaths, and that grade is the reason people replay a map they have already
 * cleared. Time is summed across all three stages, so a slow stage 1 can be
 * paid back by a fast stage 3 — which is exactly why the target is shown up
 * front and the running total is on screen the whole way.
 */

import { RANKS, RANK_WEIGHTS, DEATH_PENALTY } from '../config.js';

/* `run` is { kills, time, deaths }; `ss` is the raid's { kills, time } target. */
export function score(run, ss) {
  const kills = Math.min(1, run.kills / Math.max(1, ss.kills));
  /* Beating the target time is worth no more than hitting it exactly — there is
   * no prize for rushing past SS, only for reaching it. */
  const time = Math.min(1, ss.time / Math.max(1, run.time));
  const clean = Math.max(0, 1 - run.deaths * DEATH_PENALTY);
  return kills * RANK_WEIGHTS.kills + time * RANK_WEIGHTS.time + clean * RANK_WEIGHTS.noDeath;
}

export function rankOf(run, ss) {
  const s = score(run, ss);
  const band = RANKS.find(r => s >= r.at) || RANKS[RANKS.length - 1];
  return { ...band, score: s };
}

/* What each component contributed, for the results card. */
export function breakdown(run, ss) {
  return [
    { label: 'Tiêu diệt', got: `${run.kills}`, target: `${ss.kills}`,
      ok: run.kills >= ss.kills },
    { label: 'Thời gian', got: fmt(run.time), target: fmt(ss.time),
      ok: run.time <= ss.time },
    { label: 'Số lần chết', got: `${run.deaths}`, target: '0',
      ok: run.deaths === 0 },
  ];
}

export function fmt(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
