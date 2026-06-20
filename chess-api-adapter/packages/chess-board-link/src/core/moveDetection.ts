import { Chess } from 'chess.js';
import type { BoardState, DetectedMove, Piece, Square } from './types.js';
import { indexToSquare } from '../utils/squares.js';

/**
 * Derive the move that turned one board snapshot into another.
 *
 * Physical boards report occupancy/piece changes; they do not tell you the
 * move directly. We diff the two snapshots into "squares that emptied" and
 * "squares that became (or changed to) occupied", then reconstruct the UCI.
 *
 * When a legal source position is supplied we validate the move against
 * chess.js, which resolves promotions/SAN and rejects illegal diffs (e.g.
 * mid-move snapshots where a piece is lifted but not yet placed).
 */

interface SquareDiff {
  index: number;
  before: Piece;
  after: Piece;
}

function diffSquares(before: BoardState, after: BoardState): SquareDiff[] {
  const diffs: SquareDiff[] = [];
  for (let i = 0; i < 64; i++) {
    if (before[i] !== after[i]) {
      diffs.push({ index: i, before: before[i] ?? null, after: after[i] ?? null });
    }
  }
  return diffs;
}

export interface DetectMoveOptions {
  /**
   * FEN of the full position *before* the move (with side-to-move, castling,
   * etc). When provided, the move is validated and SAN/promotion are filled in.
   * When omitted, a best-effort UCI is returned without validation.
   */
  beforeFen?: string;
}

/**
 * Returns the detected move, or `null` if the diff does not represent a single
 * completed move (e.g. a piece is currently lifted, or the change is noise).
 */
export function detectMove(
  before: BoardState,
  after: BoardState,
  options: DetectMoveOptions = {},
): DetectedMove | null {
  const diffs = diffSquares(before, after);
  if (diffs.length === 0) return null;

  // A square that had a piece and is now empty (or holds a different piece) is
  // a candidate origin. A square that is now occupied by a piece that was not
  // there before is a candidate destination.
  const vacated = diffs.filter((d) => d.before !== null && d.after === null);
  const appeared = diffs.filter(
    (d) => d.after !== null && d.after !== d.before,
  );

  let from: number | undefined;
  let to: number | undefined;

  if (vacated.length >= 1 && appeared.length >= 1) {
    // Normal move or capture: piece left one square, arrived on another.
    // Castling vacates 2 (king+rook) and fills 2 — the king move identifies it.
    const king = appeared.find(
      (d) => d.after === 'K' || d.after === 'k',
    );
    const movedPiece = king ?? appeared[0]!;
    to = movedPiece.index;
    // Origin = a vacated square holding the same piece that appeared at `to`,
    // falling back to any vacated square (handles promotion: pawn -> queen).
    const origin =
      vacated.find((d) => d.before === movedPiece.after) ?? vacated[0]!;
    from = origin.index;
  } else if (vacated.length >= 1 && appeared.length === 0) {
    // Only lifts seen — move not completed yet (transient mid-move snapshot).
    return null;
  } else {
    return null;
  }

  if (from === undefined || to === undefined) return null;

  const fromSq = indexToSquare(from) as Square;
  const toSq = indexToSquare(to) as Square;

  if (options.beforeFen) {
    return validateWithChessJs(options.beforeFen, fromSq, toSq);
  }

  return {
    from: fromSq,
    to: toSq,
    uci: `${fromSq}${toSq}`,
  };
}

function validateWithChessJs(
  beforeFen: string,
  from: Square,
  to: Square,
): DetectedMove | null {
  const game = new Chess();
  try {
    game.load(beforeFen);
  } catch {
    // Invalid FEN — fall back to unvalidated UCI.
    return { from, to, uci: `${from}${to}` };
  }

  // Try the move, auto-promoting to queen when a promotion is required.
  for (const promotion of [undefined, 'q'] as const) {
    try {
      const move = game.move({ from, to, promotion });
      if (move) {
        return {
          from,
          to,
          promotion: move.promotion as DetectedMove['promotion'],
          uci: `${from}${to}${move.promotion ?? ''}`,
          san: move.san,
        };
      }
    } catch {
      // chess.js throws on illegal moves — try the next variant.
    }
  }
  return null;
}
