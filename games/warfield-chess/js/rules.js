/* Warfield Chess — standard chess rules, DOM-free so tests/warfield-chess-rules.test.mjs can
   import it directly and the AI worker can run it. Square index = rank * 8 + file; rank 0 is
   the player's (white, "Red") back rank. Every piece carries an `id` that survives moves, so the
   3D layer can follow one unit across the whole game. Promotion is always to a queen. */

export const W = 'w', B = 'b';
export const FILES = 'abcdefgh';
export const other = c => (c === W ? B : W);
export const sqName = i => FILES[i & 7] + ((i >> 3) + 1);
export const sqIndex = name => (+name[1] - 1) * 8 + FILES.indexOf(name[0]);

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function newGame() { return fromFEN(START_FEN); }

export function fromFEN(fen) {
  const [placement, turn = 'w', castle = '-', ep = '-', half = '0', full = '1'] = fen.trim().split(/\s+/);
  const board = new Array(64).fill(null);
  let id = 0;
  placement.split('/').forEach((row, i) => {
    const r = 7 - i;
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { f += +ch; continue; }
      board[r * 8 + f] = { t: ch.toLowerCase(), c: ch === ch.toUpperCase() ? W : B, id: id++ };
      f++;
    }
  });
  return { board, turn, castle: castle === '-' ? '' : castle, ep: ep === '-' ? -1 : sqIndex(ep), half: +half, full: +full };
}

const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const KG = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const ORTH = KG.slice(0, 4), DIAG = KG.slice(4);

/** Is square `sq` attacked by any piece of colour `by`? */
export function attacked(s, sq, by) {
  const b = s.board, f = sq & 7, r = sq >> 3;
  const at = (ff, rr) => (ff >= 0 && ff < 8 && rr >= 0 && rr < 8 ? b[rr * 8 + ff] : undefined);
  for (const [df, dr] of KN) { const p = at(f + df, r + dr); if (p && p.c === by && p.t === 'n') return true; }
  for (const [df, dr] of KG) { const p = at(f + df, r + dr); if (p && p.c === by && p.t === 'k') return true; }
  const pr = by === W ? r - 1 : r + 1;           // the rank an attacking pawn stands on
  for (const df of [-1, 1]) { const p = at(f + df, pr); if (p && p.c === by && p.t === 'p') return true; }
  const ray = (dirs, kinds) => {
    for (const [df, dr] of dirs) {
      let ff = f + df, rr = r + dr;
      while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) {
        const p = b[rr * 8 + ff];
        if (p) { if (p.c === by && kinds.includes(p.t)) return true; break; }
        ff += df; rr += dr;
      }
    }
    return false;
  };
  return ray(ORTH, 'rq') || ray(DIAG, 'bq');
}

export function kingSquare(s, c) {
  for (let i = 0; i < 64; i++) { const p = s.board[i]; if (p && p.t === 'k' && p.c === c) return i; }
  return -1;
}

export const inCheck = (s, c) => { const k = kingSquare(s, c); return k >= 0 && attacked(s, k, other(c)); };

/** Moves that obey each piece's pattern but may leave the own king in check. */
export function pseudoMoves(s, from, out = []) {
  const b = s.board, p = b[from];
  if (!p) return out;
  const f = from & 7, r = from >> 3;
  const add = (to, extra) => out.push(Object.assign({ from, to, capture: b[to] ? to : -1 }, extra));
  const step = (dirs, slide) => {
    for (const [df, dr] of dirs) {
      let nf = f + df, nr = r + dr;
      while (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
        const t = nr * 8 + nf, q = b[t];
        if (q) { if (q.c !== p.c) add(t); break; }
        add(t);
        if (!slide) break;
        nf += df; nr += dr;
      }
    }
  };
  switch (p.t) {
    case 'n': step(KN, false); break;
    case 'b': step(DIAG, true); break;
    case 'r': step(ORTH, true); break;
    case 'q': step(KG, true); break;
    case 'k': {
      step(KG, false);
      const home = p.c === W ? 4 : 60, foe = other(p.c);
      if (from === home && !attacked(s, from, foe)) {
        const [kc, qc] = p.c === W ? ['K', 'Q'] : ['k', 'q'];
        const rookAt = i => b[i] && b[i].t === 'r' && b[i].c === p.c;
        if (s.castle.includes(kc) && rookAt(from + 3) && !b[from + 1] && !b[from + 2] &&
            !attacked(s, from + 1, foe) && !attacked(s, from + 2, foe)) add(from + 2, { castle: 'K' });
        if (s.castle.includes(qc) && rookAt(from - 4) && !b[from - 1] && !b[from - 2] && !b[from - 3] &&
            !attacked(s, from - 1, foe) && !attacked(s, from - 2, foe)) add(from - 2, { castle: 'Q' });
      }
      break;
    }
    case 'p': {
      const dir = p.c === W ? 1 : -1, start = p.c === W ? 1 : 6, last = p.c === W ? 7 : 0;
      const push = (to, extra) => add(to, (to >> 3) === last ? { ...extra, promo: 'q' } : extra);
      const nr = r + dir;
      if (nr < 0 || nr > 7) break;
      const one = nr * 8 + f;
      if (!b[one]) {
        push(one);
        const two = one + 8 * dir;
        if (r === start && !b[two]) add(two, { double: true });
      }
      for (const df of [-1, 1]) {
        const nf = f + df;
        if (nf < 0 || nf > 7) continue;
        const t = nr * 8 + nf;
        if (b[t] && b[t].c !== p.c) push(t);
        else if (t === s.ep && !b[t]) add(t, { ep: true, capture: r * 8 + nf });
      }
      break;
    }
  }
  return out;
}

