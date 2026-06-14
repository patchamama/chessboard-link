import { type EngineLinesState } from '../../../shared/stockfish/useEngineLines'
import { useSettingsStore, STOCKFISH_VERSIONS } from '../../../shared/settings/settingsStore'
import {
  formatScore,
  formatNps,
  formatNodes,
  formatTime,
  pvToFigurineSegments,
} from '../../../shared/stockfish/engineFormat'

interface EngineEvalPanelProps {
  fen: string
  /** Play the clicked PV move (UCI) on the board → triggers a fresh evaluation. */
  onPlayUci: (uci: string) => void
  /**
   * Engine state, lifted to the parent (StudyBoard) so a single worker drives
   * both this panel and the board's best-move arrow.
   */
  engine: EngineLinesState
}

/** "Stockfish 10 (jsDelivr)" → "Stockfish 10" (drop the CDN suffix). */
function engineName(label: string): string {
  return label.replace(/\s*\(.*\)\s*$/, '')
}

/**
 * Evaluation panel rendered beneath the last-move row. Shows the engine name and
 * a single live info line per principal variation:
 *
 *   (12.11) 1... ♚e1 2. ♛a7 … d=19 n=57289 nps=526K time:0s
 *
 * Each PV move is a button: clicking it plays that move on the board, which
 * re-runs the engine on the new position with the current settings.
 */
export function EngineEvalPanel({ fen, onPlayUci, engine }: EngineEvalPanelProps) {
  const stockfishVersion = useSettingsStore((s) => s.stockfishVersion)
  const name = engineName(STOCKFISH_VERSIONS[stockfishVersion].label)

  const { lines, loading } = engine

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/70 px-2.5 py-2 font-mono text-[11px] text-slate-700">
      <span className="font-semibold text-slate-500">{name}:</span>
      {/* Fixed height of exactly 4 lines (line-height 1.25rem → 5rem); scroll past that. */}
      <div className="mt-0.5 h-20 overflow-y-auto leading-5">
      {lines.length === 0 ? (
        <span className="italic opacity-50">{loading ? 'analizando…' : ''}</span>
      ) : (
        lines.map((line) => {
          const score = formatScore(line)
          const segments = pvToFigurineSegments(fen, line.pv)
          const meta =
            `d=${line.depth}` +
            (line.nodes !== undefined ? ` n=${formatNodes(line.nodes)}` : '') +
            (line.nps !== undefined ? ` nps=${formatNps(line.nps)}` : '') +
            (line.time !== undefined ? ` time:${formatTime(line.time)}` : '')

          return (
            <div key={line.idx} className="mt-0.5">
              <span className="font-semibold text-emerald-700">{score}</span>{' '}
              {segments.map(({ label, pvIndex }) => (
                <span key={pvIndex}>
                  <button
                    type="button"
                    aria-label={label}
                    onClick={() => onPlayUci(line.pv[pvIndex])}
                    className="cursor-pointer rounded px-0.5 hover:bg-blue-100 hover:text-blue-700"
                  >
                    {label}
                  </button>{' '}
                </span>
              ))}
              <span className="text-slate-400">{meta}</span>
            </div>
          )
        })
      )}
      </div>
    </div>
  )
}
