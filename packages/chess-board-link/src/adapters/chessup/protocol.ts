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

/** ACK the host writes after receiving a move (parity-encoded by the adapter). */
export const CHESSUP_ACK = new Uint8Array([33]);

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

/**
 * ChessUp protocol (verified against ChessConnect v5.9.1, which is what shipping
 * boards run). Messages are **not** bit-7 framed: the first byte is the opcode
 * directly, followed by its data. Outgoing BLE bytes are parity-encoded
 * ({@link applyParity}); incoming bytes are not.
 */

/** Outgoing opcodes (raw; parity is applied by the adapter's writer). */
export const ChessUpCommand = {
  RESET: 100, // 0x64 — reset the board (startGame step 1)
  SEND_FEN: 102, // 0x66 — [102, len, ...fenBytes]; board replies opcode 177
  GAME_SETTINGS: 185, // 0xB9 — [185, 2,0,1,1,0,1,1,0, ...]; board replies opcode 36
  SEND_MOVE: 153, // 0x99 — [153, fromIndex, toIndex] (light a move on the board)
  ACK: 33, // 0x21 — acknowledge a received move
} as const;

/** Inbound opcodes (the raw first byte of a notification). */
export const ChessUpInbound = {
  MOVE: 163, // 0xA3 — a completed move: [163, 53, fromRow, fromCol, toRow, toCol]
  PROMOTION: 151,
  PIECE_TOUCHED: 184,
  ERROR: 38,
  FEN_OK: 177, // reply to SEND_FEN
  SETTINGS_OK: 36, // reply to GAME_SETTINGS
} as const;

/**
 * GAME_SETTINGS payload (the `b9 02 ...` in the logs). The trailing bytes encode
 * which side the app plays; the extension's default app-vs-board values are used.
 */
export const CHESSUP_GAME_SETTINGS: number[] = [2, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0];

/** Convert a field {row,col} (row 0..7 = rank 1..8, col 0..7 = a..h) to an index. */
export function fieldToIndex(row: number, col: number): number {
  return row * 8 + col;
}

const MOVE_FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
/** Square name from (row, col) — row 0 = rank 1, col 0 = file a. */
function squareName(row: number, col: number): string {
  return `${MOVE_FILES[col] ?? '?'}${row + 1}`;
}

/**
 * Parse an inbound MOVE notification into a UCI move. Layout (raw, no framing):
 * `[163, 53, fromRow, fromCol, toRow, toCol]` — the extension reads
 * `from = W(e[3], e[2])` and `to = W(e[5], e[4])` where `W(row, col)`. So
 * fromRow=e[3], fromCol=e[2], toRow=e[5], toCol=e[4]. Castling is reported
 * king→rook and normalised to UCI king-target form.
 */
export function parseChessUpMove(data: Uint8Array): DetectedMove | null {
  if (data.length < 6 || data[0] !== ChessUpInbound.MOVE || data[1] !== 53) {
    return null;
  }
  const from = squareName(data[3]!, data[2]!);
  let to = squareName(data[5]!, data[4]!);
  const castle: Record<string, string> = {
    e1h1: 'g1', e1a1: 'c1', e8h8: 'g8', e8a8: 'c8',
  };
  const target = castle[`${from}${to}`];
  if (target) to = target;
  return { from, to, uci: `${from}${to}` };
}

/**
 * Encode a FEN to the board's SEND_FEN payload (`fen2Uint8`): the first four FEN
 * fields joined by spaces as ASCII, followed by the halfmove clock and the
 * fullmove number (high, low bytes).
 */
export function encodeChessUpFen(fen: string): number[] {
  const parts = fen.trim().split(/\s+/);
  const head = parts.slice(0, 4).join(' ');
  const halfmove = Number(parts[4] ?? 0) || 0;
  const fullmove = Number(parts[5] ?? 1) || 1;
  const bytes = Array.from(head, (c) => c.charCodeAt(0));
  bytes.push(halfmove & 0xff, (fullmove >> 8) & 0xff, fullmove & 0xff);
  return bytes;
}
