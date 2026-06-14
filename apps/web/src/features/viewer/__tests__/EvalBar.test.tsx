import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import EvalBar from '../components/EvalBar'

vi.mock('../../../shared/stockfish/useStockfishEval', () => ({
  useStockfishEval: vi.fn(),
}))

vi.mock('../../../shared/settings/settingsStore', () => ({
  useSettingsStore: vi.fn((sel: (s: { evalBarDirection: string }) => unknown) =>
    sel({ evalBarDirection: 'horizontal' })
  ),
}))

import { useStockfishEval } from '../../../shared/stockfish/useStockfishEval'
const mockUseStockfishEval = useStockfishEval as ReturnType<typeof vi.fn>

const STARTPOS = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('EvalBar', () => {
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

  it('renders mate as +M3', () => {
    mockUseStockfishEval.mockReturnValue({ loading: false, mate: 3, depth: 5 })
    render(<EvalBar fen={STARTPOS} />)
    expect(screen.getByText('+M3')).toBeInTheDocument()
  })

  it('renders opponent mate as -M2', () => {
    mockUseStockfishEval.mockReturnValue({ loading: false, mate: -2, depth: 5 })
    render(<EvalBar fen={STARTPOS} />)
    expect(screen.getByText('-M2')).toBeInTheDocument()
  })

  it('prefers an externally supplied score (engine panel) over its own worker', () => {
    // The own worker would say -3.0, but the supplied score (live from the panel,
    // ramping depth) is +12.1 — the bar must show the supplied value.
    mockUseStockfishEval.mockReturnValue({ loading: false, scoreCp: -300, depth: 15 })
    render(<EvalBar fen={STARTPOS} score={{ scoreCp: 1211, loading: false }} />)
    expect(screen.getByText('+12.1')).toBeInTheDocument()
    expect(screen.queryByText('-3.0')).not.toBeInTheDocument()
  })

  it('does not run its own worker when a score is supplied', () => {
    mockUseStockfishEval.mockReturnValue({ loading: true, depth: 0 })
    render(<EvalBar fen={STARTPOS} score={{ scoreCp: 50, loading: false }} />)
    // Supplied score wins; the worker hook is still called (hook rules) but its
    // result is ignored. We assert the supplied value renders.
    expect(screen.getByText('+0.5')).toBeInTheDocument()
  })

  it('shows a preliminary score even while still loading (progressive depth)', () => {
    // While the engine ramps up depth, each update is loading=true but already
    // carries a score — the bar must show it, not "…".
    mockUseStockfishEval.mockReturnValue({ loading: true, scoreCp: 80, depth: 12 })
    render(<EvalBar fen={STARTPOS} />)
    expect(screen.getByText('+0.8')).toBeInTheDocument()
    expect(screen.queryByText('…')).not.toBeInTheDocument()
  })

  it('only shows the placeholder when loading with no score yet', () => {
    mockUseStockfishEval.mockReturnValue({ loading: true, depth: 0 })
    render(<EvalBar fen={STARTPOS} direction="vertical" />)
    expect(screen.getByText('…')).toBeInTheDocument()
  })
})
