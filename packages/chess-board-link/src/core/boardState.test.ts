import { describe, expect, it } from 'vitest';
import {
  boardToFen,
  boardsEqual,
  emptyBoard,
  fenToBoard,
  startingBoard,
} from './boardState.js';

describe('boardState <-> FEN', () => {
  it('round-trips the starting position', () => {
    const board = startingBoard();
    expect(boardToFen(board)).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
    );
  });

  it('indexes a8 at 0 and h1 at 63', () => {
    const board = startingBoard();
    expect(board[0]).toBe('r'); // a8
    expect(board[63]).toBe('R'); // h1
    expect(board[4]).toBe('k'); // e8
    expect(board[60]).toBe('K'); // e1
  });

  it('parses empty squares correctly', () => {
    const board = fenToBoard('8/8/8/8/8/8/8/8');
    expect(boardsEqual(board, emptyBoard())).toBe(true);
  });

  it('round-trips a midgame FEN placement', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R';
    expect(boardToFen(fenToBoard(fen))).toBe(fen);
  });

  it('rejects malformed FEN', () => {
    expect(() => fenToBoard('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP')).toThrow();
  });
});
