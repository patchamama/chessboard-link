import { useState, useEffect, useRef } from 'react'
import { createStockfishWorker } from './stockfishWorker'
import { useSettingsStore, STOCKFISH_VERSIONS } from '../settings/settingsStore'

export interface EvalResult {
  scoreCp?: number
  mate?: number
  bestMove?: string
  depth?: number
  loading: boolean
}

const evalCache = new Map<string, Omit<EvalResult, 'loading'>>()

export function useStockfishEval(fen: string, enabled = true): EvalResult {
  const stockfishVersion = useSettingsStore((s) => s.stockfishVersion)
  const sfUrl = STOCKFISH_VERSIONS[stockfishVersion].url

  const [result, setResult] = useState<EvalResult>(() => {
    const cached = evalCache.get(fen)
    return cached ? { ...cached, loading: false } : { loading: true }
  })

  const workerRef = useRef<Worker | null>(null)
  const fenRef    = useRef<string>(fen)

  // Recreate worker when sfUrl changes (skip entirely when disabled — used when
  // an external score, e.g. the engine panel, already drives the bar).
  useEffect(() => {
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }
    if (!enabled) return
    evalCache.clear()

    const worker = createStockfishWorker(sfUrl)
    worker.onmessage = (event: MessageEvent) => {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      if (data.type !== 'eval') return
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

    setResult({ loading: true })
    workerRef.current.postMessage({ type: 'evaluate', fen: fenRef.current })

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [sfUrl, enabled])

  useEffect(() => {
    fenRef.current = fen
    if (!workerRef.current) return

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
