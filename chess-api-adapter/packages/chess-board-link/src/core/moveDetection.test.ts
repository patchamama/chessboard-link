import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { fenToBoard, startingBoard } from './boardState.js';
import { detectMove } from './moveDetection.js';

const START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Build the board after applying `uciMoves` to the start position. */
function boardAfter(uciMoves: string[]): ReturnType<typeof startingBoard> {
  const game = new Chess();
  for (const m of uciMoves) {
    game.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
  }
  return fenToBoard(game.fen());
}

describe('detectMove', () => {
  it('detects a simple pawn push e2e4', () => {
    const before = startingBoard();
    const after = boardAfter(['e2e4']);
    const move = detectMove(before, after, { beforeFen: START_FEN });
    expect(move?.uci).toBe('e2e4');
    expect(move?.san).toBe('e4');
  });

  it('detects a knight move with validation', () => {
    const before = startingBoard();
    const after = boardAfter(['g1f3']);
    const move = detectMove(before, after, { beforeFen: START_FEN });
    expect(move?.uci).toBe('g1f3');
    expect(move?.san).toBe('Nf3');
  });

  it('detects a capture', () => {
    const moves = ['e2e4', 'd7d5'];
    const before = boardAfter(moves);
    const fen = (() => {
      const g = new Chess();
      for (const m of moves) g.move({ from: m.slice(0, 2), to: m.slice(2, 4) });
      return g.fen();
    })();
    const after = boardAfter([...moves, 'e4d5']);
    const move = detectMove(before, after, { beforeFen: fen });
    expect(move?.uci).toBe('e4d5');
  });

  it('detects kingside castling (two pieces move)', () => {
    const setup = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5'];
    const before = boardAfter(setup);
    const fen = (() => {
      const g = new Chess();
      for (const m of setup) g.move({ from: m.slice(0, 2), to: m.slice(2, 4) });
      return g.fen();
    })();
    const after = boardAfter([...setup, 'e1g1']);
    const move = detectMove(before, after, { beforeFen: fen });
    expect(move?.uci).toBe('e1g1');
    expect(move?.san).toBe('O-O');
  });

  it('returns null for an unchanged board', () => {
    const board = startingBoard();
    expect(detectMove(board, board)).toBeNull();
  });

  it('returns null for a transient lift (piece removed, none placed)', () => {
    const before = startingBoard();
    const after = before.slice();
    after[52] = null; // e2 lifted, nothing placed yet
    expect(detectMove(before, after, { beforeFen: START_FEN })).toBeNull();
  });

  it('returns best-effort UCI without a FEN', () => {
    const before = startingBoard();
    const after = boardAfter(['d2d4']);
    const move = detectMove(before, after);
    expect(move?.uci).toBe('d2d4');
    expect(move?.san).toBeUndefined();
  });
});
