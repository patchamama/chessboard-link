import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStockfishEval } from '../useStockfishEval'

// ---------------------------------------------------------------------------
// Mock the worker module — we don't run real WASM in Vitest
// ---------------------------------------------------------------------------
const mockPostMessage = vi.fn()
let capturedOnMessage: ((event: MessageEvent) => void) | null = null

vi.mock('../stockfishWorker', () => ({
  createStockfishWorker: vi.fn(() => {
    const worker = {
      postMessage: mockPostMessage,
      onmessage: null as ((event: MessageEvent) => void) | null,
      terminate: vi.fn(),
    }
    // Capture onmessage setter so tests can simulate engine replies
    Object.defineProperty(worker, 'onmessage', {
      set(handler: (event: MessageEvent) => void) {
        capturedOnMessage = handler
      },
      get() {
        return capturedOnMessage
      },
    })
    return worker
  }),
}))

const STARTPOS = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4  = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'

function simulateEngineReply(data: string) {
  capturedOnMessage?.({ data } as MessageEvent)
}

describe('useStockfishEval', () => {
  beforeEach(() => {
    mockPostMessage.mockClear()
    capturedOnMessage = null
    vi.clearAllMocks()
  })

  it('starts in loading state', () => {
    const { result } = renderHook(() => useStockfishEval(STARTPOS))
    expect(result.current.loading).toBe(true)
    expect(result.current.scoreCp).toBeUndefined()
  })

  it('posts the fen to the worker on mount', () => {
    renderHook(() => useStockfishEval(STARTPOS))
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'evaluate', fen: STARTPOS })
    )
  })

  it('returns parsed cp eval after worker message', async () => {
    const { result } = renderHook(() => useStockfishEval(STARTPOS))

    act(() => {
      simulateEngineReply(
        JSON.stringify({ type: 'eval', fen: STARTPOS, scoreCp: 34, bestMove: 'e2e4', depth: 15 })
      )
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.scoreCp).toBe(34)
    expect(result.current.bestMove).toBe('e2e4')
    expect(result.current.depth).toBe(15)
    expect(result.current.mate).toBeUndefined()
  })

  it('returns mate eval after worker message', async () => {
    const { result } = renderHook(() => useStockfishEval(STARTPOS))

    act(() => {
      simulateEngineReply(
        JSON.stringify({ type: 'eval', fen: STARTPOS, mate: 3, bestMove: 'd1h5', depth: 5 })
      )
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.mate).toBe(3)
    expect(result.current.scoreCp).toBeUndefined()
  })

  it('caches by fen — second call same fen does not repost', async () => {
    const { result, rerender } = renderHook(({ fen }) => useStockfishEval(fen), {
      initialProps: { fen: STARTPOS },
    })

    // Simulate eval for startpos
    act(() => {
      simulateEngineReply(
        JSON.stringify({ type: 'eval', fen: STARTPOS, scoreCp: 34, bestMove: 'e2e4', depth: 15 })
      )
    })
    await waitFor(() => expect(result.current.loading).toBe(false))

    const callCountAfterFirst = mockPostMessage.mock.calls.length

    // Change to a different fen then back
    rerender({ fen: AFTER_E4 })
    act(() => {
      simulateEngineReply(
        JSON.stringify({ type: 'eval', fen: AFTER_E4, scoreCp: -20, bestMove: 'e7e5', depth: 15 })
      )
    })
    await waitFor(() => expect(result.current.scoreCp).toBe(-20))

    // Back to startpos — cached, should NOT post again
    rerender({ fen: STARTPOS })
    const callCountAfterReturn = mockPostMessage.mock.calls.length

    expect(callCountAfterReturn).toBe(callCountAfterFirst + 1) // only the AFTER_E4 call was new
    expect(result.current.scoreCp).toBe(34) // cached value returned immediately
    expect(result.current.loading).toBe(false)
  })

  it('supersedes old fen when fen changes', async () => {
    const { result, rerender } = renderHook(({ fen }) => useStockfishEval(fen), {
      initialProps: { fen: STARTPOS },
    })

    // Change fen immediately before startpos reply arrives
    rerender({ fen: AFTER_E4 })

    // Late reply for old fen — should be ignored
    act(() => {
      simulateEngineReply(
        JSON.stringify({ type: 'eval', fen: STARTPOS, scoreCp: 99, bestMove: 'e2e4', depth: 15 })
      )
    })

    // Result for new fen arrives
    act(() => {
      simulateEngineReply(
        JSON.stringify({ type: 'eval', fen: AFTER_E4, scoreCp: -20, bestMove: 'e7e5', depth: 15 })
      )
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.scoreCp).toBe(-20)
  })
})
