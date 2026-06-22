import { describe, expect, it } from 'vitest';
import {
  addParityBit,
  ChessUpCommand,
  ChessUpInbound,
  encodeChessUpFen,
  encodeChessUpLeds,
  fieldToIndex,
  parseChessUpMove,
} from './protocol.js';

/** Build a raw inbound MOVE: [163, 53, fromCol, fromRow, toCol, toRow]. */
function moveFrame(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
): Uint8Array {
  // Wire order per the extension: e[2]=fromCol, e[3]=fromRow, e[4]=toCol, e[5]=toRow.
  return Uint8Array.from([ChessUpInbound.MOVE, 53, fromCol, fromRow, toCol, toRow]);
}

describe('parseChessUpMove (raw v5.9.1 frame)', () => {
  it('parses e2e4', () => {
    // e2 = row 1 (rank 2), col 4 (file e); e4 = row 3, col 4.
    expect(parseChessUpMove(moveFrame(1, 4, 3, 4))?.uci).toBe('e2e4');
  });

  it('parses a black move e7e5', () => {
    expect(parseChessUpMove(moveFrame(6, 4, 4, 4))?.uci).toBe('e7e5');
  });

  it('normalises kingside castling e1->h1 to e1g1', () => {
    expect(parseChessUpMove(moveFrame(0, 4, 0, 7))?.uci).toBe('e1g1');
  });

  it('normalises queenside castling e8->a8 to e8c8', () => {
    expect(parseChessUpMove(moveFrame(7, 4, 7, 0))?.uci).toBe('e8c8');
  });

  it('returns null when not a move frame', () => {
    expect(parseChessUpMove(Uint8Array.from([ChessUpInbound.PIECE_TOUCHED, 0, 0]))).toBeNull();
    expect(parseChessUpMove(Uint8Array.from([ChessUpInbound.MOVE, 99, 0, 0, 0, 0]))).toBeNull();
  });
});

describe('ChessUp parity (computeXParity)', () => {
  const ref = (byte: number) => {
    let e = byte | 128;
    for (let t = 0; t < 7; t++) if (e & (1 << t)) e ^= 128;
    return e & 0xff;
  };
  it('matches the extension algorithm and preserves the low 7 bits', () => {
    for (let b = 0; b < 256; b++) {
      const p = addParityBit(b);
      expect(p).toBe(ref(b));
      expect(p & 0x7f).toBe(b & 0x7f);
    }
  });
  it('produces known values', () => {
    expect(addParityBit(0x00)).toBe(0x80);
    expect(addParityBit(0x21)).toBe(0xa1);
  });
});

describe('ChessUp LED encoding', () => {
  it('lights e2 in the right byte/bit (8-byte bitmap)', () => {
    const buf = encodeChessUpLeds([{ square: 'e2', on: true }]);
    expect(buf.length).toBe(8);
    expect(buf[6]).toBe(1 << 4);
  });
  it('lights a1 at byte 7 bit 0 and h8 at byte 0 bit 7', () => {
    expect(encodeChessUpLeds([{ square: 'a1', on: true }])[7]).toBe(1 << 0);
    expect(encodeChessUpLeds([{ square: 'h8', on: true }])[0]).toBe(1 << 7);
  });
});

describe('ChessUp commands + helpers', () => {
  it('uses the verified raw opcodes', () => {
    expect(ChessUpCommand.RESET).toBe(100);
    expect(ChessUpCommand.SEND_FEN).toBe(102);
    expect(ChessUpCommand.GAME_SETTINGS).toBe(185);
    expect(ChessUpCommand.SEND_MOVE).toBe(153);
    expect(ChessUpInbound.MOVE).toBe(163);
  });

  it('fieldToIndex is row*8+col', () => {
    expect(fieldToIndex(0, 0)).toBe(0); // a1
    expect(fieldToIndex(3, 4)).toBe(28); // e4
  });

  it('encodeChessUpFen matches the verified board bytes (66 38 …)', () => {
    // From a real board's log: [len, ...ascii("…w KQkq - "), 0, 0, 1].
    const bytes = encodeChessUpFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(bytes[0]).toBe(56); // length byte (0x38) = payload length
    expect(bytes.length).toBe(57); // len byte + 56 payload bytes
    // payload = ASCII (53 chars incl. trailing space) + [0,0,1]
    const ascii = bytes.slice(1, bytes.length - 3).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - ');
    expect(bytes.slice(-3)).toEqual([0, 0, 1]); // halfmove, fullmove hi, lo
  });
});
