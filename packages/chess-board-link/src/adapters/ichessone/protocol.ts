import type { BoardState, Piece } from '../../core/types.js';

/**
 * iChessOne BLE protocol (Nordic UART).
 *
 * Reverse-engineered from the ChessConnect extension. iChessOne sends ASCII
 * frames; a position dump is a command whose first char is `'s'` followed by 64
 * piece chars. Each board char is a FEN-style letter (uppercase = white,
 * lowercase = black, `.`/space = empty).
 */
export const ICHESSONE_NAME = 'iChessOne';

/** First char of a frame -> total command length (from `lengthOfCommand`). */
export const ICHESSONE_COMMAND_LENGTH: Record<string, number> = {
  s: 67, // position dump (1 cmd char + 64 board chars + 2 trailer)
  l: 3,
  x: 3,
  v: 7,
  w: 7,
  r: 7,
  i: 100,
};

const PIECE_CHARS = new Set(['K', 'Q', 'R', 'B', 'N', 'P']);

/**
 * Decode an iChessOne position string into a board.
 *
 * Mirrors the extension: for rank `s` (0..7) and file `i` (0..7), the char is at
 * index `7 - i + 1 + 8*s`. Internal field `(file, rank)`; rank 0 is white's back
 * rank, so our a8..h1 index is `(7 - rank) * 8 + file`.
 */
export function decodeIChessOnePosition(position: string): BoardState {
  if (position.length < 65) {
    throw new Error(`iChessOne position too short: ${position.length}`);
  }
  const board: BoardState = new Array<Piece>(64).fill(null);
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const idx = 7 - file + 1 + 8 * rank;
      const ch = position.charAt(idx);
      const upper = ch.toUpperCase();
      if (PIECE_CHARS.has(upper)) {
        const piece = (ch === upper ? upper : upper.toLowerCase()) as Piece;
        board[(7 - rank) * 8 + file] = piece;
      }
    }
  }
  return board;
}

/** Extract the position payload from a UTF-8 decoded frame starting with 's'. */
export function isIChessOnePositionFrame(frame: string): boolean {
  return frame.charAt(0) === 's' && frame.length >= 65;
}
