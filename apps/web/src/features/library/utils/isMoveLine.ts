// Piece letters incl. Unicode figurines, matching the BookReader SAN tokenizer.
const PIECE = 'KQRBN♔♚♕♛♖♜♗♝♘♞'

// A line is a "move line" when its FIRST non-space token is a move-ish token:
//  - a move number:        "1." or "12..."
//  - a SAN move:           "e4", "Nf3", "O-O", "exd5", "Qxf7+", "♘f3"
//  - a bare annotation:    "!", "?", "!?", "+/-", "=", "∞" …
const LEADING_MOVE_NUMBER = /^\s*\d+\.(\.\.)?/
const LEADING_SAN = new RegExp(
  `^\\s*(O-O-O|O-O|[${PIECE}][a-h1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|[a-h]x?[a-h][1-8](?:=[QRBN])?[+#]?|[a-h][1-8](?:=[QRBN])?[+#]?)`,
)
const LEADING_ANNOTATION = /^\s*([!?]+|[+\-=]\/?[+\-=]?|[±∓⩲⩱∞⊕→↑]|N\b)/

/**
 * True when a paragraph's text begins with a chess move, move number, or
 * annotation glyph — these lines should NOT be first-line indented.
 */
export function isMoveLine(text: string): boolean {
  if (!text) return false
  return (
    LEADING_MOVE_NUMBER.test(text) ||
    LEADING_SAN.test(text) ||
    LEADING_ANNOTATION.test(text)
  )
}
