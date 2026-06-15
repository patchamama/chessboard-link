/**
 * Converts a sequence of SAN tokens into a GameTree using chess.js for validation.
 *
 * Variation handling:
 *  - '(' forks a variation off the CURRENT node (the last successfully placed node)
 *  - ')' returns to the parent of the variation start (natural tree parent pointer)
 *  - Nested variations are supported
 *
 * Illegal moves:
 *  - A move that chess.js rejects → node marked invalid, line stops (no more moves in that branch)
 *  - Subsequent moves are skipped until the branch ends
 */

import { Chess } from 'chess.js';
import { type SanToken } from '../notation/sanTokenizer.js';
import {
  type GameTree,
  type GameNode,
  type IsolatedMove,
  createGameTree,
} from '../model/gameTree.js';

const STANDARD_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

let _nodeCounter = 0;
function nextId(): string {
  return `node-${++_nodeCounter}`;
}

export function resetNodeCounter(): void {
  _nodeCounter = 0;
}

interface BuildContext {
  chess: Chess;
  tree: GameTree;
  /** id of the node that is currently the "tip" of this branch */
  currentNodeId: string | null;
  /** FEN before the last move was played (used to fork variations) */
  fenBeforeLastMove: string;
  /** id of the parent of the last move placed (for variation parent tracking) */
  parentBeforeLastMove: string | null;
  /** stack for variation return points: each entry = [chess state to restore, node id to return to] */
  variationStack: Array<{
    fen: string;
    returnToNodeId: string | null;
    lineKeyDepth: number;
    proseLine: string[] | null;
    /** the line array for THIS paren variation (created lazily on first move) */
    line: string[] | null;
  }>;
  /** whether this branch is dead (last move was invalid) */
  dead: boolean;
  moveNumber: number;
  color: 'white' | 'black';
  /** mainline nodes keyed by "moveNumber:color" — anchors for prose analysis variations */
  mainlineByKey: Map<string, string>;
  /** false once the mainline is finished (a result token, or first re-anchor) → prose analysis mode */
  onMainline: boolean;
  /** highest move number reached on the mainline so far (to detect a backtracked move-number) */
  maxMainlineMoveNumber: number;
  /**
   * The move-number the author wrote explicitly right before the next move at
   * root level (null once consumed). Distinguishes an author-restated ply
   * ("...3. Nf3") from a number merely carried over from a closed paren.
   */
  pendingExplicitNumber: { moveNumber: number; color: 'white' | 'black' } | null;
  /** the prose analysis variation line currently being extended (node ids), or null on mainline */
  proseLine: string[] | null;
  /** true while inside a contiguous run of illegal numbered moves (report once) */
  inUnreferencedRun: boolean;
}

function moveKey(moveNumber: number, color: 'white' | 'black'): string {
  return `${moveNumber}:${color}`;
}

/** The last (tip) node of the mainline, or null if the mainline is empty. */
function lastMainlineNode(tree: GameTree): GameNode | null {
  const lastId = tree.mainline[tree.mainline.length - 1];
  return lastId ? tree.nodes.get(lastId) ?? null : null;
}

/** Half-move index: 1.white=1, 1.black=2, 2.white=3, … — for ordering plies. */
function plyIndex(moveNumber: number, color: 'white' | 'black'): number {
  return (moveNumber - 1) * 2 + (color === 'white' ? 1 : 2);
}

/** The (number,color) that should immediately follow the given ply. */
function expectedNext(
  moveNumber: number,
  color: 'white' | 'black',
): { moveNumber: number; color: 'white' | 'black' } {
  return color === 'white'
    ? { moveNumber, color: 'black' }
    : { moveNumber: moveNumber + 1, color: 'white' };
}

/** Derive the (moveNumber,color) of the move to be played from a FEN. */
function expectedNumberFromFen(
  fen: string,
): { moveNumber: number; color: 'white' | 'black' } | null {
  const parts = fen.split(' ');
  if (parts.length < 6) return null;
  const color: 'white' | 'black' = parts[1] === 'w' ? 'white' : 'black';
  const moveNumber = parseInt(parts[5], 10);
  if (Number.isNaN(moveNumber)) return null;
  return { moveNumber, color };
}

/** Return `fen` with the side-to-move field set to `turn` ('w'|'b'), or null. */
function flipTurn(fen: string, turn: 'w' | 'b'): string | null {
  const parts = fen.split(' ');
  if (parts.length < 2) return null;
  parts[1] = turn;
  // Reset en-passant target (it would be invalid after a turn flip).
  if (parts.length >= 4) parts[3] = '-';
  return parts.join(' ');
}

