import type { BoardState, LedState, Piece } from '../../core/types.js';
import { squareToIndex } from '../../utils/squares.js';

/**
 * Chessnut Air / Pro BLE protocol.
 *
 * Reverse-engineered from the open-source implementations
 * `paulvonallwoerden/chessnut-air` (TS) and `rmarabini/chessnutair` (Python),
 * which both agree on the UUIDs, the real-time-enable command and the nibble
 * board encoding.
 */

export const CHESSNUT_SERVICE_UUID = '1b7e8262-2877-41c3-b46e-cf057c562023';
/** Notifications carrying board state arrive on this characteristic. */
export const CHESSNUT_NOTIFY_UUID = '1b7e8273-2877-41c3-b46e-cf057c562023';
/** Commands (real-time enable, LEDs) are written here. */
export const CHESSNUT_WRITE_UUID = '1b7e8272-2877-41c3-b46e-cf057c562023';

/** Write this to begin receiving real-time board-state notifications. */
export const CHESSNUT_ENABLE_REALTIME = new Uint8Array([0x21, 0x01, 0x00]);

/**
 * Nibble value -> piece letter, as emitted by the board. Index is the 4-bit
 * value (0-12); 0 is an empty square. Order from the chessnut-air `PieceLut`.
 */
export const CHESSNUT_PIECE_LUT: Piece[] = [
  null, // 0 empty
  'q', // 1
  'k', // 2
  'b', // 3
  'p', // 4
  'n', // 5
  'R', // 6
  'P', // 7
  'r', // 8
  'B', // 9
  'N', // 10
  'Q', // 11
  'K', // 12
];

/**
 * Decode a board-state notification into a 64-entry {@link BoardState}.
 *
 * The notification starts with a 2-byte header; bytes `[2, 34)` are the 32
 * board bytes. Each byte packs two squares: the low nibble first, then the
 * high nibble. The stream begins at a8 and proceeds in a8..h1 order, matching
 * this library's canonical board index.
 */
export function decodeChessnutBoard(data: DataView | Uint8Array): BoardState {
  const bytes =
    data instanceof Uint8Array
      ? data
      : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

  if (bytes.length < 34) {
    throw new Error(
      `chessnut board frame too short: ${bytes.length} bytes (need >= 34)`,
    );
  }

  const board: BoardState = new Array<Piece>(64).fill(null);
  // 32 bytes -> 64 nibbles, two squares per byte. The extension maps each byte
  // index `i` to an internal field `8*r + c` (r=row 0..7, top = 7), with the
  // low nibble at (r, c) and the high nibble at (r, c-1):
  //   r = 7 - floor(i/4),  c = 7 - (i%4)*2
  // Row r=7 is rank 8, so our a8..h1 index is (7 - r) * 8 + c.
  for (let i = 0; i < 32; i++) {
    const byte = bytes[2 + i]!;
    const low = byte & 0x0f;
    const high = (byte >> 4) & 0x0f;
    const r = 7 - Math.floor(i / 4);
    const c = 7 - (i % 4) * 2;
    board[(7 - r) * 8 + c] = CHESSNUT_PIECE_LUT[low] ?? null;
    board[(7 - r) * 8 + (c - 1)] = CHESSNUT_PIECE_LUT[high] ?? null;
  }
  return board;
}

/** Command byte that precedes the 8-byte LED bitmap. */
export const CHESSNUT_LED_COMMAND = 0x0a;

/**
 * Build the LED command. The board has one byte per rank (rank 8 first) and
 * one bit per file (file a = most-significant bit). Squares listed with
 * `on: true` are lit.
 */
export function encodeChessnutLeds(leds: LedState[]): Uint8Array {
  const rows = new Uint8Array(8); // rows[0] = rank 8 .. rows[7] = rank 1
  for (const { square, on } of leds) {
    if (!on) continue;
    const index = squareToIndex(square); // a8..h1 order
    const row = Math.floor(index / 8);
    const file = index % 8;
    rows[row]! |= 0x80 >> file;
  }
  const out = new Uint8Array(2 + rows.length);
  out[0] = CHESSNUT_LED_COMMAND;
  out[1] = rows.length;
  out.set(rows, 2);
  return out;
}
