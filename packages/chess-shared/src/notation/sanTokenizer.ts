/**
 * SAN tokenizer: scans a text string and returns chess move tokens
 * preserving character offsets (needed for clickable span mapping).
 *
 * Handles:
 * - Move numbers: "12." and "12..." (ellipsis = black's move)
 * - Standard piece moves: Nf3, Bc4, Qxd5, Rxe8+, Kh1
 * - Pawn moves: e4, exd5, e8=Q
 * - Castling: O-O, O-O-O (English normalised)
 * - Checks/mates: +, #
 * - Annotations: !, ?, !!, ??, !?, ?!
 * - Parenthesised variations: (, )
 */

export type TokenType =
  | 'move-number'    // "1." or "1..."
  | 'move'           // SAN move token
  | 'variation-open'  // (
  | 'variation-close' // )
  | 'annotation'     // !, ?, etc. standalone
  | 'paragraph-break' // a newline / paragraph boundary in the source
  | 'result';        // 1-0, 0-1, 1/2-1/2, *

export interface SanToken {
  type: TokenType;
  raw: string;        // raw text as found in source
  charStart: number;
  charEnd: number;    // exclusive
  /** Parsed move number (only for move-number tokens) */
  moveNumber?: number;
  /** true if this is a black's continuation move number (1...) */
  isEllipsis?: boolean;
  /** Normalised English SAN (only for move tokens) */
  san?: string;
  /** Original source notation as written (e.g. "♘f3", "Cf3"); set by recognizeGames. */
  rawSan?: string;
  /** Determined by context: color of the move that follows this move-number */
  color?: 'white' | 'black';
  /**
   * true when this token is the FIRST move-ish token of its paragraph/line, i.e.
   * a paragraph break (newline) precedes it with no intervening move. The reader
   * uses this as a strong signal that a move-number here resumes the mainline.
   */
  atParagraphStart?: boolean;
  /**
   * true when this move token is NOT a reproducible game move: it is an isolated
   * SAN-looking token in prose (e.g. "—d5—", "la casilla e4") that is not chained
   * back to a move-number through adjacent tokens. Isolated moves must not enter
   * the game sequence; they are only highlighted as a single square on the board.
   * Only meaningful for type === 'move'.
   */
  isolated?: boolean;
}

/**
 * Max char gap (whitespace/punctuation) allowed between two chained tokens.
 * Real game moves are separated by a space or a "." → gap of 1-2. Isolated prose
 * moves are separated by words/dashes → gap of 7+. 3 is a safe threshold.
 */
const MAX_CHAIN_GAP = 3;

