import { describe, expect, it } from 'vitest';
import { boardToFen, startingBoard } from '../../core/boardState.js';
import {
  CHESSNUT_PIECE_LUT,
  decodeChessnutBoard,
  encodeChessnutLeds,
} from './protocol.js';
import type { Piece } from '../../core/types.js';

/**
 * Build a Chessnut board frame from a BoardState using the inverse of the
 * documented encoding: 2-byte header + 32 bytes, low nibble = even square,
 * high nibble = odd square. This lets us assert decode against an
 * independently-constructed buffer.
 */
function encodeChessnutFrame(board: Piece[]): Uint8Array {
  const pieceToNibble = (p: Piece): number => {
    const idx = CHESSNUT_PIECE_LUT.indexOf(p);
    return idx < 0 ? 0 : idx;
  };
  const bytes = new Uint8Array(34);
  bytes[0] = 0x01; // header byte (op/length) — ignored by the decoder
  bytes[1] = 0x24;
  // Inverse of the real decode: byte i carries (r,c) low + (r,c-1) high, where
  // r = 7 - floor(i/4), c = 7 - (i%4)*2, and our a8..h1 index is (7-r)*8 + col.
  for (let i = 0; i < 32; i++) {
    const r = 7 - Math.floor(i / 4);
    const c = 7 - (i % 4) * 2;
    const low = pieceToNibble(board[(7 - r) * 8 + c] ?? null);
    const high = pieceToNibble(board[(7 - r) * 8 + (c - 1)] ?? null);
    bytes[2 + i] = (high << 4) | low;
  }
  return bytes;
}

describe('Chessnut protocol', () => {
  it('decodes a frame built from the starting position back to the start FEN', () => {
    const frame = encodeChessnutFrame(startingBoard());
    const board = decodeChessnutBoard(frame);
    expect(boardToFen(board)).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
    );
  });

  it('maps byte 0 to h8/g8 (raw-byte check against the real layout)', () => {
    // Byte i=0 -> r=7, c=7: low nibble = (r,c) = h8, high nibble = (r,c-1) = g8.
    // Starting position: h8 = black rook 'r' (LUT index 8), g8 = black knight
    // 'n' (LUT index 5). So byte = (5 << 4) | 8 = 0x58.
    const frame = encodeChessnutFrame(startingBoard());
    expect(frame[2]).toBe(0x58);
    const board = decodeChessnutBoard(frame);
    expect(board[7]).toBe('r'); // h8
    expect(board[6]).toBe('n'); // g8
  });

  it('decodes an empty board', () => {
    const frame = encodeChessnutFrame(new Array<Piece>(64).fill(null));
    const board = decodeChessnutBoard(frame);
    expect(board.every((p) => p === null)).toBe(true);
  });

  it('throws on a short frame', () => {
    expect(() => decodeChessnutBoard(new Uint8Array(10))).toThrow();
  });

  it('encodes LEDs with file a as the most-significant bit', () => {
    // a8 is index 0 -> row 0 (rank 8), file a -> bit 0x80.
    const cmd = encodeChessnutLeds([{ square: 'a8', on: true }]);
    expect(cmd[0]).toBe(0x0a); // command byte
    expect(cmd[1]).toBe(8); // payload length
    expect(cmd[2]).toBe(0x80); // rank 8, file a
  });

  it('lights h1 in the last rank byte at the least-significant bit', () => {
    const cmd = encodeChessnutLeds([{ square: 'h1', on: true }]);
    expect(cmd[9]).toBe(0x01); // rank 1 (last byte), file h
  });
});
