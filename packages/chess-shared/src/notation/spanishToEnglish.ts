/**
 * Converts Spanish chess notation (SAN) to English SAN.
 *
 * Spanish piece letters:
 *  C -> N (Caballo / Knight)
 *  A -> B (Alfil / Bishop)
 *  D -> Q (Dama / Queen)
 *  T -> R (Torre / Rook)
 *  R (Rey / King) -> K  — but ONLY when it starts or follows expected SAN patterns
 *
 * Castling normalisation: 0-0 -> O-O, 0-0-0 -> O-O-O
 *
 * Order of substitution matters:
 *  1. Normalise castling BEFORE piece substitutions (avoids 0->O being confused)
 *  2. Replace T->R before R->K so we don't re-process T-derived Rs
 *  3. Use word-boundary / positional logic so 'R' as King doesn't clobber file 'r'
 */

/**
 * Pure token conversion: converts a single SAN token written in Spanish to English.
 * Input must already be a clean SAN token (no leading/trailing whitespace).
 */
export function spanishTokenToEnglish(token: string): string {
  // Castling: 0-0-0 -> O-O-O, 0-0 -> O-O (before piece mapping)
  let t = token
    .replace(/^0-0-0$/, 'O-O-O')
    .replace(/^0-0$/, 'O-O');

  // If it's already an O-O variant, no piece substitution needed
  if (t === 'O-O-O' || t === 'O-O') return t;

  // Piece substitutions — uppercase only (lowercase are files/squares)
  // Order matters:
  //  1. T->R first (Torre = Rook) — use a temporary placeholder __ROOK__ to prevent R->K from re-processing it
  //  2. C->N (Caballo = Knight)
  //  3. A->B (Alfil = Bishop)
  //  4. D->Q (Dama = Queen)
  //  5. R->K (Rey = King) — only for the ORIGINAL R, not T-derived Rs
  //  6. Restore __ROOK__ -> R
  t = t
    .replace(/^T/, '__ROOK__')   // Torre -> placeholder
    .replace(/^C/, 'N')           // Caballo -> Knight
    .replace(/^A/, 'B')           // Alfil -> Bishop
    .replace(/^D/, 'Q')           // Dama -> Queen
    .replace(/^R/, 'K')           // Rey -> King (original R only)
    .replace(/^__ROOK__/, 'R');   // restore Rook

  return t;
}

/**
 * Converts a full PGN/prose string with Spanish chess notation to English.
 * Replaces Spanish piece letters in SAN move tokens only.
 * Also normalises castling, move-number dots, and ellipsis.
 */
/**
 * Detects if text is already written in English chess notation.
 * Heuristic: if K, N, Q or B appear as piece moves (uppercase letter before
 * a square or 'x'), and no Spanish-only markers (C, D, T before squares) are
 * found, treat as English.
 */
function isEnglishNotation(text: string): boolean {
  const hasEnglish = /(?:^|[\s(])[KNQ](?=[a-h1-8x+#])/.test(text)
  const hasSpanish  = /(?:^|[\s(])[CDT](?=[a-h1-8x+#])/.test(text)
  return hasEnglish && !hasSpanish
}

export function spanishToEnglish(text: string): string {
  // Normalise ellipsis variants
  let result = text
    .replace(/…/g, '...')
    .replace(/&#8230;/g, '...');

  // Normalise castling zero-based to letter-based (applies to both languages)
  result = result
    .replace(/\b0-0-0\b/g, 'O-O-O')
    .replace(/\b0-0\b/g, 'O-O')
    .replace(/\b0–0–0\b/g, 'O-O-O')
    .replace(/\b0–0\b/g, 'O-O');

  // If already English notation, skip piece-letter substitution.
  // This prevents Re1 (Rook e1) from being mangled into Ke1 (King e1).
  if (isEnglishNotation(result)) return result;

  // Replace Spanish piece letters that start a SAN token.
  // A SAN token starts after whitespace, '(', or beginning of string,
  // and begins with an uppercase piece letter.
  // Use a placeholder for Torre (T=Rook) so R->K substitution doesn't clobber it
  result = result
    // T (Torre/Rook) -> placeholder — must come BEFORE R (Rey/King)
    .replace(/(?<=^|[\s(])T(?=[a-h1-8x\+#=\?\!])/g, '\x00ROOK\x00')
    // C (Caballo/Knight) -> N
    .replace(/(?<=^|[\s(])C(?=[a-h1-8x\+#=\?\!])/g, 'N')
    // A (Alfil/Bishop) -> B
    .replace(/(?<=^|[\s(])A(?=[a-h1-8x\+#=\?\!])/g, 'B')
    // D (Dama/Queen) -> Q
    .replace(/(?<=^|[\s(])D(?=[a-h1-8x\+#=\?\!])/g, 'Q')
    // R (Rey/King) -> K  — only in Spanish context (no K/N/Q already present)
    .replace(/(?<=^|[\s(])R(?=[a-h1-8x\+#=\?\!])/g, 'K')
    // Restore Rook placeholder
    .replace(/\x00ROOK\x00/g, 'R');

  return result;
}
