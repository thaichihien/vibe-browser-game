/* Cờ Thú AI — negamax with alpha-beta, a quiescence search over captures and den entries, and
   a transposition table. It searches a compact copy of the board (one Int8Array, +rank for red,
   -rank for blue) with make/unmake, so it never touches the piece objects the views draw.
   No DOM and no THREE: it runs in a module worker (ai-worker.js) and in Node for the tests.
   The move generator mirrors rules.js; tests/jungle-remake-ai.test.mjs compares the two on
   random positions, so a rule change there must be mirrored here. */
import { ROWS, COLS, ANIMALS, terrain } from './rules.js';

const N = ROWS * COLS;
const RAT = 1, LEOPARD = 5, TIGER = 6, LION = 7, ELEPHANT = 8;
const RANK_TYPE = Object.fromEntries(Object.entries(ANIMALS).map(([t, a]) => [a.rank, t]));

const WATER = new Uint8Array(N);
const DEN_OF = new Int8Array(N);      // +1 red's den, -1 blue's den
const WEAK = new Int8Array(N);        // sign of the side that is weakened standing here
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c, t = terrain[r][c];
    if (t === 'water') WATER[i] = 1;
    if (t === 'den') DEN_OF[i] = r === 0 ? 1 : -1;
    // a trap weakens the side it does not belong to: red on rows 7–8, blue on rows 0–1
    if (t === 'trap') WEAK[i] = r >= 7 ? 1 : -1;
  }
}
const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// ---------- evaluation ----------
// The rat is worth more than its rank: it kills the elephant and slips through the river.
const VALUE = [0, 450, 250, 300, 350, 500, 800, 900, 950];
// Bonus for standing close to the enemy den, indexed by Manhattan distance; weak pieces that
// reach the den area are the usual way games are won, so the last steps are worth a lot.
const NEAR = Array.from({ length: 16 }, (_, d) => Math.max(0, 14 - d) * 4 + (d === 1 ? 120 : d === 2 ? 50 : 0));
const PST = [null, new Int16Array(N), new Int16Array(N)];   // [_, red, blue]
for (let i = 0; i < N; i++) {
  const r = Math.floor(i / COLS), c = i % COLS;
  PST[1][i] = NEAR[Math.abs(8 - r) + Math.abs(3 - c)];
  PST[2][i] = NEAR[r + Math.abs(3 - c)];
}

// ---------- zobrist ----------
function mulberry32(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
}
const rnd = mulberry32(0x7a11);
const Z1 = new Int32Array(N * 17), Z2 = new Int32Array(N * 17);
for (let i = 0; i < Z1.length; i++) { Z1[i] = rnd() | 0; Z2[i] = rnd() | 0; }
const ZSIDE1 = rnd() | 0, ZSIDE2 = rnd() | 0;
const zi = (sq, p) => sq * 17 + p + 8;

export const LEVELS = {
  easy:   { depth: 2, quiesce: false, noise: 200, timeMs: Infinity },
  normal: { depth: 3, quiesce: true, noise: 25, timeMs: Infinity },
  hard:   { depth: 64, quiesce: true, noise: 0, timeMs: 1500 },
};

const WIN = 100000;
const TT_BITS = 18, TT_MASK = (1 << TT_BITS) - 1;
const EXACT = 1, LOWER = 2, UPPER = 3;

/** Board state for the search. `side` is +1 when red is to move, -1 for blue. */
export function fromPieces(pieces, player) {
  const s = {
    board: new Int8Array(N), side: player === 'red' ? 1 : -1, count: [0, 0, 0],
    h1: 0, h2: 0,
  };
  for (const p of pieces) {
    const v = ANIMALS[p.type].rank * (p.player === 'red' ? 1 : -1);
    const sq = p.row * COLS + p.col;
    s.board[sq] = v;
    s.count[v > 0 ? 1 : 2]++;
    s.h1 ^= Z1[zi(sq, v)];
    s.h2 ^= Z2[zi(sq, v)];
  }
  if (s.side < 0) { s.h1 ^= ZSIDE1; s.h2 ^= ZSIDE2; }
  return s;
}

/** A key for "this position with this side to move" — the game keeps one per move played. */
export function positionKey(pieces, player) {
  const s = fromPieces(pieces, player);
  return `${s.h1}:${s.h2}`;
}

// rules.js canCapture, on the compact board
function canCapture(board, from, to) {
  if (WATER[from] !== WATER[to]) return false;
  const a = Math.abs(board[from]), d = Math.abs(board[to]);
  if (a === RAT && d === ELEPHANT) return true;
  if (a === ELEPHANT && d === RAT) return false;
  if (WEAK[to] === Math.sign(board[to])) return true;
  return a >= d;
}

