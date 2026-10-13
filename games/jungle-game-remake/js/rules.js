/* Cờ Thú rules — a 1:1 port of games/jungle-game.html (the block from `const ROWS` through
   `movePiece`) with the DOM taken out. State changes here are instant; applyMove returns an
   ordered event list that the animation layer replays. tests/jungle-remake-parity.test.mjs
   checks the move generator against the original file, so keep the two in step. */

export const ROWS = 9;
export const COLS = 7;

export const ANIMALS = {
  rat:      { emoji: '🐭', rank: 1, name: 'Chuột' },
  cat:      { emoji: '🐱', rank: 2, name: 'Mèo' },
  dog:      { emoji: '🐶', rank: 3, name: 'Chó' },
  wolf:     { emoji: '🐺', rank: 4, name: 'Sói' },
  leopard:  { emoji: '🐆', rank: 5, name: 'Báo' },
  tiger:    { emoji: '🐯', rank: 6, name: 'Hổ' },
  lion:     { emoji: '🦁', rank: 7, name: 'Sư tử' },
  elephant: { emoji: '🐘', rank: 8, name: 'Voi' },
};

export const terrain = Array.from({ length: ROWS }, () => Array(COLS).fill('land'));

export const WATER = [
  [3, 1], [3, 2], [4, 1], [4, 2], [5, 1], [5, 2],
  [3, 4], [3, 5], [4, 4], [4, 5], [5, 4], [5, 5],
];
WATER.forEach(([r, c]) => { terrain[r][c] = 'water'; });

export const TRAPS = [[0, 2], [0, 4], [1, 3], [8, 2], [8, 4], [7, 3]];
TRAPS.forEach(([r, c]) => { terrain[r][c] = 'trap'; });

terrain[0][3] = 'den';
terrain[8][3] = 'den';

export const initialPieces = [
  { type: 'lion', player: 'red', row: 0, col: 0 },
  { type: 'tiger', player: 'red', row: 0, col: 6 },
  { type: 'leopard', player: 'red', row: 2, col: 2 },
  { type: 'wolf', player: 'red', row: 2, col: 4 },
  { type: 'dog', player: 'red', row: 1, col: 1 },
  { type: 'cat', player: 'red', row: 1, col: 5 },
  { type: 'rat', player: 'red', row: 2, col: 0 },
  { type: 'elephant', player: 'red', row: 2, col: 6 },

  { type: 'lion', player: 'blue', row: 8, col: 6 },
  { type: 'tiger', player: 'blue', row: 8, col: 0 },
  { type: 'leopard', player: 'blue', row: 6, col: 4 },
  { type: 'wolf', player: 'blue', row: 6, col: 2 },
  { type: 'dog', player: 'blue', row: 7, col: 5 },
  { type: 'cat', player: 'blue', row: 7, col: 1 },
  { type: 'rat', player: 'blue', row: 6, col: 6 },
  { type: 'elephant', player: 'blue', row: 6, col: 0 },
];

export const SIDE_NAME = { red: 'ĐỎ', blue: 'XANH' };
export const other = player => (player === 'red' ? 'blue' : 'red');
export const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

/** Red's traps and den are on rows 0–1, blue's on rows 7–8. */
export const trapOwner = row => (row <= 1 ? 'red' : 'blue');
export const denOwner = row => (row === 0 ? 'red' : 'blue');

/** True when the piece stands on a trap of the other side — the only trap that weakens. */
export const onEnemyTrap = p => terrain[p.row][p.col] === 'trap' &&
  ((p.player === 'red' && p.row >= 7) || (p.player === 'blue' && p.row <= 1));

