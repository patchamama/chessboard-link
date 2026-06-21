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

/**
 * @deprecated Early (incorrect) assumption that ChessUp emits parity-free
 * Inbound message command ids (the low 7 bits of a bit-7 start byte, parsed by
 * {@link ChessUpMessageReader}). The board sends a completed move under command
 * {@link ChessUpOpcode.MOVE} (163), and a full occupancy snapshot under
 * {@link CHESSUP_IN_POSITION} (134). The move command is the clean path; we use
 * occupancy as a fallback.
 */
export const ChessUpOpcode = {
  MOVE: 163,
  PROMOTION: 151,
  PIECE_TOUCHED: 184,
  ERROR: 38,
} as const;

/** ACK the host writes after receiving a move (parity-encoded by the adapter). */
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

/**
 * ChessUp message framing (from the extension's `St` / `encodeMessage` and the
 * inbound parser in `processDataFromBoard`).
 *
 * Outgoing: `[command]` for a bare command, or `[command, size, ...data, 0]`
 * where `size = data.length + 1` and a `0` terminator follows the data. Every
 * byte is then parity-encoded for BLE (see {@link applyParity}).
 *
 * Incoming: a byte with bit 7 set starts a new message (its low 7 bits are the
 * command); the next one or two 7-bit bytes give the size; remaining bytes are
 * the data. Incoming bytes are NOT parity-encoded.
 */
export const ChessUpCommand = {
  RESET: 64, // 0x40 — reset the board
  REQUEST_DUMP: 66, // 0x42 — ask the board to send its current position
  CONFIG: 96, // 0x60 — configuration (puts the board in "app interaction" mode)
  CMD_68: 68, // 0x44 — part of the connect handshake
  CMD_75: 75, // 0x4b — part of the connect handshake
  SEND_MOVE: 99, // 0x63 — tell the board a move (e.g. to light it)
} as const;

/**
 * The connect handshake the extension performs, in order, to make ChessUp
 * report moves to an external app. Without the CONFIG messages the board stays
 * idle (does not emit moves). Each entry is `[command, ...data]`.
 */
export const CHESSUP_HANDSHAKE: number[][] = [
  [ChessUpCommand.RESET],
  [ChessUpCommand.CONFIG, 2, 1, 0],
  [ChessUpCommand.CONFIG, 2, 2, 0],
  [ChessUpCommand.CMD_68],
  [ChessUpCommand.CMD_75],
  [ChessUpCommand.REQUEST_DUMP],
];

/** Command id of an inbound POSITION (occupancy) message. */
export const CHESSUP_IN_POSITION = 134;
/** Inbound: board asks the host for a dump. */
export const CHESSUP_IN_REQUEST = 142;

/**
 * Parse a MOVE message's `data` (the bytes after command+size) into a UCI move.
 * Layout: `[53, fromRow, fromCol, toRow, toCol, …]` — row 0..7 = rank 1..8,
 * col 0..7 = a..h. Castling is reported king→rook and normalised to UCI
 * king-target form. Returns null if the data isn't a move payload.
 */
export function parseChessUpMoveFromData(data: number[]): DetectedMove | null {
  if (data.length < 5 || data[0] !== 53) return null;
  const from = squareName(data[2]!, data[1]!);
  let to = squareName(data[4]!, data[3]!);
  const castle: Record<string, string> = {
    e1h1: 'g1', e1a1: 'c1', e8h8: 'g8', e8a8: 'c8',
  };
  const target = castle[`${from}${to}`];
  if (target) to = target;
  return { from, to, uci: `${from}${to}` };
}

const MOVE_FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
function squareName(col: number, row: number): string {
  return `${MOVE_FILES[col] ?? '?'}${row + 1}`;
}

/** Build an outgoing message payload (pre-parity). */
export function encodeChessUpMessage(command: number, data?: number[]): Uint8Array {
  if (!data || data.length === 0) return Uint8Array.from([command]);
  const size = data.length + 1;
  return Uint8Array.from([command, size, ...data, 0]);
}

interface InMessage {
  command: number;
  size: number;
  data: number[];
}

/**
 * Stateful reader for the inbound ChessUp byte stream. Feed it raw notification
 * bytes; it yields complete messages. Mirrors the extension's incoming parser
 * (bit-7 start marker, up-to-two 7-bit size bytes, then `size - 3` data bytes).
 */
export class ChessUpMessageReader {
  private cur: (InMessage & { needSecondSizeByte: boolean }) | null = null;

  push(bytes: Uint8Array): InMessage[] {
    const out: InMessage[] = [];
    for (const t of bytes) {
      if (t & 0x80) {
        // Start of a new message; command is the low 7 bits.
        // The command keeps its high bit: the extension switches on values like
        // 163 (0xA3) and 134 (0x86), which have bit 7 set as the start marker.
        this.cur = { command: t, size: 0, data: [], needSecondSizeByte: false };
      } else if (this.cur) {
        if (this.cur.size === 0 && !this.cur.needSecondSizeByte && this.cur.data.length === 0) {
          // First size byte (high 7 bits).
          this.cur.size = t << 7;
          this.cur.needSecondSizeByte = true;
        } else if (this.cur.needSecondSizeByte) {
          this.cur.size += t & 0x7f;
          this.cur.needSecondSizeByte = false;
        } else {
          this.cur.data.push(t);
          if (this.cur.data.length >= this.cur.size - 3) {
            out.push({ command: this.cur.command, size: this.cur.size, data: this.cur.data });
            this.cur = null;
          }
        }
      }
    }
    return out;
  }
}

/**
 * Decode a POSITION message's data into board occupancy. ChessUp reports five
 * numbers per square (an RFID-style tag); a square is occupied when any of the
 * five is non-zero. Square index is `8*rank + file` (rank/file 0..7, white = 0).
 *
 * Returns a 64-entry boolean array in a8..h1 order (true = occupied).
 *
 * Note: identifying *which* piece sits on a square needs the board's learned
 * RFID→piece table, which is per-piece-set. Without it we only know occupancy,
 * which is enough to infer moves from the starting position (like other boards).
 */
export function decodeChessUpOccupancy(data: number[]): boolean[] {
  const occ = new Array<boolean>(64).fill(false);
  for (let s = 0; s < 8; s++) {
    for (let a = 0; a < 8; a++) {
      const o = 8 * (7 - s) + a; // index into the 5-per-square stream
      let occupied = false;
      for (let k = 0; k < 5; k++) {
        if ((data[5 * o + k] ?? 0) !== 0) {
          occupied = true;
          break;
        }
      }
      // a8..h1 board index: rank s (0 = rank 1) at file a.
      occ[(7 - s) * 8 + a] = occupied;
    }
  }
  return occ;
}
