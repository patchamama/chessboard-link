import { describe, it, expect } from 'vitest'
import { buildTreeFromMoves } from '../buildTreeFromMoves'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('buildTreeFromMoves', () => {
  it('creates a mainline from UCI moves with correct fens', () => {
    const tree = buildTreeFromMoves(START, ['e2e4', 'e7e5', 'g1f3'])

    expect(tree.startFen).toBe(START)
    expect(tree.mainline).toHaveLength(3)

    const last = tree.nodes.get(tree.mainline[2])!
    expect(last.from).toBe('g1')
    expect(last.to).toBe('f3')
    expect(last.fen).toContain('5N2') // knight on f3
  })

  it('stops at the first illegal move', () => {
    const tree = buildTreeFromMoves(START, ['e2e4', 'e2e4']) // second is illegal
    expect(tree.mainline).toHaveLength(1)
  })

  it('handles an empty move list', () => {
    const tree = buildTreeFromMoves(START, [])
    expect(tree.mainline).toHaveLength(0)
  })
})
