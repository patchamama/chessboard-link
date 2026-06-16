import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import BookReader from '../BookReader'
import { useStudyBoardStore } from '../../store/studyBoardStore'
import { useSettingsStore } from '../../../../shared/settings/settingsStore'

// Two Fischer games in one chapter, each with prose alternatives, to verify the
// number-authoritative resolver: "9... ♘b6" in prose must map to the move-9 node
// (not the "11... ♘b6" variation), and a prose-only "9. e5" must not be painted
// as a mainline move, and game 1 moves must not leak into game 2.
const TWO_GAMES_HTML = `
<p>Blancas: Donald Byrne — Negras: R. Fischer</p>
<p>1. ♘f3 ♘f6 2. c4 g6 3. ♘c3 ♗g7 4. d4 O-O 5. ♗f4 d5</p>
<p>Una reacción habría sido 5... d6.</p>
<p>6. ♕b3</p>
<p>Más sólido es 6. ♖c1.</p>
<p>6... dxc4 7. ♕xc4 c6 8. e4 ♘bd7 9. ♖d1</p>
<p>Si 9. e5 ♘d5! 10. ♘xd5 ♘xd5 11. ♕b3 (11. ♕xd5? ♘xe5!), 11... ♘b6.</p>
<p>9... ♘b6 10. ♕c5</p>
<p>Blancas: R. Fischer — Negras: S. Gligoric</p>
<p>1. e4 c5 2. ♘f3 ♘c6 3. d4 ♘xd4 4. ♘xd4 ♘f6 5. ♘c3 d6 6. ♗c4</p>
`

vi.mock('../../api/libraryApi', () => ({
  useChapter: () => ({
    data: { title: 'Fischer', html: TWO_GAMES_HTML, toc: [] },
    isLoading: false,
  }),
  useTouchBook: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('react-chessboard', () => ({ Chessboard: () => <div data-testid="chessboard" /> }))
vi.mock('../../../../shared/stockfish/useStockfishEval', () => ({
  useStockfishEval: () => ({ loading: false, scoreCp: 0, depth: 10 }),
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

/** All wrapped move spans whose visible text contains the given SAN glyph text. */
function spansWithText(container: HTMLElement, text: string): HTMLElement[] {
  return [...container.querySelectorAll('span[data-node-id]')].filter((s) =>
    (s.textContent ?? '').includes(text),
  ) as HTMLElement[]
}

for (const algorithm of [1, 2] as const) {
  describe(`BookReader two-game recognition (algorithm ${algorithm})`, () => {
    beforeEach(() => {
      useStudyBoardStore.getState().reset()
      useSettingsStore.getState().set({ recognitionAlgorithm: algorithm })
    })

    it('"9... ♘b6" maps to a move-9 node (game index, not the 11... variation)', async () => {
      const { container } = render(<BookReader />, { wrapper })
      let nb6Spans: HTMLElement[] = []
      await waitFor(() => {
        nb6Spans = spansWithText(container, '♘b6').filter((s) => (s.textContent ?? '').includes('9...'))
        expect(nb6Spans.length).toBeGreaterThan(0)
      })
      // The "9... ♘b6" span must belong to game 0 (Byrne–Fischer), move 9.
      const s = nb6Spans[0]
      expect(s.getAttribute('data-game-index')).toBe('0')
    })

    it('game 2 "1. e4" is a distinct game (game index 1), no cross-game leak', async () => {
      const { container } = render(<BookReader />, { wrapper })
      let e4Spans: HTMLElement[] = []
      await waitFor(() => {
        e4Spans = spansWithText(container, 'e4').filter((s) => (s.textContent ?? '').includes('1.'))
        expect(e4Spans.length).toBeGreaterThan(0)
      })
      expect(e4Spans[0].getAttribute('data-game-index')).toBe('1')
    })
  })
}

describe('BookReader algorithm 1: prose-only variation move is NOT painted', () => {
  beforeEach(() => {
    useStudyBoardStore.getState().reset()
    useSettingsStore.getState().set({ recognitionAlgorithm: 1 })
  })

  it('"9. e5" (a prose variation, absent from the alg-1 mainline tree) is not a move span', async () => {
    const { container } = render(<BookReader />, { wrapper })
    // Wait for wrapping to settle (a known mainline move exists).
    await waitFor(() => {
      expect(spansWithText(container, '♖d1').length).toBeGreaterThan(0)
    })
    // e5 appears only as the prose variation "9. e5"; with algorithm 1 it has no
    // node, so it must NOT be a clickable move span.
    const e5MoveSpans = spansWithText(container, 'e5').filter((s) => (s.textContent ?? '').includes('9.'))
    expect(e5MoveSpans.length).toBe(0)
  })
})
