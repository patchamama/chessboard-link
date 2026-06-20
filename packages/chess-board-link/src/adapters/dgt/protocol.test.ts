import { describe, expect, it } from 'vitest';
import { boardToFen, startingBoard } from '../../core/boardState.js';
import {
  applyDgtFieldUpdate,
  decodeDgtBoardDump,
  DgtMessage,
  DgtMessageReader,
} from './protocol.js';
import { squareToIndex } from '../../utils/squares.js';
import type { Piece } from '../../core/types.js';

const DGT_CODE: Record<string, number> = {
  P: 0x01, R: 0x02, N: 0x03, B: 0x04, K: 0x05, Q: 0x06,
  p: 0x07, r: 0x08, n: 0x09, b: 0x0a, k: 0x0b, q: 0x0c,
};

function dgtDumpPayload(board: Piece[]): Uint8Array {
  return Uint8Array.from(board.map((p) => (p ? DGT_CODE[p]! : 0x00)));
}

/** Wrap a payload in the 3-byte DGT message header. */
function frameMessage(id: number, payload: Uint8Array): Uint8Array {
  const length = payload.length + 3;
  return Uint8Array.from([
    id | 0x80,
    (length >> 7) & 0x7f,
    length & 0x7f,
    ...payload,
  ]);
}

describe('DGT protocol', () => {
  it('decodes a board dump into the starting position', () => {
    const payload = dgtDumpPayload(startingBoard());
    const board = decodeDgtBoardDump(payload);
    expect(boardToFen(board)).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
    );
  });

  it('applies a field update (lift a pawn from e2)', () => {
    const board = startingBoard();
    const e2 = squareToIndex('e2');
    const next = applyDgtFieldUpdate(board, Uint8Array.from([e2, 0x00]));
    expect(next[e2]).toBeNull();
    expect(board[e2]).toBe('P'); // original untouched (returns a copy)
  });

  it('reassembles framed messages from split chunks', () => {
    const dump = frameMessage(DgtMessage.BOARD_DUMP, dgtDumpPayload(startingBoard()));
    const reader = new DgtMessageReader();
    // Split the frame across two reads to exercise buffering.
    const first = reader.push(dump.slice(0, 10));
    expect(first).toHaveLength(0);
    const rest = reader.push(dump.slice(10));
    expect(rest).toHaveLength(1);
    expect(rest[0]!.id).toBe(DgtMessage.BOARD_DUMP);
    expect(decodeDgtBoardDump(rest[0]!.payload).length).toBe(64);
  });

  it('parses two back-to-back field updates in one chunk', () => {
    const a = frameMessage(DgtMessage.FIELD_UPDATE, Uint8Array.from([52, 0x00]));
    const b = frameMessage(DgtMessage.FIELD_UPDATE, Uint8Array.from([36, 0x01]));
    const reader = new DgtMessageReader();
    const merged = Uint8Array.from([...a, ...b]);
    const msgs = reader.push(merged);
    expect(msgs).toHaveLength(2);
    expect(msgs.every((m) => m.id === DgtMessage.FIELD_UPDATE)).toBe(true);
  });
});
