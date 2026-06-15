import type { GameTree } from '@chess-ebook/chess-shared'

const STANDARD_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export interface TrainerLineDraft {
  startFen: string
  movesUci: string[]
  orientation: 'white' | 'black'
}

/**
 * Build a trainer line from a chosen mainline node: the start position is that
 * node's position (or the game start when `fromNodeId` is null), and the moves
 * are the remaining mainline moves in UCI. Orientation is the side to move at
 * the start position (you train the side that moves first).
 */
export function trainerLineFromNode(tree: GameTree, fromNodeId: string | null): TrainerLineDraft {
  const startFen = fromNodeId
    ? tree.nodes.get(fromNodeId)?.fen ?? tree.startFen ?? STANDARD_FEN
    : tree.startFen || STANDARD_FEN

  const startIdx = fromNodeId ? tree.mainline.indexOf(fromNodeId) : -1
  const remaining = tree.mainline.slice(startIdx + 1)

  const movesUci = remaining
    .map((id) => tree.nodes.get(id))
    .filter((n): n is NonNullable<typeof n> => !!n && !!n.from && !!n.to)
    .map((n) => `${n.from}${n.to}`)

  const sideToMove = (startFen.split(' ')[1] ?? 'w') === 'w' ? 'white' : 'black'

  return { startFen, movesUci, orientation: sideToMove }
}
