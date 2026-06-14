import { useState, useEffect, useRef } from 'react'
import { createStockfishWorker } from './stockfishWorker'
import { useSettingsStore, STOCKFISH_VERSIONS } from '../settings/settingsStore'

export interface EngineLine {
  idx: number
  pv: string[]
  scoreCp?: number
  mate?: number
  depth: number
  nodes?: number
  nps?: number
  time?: number
}

export interface EngineLinesState {
  lines: EngineLine[]
  loading: boolean
  /** depth of the latest streamed result */
  depth: number
  nodes?: number
  nps?: number
  time?: number
  /** first UCI move of the principal variation (the engine best move) */
  bestMove?: string
}

const EMPTY: EngineLinesState = { lines: [], loading: false, depth: 0 }

/** Derive the streamed metrics (depth/nodes/nps/time/bestMove) from line[0]. */
function deriveState(lines: EngineLine[], loading: boolean): EngineLinesState {
  const best = lines[0]
  return {
    lines,
    loading,
    depth: best?.depth ?? 0,
    nodes: best?.nodes,
    nps: best?.nps,
    time: best?.time,
    bestMove: best?.pv?.[0],
  }
}

/**
 * Progressive Stockfish analysis for `fen`. Runs only while the `showEval`
 * setting is on; depth and variation count come from Settings. The worker
 * streams a result per completed depth, so `state.depth` ramps up live.
 */
export function useEngineLines(fen: string): EngineLinesState {
  const stockfishVersion = useSettingsStore((s) => s.stockfishVersion)
  const showEval = useSettingsStore((s) => s.showEval)
  const depth = useSettingsStore((s) => s.engineDepth)
  const count = useSettingsStore((s) => s.engineVariations)
  const sfUrl = STOCKFISH_VERSIONS[stockfishVersion].url

  const [state, setState] = useState<EngineLinesState>(EMPTY)

  const workerRef = useRef<Worker | null>(null)
  const fenRef = useRef<string>(fen)

  // (Re)create the worker whenever the engine is enabled or its config changes.
  // Depth/count are part of the request payload, so a change re-runs analysis.
  useEffect(() => {
    fenRef.current = fen
    if (!showEval) {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
      setState(EMPTY)
      return
    }

    const worker = createStockfishWorker(sfUrl)
    worker.onmessage = (e: MessageEvent) => {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
      if (data.type !== 'lines') return
      if (data.fen !== fenRef.current) return
      setState(deriveState(data.lines, !data.final))
    }
    workerRef.current = worker

    setState({ ...EMPTY, loading: true })
    worker.postMessage({ type: 'lines', fen, depth, count })

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [fen, sfUrl, showEval, depth, count])

  return state
}
