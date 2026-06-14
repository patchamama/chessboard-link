import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// A controllable fake worker we can drive from the test.
class FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
  emit(data: unknown) {
    this.onmessage?.({ data } as MessageEvent)
  }
}

let lastWorker: FakeWorker | null = null

vi.mock('./stockfishWorker', () => ({
  SF_DEFAULT_URL: 'blob:mock',
  createStockfishWorker: () => {
    lastWorker = new FakeWorker()
    return lastWorker as unknown as Worker
  },
}))

import { useEngineLines } from './useEngineLines'
import { useSettingsStore } from '../settings/settingsStore'

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('useEngineLines', () => {
  beforeEach(() => {
    lastWorker = null
    useSettingsStore.getState().reset()
    useSettingsStore.getState().set({ showEval: true, engineDepth: 19, engineVariations: 1 })
  })

  it('does not spawn a worker while showEval is off', () => {
    useSettingsStore.getState().set({ showEval: false })
    renderHook(() => useEngineLines(FEN))
    expect(lastWorker).toBeNull()
  })

  it('requests analysis at the configured depth and variation count', async () => {
    useSettingsStore.getState().set({ engineDepth: 24, engineVariations: 3 })
    renderHook(() => useEngineLines(FEN))
    await waitFor(() => expect(lastWorker).not.toBeNull())
    await waitFor(() =>
      expect(lastWorker!.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'lines', fen: FEN, depth: 24, count: 3 }),
      ),
    )
  })

  it('exposes streamed depth/nodes/nps/time and the best move', async () => {
    const { result } = renderHook(() => useEngineLines(FEN))
    await waitFor(() => expect(lastWorker).not.toBeNull())

    act(() => {
      lastWorker!.emit({
        type: 'lines',
        fen: FEN,
        final: false,
        lines: [{ idx: 1, pv: ['e2e4', 'e7e5'], scoreCp: 1211, depth: 19, nodes: 57289, nps: 526000, time: 109 }],
      })
    })

    await waitFor(() => expect(result.current.lines.length).toBe(1))
    expect(result.current.depth).toBe(19)
    expect(result.current.nodes).toBe(57289)
    expect(result.current.nps).toBe(526000)
    expect(result.current.time).toBe(109)
    expect(result.current.bestMove).toBe('e2e4')
  })
})
