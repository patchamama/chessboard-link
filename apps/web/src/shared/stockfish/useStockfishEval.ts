import { useState, useEffect, useRef } from 'react'
import { createStockfishWorker } from './stockfishWorker'

export interface EvalResult {
  scoreCp?: number
  mate?: number
  bestMove?: string
  depth?: number
  loading: boolean
}

// FEN → EvalResult cache (module-level, survives re-renders but resets on page reload)
const evalCache = new Map<string, Omit<EvalResult, 'loading'>>()

export function useStockfishEval(fen: string): EvalResult {
  const [result, setResult] = useState<EvalResult>(() => {
    const cached = evalCache.get(fen)
    return cached ? { ...cached, loading: false } : { loading: true }
  })

  const workerRef = useRef<Worker | null>(null)
  const fenRef    = useRef<string>(fen)

  useEffect(() => {
    // Create worker once
    if (!workerRef.current) {
      const worker = createStockfishWorker()

      worker.onmessage = (event: MessageEvent) => {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (data.type !== 'eval') return
        // Discard stale replies (fen changed since request was sent)
        if (data.fen !== fenRef.current) return

        const evalData: Omit<EvalResult, 'loading'> = {
          scoreCp:  data.scoreCp,
          mate:     data.mate,
          bestMove: data.bestMove,
          depth:    data.depth,
        }
        evalCache.set(data.fen, evalData)
        setResult({ ...evalData, loading: false })
      }

      workerRef.current = worker
    }

    fenRef.current = fen

    // Check cache before posting
    const cached = evalCache.get(fen)
    if (cached) {
      setResult({ ...cached, loading: false })
      return
    }

    setResult({ loading: true })
    workerRef.current.postMessage({ type: 'evaluate', fen })
  }, [fen])

  return result
}
