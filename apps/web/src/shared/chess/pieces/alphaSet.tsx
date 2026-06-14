import type { PieceRenderSet, PieceCode } from './types'
import { PIECE_CODES } from './types'

/**
 * "Alpha" — a clean, license-free glyph set.
 * Each piece is the Unicode chess glyph for its TYPE, painted in the colour's
 * fill with a contrasting outline so both white and black pieces read clearly
 * on any board theme.
 */
const GLYPH: Record<string, string> = {
  K: '♚', // ♚ (solid glyph, recoloured per side)
  Q: '♛', // ♛
  R: '♜', // ♜
  B: '♝', // ♝
  N: '♞', // ♞
  P: '♟', // ♟
}

function makePiece(code: PieceCode) {
  const isWhite = code[0] === 'w'
  const type = code[1]
  const fill = isWhite ? '#f8f8f8' : '#2b2b2b'
  const stroke = isWhite ? '#2b2b2b' : '#f8f8f8'
  return function AlphaPiece() {
    return (
      <svg viewBox="0 0 45 45" width="100%" height="100%" aria-hidden="true">
        <text
          x="22.5"
          y="34"
          textAnchor="middle"
          fontSize="40"
          fill={fill}
          stroke={stroke}
          strokeWidth="0.8"
          style={{ paintOrder: 'stroke' }}
        >
          {GLYPH[type]}
        </text>
      </svg>
    )
  }
}

export const alphaSet: PieceRenderSet = Object.fromEntries(
  PIECE_CODES.map((code) => [code, makePiece(code)]),
)
