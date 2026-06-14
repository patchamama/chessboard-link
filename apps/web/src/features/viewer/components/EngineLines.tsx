import { Chess, type Square } from 'chess.js'
import { useEngineLines, type EngineLine } from '../../../shared/stockfish/useEngineLines'

interface EngineLinesProps {
  fen: string
  onPreviewFen: (fen: string | null) => void
}

function formatScore(line: EngineLine): string {
  if (line.mate !== undefined)
    return line.mate > 0 ? '+M' + line.mate : '-M' + Math.abs(line.mate)
  if (line.scoreCp !== undefined) {
    const p = line.scoreCp / 100
    return (p > 0 ? '+' : '') + p.toFixed(1)
  }
  return '?'
}

interface PvSegment {
  label: string
  pvIndex: number
}

function pvToSegments(fen: string, pv: string[]): PvSegment[] {
  try {
    const chess = new Chess(fen)
    const fenParts = fen.split(' ')
    let moveNum = parseInt(fenParts[5] ?? '1', 10)
    let isWhiteTurn = (fenParts[1] ?? 'w') === 'w'
    const result: PvSegment[] = []
    // Show up to 10 plies (10 half-moves total) of the best line
    const slice = pv.slice(0, 10)

    for (let i = 0; i < slice.length; i++) {
      const uci = slice[i]
      const from = uci.slice(0, 2) as Square
      const to = uci.slice(2, 4) as Square
      const promo = uci[4] as 'q' | 'r' | 'b' | 'n' | undefined
      const move = chess.move({ from, to, promotion: promo ?? 'q' })
      if (!move) break

      let label: string
      if (isWhiteTurn) {
        label = moveNum + '. ' + move.san
      } else {
        label = i === 0 ? moveNum + '... ' + move.san : move.san
        moveNum++
      }
      result.push({ label, pvIndex: i })
      isWhiteTurn = !isWhiteTurn
    }
    return result
  } catch {
    return pv.slice(0, 10).map((uci, i) => ({ label: uci, pvIndex: i }))
  }
}

function fenAfterMoves(fen: string, pv: string[], upTo: number): string | null {
  try {
    const chess = new Chess(fen)
    for (let i = 0; i < upTo; i++) {
      const uci = pv[i]
      const from = uci.slice(0, 2) as Square
      const to = uci.slice(2, 4) as Square
      const promo = uci[4] as 'q' | 'r' | 'b' | 'n' | undefined
      if (!chess.move({ from, to, promotion: promo ?? 'q' })) return null
    }
    return chess.fen()
  } catch {
    return null
  }
}

export default function EngineLines({ fen, onPreviewFen }: EngineLinesProps) {
  const { lines, loading } = useEngineLines(fen)

  if (loading && lines.length === 0) {
    return <span className="text-[11px] opacity-40 italic">SF10 · ...</span>
  }

  const best = lines[0]
  if (!best) return null

  const score = formatScore(best)
  const segments = pvToSegments(fen, best.pv)

  return (
    <p className="text-[11px] leading-snug">
      <span className="font-semibold opacity-70">SF10 · {score}</span>
      {segments.map(({ label, pvIndex }) => (
        <span key={pvIndex}>
          {' '}
          <button
            style={{ all: 'unset', cursor: 'pointer' }}
            className="hover:underline hover:opacity-70 transition-opacity"
            onMouseEnter={() => {
              const f = fenAfterMoves(fen, best.pv, pvIndex + 1)
              if (f) onPreviewFen(f)
            }}
            onMouseLeave={() => onPreviewFen(null)}
            onClick={() => {
              const f = fenAfterMoves(fen, best.pv, pvIndex + 1)
              if (f) onPreviewFen(f)
            }}
          >
            {label}
          </button>
        </span>
      ))}
    </p>
  )
}
