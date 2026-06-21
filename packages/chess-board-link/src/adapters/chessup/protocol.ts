import type { DetectedMove, LedState } from '../../core/types.js';
import { squareToIndex } from '../../utils/squares.js';

/**
 * ChessUp BLE protocol.
 *
 * Reverse-engineered from the official ChessConnect Chrome extension
 * (`background.js`, v6.0.3). ChessUp speaks the Nordic UART service and, unlike
 * Chessnut/DGT, reports *moves* directly (it computes them on-device) rather
 * than streaming a 64-square occupancy map.
 */

export const CHESSUP_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const CHESSUP_WRITE_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
export const CHESSUP_NOTIFY_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
export const CHESSUP_NAME_PREFIX = 'ChessUp';

/** First byte (opcode) of an inbound frame. */
export const ChessUpOpcode = {
  MOVE: 163, // a completed move: bytes [163, 53, fromRow, fromCol, toRow, toCol, ...]
  PROMOTION: 151, // promotion piece selected on the board
  PIECE_TOUCHED: 184, // a piece was lifted/touched (hint, not a move)
  ERROR: 38,
} as const;

/** Acknowledgement the extension writes back after receiving a move (opcode 33). */
export const CHESSUP_ACK = new Uint8Array([33]);

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

/**
 * Decode a (col, row) pair into an algebraic square. ChessUp uses
 * col 0..7 = a..h and row 0..7 = rank 1..8 (white's side is row 0), matching
 * the `W(col, row)` helper in the extension.
 */
function squareFrom(col: number, row: number): string {
  if (col < 0 || col > 7 || row < 0 || row > 7) {
    throw new RangeError(`ChessUp square out of range: col=${col} row=${row}`);
  }
  return `${FILES[col]}${row + 1}`;
}

/**
 * Parse an opcode-163 MOVE frame into a UCI move.
 *
 * Frame layout (from the extension): `[163, 53, fromRow, fromCol, toRow, toCol, ...]`.
 * The board reports castling in king-to-rook form (e1->h1 for O-O); we
 * normalise that to standard UCI king-target form (e1g1 / e1c1).
 */
export function parseChessUpMove(data: Uint8Array): DetectedMove | null {
  if (data.length < 6 || data[0] !== ChessUpOpcode.MOVE) return null;

  const from = squareFrom(data[3]!, data[2]!);
  let to = squareFrom(data[5]!, data[4]!);

  // Castling normalisation: a king move onto its own rook square (e1->h1 /
  // e1->a1 / e8->h8 / e8->a8) is reported by ChessUp; convert to king-target.
  const castle: Record<string, string> = {
    e1h1: 'g1',
    e1a1: 'c1',
    e8h8: 'g8',
    e8a8: 'c8',
  };
  const target = castle[`${from}${to}`];
  if (target) to = target;

  return { from, to, uci: `${from}${to}` };
}

/**
 * ChessUp BLE parity encoding. Every byte sent to the board over Bluetooth is
 * passed through this (the extension's `computeXParity` / `addParityBit`):
 * set bit 7, then for each of the low 7 bits that is set, flip bit 7. The
 * result is an even-parity byte the board expects.
 */
export function addParityBit(byte: number): number {
  let e = byte | 0x80;
  for (let i = 0; i < 7; i++) {
    if (e & (1 << i)) e ^= 0x80;
  }
  return e & 0xff;
}

/** Apply {@link addParityBit} to every byte of a buffer (returns a new array). */
export function applyParity(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = addParityBit(bytes[i]!);
  return out;
}

/**
 * Encode an LED state for a (non-RGB) ChessUp board: an 8-byte bitmap where
 * byte `7 - rank` has bit `1 << file` set for each lit square (rank/file 0..7,
 * white's first rank = 0). Mirrors the extension's `encodeLedStateSimple`.
 *
 * Note: the returned bytes are the raw payload; parity is applied by the
 * adapter's writer (every ChessUp BLE write is parity-encoded).
 */
export function encodeChessUpLeds(leds: LedState[]): Uint8Array {
  const out = new Uint8Array(8);
  for (const { square, on } of leds) {
    if (!on) continue;
    const index = squareToIndex(square); // a8..h1 order
    const rank = 7 - Math.floor(index / 8); // 0 = rank 1 (white side)
    const file = index % 8; // 0 = a
    out[7 - rank]! |= 1 << file;
  }
  return out;
}
