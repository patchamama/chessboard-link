/**
 * Algorithm 2 — two-pass, number-authoritative GameTree builder.
 *
 * The key invariant the single-pass builder kept violating: the move NUMBER
 * written in the source is law. A move "N. san" belongs at ply N, full stop.
 *
 * Pass 1 — MAINLINE ONLY:
 *   Walk the tokens. Track the expected next ply of the mainline. A move is a
 *   mainline move iff its written (number,color) equals that expected ply AND it
 *   is legal there. Everything else (prose alternatives, parenthesised lines,
 *   restated earlier plies) is skipped in this pass. Parentheses are skipped
 *   wholesale: their content never enters the mainline.
 *
 * Pass 2 — VARIATIONS:
 *   With the clean mainline built, walk the tokens again. Any run of moves that
 *   did NOT go to the mainline is a variation; it anchors onto the mainline node
 *   whose ply is the PREDECESSOR of the run's first move number (number-anchored),
 *   validated with chess.js. Nested parentheses open sub-lines under the current
 *   variation node.
 */

import { Chess } from 'chess.js';
import { type SanToken } from '../notation/sanTokenizer.js';
import {
  type GameTree,
  type GameNode,
  type IsolatedMove,
  createGameTree,
  type RecognitionError,
} from '../model/gameTree.js';
import { resetNodeCounter } from './pgnToTree.js';

