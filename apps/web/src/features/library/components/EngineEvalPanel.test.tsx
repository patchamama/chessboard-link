import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { EngineLinesState } from '../../../shared/stockfish/useEngineLines'
import { EngineEvalPanel } from './EngineEvalPanel'

let mockState: EngineLinesState

const FEN_WHITE = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('EngineEvalPanel', () => {
  beforeEach(() => {
    mockState = {
      lines: [
        {
          idx: 1,
          pv: ['e2e4', 'e7e5', 'g1f3'],
          scoreCp: 1211,
          depth: 19,
          nodes: 57289,
          nps: 526000,
          time: 109,
        },
      ],
      loading: false,
      depth: 19,
      nodes: 57289,
      nps: 526000,
      time: 109,
      bestMove: 'e2e4',
    }
  })

  it('renders the engine label and the formatted info line', () => {
    render(<EngineEvalPanel fen={FEN_WHITE} onPlayUci={vi.fn()} engine={mockState} />)
    expect(screen.getByText(/Stockfish 10:/i)).toBeInTheDocument()
    // Score, depth, nodes, nps, time tokens all present.
    expect(screen.getByText(/\(12\.11\)/)).toBeInTheDocument()
    expect(screen.getByText(/d=19/)).toBeInTheDocument()
    expect(screen.getByText(/n=57289/)).toBeInTheDocument()
    expect(screen.getByText(/nps=526K/)).toBeInTheDocument()
    expect(screen.getByText(/time:0s/)).toBeInTheDocument()
  })

  it('renders the PV with figurine glyphs as clickable buttons', () => {
    render(<EngineEvalPanel fen={FEN_WHITE} onPlayUci={vi.fn()} engine={mockState} />)
    // First white move e4, then black e5, then white Nf3 → figurine knight.
    expect(screen.getByRole('button', { name: '1. e4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /♞f3/ })).toBeInTheDocument()
  })

  it('calls onPlayUci with the clicked move when a PV move is pressed', () => {
    const onPlayUci = vi.fn()
    render(<EngineEvalPanel fen={FEN_WHITE} onPlayUci={onPlayUci} engine={mockState} />)
    fireEvent.click(screen.getByRole('button', { name: '1. e4' }))
    expect(onPlayUci).toHaveBeenCalledWith('e2e4')
  })

  it('shows a loading hint and nothing else while analysing with no lines yet', () => {
    mockState = { lines: [], loading: true, depth: 0 }
    render(<EngineEvalPanel fen={FEN_WHITE} onPlayUci={vi.fn()} engine={mockState} />)
    expect(screen.getByText(/Stockfish 10:/i)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
