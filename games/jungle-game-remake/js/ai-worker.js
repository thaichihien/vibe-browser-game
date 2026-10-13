/* Runs the AI search off the main thread, so the scene keeps animating while Hard thinks for
   its full time budget. main.js falls back to calling chooseMove directly if this fails. */
import { chooseMove } from './ai.js';

self.onmessage = ({ data }) => {
  const { id, pieces, player, level, history } = data;
  self.postMessage({ id, move: chooseMove(pieces, player, level, { history }) });
};
