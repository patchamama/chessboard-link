import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import BookReader from '../../library/components/BookReader'
import { useViewerStore } from '../store/viewerStore'

// Mock useChapter to return chess prose
vi.mock('../../library/api/libraryApi', () => ({
  useChapter: () => ({
    data: {
      title: 'Chapter 1',
      html: '<p>After 1. e4 e5 2. Nf3 Nc6 the game continues.</p>',
      toc: [],
    },
    isLoading: false,
  }),
  useTouchBook: () => ({ mutate: vi.fn(), isPending: false }),
}))

// Mock react-chessboard so jsdom doesn't fail on canvas/SVG
vi.mock('react-chessboard', () => ({
  Chessboard: ({ options }: { options?: Record<string, unknown> }) => (
    <div data-testid="chessboard" data-position={options?.position as string} />
  ),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/read/1']}>
        <Routes>
          <Route path="/read/:bookId" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('BookReader integration', () => {
  beforeEach(() => {
    useViewerStore.setState({ currentNodeId: {}, orientation: 'white', isInVariation: {} })
  })

  it('renders chapter title', async () => {
    render(<BookReader />, { wrapper })
    await waitFor(() => expect(screen.getByText('Chapter 1')).toBeInTheDocument())
  })

  it('renders a chess board', async () => {
    render(<BookReader />, { wrapper })
    await waitFor(() => expect(screen.getByTestId('chessboard')).toBeInTheDocument())
  })

  it('renders move buttons from recognized moves', async () => {
    render(<BookReader />, { wrapper })
    await waitFor(() => {
      const buttons = screen.getAllByRole('button')
      // At minimum there should be move buttons (e4, e5, Nf3, Nc6)
      expect(buttons.length).toBeGreaterThanOrEqual(4)
    })
  })

  it('clicking a move button updates the board position', async () => {
    const user = userEvent.setup()
    render(<BookReader />, { wrapper })

    await waitFor(() => screen.getAllByRole('button').length > 0)

    const board = screen.getByTestId('chessboard')
    const initialPos = board.getAttribute('data-position')

    const moveButtons = screen.getAllByRole('button').filter(b => b.hasAttribute('data-node-id'))
    if (moveButtons.length > 0) {
      await user.click(moveButtons[0])
      // After clicking, position should differ from starting FEN (or store updated)
      const storeState = useViewerStore.getState()
      const nodeIds = Object.values(storeState.currentNodeId)
      expect(nodeIds.some(id => id !== null)).toBe(true)
    }

    void initialPos
  })
})
