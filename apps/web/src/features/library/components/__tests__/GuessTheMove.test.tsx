import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock the chessboard with a tiny stub exposing an onPieceDrop hook.
vi.mock('react-chessboard', () => ({
  Chessboard: ({ options }: { options: { onPieceDrop?: (a: { sourceSquare: string; targetSquare: string }) => boolean } }) => (
    <button
      data-testid="cb-move"
      onClick={() => options.onPieceDrop?.({ sourceSquare: 'e7', targetSquare: 'e5' })}
    >
      board
    </button>
  ),
}))

// Engine eval mock — returns whatever we set, no worker.
vi.mock('../../../../shared/stockfish/useStockfishEval', () => ({
  useStockfishEval: vi.fn(() => ({ loading: false })),
}))

import { GuessTheMove } from '../GuessTheMove'
import { usePracticeStore } from '../../store/practiceStore'
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

describe('GuessTheMove', () => {
  beforeEach(() => {
    usePracticeStore.getState().stop()
    usePracticeStore.getState().start(tree(), 'n1') // base = after e4, guess e7e5
  })

  it('shows the running score', () => {
    render(<GuessTheMove />)
    expect(screen.getByText(/score/i)).toBeInTheDocument()
    expect(screen.getByTestId('practice-score')).toHaveTextContent('0')
  })

  it('a correct book move scores and advances', async () => {
    render(<GuessTheMove />)

    // The mocked board plays e7e5 on click → matches the book move.
    await userEvent.click(screen.getByTestId('cb-move'))

    await waitFor(() => {
      expect(usePracticeStore.getState().score).toBe(2)
    })
    expect(usePracticeStore.getState().targetUci).toBe('g1f3')
  })

  it('shows a correct-feedback indicator after a right guess', async () => {
    render(<GuessTheMove />)
    await userEvent.click(screen.getByTestId('cb-move'))
    await waitFor(() => {
      expect(screen.getByTestId('practice-feedback')).toHaveTextContent(/correct/i)
    })
  })

  it('renders a finished state when the line is done', async () => {
    usePracticeStore.getState().stop()
    usePracticeStore.getState().start(tree(), 'n3') // no move after the last → finished
    render(<GuessTheMove />)
    expect(screen.getByText(/finished|complete|done/i)).toBeInTheDocument()
  })
})
