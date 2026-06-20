import { describe, expect, it } from 'vitest';
import { boardToFen, startingBoard } from '../../core/boardState.js';
import { decodeIChessOnePosition } from './protocol.js';
import type { Piece } from '../../core/types.js';

/** Inverse of the decode: place each a8..h1 piece at index 7-file+1+8*rank. */
function encodeIChessOnePosition(board: Piece[]): string {
  const chars = new Array<string>(65).fill('.');
  chars[0] = 's';
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[(7 - rank) * 8 + file];
      const idx = 7 - file + 1 + 8 * rank;
      chars[idx] = piece ?? '.';
    }
  }
  return chars.join('');
}

describe('iChessOne protocol', () => {
  it('round-trips the starting position to the start FEN', () => {
    const frame = encodeIChessOnePosition(startingBoard());
    const board = decodeIChessOnePosition(frame);
    expect(boardToFen(board)).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
    );
  });

  it('decodes an empty board', () => {
    const frame = 's' + '.'.repeat(64);
    const board = decodeIChessOnePosition(frame);
    expect(board.every((p) => p === null)).toBe(true);
  });

  it('throws on a short frame', () => {
    expect(() => decodeIChessOnePosition('s..')).toThrow();
  });
});
