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
  variationStack: Array<{ fen: string; returnToNodeId: string | null; lineKeyDepth: number }>;
  /** whether this branch is dead (last move was invalid) */
  dead: boolean;
  moveNumber: number;
  color: 'white' | 'black';
}

export function buildGameTree(
  tokens: SanToken[],
  startFen: string = STANDARD_START_FEN,
): GameTree {
  resetNodeCounter();
  const tree = createGameTree(startFen);
  const chess = new Chess(startFen);

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
  };

  for (const token of tokens) {
    if (token.type === 'move-number') {
      if (!ctx.variationStack.length || ctx.variationStack.length === 0) {
        // mainline context
        ctx.moveNumber = token.moveNumber!;
        ctx.color = token.isEllipsis ? 'black' : 'white';
      }
      continue;
    }

    if (token.type === 'variation-open') {
      // Save the CURRENT chess state (after last mainline move) so we can return to it
      const currentFen = ctx.chess.fen();
      const currentNodeId = ctx.currentNodeId;
      ctx.variationStack.push({
        fen: currentFen,
        returnToNodeId: currentNodeId,
        lineKeyDepth: ctx.variationStack.length + 1,
      });
      // Load the state BEFORE the last move was played — the variation is an alternative to that move
      ctx.chess.load(ctx.fenBeforeLastMove);
      ctx.currentNodeId = ctx.parentBeforeLastMove;
      ctx.dead = false;
      continue;
    }

    if (token.type === 'variation-close') {
      if (ctx.variationStack.length > 0) {
        const saved = ctx.variationStack.pop()!;
        // Restore to the chess state saved at variation-open (i.e. after last mainline move)
        ctx.chess.load(saved.fen);
        ctx.currentNodeId = saved.returnToNodeId;
        ctx.dead = false;
      }
      continue;
    }

    if (token.type !== 'move') continue;

    if (ctx.dead) continue;

    const san = token.san!;
    const parentId = ctx.currentNodeId;
    const fenBeforeMove = ctx.chess.fen();
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
      san,
      fen: isInvalid ? parentFen : ctx.chess.fen(),
      from: moveResult?.from ?? '',
      to: moveResult?.to ?? '',
      moveNumber: token.moveNumber ?? ctx.moveNumber,
      color: token.color ?? ctx.color,
      parentId,
      ...(isInvalid ? { invalid: true } : {}),
    };

    tree.nodes.set(nodeId, node);

    // Determine if we are on mainline or in a variation
    // Invalid nodes are kept in tree.nodes (for debugging) but NOT in mainline/variations
    // so the viewer never navigates to them.
    if (isInvalid) {
      ctx.dead = true;
      continue;
    }

    if (ctx.variationStack.length === 0) {
      // Mainline
      tree.mainline.push(nodeId);
    } else {
      // Variation: track under parent node
      const stackTop = ctx.variationStack[ctx.variationStack.length - 1];
      const variationParentId = stackTop.returnToNodeId ?? 'root';
      if (!tree.variations.has(variationParentId)) {
        tree.variations.set(variationParentId, []);
      }
      const varLines = tree.variations.get(variationParentId)!;
      // Each variation-open creates a new line at this depth
      // Use lineKeyDepth as unique key per branch opening
      const lineKey = `__depth_${stackTop.lineKeyDepth}__`;
      const lineKeyMap: Map<string, number> = (tree as any).__lineKeyMap ?? ((tree as any).__lineKeyMap = new Map<string, number>());
      if (!lineKeyMap.has(lineKey)) {
        lineKeyMap.set(lineKey, varLines.length);
        varLines.push([]);
      }
      const lineIdx = lineKeyMap.get(lineKey)!;
      varLines[lineIdx].push(nodeId);
    }

    ctx.currentNodeId = nodeId;
    // Track position before this move for future variation branching
    ctx.fenBeforeLastMove = fenBeforeMove;
    ctx.parentBeforeLastMove = parentId;

    // Update move number tracking from token (already set by tokenizer)
    if (token.color === 'black') {
      ctx.moveNumber = (token.moveNumber ?? ctx.moveNumber) + 1;
      ctx.color = 'white';
    } else {
      ctx.color = 'black';
    }
  }

  return tree;
}
