import { describe, it, expect, beforeEach } from 'vitest'
import { usePracticeStore } from '../practiceStore'
import { createGameTree, type GameTree, type GameNode } from '@chess-ebook/chess-shared'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
const AFTER_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2'
const AFTER_NF3 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'

function node(id: string, from: string, to: string, fen: string, parentId: string | null): GameNode {
  return {
    id,
    san: '',
    fen,
    from,
    to,
    moveNumber: 1,
    color: 'white',
    parentId,
  }
}

/** Tree: 1. e4 e5 2. Nf3 (mainline of 3 nodes). */
function tree(): GameTree {
  const t = createGameTree(START)
  const n1 = node('n1', 'e2', 'e4', AFTER_E4, null)
  const n2 = node('n2', 'e7', 'e5', AFTER_E5, 'n1')
  const n3 = node('n3', 'g1', 'f3', AFTER_NF3, 'n2')
  t.nodes.set('n1', n1)
  t.nodes.set('n2', n2)
  t.nodes.set('n3', n3)
  t.mainline = ['n1', 'n2', 'n3']
  return t
}

describe('practiceStore', () => {
  beforeEach(() => {
    usePracticeStore.getState().stop()
  })

  it('starts inactive', () => {
    expect(usePracticeStore.getState().active).toBe(false)
  })

  it('start(from a node) activates and targets the NEXT mainline move', () => {
    const t = tree()
    usePracticeStore.getState().start(t, 'n1') // sit on e4, guess e5 next

    const s = usePracticeStore.getState()
    expect(s.active).toBe(true)
    expect(s.baseFen).toBe(AFTER_E4)
    expect(s.targetUci).toBe('e7e5') // the book move to guess
    expect(s.score).toBe(0)
    expect(s.status).toBe('guessing')
  })

  it('start(null) begins from the initial position guessing the first move', () => {
    const t = tree()
    usePracticeStore.getState().start(t, null)

    const s = usePracticeStore.getState()
    expect(s.baseFen).toBe(START)
    expect(s.targetUci).toBe('e2e4')
  })

  it('a correct exact guess scores +2, advances, and keeps guessing', () => {
    const t = tree()
    usePracticeStore.getState().start(t, 'n1')

    usePracticeStore.getState().submitResult('exact')

    const s = usePracticeStore.getState()
    expect(s.score).toBe(2)
    expect(s.streak).toBe(1)
    expect(s.baseFen).toBe(AFTER_E5) // advanced to e5
    expect(s.targetUci).toBe('g1f3') // next book move
    expect(s.status).toBe('guessing')
  })

  it('an engine-ok guess scores +1 and advances', () => {
    const t = tree()
    usePracticeStore.getState().start(t, 'n1')

    usePracticeStore.getState().submitResult('engine-ok')

    const s = usePracticeStore.getState()
    expect(s.score).toBe(1)
    expect(s.baseFen).toBe(AFTER_E5)
    expect(s.targetUci).toBe('g1f3')
  })

  it('a wrong guess resets streak, reveals, and does NOT advance', () => {
    const t = tree()
    usePracticeStore.getState().start(t, 'n1')
    usePracticeStore.getState().submitResult('exact') // streak 1
    usePracticeStore.getState().submitResult('wrong')

    const s = usePracticeStore.getState()
    expect(s.streak).toBe(0)
    expect(s.status).toBe('revealed')
    expect(s.baseFen).toBe(AFTER_E5) // stayed on the move it failed
    expect(s.targetUci).toBe('g1f3')
  })

  it('continueAfterReveal advances past a revealed move', () => {
    const t = tree()
    usePracticeStore.getState().start(t, 'n1')
    usePracticeStore.getState().submitResult('exact') // -> guessing g1f3
    usePracticeStore.getState().submitResult('wrong') // revealed g1f3
    usePracticeStore.getState().continueAfterReveal()

    const s = usePracticeStore.getState()
    expect(s.baseFen).toBe(AFTER_NF3)
    expect(s.status).toBe('finished') // no more mainline moves
  })

  it('finishes when the mainline is exhausted', () => {
    const t = tree()
    usePracticeStore.getState().start(t, 'n2') // sit on e5, guess Nf3 (last)
    usePracticeStore.getState().submitResult('exact')

    expect(usePracticeStore.getState().status).toBe('finished')
  })
})
