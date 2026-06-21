import { describe, expect, it } from 'vitest';
import {
  addParityBit,
  CHESSUP_HANDSHAKE,
  ChessUpCommand,
  ChessUpMessageReader,
  ChessUpOpcode,
  encodeChessUpLeds,
  encodeChessUpMessage,
  parseChessUpMove,
  parseChessUpMoveFromData,
} from './protocol.js';

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

describe('ChessUp parity (computeXParity)', () => {
  // Reference implementation copied verbatim from the extension's addParityBit.
  const ref = (byte: number) => {
    let e = byte | 128;
    for (let t = 0; t < 7; t++) if (e & (1 << t)) e ^= 128;
    return e & 0xff;
  };

  it('matches the extension algorithm and preserves the low 7 bits', () => {
    for (let b = 0; b < 256; b++) {
      const p = addParityBit(b);
      expect(p).toBe(ref(b));
      expect(p & 0x7f).toBe(b & 0x7f); // low 7 bits unchanged
    }
  });

  it('produces known values', () => {
    expect(addParityBit(0x00)).toBe(0x80); // no low bits -> just bit7 set
    expect(addParityBit(0x21)).toBe(0xa1); // bits 0,5 set -> bit7 flips twice -> set
  });
});

describe('ChessUp LED encoding', () => {
  it('lights e2 in the right byte/bit (8-byte bitmap)', () => {
    // e2: file e=4, rank 2 -> rank index 1; byte index 7-1=6, bit 1<<4.
    const buf = encodeChessUpLeds([{ square: 'e2', on: true }]);
    expect(buf.length).toBe(8);
    expect(buf[6]).toBe(1 << 4);
  });

  it('lights a1 at byte 7 bit 0 and h8 at byte 0 bit 7', () => {
    expect(encodeChessUpLeds([{ square: 'a1', on: true }])[7]).toBe(1 << 0);
    expect(encodeChessUpLeds([{ square: 'h8', on: true }])[0]).toBe(1 << 7);
  });

  it('ignores off squares', () => {
    const buf = encodeChessUpLeds([{ square: 'e2', on: false }]);
    expect(buf.every((b) => b === 0)).toBe(true);
  });
});

describe('ChessUp message framing', () => {
  it('encodes a bare command as a single byte', () => {
    expect(Array.from(encodeChessUpMessage(ChessUpCommand.RESET))).toEqual([64]);
  });

  it('encodes a command with data as [cmd, size, ...data, 0]', () => {
    // CONFIG [2,1,0] -> [96, 4, 2, 1, 0, 0] (size = data.length + 1).
    expect(Array.from(encodeChessUpMessage(ChessUpCommand.CONFIG, [2, 1, 0]))).toEqual([
      96, 4, 2, 1, 0, 0,
    ]);
  });

  it('reader reassembles a framed message (bit-7 start + size bytes)', () => {
    // command 163, size encoded as two 7-bit bytes, then data [53, 1, 4, 3, 4].
    const data = [53, 1, 4, 3, 4];
    const size = data.length + 3;
    const frame = Uint8Array.from([
      0x80 | ChessUpOpcode.MOVE, // start marker + command
      (size >> 7) & 0x7f,
      size & 0x7f,
      ...data,
    ]);
    const reader = new ChessUpMessageReader();
    const msgs = reader.push(frame);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.command).toBe(ChessUpOpcode.MOVE);
    expect(msgs[0]!.data).toEqual(data);
  });

  it('handshake includes the CONFIG (app-interaction) messages', () => {
    const hasConfig = CHESSUP_HANDSHAKE.some((m) => m[0] === ChessUpCommand.CONFIG);
    expect(hasConfig).toBe(true);
    expect(CHESSUP_HANDSHAKE[0]).toEqual([ChessUpCommand.RESET]);
  });
});

describe('parseChessUpMoveFromData (framed move data)', () => {
  it('parses e2e4 from [53, fromRow, fromCol, toRow, toCol]', () => {
    // e2 = col 4 row 1, e4 = col 4 row 3.
    expect(parseChessUpMoveFromData([53, 1, 4, 3, 4])?.uci).toBe('e2e4');
  });

  it('normalises kingside castling e1->h1 to e1g1', () => {
    expect(parseChessUpMoveFromData([53, 0, 4, 0, 7])?.uci).toBe('e1g1');
  });

  it('returns null when the data is not a move payload', () => {
    expect(parseChessUpMoveFromData([99, 0, 0])).toBeNull();
  });
});
