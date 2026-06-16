/**
 * recognizeGames: finds chess game fragments in a prose text string.
 *
 * Strategy:
 *  1. Scan text for move-number tokens starting at 1.
 *  2. Collect the token sequence until a clear "game end" signal
 *     (result token, next game starting at 1., or long gap without moves).
 *  3. Build a GameTree for each collected sequence.
 *  4. Return recognised games with source span + GameTree.
 */

import { tokenize, type SanToken } from '../notation/sanTokenizer.js';
import { figurineToAscii } from '../notation/figurineToAscii.js';
import { spanishToEnglish } from '../notation/spanishToEnglish.js';
import { buildGameTree } from '../pgn/pgnToTree.js';
import { buildGameTreeTwoPass } from '../pgn/twoPassBuilder.js';
import { type GameTree } from '../model/gameTree.js';

const STANDARD_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Recognition algorithm:
 *  - 1: mainline only — pass 1 of the two-pass builder. Builds just the clean
 *       main line (paragraphs starting with the contiguous next ply), no
 *       variations at all.
 *  - 2: two-pass, number-authoritative — mainline first, then variations
 *       anchored by move number. Keeps the mainline pristine. (Default.)
 *  - 3: legacy single-pass (validation-anchored). Kept for comparison.
 */
export interface RecognizeOptions {
  algorithm?: 1 | 2 | 3;
}

export interface RecognizedGame {
  /** Character offset in the original text where the game starts */
  charStart: number;
  /** Character offset (exclusive) where the game ends */
  charEnd: number;
  /** The raw source text slice */
  source: string;
  /** The built GameTree */
  tree: GameTree;
}

export function recognizeGames(text: string, options: RecognizeOptions = {}): RecognizedGame[] {
  const algorithm = options.algorithm ?? 2;
  // Normalise figurine glyphs (♘→N) and then Spanish notation (Cf3→Nf3).
  // Both transforms are length-preserving for piece letters, so token offsets
  // stay aligned with the ORIGINAL `text` and we can recover the source token.
  const normalised = spanishToEnglish(figurineToAscii(text));

  const tokens = tokenize(normalised);

  if (tokens.length === 0) return [];

  // Attach the original source notation (rawSan) to every move token.
  for (const token of tokens) {
    if (token.type === 'move') {
      token.rawSan = text.slice(token.charStart, token.charEnd);
    }
  }

  // Split token stream into candidate game sequences.
  //
  // A `result` token (1-0, …) does NOT close the game: analysis prose with
  // variations frequently follows the result (e.g. "19. Be4 was stronger"),
  // and those moves belong to the SAME game. Instead, a result MARKS that any
  // following content is analysis. A genuinely new game only begins on a fresh
  // "1." move-number that appears AFTER a result (the PGN convention for
  // separating consecutive games), or on a "1." when no result has been seen
  // yet but a previous mainline already started from move 1.
  const gameSequences: SanToken[][] = [];
  let current: SanToken[] = [];
  let sawMove1 = false;

  for (const token of tokens) {
    // A fresh "1." (white) when the current sequence already has a move 1 and
    // some moves → the start of a NEW game (back-to-back PGN dump). Post-result
    // analysis uses higher move numbers (19., 20., …) and stays in this game.
    if (
      token.type === 'move-number' &&
      token.moveNumber === 1 &&
      !token.isEllipsis
    ) {
      if (sawMove1 && current.some(t => t.type === 'move')) {
        gameSequences.push(current);
        current = [];
      }
      sawMove1 = true;
      current.push(token);
      continue;
    }

    // Result tokens stay in the sequence (analysis prose may follow).
    current.push(token);
  }

  if (current.some(t => t.type === 'move' || t.type === 'move-number')) {
    gameSequences.push(current);
  }

  const results: RecognizedGame[] = [];

  for (const seq of gameSequences) {
    const moveTokens = seq.filter(t => t.type === 'move');
    if (moveTokens.length === 0) continue;

    const charStart = seq[0].charStart;
    const charEnd = seq[seq.length - 1].charEnd;

    const tree =
      algorithm === 1 ? buildGameTreeTwoPass(seq, STANDARD_START_FEN, true) // mainline only
      : algorithm === 2 ? buildGameTreeTwoPass(seq, STANDARD_START_FEN)
      : buildGameTree(seq, STANDARD_START_FEN);

    if (tree.nodes.size === 0) continue;

    results.push({
      charStart,
      charEnd,
      source: normalised.slice(charStart, charEnd),
      tree,
    });
  }

  return results;
}