// SAN move pattern (English notation only — caller should normalise Spanish first)
// Note: no trailing \b because check (+) and mate (#) symbols are non-word chars
const SAN_MOVE_RE =
  /(?<![a-zA-Z])(O-O-O|O-O|[KQRBN][a-h1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?[!?]*|[KQRBN][a-h1-8]?[a-h][1-8](?:=[QRBN])?[+#]?[!?]*|[a-h]x?[a-h][1-8](?:=[QRBN])?[+#]?[!?]*|[a-h][1-8](?:=[QRBN])?[+#]?[!?]*)(?=[^a-zA-Z]|$)/g;

const MOVE_NUMBER_RE = /\b(\d{1,3})(\.{1,3})\s*/g;
const RESULT_RE = /\b(1-0|0-1|1\/2-1\/2|\*)\b/g;

export function tokenize(text: string): SanToken[] {
  const tokens: SanToken[] = [];

  // We do a single linear scan. Build a set of all token positions.
  // Strategy: find move-number patterns first, then SAN moves in remaining gaps.

  type RawMatch = { start: number; end: number; token: SanToken };
  const matches: RawMatch[] = [];

  // Collect paragraph breaks (newlines). Consecutive newlines collapse into one
  // break token. These mark where a new paragraph/line begins in the source.
  {
    const re = /\n+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        token: { type: 'paragraph-break', raw: m[0], charStart: m.index, charEnd: m.index + m[0].length },
      });
    }
  }

  // Collect variation markers. Parentheses, square brackets and braces all open
  // and close an isolated variation line: ( … ), [ … ], { … }.
  const OPENERS = '([{';
  const CLOSERS = ')]}';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (OPENERS.includes(ch)) {
      matches.push({
        start: i, end: i + 1,
        token: { type: 'variation-open', raw: ch, charStart: i, charEnd: i + 1 }
      });
    } else if (CLOSERS.includes(ch)) {
      matches.push({
        start: i, end: i + 1,
        token: { type: 'variation-close', raw: ch, charStart: i, charEnd: i + 1 }
      });
    }
  }

  // Collect move numbers
  {
    const re = /\b(\d{1,3})(\.{1,3})/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const num = parseInt(m[1], 10);
      const dots = m[2];
      const isEllipsis = dots.length >= 2;
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        token: {
          type: 'move-number',
          raw: m[0],
          charStart: m.index,
          charEnd: m.index + m[0].length,
          moveNumber: num,
          isEllipsis,
          color: isEllipsis ? 'black' : 'white',
        }
      });
    }
  }

  // Collect result tokens
  {
    const re = /\b(1-0|0-1|1\/2-1\/2|\*)\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        token: { type: 'result', raw: m[0], charStart: m.index, charEnd: m.index + m[0].length }
      });
    }
  }

  // Collect SAN moves
  {
    const re = new RegExp(SAN_MOVE_RE.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        token: {
          type: 'move',
          raw: m[0],
          charStart: m.index,
          charEnd: m.index + m[0].length,
          san: m[0],
        }
      });
    }
  }

  // Sort by start position, resolve overlaps (prefer longer / earlier)
  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  const used = new Set<number>();
  const nonOverlapping: RawMatch[] = [];

  for (const match of matches) {
    let conflict = false;
    for (let i = match.start; i < match.end; i++) {
      if (used.has(i)) { conflict = true; break; }
    }
    if (!conflict) {
      for (let i = match.start; i < match.end; i++) used.add(i);
      nonOverlapping.push(match);
    }
  }

  nonOverlapping.sort((a, b) => a.start - b.start);

  // Assign color to moves based on preceding move-number.
  //
  // Reproducibility chain: a move is a real game move only if it is connected,
  // through small char gaps, back to a move-number. We track `chainEnd` = the
  // charEnd of the last token in the live chain. A move-number (re)seeds the
  // chain; a '(' that opens right after a live chain lets the paren inherit it
  // (saved/restored on ')'). A move whose gap to the chain is too large is an
  // isolated prose token (marked `isolated`) and breaks the chain.
  let currentMoveNumber = 1;
  let nextColor: 'white' | 'black' = 'white';

  // chainEnd = charEnd of the last chained token, or null when the chain is dead.
  let chainEnd: number | null = null;
  const chainStack: Array<number | null> = [];
  // charEnd of the most recent paragraph-break, or null once consumed. Used to
  // verify the NEXT move-ish token sits at the real start of the paragraph (only
  // whitespace/punctuation between the break and the token — no prose words).
  let paragraphBreakEnd: number | null = null;
  // Set when a paragraph-leading move-number was seen, to also flag its move.
  let carryParagraphStart = false;

  const chained = (start: number): boolean =>
    chainEnd !== null && start - chainEnd <= MAX_CHAIN_GAP;

  // A token leads its paragraph only if everything between the break and the
  // token is non-letter (spaces, digits-as-part-of-number handled separately,
  // punctuation) — i.e. no prose words precede it on that line.
  const leadsParagraph = (tokenStart: number): boolean => {
    if (paragraphBreakEnd === null) return false;
    const between = text.slice(paragraphBreakEnd, tokenStart);
    return !/[A-Za-zÀ-ÿ]/.test(between);
  };

  for (const { token } of nonOverlapping) {
    if (token.type === 'paragraph-break') {
      // A newline breaks the reproducibility chain (a move after a newline is in
      // a new paragraph, not glued to the previous token).
      paragraphBreakEnd = token.charEnd;
      chainEnd = null;
      // Not emitted into the token stream — it is a positional signal only.
      continue;
    }
    if (token.type === 'move-number') {
      currentMoveNumber = token.moveNumber!;
      nextColor = token.isEllipsis ? 'black' : 'white';
      if (leadsParagraph(token.charStart)) {
        token.atParagraphStart = true;
        // Carry the flag onto the first move of this number too.
        carryParagraphStart = true;
      }
      paragraphBreakEnd = null;
      // A move-number always seeds/keeps the chain alive.
      chainEnd = token.charEnd;
      tokens.push(token);
    } else if (token.type === 'move') {
      token.moveNumber = currentMoveNumber;
      token.color = nextColor;
      if (leadsParagraph(token.charStart) || carryParagraphStart) {
        token.atParagraphStart = true;
        carryParagraphStart = false;
      }
      paragraphBreakEnd = null;
      nextColor = nextColor === 'white' ? 'black' : 'white';
      if (chained(token.charStart)) {
        chainEnd = token.charEnd;
      } else {
        token.isolated = true;
        chainEnd = null;
      }
      tokens.push(token);
    } else if (token.type === 'variation-open') {
      // A paren between a paragraph-leading number and its move cancels the carry.
      carryParagraphStart = false;
      paragraphBreakEnd = null;
      // The paren inherits the chain only if it opens adjacent to a live chain.
      chainStack.push(chainEnd);
      chainEnd = chained(token.charStart) ? token.charEnd : null;
      tokens.push(token);
    } else if (token.type === 'variation-close') {
      // A move right after ')' continues the enclosing line, so the close paren
      // anchors the chain at its own position — but only if the line was alive
      // either before the paren or inside it. A purely-prose paren stays dead.
      const savedPre = chainStack.length > 0 ? chainStack.pop()! : null;
      chainEnd = savedPre !== null || chainEnd !== null ? token.charEnd : null;
      tokens.push(token);
    } else {
      // result / other: does not extend the move chain.
      chainEnd = null;
      tokens.push(token);
    }
  }

  return tokens;
}
