import { describe, expect, it } from 'vitest';
import { ChessUpOpcode, parseChessUpMove } from './protocol.js';

/** Build an opcode-163 MOVE frame: [163, 53, fromRow, fromCol, toRow, toCol]. */
function moveFrame(
  fromCol: number,
  fromRow: number,
  toCol: number,
  toRow: number,
): Uint8Array {
  return Uint8Array.from([ChessUpOpcode.MOVE, 53, fromRow, fromCol, toRow, toCol]);
}

describe('ChessUp protocol', () => {
  it('parses e2e4 (col 4, row 1 -> col 4, row 3)', () => {
    const move = parseChessUpMove(moveFrame(4, 1, 4, 3));
    expect(move?.uci).toBe('e2e4');
  });

  it('parses a black move e7e5', () => {
    const move = parseChessUpMove(moveFrame(4, 6, 4, 4));
    expect(move?.uci).toBe('e7e5');
  });

  it('normalises kingside castling e1->h1 to e1g1', () => {
    // from e1 (col 4, row 0) to h1 (col 7, row 0)
    const move = parseChessUpMove(moveFrame(4, 0, 7, 0));
    expect(move?.uci).toBe('e1g1');
  });

  it('normalises queenside castling e8->a8 to e8c8', () => {
    const move = parseChessUpMove(moveFrame(4, 7, 0, 7));
    expect(move?.uci).toBe('e8c8');
  });

  it('returns null for a non-move opcode', () => {
    expect(parseChessUpMove(Uint8Array.from([ChessUpOpcode.PIECE_TOUCHED, 0, 0, 0]))).toBeNull();
  });
});
