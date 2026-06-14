import { Chessboard } from 'react-chessboard'
import type { Arrow } from 'react-chessboard'
import type { CSSProperties } from 'react'
import { useSettingsStore, BOARD_THEMES } from '../settings/settingsStore'
import { getPieceSet } from './pieces'

export interface LastMove {
  from: string
  to: string
}

interface ChessBoardProps {
  fen: string
  orientation: 'white' | 'black'
  lastMove?: LastMove | null
  /** Drawn arrows (controlled). */
  arrows?: Arrow[]
  /** Allow the user to drag-draw arrows on the board. */
  allowDrawingArrows?: boolean
  /** Fired when the user adds/removes an arrow. */
  onArrowsChange?: (arrows: Arrow[]) => void
  /** Extra square styles (e.g. annotation highlights), merged AFTER lastMove. */
  customSquareStyles?: Record<string, CSSProperties>
  /** Fired when a square is clicked (used by highlight/eraser tools AND click-to-move). */
  onSquareClick?: (square: string) => void
  /** Enable drag-to-move. */
  allowDragging?: boolean
  /** Drag completion handler; return true to accept the move. */
  onPieceDrop?: (from: string, to: string) => boolean
  /** The selected source square (click-to-move) to highlight. */
  selectedSquare?: string | null
  /** Legal destination squares to highlight as move dots. */
  legalTargets?: string[]
}

const HIGHLIGHT_STYLE: CSSProperties = {
  backgroundColor: 'rgba(255, 214, 10, 0.5)',
}

// Subtle corner-dot highlight used when "full square highlight" is OFF.
const DOT_HIGHLIGHT_STYLE: CSSProperties = {
  background:
    'radial-gradient(circle at 50% 50%, rgba(255,214,10,0.85) 12%, transparent 16%)',
}

const SELECTED_STYLE: CSSProperties = {
  backgroundColor: 'rgba(56, 142, 255, 0.45)',
}

// A small centred dot marking a legal destination.
const TARGET_STYLE: CSSProperties = {
  background:
    'radial-gradient(circle, rgba(56,142,255,0.55) 22%, transparent 24%)',
}

export default function ChessBoard({
  fen,
  orientation,
  lastMove,
  arrows,
  allowDrawingArrows,
  onArrowsChange,
  customSquareStyles,
  onSquareClick,
  allowDragging,
  onPieceDrop,
  selectedSquare,
  legalTargets,
}: ChessBoardProps) {
  const boardTheme = useSettingsStore((s) => s.boardTheme)
  const pieceTheme = useSettingsStore((s) => s.pieceTheme)
  const showBoardLabels = useSettingsStore((s) => s.showBoardLabels)
  const fullSquareHighlight = useSettingsStore((s) => s.fullSquareHighlight)
  const theme = BOARD_THEMES[boardTheme]
  const pieces = getPieceSet(pieceTheme)

  const lastMoveStyle = fullSquareHighlight ? HIGHLIGHT_STYLE : DOT_HIGHLIGHT_STYLE

  const squareStyles: Record<string, CSSProperties> = {}
  if (lastMove) {
    squareStyles[lastMove.from] = lastMoveStyle
    squareStyles[lastMove.to]   = lastMoveStyle
  }
  if (customSquareStyles) {
    for (const [sq, style] of Object.entries(customSquareStyles)) {
      squareStyles[sq] = { ...squareStyles[sq], ...style }
    }
  }
  // Click-to-move overlays (drawn on top of last-move / annotations).
  if (selectedSquare) {
    squareStyles[selectedSquare] = { ...squareStyles[selectedSquare], ...SELECTED_STYLE }
  }
  if (legalTargets) {
    for (const sq of legalTargets) {
      squareStyles[sq] = { ...squareStyles[sq], ...TARGET_STYLE }
    }
  }

  return (
    <Chessboard
      options={{
        position: fen,
        boardOrientation: orientation,
        squareStyles,
        allowDragging: allowDragging ?? false,
        showAnimations: false,
        allowDrawingArrows: allowDrawingArrows ?? false,
        ...(arrows ? { arrows } : {}),
        ...(onArrowsChange ? { onArrowsChange: ({ arrows }) => onArrowsChange(arrows) } : {}),
        ...(onSquareClick ? { onSquareClick: ({ square }) => onSquareClick(square) } : {}),
        ...(onPieceDrop
          ? {
              onPieceDrop: ({ sourceSquare, targetSquare }) =>
                targetSquare ? onPieceDrop(sourceSquare, targetSquare) : false,
            }
          : {}),
        lightSquareStyle: { backgroundColor: theme.light },
        darkSquareStyle:  { backgroundColor: theme.dark },
        showNotation: showBoardLabels,
        ...(pieces ? { pieces } : {}),
      }}
    />
  )
}