/** Can `san` be legally played from `fen`? (uses chess.js as the oracle) */
function isLegalFrom(fen: string, san: string): boolean {
  try {
    const c = new Chess(fen);
    c.move(san);
    return true;
  } catch {
    return false;
  }
}

export function buildGameTree(
  tokens: SanToken[],
  startFen: string = STANDARD_START_FEN,
): GameTree {
  resetNodeCounter();
  const tree = createGameTree(startFen);
  const chess = new Chess(startFen);

  // Lookahead: a move that does NOT lead a paragraph but whose (number,color) is
  // RE-STATED later by a move that DOES lead a paragraph is an embedded prose
  // alternative — the paragraph-leading restatement is the real mainline move.
  // Mark these so they don't extend the mainline.
  const paragraphLeadKeys = new Set<string>();
  for (const t of tokens) {
    if (t.type === 'move' && !t.isolated && t.atParagraphStart && t.moveNumber !== undefined && t.color) {
      paragraphLeadKeys.add(moveKey(t.moveNumber, t.color));
    }
  }
  const supersededByParagraph = (t: SanToken): boolean =>
    t.type === 'move' &&
    !t.atParagraphStart &&
    t.moveNumber !== undefined &&
    !!t.color &&
    paragraphLeadKeys.has(moveKey(t.moveNumber, t.color));

  const ctx: BuildContext = {
    chess,
    tree,
    currentNodeId: null,
    fenBeforeLastMove: startFen,
    parentBeforeLastMove: null,
    variationStack: [],
    dead: false,
    moveNumber: 1,
    color: 'white',
    mainlineByKey: new Map(),
    onMainline: true,
    maxMainlineMoveNumber: 0,
    pendingExplicitNumber: null,
    proseLine: null,
    inUnreferencedRun: false,
  };

  for (const token of tokens) {
    if (token.type === 'result') {
      // The mainline is complete; anything after is analysis prose.
      ctx.onMainline = false;
      continue;
    }

    if (token.type === 'move-number') {
      if (ctx.variationStack.length === 0) {
        ctx.moveNumber = token.moveNumber!;
        ctx.color = token.isEllipsis ? 'black' : 'white';
        // Remember the author's explicit number for the next root-level move,
        // so a restated ply ("...3. Nf3") is distinguishable from a number
        // carried over implicitly (e.g. a move right after a closed paren).
        ctx.pendingExplicitNumber = {
          moveNumber: token.moveNumber!,
          color: token.isEllipsis ? 'black' : 'white',
        };
      }
      continue;
    }

    if (token.type === 'variation-open') {
      // Save the CURRENT chess state (after last move) so we can return to it
      const currentFen = ctx.chess.fen();
      const currentNodeId = ctx.currentNodeId;
      ctx.variationStack.push({
        fen: currentFen,
        returnToNodeId: currentNodeId,
        lineKeyDepth: ctx.variationStack.length + 1,
        proseLine: ctx.proseLine,
        line: null,
      });
      // Load the state BEFORE the last move was played — the variation is an alternative to that move
      ctx.chess.load(ctx.fenBeforeLastMove);
      ctx.currentNodeId = ctx.parentBeforeLastMove;
      ctx.dead = false;
      // A parenthesised variation is its own line, not the enclosing prose line.
      ctx.proseLine = null;
      continue;
    }

    if (token.type === 'variation-close') {
      if (ctx.variationStack.length > 0) {
        const saved = ctx.variationStack.pop()!;
        ctx.chess.load(saved.fen);
        ctx.currentNodeId = saved.returnToNodeId;
        ctx.dead = false;
        // Resume the enclosing prose analysis line (if any) after the paren.
        ctx.proseLine = saved.proseLine;
      }
      continue;
    }

    if (token.type !== 'move') continue;

    // Isolated prose move: not a reproducible sequence move. Record it as a
    // board-only square highlight and do NOT touch the chess state / tree path.
    if (token.isolated) {
      const iso = parseIsolatedMove(token);
      if (iso) tree.isolatedMoves.push(iso);
      continue;
    }

    if (ctx.dead) continue;

    const san = token.san!;
    const inParen = ctx.variationStack.length > 0;

    // ── Embedded move superseded by a later paragraph-leading restatement ──
    // "podían jugar 3...Nf6 …" mid-prose, then "3...a6" leading a new paragraph:
    // the embedded 3...Nf6 is the unplayed alternative. Drop off the mainline so
    // it becomes a variation; the real move resumes via the paragraph rule.
    if (!inParen && ctx.onMainline && supersededByParagraph(token)) {
      ctx.onMainline = false;
    }

    // ── Backtracked move-number on the mainline ────────────────────────────
    // Opening theory written in prose never emits a result token, yet still
    // introduces alternatives: "3. Nc3 Bb4 ... Si las blancas jugaban 3. Nf3".
    // A move RE-STATES an earlier ply when its (number,color) is already on the
    // mainline, or its number sits below the highest number reached. Either way
    // it cannot be a real continuation, so it opens an analysis variation. A
    // normal black reply (same number, not yet seen) is NOT a regression.
    // Leaving the mainline hands it to the re-anchor logic below, which
    // validates the anchor with chess.js.
    const explicit = !inParen ? ctx.pendingExplicitNumber : null;
    if (!inParen) ctx.pendingExplicitNumber = null;
    if (!inParen && ctx.onMainline && explicit) {
      const restatesPly = ctx.mainlineByKey.has(moveKey(explicit.moveNumber, explicit.color));
      const regresses = explicit.moveNumber < ctx.maxMainlineMoveNumber;
      if (restatesPly || regresses) {
        ctx.onMainline = false;
      }
    }

    // ── Paragraph-leading move resumes the mainline (signal + validation) ──
    // The user's key rule: mainline moves almost always start a paragraph. If we
    // drifted into prose-analysis mode but now see a move that (a) begins a new
    // paragraph, (b) advances the move number past the mainline tip, and (c) is
    // legal as the continuation of the mainline tip, then it RESUMES the
    // mainline — it is not part of the preceding embedded variation.
    if (!inParen && !ctx.onMainline && token.atParagraphStart) {
      const tip = lastMainlineNode(tree);
      const tipFen = tip ? tip.fen : tree.startFen;
      const advances =
        (token.moveNumber ?? 0) >= ctx.maxMainlineMoveNumber;
      if (advances && isLegalFrom(tipFen, san)) {
        ctx.onMainline = true;
        ctx.proseLine = null;
        ctx.chess.load(tipFen);
        ctx.currentNodeId = tip ? tip.id : null;
        ctx.fenBeforeLastMove = tipFen;
        ctx.parentBeforeLastMove = tip ? tip.parentId : null;
        ctx.dead = false;
      }
    }

    // ── Prose analysis re-anchoring (validation-driven) ────────────────────
    // Once past the mainline (a result was seen) and not inside parentheses,
    // a move that is NOT legal continuing the current line is the start of a
    // new analysis variation. chess.js decides where it anchors: try the parent
    // of the mainline move with the same (number,color); fall back to scanning
    // mainline parents for the first position where the move is legal.
    if (!inParen && !ctx.onMainline) {
      const continues = !ctx.dead && isLegalFrom(ctx.chess.fen(), san);
      if (!continues || ctx.proseLine === null) {
        const anchor = findProseAnchor(ctx, token);
        if (anchor) {
          ctx.chess.load(anchor.parentFen);
          ctx.currentNodeId = anchor.parentId;
          ctx.fenBeforeLastMove = anchor.parentFen;
          ctx.parentBeforeLastMove = anchor.parentId;
          ctx.dead = false;
          ctx.proseLine = openProseLine(tree, anchor.parentId);
        }
      }
    }

    const parentId = ctx.currentNodeId;
    let fenBeforeMove = ctx.chess.fen();

    // ── Contiguity check (number is law) ───────────────────────────────────
    // On the mainline, the written (number,color) must be the immediate
    // successor of the tip. A forward gap means an earlier ply is missing in the
    // source. The skipped ply also flips the side to move, so the move would be
    // rejected as "wrong turn"; flip the FEN's turn so the move can still be
    // placed (the gap is recorded for the editor).
    if (
      !inParen &&
      ctx.proseLine === null &&
      token.moveNumber !== undefined &&
      token.color
    ) {
      const tip = lastMainlineNode(tree);
      if (tip) {
        const exp = expectedNext(tip.moveNumber, tip.color);
        const tokenPly = plyIndex(token.moveNumber, token.color);
        const expPly = plyIndex(exp.moveNumber, exp.color);
        // Only flag a missing-move when the move is actually PLACEABLE after the
        // gap (legal directly, or legal once the side-to-move is flipped). If it
        // is illegal either way it is an unreferenced move, reported below.
        const wantTurn = token.color === 'white' ? 'w' : 'b';
        const needsFlip = !fenBeforeMove.includes(` ${wantTurn} `);
        const flipped = needsFlip ? flipTurn(fenBeforeMove, wantTurn) : fenBeforeMove;
        const placeableAfterGap =
          (!needsFlip && isLegalFrom(fenBeforeMove, san)) ||
          (needsFlip && flipped !== null && isLegalFrom(flipped, san));
        if (tokenPly > expPly && placeableAfterGap) {
          tree.errors.push({
            kind: 'missing-move',
            san,
            ...(token.rawSan ? { rawSan: token.rawSan } : {}),
            moveNumber: token.moveNumber,
            color: token.color,
            message: `Falta una jugada antes de ${token.moveNumber}${token.color === 'black' ? '...' : '.'} ${san} (la secuencia salta de ${tip.moveNumber}${tip.color === 'black' ? '...' : '.'} a ${token.moveNumber}).`,
            ...(token.charStart !== undefined
              ? { charStart: token.charStart, charEnd: token.charEnd }
              : {}),
          });
          // Place the move after the hole using the flipped position if needed.
          if (needsFlip && flipped !== null) {
            ctx.chess.load(flipped);
            fenBeforeMove = flipped;
          }
        }
      }
    }

    const parentFen = fenBeforeMove;

    let moveResult: ReturnType<Chess['move']> | null = null;
    let isInvalid = false;

    try {
      moveResult = ctx.chess.move(san);
    } catch {
      isInvalid = true;
    }

    const nodeId = nextId();
    const node: GameNode = {
      id: nodeId,
      // Canonical SAN from chess.js (strips !/?/!! annotations) when legal;
      // the original token (with glyphs/annotations) is kept in rawSan.
      san: moveResult?.san ?? san,
      fen: isInvalid ? parentFen : ctx.chess.fen(),
      from: moveResult?.from ?? '',
      to: moveResult?.to ?? '',
      moveNumber: token.moveNumber ?? ctx.moveNumber,
      color: token.color ?? ctx.color,
      parentId,
      ...(token.rawSan ? { rawSan: token.rawSan } : {}),
      ...(token.charStart !== undefined
        ? { charStart: token.charStart, charEnd: token.charEnd }
        : {}),
      ...(isInvalid ? { invalid: true } : {}),
    };

    tree.nodes.set(nodeId, node);

    if (isInvalid) {
      // An illegal numbered move anchors to no line. Report only the FIRST of a
      // contiguous run of such moves; the run resets once a valid move lands.
      if (token.moveNumber !== undefined && !ctx.inUnreferencedRun) {
        ctx.inUnreferencedRun = true;
        tree.errors.push({
          kind: 'unreferenced',
          san: node.san,
          ...(node.rawSan ? { rawSan: node.rawSan } : {}),
          moveNumber: token.moveNumber,
          ...(token.color ? { color: token.color } : {}),
          message: `Jugada con número sin referencia válida: ${token.moveNumber}${token.color === 'black' ? '...' : '.'} ${node.san} (no continúa ninguna línea legal).`,
          ...(node.charStart !== undefined
            ? { charStart: node.charStart, charEnd: node.charEnd }
            : {}),
        });
      }
      ctx.dead = true;
      continue;
    }
    // A valid move ends any unreferenced run.
    ctx.inUnreferencedRun = false;

    if (inParen) {
      // Inside a variation, the written number must match the position the move
      // occupies in the line (derived from the parent FEN's fullmove + side). A
      // mismatch is a wrong-number error (the number contradicts the position).
      if (token.moveNumber !== undefined && token.color) {
        const expected = expectedNumberFromFen(parentFen);
        if (expected && (expected.moveNumber !== token.moveNumber || expected.color !== token.color)) {
          tree.errors.push({
            kind: 'wrong-number',
            san: node.san,
            ...(node.rawSan ? { rawSan: node.rawSan } : {}),
            moveNumber: token.moveNumber,
            color: token.color,
            message: `El número ${token.moveNumber}${token.color === 'black' ? '...' : '.'} no corresponde a la posición de la variante (debería ser ${expected.moveNumber}${expected.color === 'black' ? '...' : '.'}) para ${node.san}.`,
            ...(node.charStart !== undefined
              ? { charStart: node.charStart, charEnd: node.charEnd }
              : {}),
          });
        }
      }
      // Parenthesised variation: each '(' owns one line under its branch point,
      // created lazily on the first move so empty/nested parens don't collide.
      const stackTop = ctx.variationStack[ctx.variationStack.length - 1];
      if (stackTop.line === null) {
        stackTop.line = openProseLine(tree, stackTop.returnToNodeId);
      }
      stackTop.line.push(nodeId);
    } else if (ctx.proseLine !== null) {
      // Re-anchored prose analysis line.
      ctx.proseLine.push(nodeId);
    } else {
      // Mainline (contiguity already validated above before the move was played).
      tree.mainline.push(nodeId);
      ctx.mainlineByKey.set(moveKey(node.moveNumber, node.color), nodeId);
      if (node.moveNumber > ctx.maxMainlineMoveNumber) {
        ctx.maxMainlineMoveNumber = node.moveNumber;
      }
    }

    ctx.currentNodeId = nodeId;
    ctx.fenBeforeLastMove = fenBeforeMove;
    ctx.parentBeforeLastMove = parentId;

    if (token.color === 'black') {
      ctx.moveNumber = (token.moveNumber ?? ctx.moveNumber) + 1;
      ctx.color = 'white';
    } else {
      ctx.color = 'black';
    }
  }

  return tree;
}

