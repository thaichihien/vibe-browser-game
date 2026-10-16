/* Warfield Chess — the enemy general. Alpha-beta negamax over rules.js with a capture-only
   quiescence tail, material + piece-square evaluation. DOM-free: runs inside ai-worker.js, or on
   the main thread if the worker cannot start. The AI sees the whole board — its scouts are
   everywhere; only the player fights in the mist. */
import { legalMoves, applyMove, inCheck, W, positionKey } from './rules.js';

const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// Piece-square tables written as the board looks from White's side: first row = rank 8.
const PST = {
  p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};

const MATE = 100000;

/** Score from the side to move's point of view. */
export function evaluate(s) {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = s.board[i];
    if (!p) continue;
    const r = i >> 3, f = i & 7;
    const idx = p.c === W ? (7 - r) * 8 + f : r * 8 + f;
    const v = VAL[p.t] + PST[p.t][idx];
    score += p.c === W ? v : -v;
  }
  return s.turn === W ? score : -score;
}

function order(s, moves) {
  const key = m => {
    let k = 0;
    if (m.capture >= 0) k += 10 * VAL[s.board[m.capture].t] - VAL[s.board[m.from].t] + 1000;
    if (m.promo) k += 800;
    return k;
  };
  return moves.map(m => [key(m), m]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
}

function quiesce(s, alpha, beta, qd) {
  const stand = evaluate(s);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  if (qd >= 4) return alpha;
  const caps = order(s, legalMoves(s).filter(m => m.capture >= 0 || m.promo));
  for (const m of caps) {
    const v = -quiesce(applyMove(s, m), -beta, -alpha, qd + 1);
    if (v >= beta) return beta;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

function negamax(s, depth, alpha, beta, ply) {
  const moves = legalMoves(s);
  if (!moves.length) return inCheck(s, s.turn) ? -MATE + ply : 0;
  if (s.half >= 100) return 0;
  if (depth <= 0) return quiesce(s, alpha, beta, 0);
  for (const m of order(s, moves)) {
    const v = -negamax(applyMove(s, m), depth - 1, -beta, -alpha, ply + 1);
    if (v >= beta) return beta;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

/** Pick a move for the side to move. `noise` (centipawns) blurs close choices so games vary;
    `seen` holds position keys already reached this game, which the AI avoids when it is ahead. */
export function chooseMove(s, depth = 2, noise = 15, seen = []) {
  const moves = order(s, legalMoves(s));
  if (!moves.length) return null;
  const seenSet = new Set(seen);
  let best = null, bestScore = -Infinity;
  for (const m of moves) {
    const next = applyMove(s, m);
    let v = -negamax(next, depth - 1, -MATE - 1, MATE + 1, 1);
    if (seenSet.has(positionKey(next)) && v > 0) v -= 60;
    v += (Math.random() * 2 - 1) * noise;
    if (v > bestScore) { bestScore = v; best = m; }
  }
  return best;
}