/** Legal moves for the side to move, each packed as from | to << 7. */
export function generate(s, capturesOnly = false) {
  const { board, side } = s;
  const out = [];
  for (let from = 0; from < N; from++) {
    const v = board[from];
    if (v === 0 || Math.sign(v) !== side) continue;
    const rank = v * side;
    const r = Math.floor(from / COLS), c = from % COLS;
    for (const [dr, dc] of DIRS) {
      let nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      let to = nr * COLS + nc;
      if (WATER[to] && rank !== RAT) {
        // tiger and lion jump along columns, leopard and lion along rows; any rat blocks
        if (dr !== 0 && rank !== TIGER && rank !== LION) continue;
        if (dc !== 0 && rank !== LEOPARD && rank !== LION) continue;
        let blocked = false;
        while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && WATER[nr * COLS + nc]) {
          if (Math.abs(board[nr * COLS + nc]) === RAT) { blocked = true; break; }
          nr += dr; nc += dc;
        }
        if (blocked || nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        to = nr * COLS + nc;
      }
      if (DEN_OF[to] === side) continue;
      const t = board[to];
      if (t !== 0) {
        if (Math.sign(t) === side || !canCapture(board, from, to)) continue;
        out.push(from | (to << 7));
      } else if (!capturesOnly || DEN_OF[to] === -side) {
        out.push(from | (to << 7));
      }
    }
  }
  return out;
}

function make(s, m) {
  const from = m & 127, to = m >> 7;
  const { board } = s;
  const v = board[from], cap = board[to];
  if (cap !== 0) {
    s.h1 ^= Z1[zi(to, cap)]; s.h2 ^= Z2[zi(to, cap)];
    s.count[cap > 0 ? 1 : 2]--;
  }
  s.h1 ^= Z1[zi(from, v)] ^ Z1[zi(to, v)] ^ ZSIDE1;
  s.h2 ^= Z2[zi(from, v)] ^ Z2[zi(to, v)] ^ ZSIDE2;
  board[to] = v;
  board[from] = 0;
  s.side = -s.side;
  return cap;
}

function unmake(s, m, cap) {
  const from = m & 127, to = m >> 7;
  const { board } = s;
  const v = board[to];
  s.side = -s.side;
  board[from] = v;
  board[to] = cap;
  s.h1 ^= Z1[zi(from, v)] ^ Z1[zi(to, v)] ^ ZSIDE1;
  s.h2 ^= Z2[zi(from, v)] ^ Z2[zi(to, v)] ^ ZSIDE2;
  if (cap !== 0) {
    s.h1 ^= Z1[zi(to, cap)]; s.h2 ^= Z2[zi(to, cap)];
    s.count[cap > 0 ? 1 : 2]++;
  }
}

/** Static score from the side to move's point of view. */
export function evaluate(s) {
  const { board } = s;
  let score = 0;
  for (let i = 0; i < N; i++) {
    const v = board[i];
    if (v > 0) score += VALUE[v] + PST[1][i];
    else if (v < 0) score -= VALUE[-v] + PST[2][i];
  }
  return score * s.side;
}

// Captures by victim value first, then the cheapest attacker; den entries ahead of everything.
function orderScore(s, m, ttMove) {
  if (m === ttMove) return 1e9;
  const to = m >> 7;
  if (DEN_OF[to] === -s.side) return 1e8;
  const cap = s.board[to];
  if (cap !== 0) return 1e6 + VALUE[Math.abs(cap)] * 16 - Math.abs(s.board[m & 127]);
  const pst = PST[s.side > 0 ? 1 : 2];
  return pst[to] - pst[m & 127];
}

function sortMoves(s, moves, ttMove) {
  const keyed = moves.map(m => [orderScore(s, m, ttMove), m]);
  keyed.sort((a, b) => b[0] - a[0]);
  return keyed.map(k => k[1]);
}

class Timeout extends Error {}

