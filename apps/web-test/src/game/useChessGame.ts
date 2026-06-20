import { useCallback, useMemo, useRef, useState } from 'react';
import { Chess, type Move } from 'chess.js';

export type GameResult = 'checkmate' | 'stalemate' | 'draw' | 'in_progress';

export interface ChessGameState {
  fen: string;
  pgn: string;
  turn: 'w' | 'b';
  history: string[]; // SAN list
  result: GameResult;
  isCheck: boolean;
  lastMove?: { from: string; to: string; uci: string };
}

export interface UseChessGame extends ChessGameState {
  /** Apply a move (UCI like "e2e4" or "e7e8q"). Returns the move or null if illegal. */
  move: (uci: string) => Move | null;
  /** Legal destination squares from a given square. */
  legalTargets: (square: string) => string[];
  /** Whether a move would be legal without applying it. */
  isLegal: (uci: string) => boolean;
  reset: (fen?: string) => void;
  loadFen: (fen: string) => boolean;
  undo: () => void;
}

function resultOf(game: Chess): GameResult {
  if (game.isCheckmate()) return 'checkmate';
  if (game.isStalemate()) return 'stalemate';
  if (game.isDraw()) return 'draw';
  return 'in_progress';
}

function snapshot(game: Chess): ChessGameState {
  const verbose = game.history({ verbose: true });
  const last = verbose[verbose.length - 1];
  return {
    fen: game.fen(),
    pgn: game.pgn(),
    turn: game.turn(),
    history: game.history(),
    result: resultOf(game),
    isCheck: game.isCheck(),
    lastMove: last
      ? { from: last.from, to: last.to, uci: `${last.from}${last.to}${last.promotion ?? ''}` }
      : undefined,
  };
}

/** chess.js-backed game state with a React-friendly API. */
export function useChessGame(initialFen?: string): UseChessGame {
  const gameRef = useRef(new Chess(initialFen));
  const [state, setState] = useState<ChessGameState>(() => snapshot(gameRef.current));

  const sync = useCallback(() => setState(snapshot(gameRef.current)), []);

  const move = useCallback(
    (uci: string): Move | null => {
      try {
        const m = gameRef.current.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci[4] ?? 'q',
        });
        sync();
        return m;
      } catch {
        return null;
      }
    },
    [sync],
  );

  const legalTargets = useCallback((square: string): string[] => {
    try {
      return gameRef.current
        .moves({ square: square as Parameters<Chess['moves']>[0]['square'], verbose: true })
        .map((m) => m.to);
    } catch {
      return [];
    }
  }, []);

  const isLegal = useCallback((uci: string): boolean => {
    const probe = new Chess(gameRef.current.fen());
    try {
      return !!probe.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4] ?? 'q',
      });
    } catch {
      return false;
    }
  }, []);

  const reset = useCallback(
    (fen?: string) => {
      gameRef.current = new Chess(fen);
      sync();
    },
    [sync],
  );

  const loadFen = useCallback(
    (fen: string): boolean => {
      try {
        gameRef.current.load(fen);
        sync();
        return true;
      } catch {
        return false;
      }
    },
    [sync],
  );

  const undo = useCallback(() => {
    gameRef.current.undo();
    sync();
  }, [sync]);

  return useMemo(
    () => ({ ...state, move, legalTargets, isLegal, reset, loadFen, undo }),
    [state, move, legalTargets, isLegal, reset, loadFen, undo],
  );
}
