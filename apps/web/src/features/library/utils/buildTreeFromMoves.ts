import { Chess } from 'chess.js'
import { createGameTree, type GameTree, type GameNode } from '@chess-ebook/chess-shared'

/**
 * Build a single-mainline GameTree by replaying UCI moves from a start FEN.
 * Used to turn a saved trainer line back into a tree the practice flow can drive.
 * Replay stops at the first illegal move.
 */
export function buildTreeFromMoves(startFen: string, movesUci: string[]): GameTree {
  const tree = createGameTree(startFen)
  const chess = new Chess(startFen)

  let parentId: string | null = null
  movesUci.forEach((uci, i) => {
    const from = uci.slice(0, 2)
    const to = uci.slice(2, 4)
    const promotion = uci[4] as 'q' | 'r' | 'b' | 'n' | undefined

    let move
    try {
      move = chess.move({ from, to, promotion: promotion ?? 'q' })
    } catch {
      move = null
    }
    if (!move) return

    const id = `m${i + 1}`
    const node: GameNode = {
      id,
      san: move.san,
      fen: chess.fen(),
      from: move.from,
      to: move.to,
      moveNumber: Math.floor(i / 2) + 1,
      color: move.color === 'w' ? 'white' : 'black',
      parentId,
    }
    tree.nodes.set(id, node)
    tree.mainline.push(id)
    parentId = id
  })

  return tree
}
