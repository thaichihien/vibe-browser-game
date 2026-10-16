/* Runs the enemy general off the main thread so the battlefield keeps animating while it thinks. */
import { chooseMove } from './ai.js';

self.onmessage = e => {
  const { id, state, depth, noise, seen } = e.data;
  self.postMessage({ id, move: chooseMove(state, depth, noise, seen) });
};
