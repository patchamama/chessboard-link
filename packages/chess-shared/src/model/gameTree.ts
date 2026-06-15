/**
 * GameTree model — pure data types, no chess logic here.
 *
 * Structure:
 *  - Root node (id="root") represents the starting position.
 *  - Each subsequent node is a chess move from its parent.
 *  - Variations fork off any node and are tracked in the `variations` map.
 *  - The mainline is the path from root along firstChild links.
 */

export type Color = 'white' | 'black';

export interface GameNode {
  id: string;
  san: string;
  fen: string;
  /** From-square in algebraic (e.g. "e2") */
  from: string;
  /** To-square in algebraic (e.g. "e4") */
  to: string;
  moveNumber: number;
  color: Color;
  parentId: string | null;
  /** Original notation as written in the source (e.g. "♘f3", "Cf3"); falls back to `san`. */
  rawSan?: string;
  /** Character offset of the source token (into the normalised recognition text). */
  charStart?: number;
  /** Exclusive character offset of the source token. */
  charEnd?: number;
  /** true when the move was rejected by the chess engine as illegal */
  invalid?: boolean;
}

/**
 * An isolated move is a SAN-looking token in prose that is NOT part of a
 * reproducible game sequence (e.g. "—d5—", "la casilla e4", "un alfil a Cb5").
 * It is never placed in the move tree; it only marks a single square to
 * highlight on the study board, with a piece that alternates white/black
 * (the side to move is unknown for a bare token).
 */
export interface IsolatedMove {
  /** Target square in algebraic, e.g. "d5", "b5". */
  square: string;
  /** Piece type to show on the square: 'p','n','b','r','q','k' (lowercase). */
  piece: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  /** Normalised SAN as parsed (e.g. "d5", "Nb5"). */
  san: string;
  /** Original notation as written in the source (e.g. "♘b5", "Cb5"). */
  rawSan?: string;
  /** Character offset of the source token (into the normalised recognition text). */
  charStart?: number;
  /** Exclusive character offset of the source token. */
  charEnd?: number;
}

/**
 * A recognition problem detected while building the tree. Surfaced to the reader
 * so an editor can jump to the spot in the book and fix the source.
 *
 *  - 'missing-move'    : a move could not be placed because an EARLIER ply in its
 *                        line is absent (e.g. "6. c4" with no 5...? before it).
 *  - 'unreferenced'    : a numbered move that anchors to NO line (only the FIRST
 *                        of each run is reported).
 *  - 'wrong-number'    : a move whose written number does not match the position
 *                        it would occupy in any candidate line.
 */
export type RecognitionErrorKind = 'missing-move' | 'unreferenced' | 'wrong-number';

export interface RecognitionError {
  kind: RecognitionErrorKind;
  /** Normalised SAN of the offending move (e.g. "c4"). */
  san: string;
  /** Original notation as written (e.g. "♘f3", "Cf3"). */
  rawSan?: string;
  /** The move number written in the source for this token. */
  moveNumber?: number;
  color?: Color;
  /** Human-readable explanation (Spanish, user-facing). */
  message: string;
  /** Source character offsets (into the normalised recognition text). */
  charStart?: number;
  charEnd?: number;
}

export interface GameTree {
  /** Starting FEN (standard start if null) */
  startFen: string;
  /** All nodes by id */
  nodes: Map<string, GameNode>;
  /** Ordered mainline node ids (root to last mainline move) */
  mainline: string[];
  /** Variation branches: key = parent node id, value = ordered lists of variation lines (each line is an array of node ids) */
  variations: Map<string, string[][]>;
  /** Isolated prose moves: board-only square highlights, not part of the sequence. */
  isolatedMoves: IsolatedMove[];
  /** Recognition problems detected while building this tree (for the error panel). */
  errors: RecognitionError[];
}

export function createGameTree(startFen: string): GameTree {
  return {
    startFen,
    nodes: new Map(),
    mainline: [],
    variations: new Map(),
    isolatedMoves: [],
    errors: [],
  };
}

/** Returns the path from root to a given node (list of node ids). */
export function pathToNode(tree: GameTree, nodeId: string): string[] {
  const path: string[] = [];
  let current: GameNode | undefined = tree.nodes.get(nodeId);
  while (current) {
    path.unshift(current.id);
    current = current.parentId ? tree.nodes.get(current.parentId) : undefined;
  }
  return path;
}

/** Returns all nodes on the mainline as an ordered array. */
export function mainlineNodes(tree: GameTree): GameNode[] {
  return tree.mainline
    .map(id => tree.nodes.get(id))
    .filter((n): n is GameNode => n !== undefined);
}

/** Serialises GameTree to a plain JSON-safe object for golden fixture comparison. */
export function serializeTree(tree: GameTree): SerializedGameTree {
  return {
    startFen: tree.startFen,
    nodes: Object.fromEntries(
      Array.from(tree.nodes.entries()).map(([id, node]) => [id, node])
    ),
    mainline: tree.mainline,
    variations: Object.fromEntries(
      Array.from(tree.variations.entries())
    ),
  };
}

export interface SerializedGameTree {
  startFen: string;
  nodes: Record<string, GameNode>;
  mainline: string[];
  variations: Record<string, string[][]>;
}
