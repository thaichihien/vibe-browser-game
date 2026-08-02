/* The machines on the arcade floor.
 *
 * Every cabinet game exposes the same contract so the meta-layer — the person
 * at the controls, the keycaps, patience, hearts, the comment feed, the CRT —
 * works identically whichever one is running:
 *
 *   id, judge:{ dir, action }, build(level), step(world, dt, input, emit),
 *   draw(r, world, d, dt), sense(world), debugDraw?(ctx, world)
 *
 * `sense` is the only place a cabinet describes itself to the person playing
 * it; who that person is lives in human.js and is shared by all of them.
 */
import { CABINET as platformer } from './platformer.js';
import { CABINET as shmup } from './shmup.js';
import { CABINET as fighter } from './fighter.js';

export const CABINETS = {
  platformer,
  shmup,
  fighter,
};