/** Parse a bare (isolated) SAN token into a square + piece for board highlight. */
function parseIsolatedMove(token: SanToken): IsolatedMove | null {
  const san = token.san!;
  const core = san.replace(/[+#!?]+$/g, '').replace(/=[QRBN]$/i, '');
  const dest = core.match(/([a-h][1-8])(?!.*[a-h][1-8])/);
  if (!dest) return null;
  const lead = core[0];
  const piece: IsolatedMove['piece'] =
    lead === 'N' ? 'n' : lead === 'B' ? 'b' : lead === 'R' ? 'r'
    : lead === 'Q' ? 'q' : lead === 'K' ? 'k' : 'p';
  return {
    square: dest[1],
    piece,
    san,
    ...(token.rawSan ? { rawSan: token.rawSan } : {}),
    ...(token.charStart !== undefined ? { charStart: token.charStart, charEnd: token.charEnd } : {}),
  };
}

const STANDARD_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

let _id = 0;
function nextId(): string {
  return `node-${++_id}`;
}

function plyIndex(moveNumber: number, color: 'white' | 'black'): number {
  return (moveNumber - 1) * 2 + (color === 'white' ? 1 : 2);
}

function isLegalFrom(fen: string, san: string): boolean {
  try {
    const c = new Chess(fen);
    c.move(san);
    return true;
  } catch {
    return false;
  }
}

/** Make a node from a token, playing `san` on `chess` (already legal). */
function makeNode(
  token: SanToken,
  chess: Chess,
  parentId: string | null,
  moveNumber: number,
  color: 'white' | 'black',
): GameNode {
  const fenBefore = chess.fen();
  const res = chess.move(token.san!);
  return {
    id: nextId(),
    san: res?.san ?? token.san!,
    fen: chess.fen(),
    from: res?.from ?? '',
    to: res?.to ?? '',
    moveNumber,
    color,
    parentId,
    ...(token.rawSan ? { rawSan: token.rawSan } : {}),
    ...(token.charStart !== undefined
      ? { charStart: token.charStart, charEnd: token.charEnd }
      : {}),
    ...(fenBefore === chess.fen() ? { invalid: true } : {}),
  };
}

export function buildGameTreeTwoPass(
  tokens: SanToken[],
  startFen: string = STANDARD_START_FEN,
  mainlineOnly = false,
): GameTree {
  resetNodeCounter();
  _id = 0;
  const tree = createGameTree(startFen);
  const errors: RecognitionError[] = tree.errors;

  // ── PASS 1: build the clean mainline ──────────────────────────────────────
  // expectedNext starts at 1.white.
  const chess = new Chess(startFen);
  let parentId: string | null = null;
  let expNumber = 1;
  let expColor: 'white' | 'black' = 'white';
  // Which token indices were consumed by the mainline (so pass 2 skips them).
  const usedByMainline = new Set<number>();
  // Map "moveNumber:color" → mainline node id (anchor lookup for pass 2).
  const mainlineByPly = new Map<number, string>();

  // The mainline only grows from paragraphs that START with the contiguous next
  // mainline ply (the user's rule). At each paragraph boundary we re-decide:
  // the paragraph's FIRST move must be the expected next ply AND legal; only then
  // does the paragraph feed the mainline. Otherwise the whole paragraph is prose
  // and is skipped by pass 1.
  let parenDepth = 0;
  let inMainlineParagraph = true;   // the first paragraph opens the game
  let paragraphDecided = false;     // has this paragraph's first move been seen?
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'paragraph-break') {
      // New paragraph: re-decide on its first move.
      paragraphDecided = false;
      inMainlineParagraph = false;
      continue;
    }
    if (t.type === 'variation-open') { parenDepth++; continue; }
    if (t.type === 'variation-close') { if (parenDepth > 0) parenDepth--; continue; }
    if (parenDepth > 0) continue; // skip everything inside parentheses in pass 1
    if (t.type !== 'move' || t.isolated) continue;
    if (t.moveNumber === undefined || !t.color) continue;

    // First move of this paragraph decides whether it feeds the mainline. It
    // qualifies only if the move LEADS the paragraph (no prose before it on the
    // line) AND is the contiguous next ply AND legal. A paragraph that opens
    // with prose ("Aquí las negras podían jugar 3...Nf6") is analysis, not the
    // mainline — its first move has atParagraphStart=false.
    if (!paragraphDecided) {
      paragraphDecided = true;
      // The very first move of the text leads the game even without a preceding
      // newline; afterwards a paragraph qualifies only if its first move leads it.
      const leads = t.atParagraphStart || tree.mainline.length === 0;
      inMainlineParagraph =
        leads &&
        t.moveNumber === expNumber &&
        t.color === expColor &&
        isLegalFrom(chess.fen(), t.san!);
    }
    if (!inMainlineParagraph) continue;

    // Accept as the next mainline ply when it is legal there AND the written
    // number does not CONTRADICT the expected ply. The number is authoritative,
    // but a bare move with no explicit number (or one mis-carried across a closed
    // paren) must not block a legal contiguous continuation: we accept it on
    // legality and stamp it with the EXPECTED number (never renaming forward).
    const numberFits =
      t.moveNumber === expNumber ||           // exact ply match, or
      plyIndex(t.moveNumber!, t.color!) >= plyIndex(expNumber, expColor); // not a regression
    if (numberFits && isLegalFrom(chess.fen(), t.san!)) {
      const node = makeNode(t, chess, parentId, expNumber, expColor); // stamp EXPECTED ply
      tree.nodes.set(node.id, node);
      tree.mainline.push(node.id);
      mainlineByPly.set(plyIndex(expNumber, expColor), node.id);
      usedByMainline.add(i);
      parentId = node.id;
      if (expColor === 'white') { expColor = 'black'; }
      else { expColor = 'white'; expNumber++; }
    } else {
      // The move did not extend the mainline. If its written number SKIPS past
      // the expected ply (a forward gap) it means an earlier ply is missing in
      // the source — flag it. Then end the mainline paragraph.
      if (
        t.moveNumber !== undefined && t.color &&
        plyIndex(t.moveNumber, t.color) > plyIndex(expNumber, expColor)
      ) {
        errors.push({
          kind: 'missing-move',
          san: t.san!,
          ...(t.rawSan ? { rawSan: t.rawSan } : {}),
          moveNumber: t.moveNumber,
          color: t.color,
          message: `Falta una jugada antes de ${t.moveNumber}${t.color === 'black' ? '...' : '.'} ${t.san} (la línea principal esperaba ${expNumber}${expColor === 'black' ? '...' : '.'}).`,
          ...(t.charStart !== undefined ? { charStart: t.charStart, charEnd: t.charEnd } : {}),
        });
      }
      inMainlineParagraph = false;
    }
  }

  // ── PASS 2: insert variations, anchored by NUMBER onto the mainline ───────
  // Skipped for algorithm 1 (mainline only). Walk again; group consecutive
  // non-mainline moves into variation runs.
  if (!mainlineOnly) {
    insertVariations(tokens, tree, mainlineByPly, usedByMainline, startFen, errors);
  }

  return tree;
}

interface VarFrame {
  /** chess state for this variation line */
  chess: Chess;
  /** parent node id the next move attaches to */
  parentId: string | null;
  /** the line array (node ids) collecting this variation */
  line: string[];
  /** the variations-map key this line lives under */
  anchorKey: string;
}

