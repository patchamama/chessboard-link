import { useStockfishEval } from '../../../shared/stockfish/useStockfishEval'
import { useSettingsStore } from '../../../shared/settings/settingsStore'

export interface SuppliedScore {
  scoreCp?: number
  mate?: number
  loading?: boolean
}

interface EvalBarProps {
  fen: string
  direction?: 'horizontal' | 'vertical'
  /**
   * Externally supplied score (e.g. the live engine panel as its depth ramps up).
   * When present, the bar uses it and does NOT spawn its own worker, so the bar
   * and the panel stay in sync and only one engine runs.
   */
  score?: SuppliedScore | null
}

function formatEval(scoreCp?: number, mate?: number): string {
  if (mate !== undefined) return mate > 0 ? `+M${mate}` : `-M${Math.abs(mate)}`
  if (scoreCp === undefined) return '0.0'
  const pawns = scoreCp / 100
  return (pawns > 0 ? '+' : '') + pawns.toFixed(1)
}

export default function EvalBar({ fen, direction: directionProp, score }: EvalBarProps) {
  // When a score is supplied, disable the bar's own worker (the panel drives it).
  const own = useStockfishEval(fen, !score)
  const { loading, scoreCp, mate, depth } = score
    ? { loading: score.loading ?? false, scoreCp: score.scoreCp, mate: score.mate, depth: undefined }
    : own
  const directionStore = useSettingsStore((s) => s.evalBarDirection)
  const direction = directionProp ?? directionStore

  // A preliminary score is available the moment any cp/mate arrives, even while
  // still loading (depth ramping). Show it; "…" only when there is no score yet.
  const hasScore = scoreCp !== undefined || mate !== undefined
  const pending  = loading && !hasScore

  const label   = pending ? '…' : formatEval(scoreCp, mate)
  const isWhite = mate !== undefined ? mate > 0 : (scoreCp ?? 0) >= 0

  // white advantage percentage (0-100)
  const whitePct = pending
    ? 50
    : mate !== undefined
      ? (mate > 0 ? 85 : 15)
      : Math.min(85, Math.max(15, 50 + (scoreCp ?? 0) / 10))

  if (direction === 'vertical') {
    return (
      <div
        className="relative w-2 shrink-0 self-stretch"
        aria-label={`Evaluation: ${label}`}
        data-depth={depth}
      >
        {/* Bar fills exactly the stretched height (= board height) */}
        <div className="absolute inset-0 bg-gray-800 rounded overflow-hidden border border-gray-600">
          <div
            className="absolute bottom-0 left-0 right-0 bg-white transition-all duration-500"
            style={{ height: `${whitePct}%` }}
          />
        </div>
        {/* Score hangs below the bar without affecting layout width */}
        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 text-[9px] font-mono font-semibold opacity-60 whitespace-nowrap">
          {label}
        </span>
      </div>
    )
  }

  // Horizontal (default)
  return (
    <div
      className="w-full"
      aria-label={`Evaluation: ${label}`}
      data-depth={depth}
    >
      <div className="relative h-3 w-full rounded overflow-hidden bg-gray-800 border border-gray-700">
        <div
          className="absolute inset-y-0 left-0 bg-white transition-all duration-500"
          style={{ width: `${whitePct}%` }}
        />
      </div>
      <div className="flex justify-between items-center mt-0.5 px-0.5">
        <span className="text-[10px] font-mono font-semibold" style={{ color: 'inherit' }}>
          {isWhite && !pending ? label : ''}
        </span>
        {pending && <span className="text-[10px] text-gray-400 animate-pulse">Stockfish…</span>}
        <span className="text-[10px] font-mono font-semibold text-gray-500">
          {!isWhite && !pending ? label : ''}
        </span>
      </div>
    </div>
  )
}