export function applyMove(s, m) {
  const b = s.board.slice();
  const p = b[m.from];
  if (m.capture >= 0) b[m.capture] = null;
  b[m.from] = null;
  b[m.to] = m.promo ? { t: m.promo, c: p.c, id: p.id } : p;
  if (m.castle === 'K') { b[m.from + 1] = b[m.from + 3]; b[m.from + 3] = null; }
  if (m.castle === 'Q') { b[m.from - 1] = b[m.from - 4]; b[m.from - 4] = null; }
  let castle = s.castle;
  if (p.t === 'k') castle = castle.replace(p.c === W ? /[KQ]/g : /[kq]/g, '');
  const corner = { 0: 'Q', 7: 'K', 56: 'q', 63: 'k' };
  for (const sq of [m.from, m.to]) if (corner[sq]) castle = castle.replace(corner[sq], '');
  return {
    board: b,
    turn: other(s.turn),
    castle,
    ep: m.double ? (m.from + m.to) >> 1 : -1,
    half: p.t === 'p' || m.capture >= 0 ? 0 : s.half + 1,
    full: s.full + (s.turn === B ? 1 : 0),
  };
}

export function legalMoves(s, from = -1) {
  const out = [];
  const list = [];
  for (let i = 0; i < 64; i++) {
    if (from >= 0 && i !== from) continue;
    const p = s.board[i];
    if (p && p.c === s.turn) pseudoMoves(s, i, list);
  }
  for (const m of list) if (!inCheck(applyMove(s, m), s.turn)) out.push(m);
  return out;
}

function insufficient(b) {
  const rest = b.filter(p => p && p.t !== 'k');
  if (rest.length === 0) return true;
  return rest.length === 1 && (rest[0].t === 'n' || rest[0].t === 'b');
}

/** 'play' | 'checkmate' | 'stalemate' | 'fifty' | 'insufficient' for the side to move. */
export function status(s) {
  if (legalMoves(s).length === 0) return inCheck(s, s.turn) ? 'checkmate' : 'stalemate';
  if (s.half >= 100) return 'fifty';
  if (insufficient(s.board)) return 'insufficient';
  return 'play';
}

/** Does `to` fit the piece's movement pattern on an empty board? */
function fitsPattern(p, from, to) {
  const df = (to & 7) - (from & 7), dr = (to >> 3) - (from >> 3);
  const ax = Math.abs(df), ay = Math.abs(dr);
  switch (p.t) {
    case 'n': return (ax === 1 && ay === 2) || (ax === 2 && ay === 1);
    case 'b': return ax === ay && ax > 0;
    case 'r': return (ax === 0) !== (ay === 0);
    case 'q': return (ax === ay && ax > 0) || ((ax === 0) !== (ay === 0));
    case 'k': return Math.max(ax, ay) === 1 || (ay === 0 && ax === 2 && from === (p.c === W ? 4 : 60));
    case 'p': {
      const dir = p.c === W ? 1 : -1, start = p.c === W ? 1 : 6;
      if (df === 0 && dr === dir) return true;
      if (df === 0 && dr === 2 * dir && (from >> 3) === start) return true;
      return ax === 1 && dr === dir;
    }
  }
  return false;
}

/** Why the side to move can or cannot send the piece on `from` to `to`.
    Returns { ok: true, move } or { ok: false, why } with why one of:
    'empty' 'own' 'pattern' 'blocked' 'noenemy' 'pawnblock' 'nocastle' 'exposed'. */
export function explain(s, from, to) {
  const p = s.board[from];
  if (!p || p.c !== s.turn) return { ok: false, why: 'empty' };
  const q = s.board[to];
  if (q && q.c === p.c) return { ok: false, why: 'own' };
  const legal = legalMoves(s, from).find(m => m.to === to);
  if (legal) return { ok: true, move: legal };
  if (pseudoMoves(s, from).some(m => m.to === to)) return { ok: false, why: 'exposed' };
  if (!fitsPattern(p, from, to)) return { ok: false, why: 'pattern' };
  if (p.t === 'k' && Math.abs((to & 7) - (from & 7)) === 2) return { ok: false, why: 'nocastle' };
  if (p.t === 'p') {
    if ((to & 7) !== (from & 7)) return { ok: false, why: 'noenemy' };
    return { ok: false, why: 'pawnblock' };
  }
  return { ok: false, why: 'blocked' };
}

/** Repetition key: placement + side + castling + en passant. */
export function positionKey(s) {
  let k = '';
  for (const p of s.board) k += p ? (p.c === W ? p.t.toUpperCase() : p.t) : '.';
  return k + s.turn + s.castle + s.ep;
}
