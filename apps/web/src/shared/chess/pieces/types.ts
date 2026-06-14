import type { PieceTheme } from '../../settings/settingsStore'

/** The 12 piece codes react-chessboard expects: colour + piece letter. */
export type PieceCode =
  | 'wP' | 'wN' | 'wB' | 'wR' | 'wQ' | 'wK'
  | 'bP' | 'bN' | 'bB' | 'bR' | 'bQ' | 'bK'

export const PIECE_CODES: PieceCode[] = [
  'wP', 'wN', 'wB', 'wR', 'wQ', 'wK',
  'bP', 'bN', 'bB', 'bR', 'bQ', 'bK',
]

/** A render object compatible with react-chessboard's `pieces` option. */
export type PieceRenderSet = Record<
  string,
  (props?: { fill?: string; square?: string; svgStyle?: React.CSSProperties }) => React.JSX.Element
>

export type { PieceTheme }
