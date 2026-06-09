import { useStockfishEval } from '../../../shared/stockfish/useStockfishEval'

interface EvalBarProps {
  fen: string
}

function formatEval(scoreCp?: number, mate?: number): string {
  if (mate !== undefined) return `#${mate}`
  if (scoreCp === undefined) return '...'
  const pawns = scoreCp / 100
  return (pawns > 0 ? '+' : '') + pawns.toFixed(1)
}

export default function EvalBar({ fen }: EvalBarProps) {
  const { loading, scoreCp, mate, depth } = useStockfishEval(fen)

  if (loading) {
    return (
      <div className="flex items-center gap-1 text-xs text-gray-400" role="status" aria-label="Evaluating position">
        <span className="animate-pulse">⏳</span>
        <span>Eval…</span>
      </div>
    )
  }

  const label    = formatEval(scoreCp, mate)
  const isWhite  = (mate !== undefined ? mate > 0 : (scoreCp ?? 0) >= 0)
  const barPct   = mate !== undefined
    ? (mate > 0 ? 85 : 15)
    : Math.min(85, Math.max(15, 50 + (scoreCp ?? 0) / 10))

  return (
    <div
      className="flex flex-col items-center gap-1"
      aria-label={`Evaluation: ${label}`}
      data-depth={depth}
    >
      {/* Vertical bar */}
      <div className="relative w-4 h-24 bg-black rounded overflow-hidden">
        <div
          className="absolute bottom-0 left-0 right-0 bg-white transition-all duration-300"
          style={{ height: `${barPct}%` }}
        />
      </div>
      {/* Numeric label */}
      <span className={`text-xs font-mono font-semibold ${isWhite ? 'text-gray-800' : 'text-gray-500'}`}>
        {label}
      </span>
    </div>
  )
}