function createSearch(level, history, now, rootKey, timeMs) {
  const cfg = { ...(LEVELS[level] ?? LEVELS.normal) };
  if (timeMs !== undefined && cfg.timeMs !== Infinity) cfg.timeMs = timeMs;
  const deadline = now() + cfg.timeMs;
  const ttKey = new Int32Array(1 << TT_BITS);
  const ttVal = new Int32Array(1 << TT_BITS);
  const ttMeta = new Int32Array(1 << TT_BITS);   // depth | flag << 8 | (move + 1) << 10
  const path = [rootKey];   // keys of the positions on the line being searched
  let nodes = 0;

  function tick() {
    if ((++nodes & 2047) === 0 && now() > deadline) throw new Timeout();
  }

  // A position already seen — earlier in the game or on the current line — scores as a draw,
  // which is what stops a side that is ahead from shuffling one piece back and forth forever.
  function repeated(s) {
    const key = `${s.h1}:${s.h2}`;
    if (history.has(key)) return true;
    return path.includes(key);
  }

  function quiesce(s, alpha, beta, ply) {
    tick();
    const stand = evaluate(s);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    for (const m of sortMoves(s, generate(s, true), 0)) {
      if (DEN_OF[m >> 7] === -s.side) return WIN - ply - 1;
      const cap = make(s, m);
      const score = s.count[s.side > 0 ? 1 : 2] === 0 ? WIN - ply - 1 : -quiesce(s, -beta, -alpha, ply + 1);
      unmake(s, m, cap);
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function negamax(s, depth, alpha, beta, ply) {
    tick();
    if (ply > 0 && repeated(s)) return 0;
    if (depth <= 0) return cfg.quiesce ? quiesce(s, alpha, beta, ply) : evaluate(s);

    const slot = s.h1 & TT_MASK;
    let ttMove = 0;
    if (ttKey[slot] === s.h2) {
      const meta = ttMeta[slot];
      ttMove = (meta >>> 10) - 1;
      if ((meta & 255) >= depth && ply > 0) {
        const flag = (meta >> 8) & 3, v = ttVal[slot];
        if (flag === EXACT) return v;
        if (flag === LOWER && v >= beta) return v;
        if (flag === UPPER && v <= alpha) return v;
      }
    }

    const moves = generate(s);
    if (moves.length === 0) return -WIN + ply;   // no legal move: as good as lost

    const alpha0 = alpha;
    let best = -Infinity, bestMove = 0;
    path.push(`${s.h1}:${s.h2}`);
    try {
      for (const m of sortMoves(s, moves, ttMove)) {
        let score;
        if (DEN_OF[m >> 7] === -s.side) {
          score = WIN - ply - 1;
        } else {
          const cap = make(s, m);
          score = s.count[s.side > 0 ? 1 : 2] === 0
            ? WIN - ply - 1
            : -negamax(s, depth - 1, -beta, -alpha, ply + 1);
          unmake(s, m, cap);
        }
        if (score > best) { best = score; bestMove = m; }
        if (score > alpha) alpha = score;
        if (alpha >= beta) break;
      }
    } finally {
      path.pop();
    }

    ttKey[slot] = s.h2;
    ttVal[slot] = best;
    const flag = best <= alpha0 ? UPPER : best >= beta ? LOWER : EXACT;
    ttMeta[slot] = depth | (flag << 8) | ((bestMove + 1) << 10);
    return best;
  }

  /** Exact score of every root move at `depth` (full window, so the noise compares like with like). */
  function scoreRoot(s, moves, depth) {
    return moves.map(m => {
      if (DEN_OF[m >> 7] === -s.side) return WIN;
      const cap = make(s, m);
      try {
        if (s.count[s.side > 0 ? 1 : 2] === 0) return WIN;
        if (repeated(s)) return 0;
        return -negamax(s, depth - 1, -WIN - 1, WIN + 1, 1);
      } finally {
        unmake(s, m, cap);
      }
    });
  }

  return { cfg, negamax, scoreRoot, nodes: () => nodes };
}

/**
 * Pick a move for `player`. `pieces` uses the rules.js shape ({ type, player, row, col });
 * `history` is the positionKey of every position already played. `random` and `now` are
 * injectable so the tests are deterministic. Returns { from: {row,col}, to: {row,col} } or null.
 */
export function chooseMove(pieces, player, level = 'normal', {
  history = [], random = Math.random, now = () => Date.now(), timeMs,
} = {}) {
  const s = fromPieces(pieces, player);
  const moves = generate(s);
  if (moves.length === 0) return null;
  // a timeout unwinds the search without unmaking, so read the result off an untouched copy
  const start = s.board.slice();
  const search = createSearch(level, new Set(history), now, `${s.h1}:${s.h2}`, timeMs);
  const { cfg } = search;

  let best = moves[0], reached = cfg.timeMs === Infinity ? cfg.depth : 0;
  if (cfg.timeMs === Infinity) {
    const scores = search.scoreRoot(s, moves, cfg.depth);
    let top = -Infinity;
    moves.forEach((m, i) => {
      // a win stays a win whatever the noise, so even the easy level never misses one
      const v = scores[i] >= WIN - 100 ? scores[i] : scores[i] + (random() * 2 - 1) * cfg.noise;
      if (v > top) { top = v; best = m; }
    });
  } else {
    // iterative deepening; keep the last depth that finished before the clock ran out
    for (let depth = 1; depth <= cfg.depth; depth++) {
      try {
        let alpha = -WIN - 1, bestHere = best, top = -Infinity;
        for (const m of sortMoves(s, moves, best)) {
          let score;
          if (DEN_OF[m >> 7] === -s.side) score = WIN;
          else {
            const cap = make(s, m);
            try {
              score = s.count[s.side > 0 ? 1 : 2] === 0 ? WIN : -search.negamax(s, depth - 1, -WIN - 1, -alpha, 1);
            } finally {
              unmake(s, m, cap);
            }
          }
          if (score > top) { top = score; bestHere = m; }
          if (score > alpha) alpha = score;
        }
        best = bestHere;
        reached = depth;
        if (top >= WIN - 100 || top <= -WIN + 100) break;   // forced result found
      } catch (err) {
        if (!(err instanceof Timeout)) throw err;
        break;
      }
    }
  }

  const from = best & 127, to = best >> 7;
  return {
    from: { row: Math.floor(from / COLS), col: from % COLS },
    to: { row: Math.floor(to / COLS), col: to % COLS },
    type: RANK_TYPE[Math.abs(start[from])],
    depth: reached, nodes: search.nodes(),
  };
}