/**
 * Find where a prose analysis move should anchor. The natural candidate is the
 * PARENT of the mainline move sharing the same (number, color) — the author
 * writes "19. Be4" to replace mainline move 19. chess.js validates the candidate;
 * if it fails, scan mainline parents for the first legal anchor.
 */
function findProseAnchor(
  ctx: BuildContext,
  token: SanToken,
): { parentId: string | null; parentFen: string } | null {
  const san = token.san!;
  const tree = ctx.tree;

  const parentFenOf = (nodeId: string): { parentId: string | null; parentFen: string } => {
    const node = tree.nodes.get(nodeId)!;
    const parentId = node.parentId;
    const parentFen = parentId ? tree.nodes.get(parentId)!.fen : tree.startFen;
    return { parentId, parentFen };
  };

  // 1. Direct key match: parent of the mainline move with this (number, color).
  if (token.moveNumber !== undefined && token.color) {
    const keyed = ctx.mainlineByKey.get(moveKey(token.moveNumber, token.color));
    if (keyed) {
      const cand = parentFenOf(keyed);
      if (isLegalFrom(cand.parentFen, san)) return cand;
    }
  }

  // 2. Fallback: scan all mainline nodes; anchor at the parent of the first
  //    mainline node from whose preceding position the move is legal.
  for (const nodeId of tree.mainline) {
    const cand = parentFenOf(nodeId);
    if (isLegalFrom(cand.parentFen, san)) return cand;
  }

  return null;
}

