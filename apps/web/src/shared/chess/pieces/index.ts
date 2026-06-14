import type { PieceTheme } from '../../settings/settingsStore'
import type { PieceRenderSet } from './types'
import { alphaSet } from './alphaSet'
import { meridaSet } from './meridaSet'

export { PIECE_CODES } from './types'
export type { PieceRenderSet, PieceCode } from './types'

/**
 * Resolve a piece theme to a react-chessboard `pieces` render object.
 * Returns `null` for the `default` theme so the board keeps the library's
 * built-in pieces (no override).
 */
export function getPieceSet(theme: PieceTheme): PieceRenderSet | null {
  switch (theme) {
    case 'alpha':
      return alphaSet
    case 'merida':
      return meridaSet
    case 'default':
    default:
      return null
  }
}