export function createGame() {
  const game = {
    pieces: [], currentPlayer: 'red', gameOver: false, winner: null,
    restart, pieceAt, getValidMoves, canCapture, applyMove,
  };

  // The original always opens with red; the remake draws the first side, so it is passed in.
  function restart(first = 'red') {
    game.pieces = initialPieces.map((p, id) => ({ id, ...p }));
    game.currentPlayer = first;
    game.gameOver = false;
    game.winner = null;
  }

  function pieceAt(r, c) {
    return game.pieces.find(p => p.row === r && p.col === c);
  }

  function getValidMoves(piece) {
    const moves = [];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = piece.row + dr;
      const nc = piece.col + dc;
      if (!inBounds(nr, nc)) continue;

      // Water: the rat swims in, tiger/leopard/lion jump across
      if (terrain[nr][nc] === 'water') {
        if (piece.type === 'rat') {
          const swimTarget = pieceAt(nr, nc);
          if (!swimTarget) {
            moves.push({ row: nr, col: nc });
          } else if (swimTarget.player !== piece.player && canCapture(piece, swimTarget, nr, nc)) {
            moves.push({ row: nr, col: nc, capture: true });
          }
        } else {
          const jump = getJumpMove(piece, dr, dc);
          if (jump) moves.push(jump);
        }
        continue;
      }

      // Never into your own den
      if (terrain[nr][nc] === 'den' &&
          ((piece.player === 'red' && nr === 0) || (piece.player === 'blue' && nr === 8))) continue;

      const target = pieceAt(nr, nc);
      if (!target) {
        moves.push({ row: nr, col: nc });
      } else if (target.player !== piece.player && canCapture(piece, target, nr, nc)) {
        moves.push({ row: nr, col: nc, capture: true });
      }
    }
    return moves;
  }

  function getJumpMove(piece, dr, dc) {
    const canJumpVertical = piece.type === 'tiger' || piece.type === 'lion';
    const canJumpHorizontal = piece.type === 'leopard' || piece.type === 'lion';
    if (dr !== 0 && !canJumpVertical) return null;
    if (dc !== 0 && !canJumpHorizontal) return null;

    let r = piece.row + dr;
    let c = piece.col + dc;
    if (!inBounds(r, c) || terrain[r][c] !== 'water') return null;

    while (inBounds(r, c) && terrain[r][c] === 'water') {
      const blocker = pieceAt(r, c);          // any rat in the river blocks the jump
      if (blocker && blocker.type === 'rat') return null;
      r += dr;
      c += dc;
    }
    if (!inBounds(r, c)) return null;

    const target = pieceAt(r, c);
    if (target) {
      if (target.player === piece.player) return null;
      if (!canCapture(piece, target, r, c)) return null;
      return { row: r, col: c, capture: true, jump: true };
    }
    return { row: r, col: c, jump: true };
  }

  // (dr, dc) is the defender's square — the original's parameter names, kept for parity.
  function canCapture(attacker, defender, dr, dc) {
    // River rule: land and water pieces cannot capture each other; only rat-vs-rat in water.
    const attackerInWater = terrain[attacker.row][attacker.col] === 'water';
    const defenderInWater = terrain[dr][dc] === 'water';
    if (attackerInWater !== defenderInWater) return false;

    if (attacker.type === 'rat' && defender.type === 'elephant') return true;
    if (attacker.type === 'elephant' && defender.type === 'rat') return false;

    // A defender standing on the other side's trap can be taken by anything
    const defenderOnEnemyTrap = terrain[dr][dc] === 'trap' && (
      (defender.player === 'red' && dr >= 7) ||
      (defender.player === 'blue' && dr <= 1)
    );
    if (defenderOnEnemyTrap) return true;

    return ANIMALS[attacker.type].rank >= ANIMALS[defender.type].rank;
  }

  function applyMove(piece, r, c) {
    if (game.gameOver) throw new Error('game is over');
    if (piece.player !== game.currentPlayer) throw new Error(`not ${piece.player}'s turn`);
    const move = getValidMoves(piece).find(m => m.row === r && m.col === c);
    if (!move) throw new Error(`illegal move: ${piece.type} to ${r},${c}`);

    const events = [];
    const from = { row: piece.row, col: piece.col };
    const target = pieceAt(r, c);
    const a = ANIMALS[piece.type];

    if (target) {
      events.push({
        type: 'capture', attacker: piece, victim: target, at: { row: r, col: c },
        inWater: terrain[r][c] === 'water',
        heavy: piece.type === 'tiger' || piece.type === 'lion' || piece.type === 'elephant',
        ratElephant: piece.type === 'rat' && target.type === 'elephant',
        message: `${a.name} ăn ${ANIMALS[target.type].name}!`,
      });
      game.pieces = game.pieces.filter(p => p !== target);
    }

    piece.row = r;
    piece.col = c;

    const wet = terrain[r][c] === 'water' || terrain[from.row][from.col] === 'water';
    const kind = move.jump ? 'jump' : (piece.type === 'rat' && wet ? 'swim' : 'move');
    events.push({ type: kind, piece, from, to: { row: r, col: c }, capture: !!target });

    if (terrain[r][c] === 'trap') {
      events.push({ type: 'trap', piece, at: { row: r, col: c }, message: `${a.name} sập bẫy! 🪤` });
    }

    const win = reason => {
      game.gameOver = true;
      game.winner = piece.player;
      events.push({ type: 'win', player: piece.player, piece, reason });
    };

    if (terrain[r][c] === 'den') {
      win(`${a.emoji} ${a.name} ${SIDE_NAME[piece.player]} đã tiến vào hang đối phương!`);
      return events;
    }

    const enemy = other(piece.player);
    if (!game.pieces.some(p => p.player === enemy)) {
      win(`${SIDE_NAME[enemy]} đã mất toàn bộ quân trên bàn cờ!`);
      return events;
    }

    game.currentPlayer = enemy;
    events.push({ type: 'turn', player: enemy });
    return events;
  }

  restart();
  return game;
}
