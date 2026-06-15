import { describe, it, expect } from 'vitest'
import { trainerLineFromNode } from '../trainerLineFromNode'
import { createGameTree, type GameTree, type GameNode } from '@chess-ebook/chess-shared'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
const AFTER_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2'
const AFTER_NF3 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'

function node(id: string, from: string, to: string, fen: string, parentId: string | null): GameNode {
  return { id, san: '', fen, from, to, moveNumber: 1, color: 'white', parentId }
}

function tree(): GameTree {
  const t = createGameTree(START)
  t.nodes.set('n1', node('n1', 'e2', 'e4', AFTER_E4, null))
  t.nodes.set('n2', node('n2', 'e7', 'e5', AFTER_E5, 'n1'))
  t.nodes.set('n3', node('n3', 'g1', 'f3', AFTER_NF3, 'n2'))
  t.mainline = ['n1', 'n2', 'n3']
  return t
}

describe('trainerLineFromNode', () => {
  it('from the start (null) takes the whole mainline starting at the game start', () => {
    const line = trainerLineFromNode(tree(), null)
    expect(line.startFen).toBe(START)
    expect(line.movesUci).toEqual(['e2e4', 'e7e5', 'g1f3'])
    expect(line.orientation).toBe('white')
  })

  it('from a node takes the position AT that node and the remaining mainline', () => {
    // start practicing from after e4 → start fen = after e4, moves = e5, Nf3
    const line = trainerLineFromNode(tree(), 'n1')
    expect(line.startFen).toBe(AFTER_E4)
    expect(line.movesUci).toEqual(['e7e5', 'g1f3'])
  })

  it('orientation reflects the side to move at the start position', () => {
    // after e4 → black to move → orientation black
    expect(trainerLineFromNode(tree(), 'n1').orientation).toBe('black')
  })

  it('returns no moves when the chosen node is the last mainline move', () => {
    const line = trainerLineFromNode(tree(), 'n3')
    expect(line.movesUci).toEqual([])
  })
})