/**
 * Parse a bare (isolated) SAN token into a square + piece for board highlight.
 * No chess context: we only need the destination square and the moving piece.
 * Pawn moves ("d5", "exd5") → pawn; piece moves ("Nb5", "Bxf3") → that piece.
 * Castling and anything without a clear destination square are ignored (null).
 */
function parseIsolatedMove(token: SanToken): IsolatedMove | null {
  const san = token.san!;
  // Strip annotations / check / mate / promotion to isolate the core.
  const core = san.replace(/[+#!?]+$/g, '').replace(/=[QRBN]$/i, '');
  // Destination is the LAST file+rank pair in the token.
  const dest = core.match(/([a-h][1-8])(?!.*[a-h][1-8])/);
  if (!dest) return null;
  const square = dest[1];

  const lead = core[0];
  const piece: IsolatedMove['piece'] =
    lead === 'N' ? 'n'
    : lead === 'B' ? 'b'
    : lead === 'R' ? 'r'
    : lead === 'Q' ? 'q'
    : lead === 'K' ? 'k'
    : 'p';

  return {
    square,
    piece,
    san,
    ...(token.rawSan ? { rawSan: token.rawSan } : {}),
    ...(token.charStart !== undefined
      ? { charStart: token.charStart, charEnd: token.charEnd }
      : {}),
  };
}

/** Open a fresh prose-analysis variation line under the given parent node. */
function openProseLine(tree: GameTree, parentId: string | null): string[] {
  const key = parentId ?? 'root';
  if (!tree.variations.has(key)) tree.variations.set(key, []);
  const lines = tree.variations.get(key)!;
  const line: string[] = [];
  lines.push(line);
  return line;
}
