import type { Arrow } from 'react-chessboard'

/** Colour of the engine best-move arrow (blue). */
export const ENGINE_ARROW_COLOR = '#2563eb'
/** Colour of the next-move (premove) arrow shown when the engine is off (green). */
export const PREMOVE_ARROW_COLOR = '#16a34a'

export interface BoardArrowState {
  /** annotation arrows drawn by the user (always shown) */
  userArrows: Arrow[]
  showEval: boolean
  hideEngineArrow: boolean
  /** engine best move as UCI (e.g. "e2e4"), if available */
  bestMoveUci?: string
  /** the tree's next move (premove), from→to, if any */
  nextMove?: { from: string; to: string } | null
}

/** Split a UCI move into from/to squares (null if malformed). */
function uciSquares(uci: string): { from: string; to: string } | null {
  if (uci.length < 4) return null
  return { from: uci.slice(0, 2), to: uci.slice(2, 4) }
}

/**
 * Compose the arrows shown on the study board:
 *  - user annotation arrows are always kept;
 *  - when the engine is ON and not hidden, add the best-move arrow (blue);
 *  - when the engine is OFF, add the tree's next-move arrow (green premove).
 * The two automatic arrows are mutually exclusive by design.
 */
export function buildBoardArrows(state: BoardArrowState): Arrow[] {
  const arrows: Arrow[] = [...state.userArrows]

  if (state.showEval) {
    if (!state.hideEngineArrow && state.bestMoveUci) {
      const sq = uciSquares(state.bestMoveUci)
      if (sq) {
        arrows.push({ startSquare: sq.from, endSquare: sq.to, color: ENGINE_ARROW_COLOR })
      }
    }
  } else if (state.nextMove) {
    arrows.push({
      startSquare: state.nextMove.from,
      endSquare: state.nextMove.to,
      color: PREMOVE_ARROW_COLOR,
    })
  }

  return arrows
}
