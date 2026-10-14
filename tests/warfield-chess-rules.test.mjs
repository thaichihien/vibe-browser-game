// Rules and AI for games/warfield-chess. Both modules are DOM-free ES modules, so they are
// imported directly. Perft counts are the standard published values for each position.
import { test } from 'node:test';
import assert from 'node:assert';
import {
  newGame, fromFEN, legalMoves, applyMove, status, explain, sqIndex, inCheck,
} from '../games/warfield-chess/js/rules.js';
import { chooseMove } from '../games/warfield-chess/js/ai.js';

function perft(s, depth) {
  if (depth === 0) return 1;
  const moves = legalMoves(s);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(applyMove(s, m), depth - 1);
  return n;
}

const KIWIPETE = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
const POS3 = '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1';
const POS4 = 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1';

test('perft from the start position', () => {
  const s = newGame();
  assert.deepStrictEqual([1, 2, 3].map(d => perft(s, d)), [20, 400, 8902]);
});

test('perft on Kiwipete (castling, en passant, pins)', () => {
  const s = fromFEN(KIWIPETE);
  assert.deepStrictEqual([1, 2].map(d => perft(s, d)), [48, 2039]);
});

test('perft on position 3 (en passant discovered checks)', () => {
  const s = fromFEN(POS3);
  assert.deepStrictEqual([1, 2, 3].map(d => perft(s, d)), [14, 191, 2812]);
});

test('perft on position 4 (promotions; queen-only means fewer)', () => {
  // Published 6 / 264 count all four promotion pieces; this game always promotes to a queen.
  const s = fromFEN(POS4);
  assert.strictEqual(perft(s, 1), 6);
});

test('piece ids survive moves and castling moves the rook', () => {
  let s = fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const kingId = s.board[sqIndex('e1')].id, rookId = s.board[sqIndex('h1')].id;
  const m = legalMoves(s).find(x => x.from === sqIndex('e1') && x.to === sqIndex('g1'));
  assert.strictEqual(m.castle, 'K');
  s = applyMove(s, m);
  assert.strictEqual(s.board[sqIndex('g1')].id, kingId);
  assert.strictEqual(s.board[sqIndex('f1')].id, rookId);
  assert.strictEqual(s.castle, 'kq');
});

test('promotion keeps the id and becomes a queen', () => {
  let s = fromFEN('8/P6k/8/8/8/8/8/K7 w - - 0 1');
  const id = s.board[sqIndex('a7')].id;
  s = applyMove(s, legalMoves(s).find(m => m.to === sqIndex('a8')));
  assert.deepStrictEqual(s.board[sqIndex('a8')], { t: 'q', c: 'w', id });
});

test('status detects mate, stalemate and bare kings', () => {
  assert.strictEqual(status(fromFEN('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1')), 'checkmate');
  assert.strictEqual(status(fromFEN('7k/8/6QK/8/8/8/8/8 b - - 0 1')), 'stalemate');
  assert.strictEqual(status(fromFEN('7k/8/8/8/8/8/8/K7 w - - 0 1')), 'insufficient');
  assert.strictEqual(status(newGame()), 'play');
});

test('explain gives the reason a move is refused', () => {
  const s = newGame();
  const why = (a, b) => explain(s, sqIndex(a), sqIndex(b));
  assert.ok(why('e2', 'e4').ok);
  assert.strictEqual(why('e2', 'd3').why, 'noenemy');
  assert.strictEqual(why('a1', 'a2').why, 'own');
  assert.strictEqual(why('a1', 'a5').why, 'blocked');
  assert.strictEqual(why('b1', 'b3').why, 'pattern');
  assert.strictEqual(why('e7', 'e5').why, 'empty');
  const pinned = fromFEN('4k3/8/8/b7/8/8/3P4/4K3 w - - 0 1');
  assert.strictEqual(explain(pinned, sqIndex('d2'), sqIndex('d3')).why, 'exposed');
  const wall = fromFEN('4k3/8/8/8/8/4p3/4P3/4K3 w - - 0 1');
  assert.strictEqual(explain(wall, sqIndex('e2'), sqIndex('e3')).why, 'pawnblock');
});

test('AI finds a mate in one and always returns a legal move', () => {
  const s = fromFEN('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
  const m = chooseMove(s, 2, 0);
  const after = applyMove(s, m);
  assert.strictEqual(status(after), 'checkmate');
  let g = newGame();
  for (let i = 0; i < 6; i++) {
    const mv = chooseMove(g, 1, 30);
    assert.ok(legalMoves(g).some(x => x.from === mv.from && x.to === mv.to));
    g = applyMove(g, mv);
  }
  assert.ok(!inCheck(g, g.turn === 'w' ? 'b' : 'w'));
});
