import { useState, useEffect, useRef } from 'react'
import { createStockfishWorker } from './stockfishWorker'

export interface EngineLine {
  idx: number
  pv: string[]
  scoreCp?: number
  mate?: number
  depth: number
}

const linesCache = new Map<string, EngineLine[]>()

export function useEngineLines(fen: string, count = 5): { lines: EngineLine[]; loading: boolean } {
  const [state, setState] = useState<{ lines: EngineLine[]; loading: boolean }>(() => {
    const cached = linesCache.get(fen)
    return cached ? { lines: cached, loading: false } : { lines: [], loading: true }
  })

  const workerRef = useRef<Worker | null>(null)
  const fenRef    = useRef<string>(fen)

  useEffect(() => {
    if (!workerRef.current) {
      const worker = createStockfishWorker()
      worker.onmessage = (e: MessageEvent) => {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (data.type !== 'lines') return
        if (data.fen !== fenRef.current) return
        linesCache.set(data.fen, data.lines)
        setState({ lines: data.lines, loading: false })
      }
      workerRef.current = worker
    }

    fenRef.current = fen
    const cached = linesCache.get(fen)
    if (cached) {
      setState({ lines: cached, loading: false })
      return
    }

    setState({ lines: [], loading: true })
    workerRef.current.postMessage({ type: 'lines', fen, count, depth: 14 })
  }, [fen, count])

  return state
}