function insertVariations(
  tokens: SanToken[],
  tree: GameTree,
  mainlineByPly: Map<number, string>,
  usedByMainline: Set<number>,
  startFen: string,
  errors: RecognitionError[],
): void {
  // Anchor a new variation run by its first move's number: it continues right
  // after ply (number,color)-1 on the mainline (or replaces that ply).
  const anchorFor = (token: SanToken): { parentId: string | null; fen: string } | null => {
    if (token.moveNumber === undefined || !token.color) return null;
    const predPly = plyIndex(token.moveNumber, token.color) - 1;
    // Anchor AT the predecessor mainline node (the move continues after it).
    if (predPly >= 1) {
      const anchorId = mainlineByPly.get(predPly);
      if (anchorId) {
        const node = tree.nodes.get(anchorId)!;
        if (isLegalFrom(node.fen, token.san!)) return { parentId: anchorId, fen: node.fen };
      }
    }
    // Replace ply N: anchor at the PARENT of the mainline node with this ply.
    const samePly = plyIndex(token.moveNumber, token.color);
    const replaceId = mainlineByPly.get(samePly);
    if (replaceId) {
      const node = tree.nodes.get(replaceId)!;
      const pFen = node.parentId ? tree.nodes.get(node.parentId)!.fen : startFen;
      if (isLegalFrom(pFen, token.san!)) return { parentId: node.parentId, fen: pFen };
    }
    return null;
  };

  const openLine = (parentId: string | null): string[] => {
    const key = parentId ?? 'root';
    if (!tree.variations.has(key)) tree.variations.set(key, []);
    const line: string[] = [];
    tree.variations.get(key)!.push(line);
    return line;
  };

  // Stack of variation frames for nested parentheses.
  const stack: VarFrame[] = [];
  let cur: VarFrame | null = null;
  let firstUnreferencedReported = false;

  const closeRun = () => { cur = null; };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t.type === 'variation-open') {
      // A '(' nests a sub-line under the current variation node (or, if no run is
      // active, under the last mainline-ish node — handled when its first move
      // anchors). Push current frame; start a fresh nested frame lazily.
      stack.push(cur as VarFrame);
      cur = null;
      continue;
    }
    if (t.type === 'variation-close') {
      cur = stack.length > 0 ? stack.pop() ?? null : null;
      continue;
    }

    if (t.type !== 'move') {
      // move-number / result / etc.: a paragraph-leading mainline run resets cur.
      if (t.type === 'result') closeRun();
      continue;
    }
    if (usedByMainline.has(i)) { closeRun(); continue; } // mainline move → end any run
    if (t.isolated) {
      // Bare prose move (not chained to a number): board-only square highlight.
      const iso = parseIsolatedMove(t);
      if (iso) tree.isolatedMoves.push(iso);
      continue;
    }
    if (t.moveNumber === undefined || !t.color) continue;

    if (cur === null) {
      // Start a new variation run: anchor it by NUMBER on the mainline.
      const anchor = anchorFor(t);
      if (!anchor) {
        // No legal anchor for this numbered move → unreferenced (report first).
        if (!firstUnreferencedReported) {
          firstUnreferencedReported = true;
          errors.push({
            kind: 'unreferenced',
            san: t.san!,
            ...(t.rawSan ? { rawSan: t.rawSan } : {}),
            moveNumber: t.moveNumber,
            color: t.color,
            message: `Jugada con número sin referencia válida: ${t.moveNumber}${t.color === 'black' ? '...' : '.'} ${t.san} (no ancla en ninguna posición de la partida).`,
            ...(t.charStart !== undefined ? { charStart: t.charStart, charEnd: t.charEnd } : {}),
          });
        }
        continue;
      }
      firstUnreferencedReported = false;
      const c = new Chess(anchor.fen);
      const line = openLine(anchor.parentId);
      cur = { chess: c, parentId: anchor.parentId, line, anchorKey: anchor.parentId ?? 'root' };
    }

    // Place the move in the current variation line if legal; else drop it.
    if (!isLegalFrom(cur.chess.fen(), t.san!)) {
      // Illegal continuation of this variation → stop the run here.
      cur = null;
      continue;
    }
    // The written number must match the position the move occupies in the line
    // (derived from the FEN's fullmove + side). A mismatch is a wrong-number.
    const fenParts = cur.chess.fen().split(' ');
    if (fenParts.length >= 6) {
      const posColor: 'white' | 'black' = fenParts[1] === 'w' ? 'white' : 'black';
      const posNumber = parseInt(fenParts[5], 10);
      if (!Number.isNaN(posNumber) && (posNumber !== t.moveNumber || posColor !== t.color)) {
        errors.push({
          kind: 'wrong-number',
          san: t.san!,
          ...(t.rawSan ? { rawSan: t.rawSan } : {}),
          moveNumber: t.moveNumber,
          color: t.color,
          message: `El número ${t.moveNumber}${t.color === 'black' ? '...' : '.'} no corresponde a la posición de la variante (debería ser ${posNumber}${posColor === 'black' ? '...' : '.'}) para ${t.san}.`,
          ...(t.charStart !== undefined ? { charStart: t.charStart, charEnd: t.charEnd } : {}),
        });
      }
    }
    const node = makeNode(t, cur.chess, cur.parentId, t.moveNumber, t.color);
    tree.nodes.set(node.id, node);
    cur.line.push(node.id);
    cur.parentId = node.id;
  }
}
