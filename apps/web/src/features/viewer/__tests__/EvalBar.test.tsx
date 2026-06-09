import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import EvalBar from '../components/EvalBar'

// Mock useStockfishEval — we test EvalBar rendering independently
vi.mock('../../../shared/stockfish/useStockfishEval', () => ({
  useStockfishEval: vi.fn(),
}))

import { useStockfishEval } from '../../../shared/stockfish/useStockfishEval'

const mockUseStockfishEval = useStockfishEval as ReturnType<typeof vi.fn>

const STARTPOS = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('EvalBar', () => {
  it('shows loading state', () => {
    mockUseStockfishEval.mockReturnValue({ loading: true })
    render(<EvalBar fen={STARTPOS} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders positive cp eval as +1.3', () => {
    mockUseStockfishEval.mockReturnValue({ loading: false, scoreCp: 130, depth: 15 })
    render(<EvalBar fen={STARTPOS} />)
    expect(screen.getByText('+1.3')).toBeInTheDocument()
  })

  it('renders negative cp eval as -0.5', () => {
    mockUseStockfishEval.mockReturnValue({ loading: false, scoreCp: -50, depth: 15 })
    render(<EvalBar fen={STARTPOS} />)
    expect(screen.getByText('-0.5')).toBeInTheDocument()
  })

  it('renders zero eval as 0.0', () => {
    mockUseStockfishEval.mockReturnValue({ loading: false, scoreCp: 0, depth: 15 })
    render(<EvalBar fen={STARTPOS} />)
    expect(screen.getByText('0.0')).toBeInTheDocument()
  })

  it('renders mate as #3', () => {
    mockUseStockfishEval.mockReturnValue({ loading: false, mate: 3, depth: 5 })
    render(<EvalBar fen={STARTPOS} />)
    expect(screen.getByText('#3')).toBeInTheDocument()
  })

  it('renders negative mate (opponent mates) as #-2', () => {
    mockUseStockfishEval.mockReturnValue({ loading: false, mate: -2, depth: 5 })
    render(<EvalBar fen={STARTPOS} />)
    expect(screen.getByText('#-2')).toBeInTheDocument()
  })
})
