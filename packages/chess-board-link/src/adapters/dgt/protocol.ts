import type { BoardState, Piece } from '../../core/types.js';

/**
 * DGT electronic board serial protocol.
 *
 * Constants from the official DGT protocol header (`dgtbrd13.h` /
 * `dgtbrd-ruud.h`) as used by picochess, fnogatz/dgtchess and others. DGT
 * boards run at 9600 baud.
 */

export const DGT_BAUD_RATE = 9600;

/** Commands sent PC -> board. */
export const DgtCommand = {
  SEND_RESET: 0x40,
  SEND_BRD: 0x42, // request a full board dump
  SEND_UPDATE: 0x43, // stream field updates only
  SEND_UPDATE_BRD: 0x44, // stream field updates (board mode)
  SEND_UPDATE_NICE: 0x4b, // stream field updates, de-duplicated
  RETURN_SERIALNR: 0x45,
} as const;

/** Message ids board -> PC (the board sets the high bit on the id byte). */
export const DgtMessage = {
  BOARD_DUMP: 0x06,
  FIELD_UPDATE: 0x0e,
  SERIALNR: 0x11,
  VERSION: 0x13,
} as const;

/**
 * DGT piece codes (per the protocol header). Mapped to FEN letters; `null` is
 * an empty square.
 */
export const DGT_PIECE_CODES: Record<number, Piece> = {
  0x00: null, // EMPTY
  0x01: 'P', // WPAWN
  0x02: 'R', // WROOK
  0x03: 'N', // WKNIGHT
  0x04: 'B', // WBISHOP
  0x05: 'K', // WKING
  0x06: 'Q', // WQUEEN
  0x07: 'p', // BPAWN
  0x08: 'r', // BROOK
  0x09: 'n', // BKNIGHT
  0x0a: 'b', // BBISHOP
  0x0b: 'k', // BKING
  0x0c: 'q', // BQUEEN
};

/**
 * DGT reports squares in a8..h1 order (rank 8 first, file a first), which is
 * already this library's canonical board index — no remapping needed.
 */
export function dgtPieceCodeToPiece(code: number): Piece {
  return DGT_PIECE_CODES[code] ?? null;
}

export interface DgtParsedMessage {
  id: number;
  payload: Uint8Array;
}

/**
 * Frame reader for the DGT message format: each message is a 3-byte header
 * `[id, lenMSB, lenLSB]` where the 14-bit length is the *total* message size
 * including the header, followed by `length - 3` payload bytes.
 *
 * Feed it raw serial chunks; it yields complete messages as they arrive.
 */
export class DgtMessageReader {
  private buffer = new Uint8Array(0);

  push(chunk: Uint8Array): DgtParsedMessage[] {
    // Append the new chunk to whatever partial bytes we held.
    const merged = new Uint8Array(this.buffer.length + chunk.length);
    merged.set(this.buffer, 0);
    merged.set(chunk, this.buffer.length);
    this.buffer = merged;

    const messages: DgtParsedMessage[] = [];
    let offset = 0;
    while (this.buffer.length - offset >= 3) {
      const id = this.buffer[offset]!;
      const length = ((this.buffer[offset + 1]! & 0x7f) << 7) | (this.buffer[offset + 2]! & 0x7f);
      if (length < 3) {
        // Malformed header — skip a byte and resync.
        offset += 1;
        continue;
      }
      if (this.buffer.length - offset < length) break; // wait for more bytes
      messages.push({
        id: id & 0x7f,
        payload: this.buffer.slice(offset + 3, offset + length),
      });
      offset += length;
    }
    this.buffer = this.buffer.slice(offset);
    return messages;
  }
}

/** Decode a BOARD_DUMP payload (64 piece codes) into a board snapshot. */
export function decodeDgtBoardDump(payload: Uint8Array): BoardState {
  if (payload.length < 64) {
    throw new Error(`DGT board dump too short: ${payload.length} bytes`);
  }
  const board: BoardState = new Array<Piece>(64).fill(null);
  for (let i = 0; i < 64; i++) {
    board[i] = dgtPieceCodeToPiece(payload[i]!);
  }
  return board;
}

/** Apply a FIELD_UPDATE payload `[squareIndex, pieceCode]` to a board (in place). */
export function applyDgtFieldUpdate(
  board: BoardState,
  payload: Uint8Array,
): BoardState {
  if (payload.length < 2) {
    throw new Error('DGT field update too short');
  }
  const squareIndex = payload[0]!;
  if (squareIndex > 63) {
    throw new Error(`DGT field update square out of range: ${squareIndex}`);
  }
  const next = board.slice();
  next[squareIndex] = dgtPieceCodeToPiece(payload[1]!);
  return next;
}
