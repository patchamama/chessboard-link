import '@testing-library/jest-dom'
import { vi } from 'vitest'

// ---------------------------------------------------------------------------
// Global Worker + URL stubs — jsdom has no Worker/createObjectURL.
// Stockfish WASM must never run in the test suite.
// ---------------------------------------------------------------------------
if (typeof Worker === 'undefined') {
  // @ts-expect-error stubbing global Worker for jsdom
  global.Worker = class MockWorker {
    onmessage: ((event: MessageEvent) => void) | null = null
    postMessage = vi.fn()
    terminate = vi.fn()
  }
}

if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = vi.fn(() => 'blob:mock')
  URL.revokeObjectURL = vi.fn()
}
