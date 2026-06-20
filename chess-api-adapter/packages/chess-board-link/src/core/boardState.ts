import type { BoardState, Piece } from './types.js';

/**
 * Conversions between the flat 64-entry {@link BoardState} (a8..h1 order) and
 * the FEN piece-placement field. Only the placement field is handled here —
 * side-to-move, castling and counters live in higher-level game state.
 */

const VALID_PIECES = new Set(['P', 'N', 'B', 'R', 'Q', 'K', 'p', 'n', 'b', 'r', 'q', 'k']);

/** Create an empty 64-square board. */
export function emptyBoard(): BoardState {
  return new Array<Piece>(64).fill(null);
}

/** The standard chess starting position as a {@link BoardState}. */
export function startingBoard(): BoardState {
  return fenToBoard('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
}

/** Convert the placement portion of a FEN into a 64-entry board. */
export function fenToBoard(fen: string): BoardState {
  const placement = fen.trim().split(/\s+/)[0] ?? '';
  const ranks = placement.split('/');
  if (ranks.length !== 8) {
    throw new Error(`FEN placement must have 8 ranks: ${placement}`);
  }
  const board = emptyBoard();
  for (let r = 0; r < 8; r++) {
    let file = 0;
    for (const ch of ranks[r]!) {
      if (ch >= '1' && ch <= '8') {
        file += Number(ch);
      } else if (VALID_PIECES.has(ch)) {
        if (file > 7) throw new Error(`FEN rank overflow: ${ranks[r]}`);
        board[r * 8 + file] = ch as Piece;
        file += 1;
      } else {
        throw new Error(`invalid FEN char "${ch}" in ${placement}`);
      }
    }
    if (file !== 8) throw new Error(`FEN rank not 8 files wide: ${ranks[r]}`);
  }
  return board;
}

/** Convert a 64-entry board into the FEN piece-placement field. */
export function boardToFen(board: BoardState): string {
  if (board.length !== 64) {
    throw new Error(`board must have 64 squares, got ${board.length}`);
  }
  const ranks: string[] = [];
  for (let r = 0; r < 8; r++) {
    let rank = '';
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const piece = board[r * 8 + f];
      if (piece === null) {
        empty += 1;
      } else {
        if (empty > 0) {
          rank += empty;
          empty = 0;
        }
        rank += piece;
      }
    }
    if (empty > 0) rank += empty;
    ranks.push(rank);
  }
  return ranks.join('/');
}

/** True when two board snapshots are identical square-by-square. */
export function boardsEqual(a: BoardState, b: BoardState): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
