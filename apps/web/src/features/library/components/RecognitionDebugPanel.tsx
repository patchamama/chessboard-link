import { useMemo, useState } from 'react'
import { recognizeGames, treeToPgn } from '@chess-ebook/chess-shared'
import { useSettingsStore } from '../../../shared/settings/settingsStore'

interface RecognitionDebugPanelProps {
  /** The current chapter's plain text (already HTML-stripped, newline-preserving). */
  chapterText: string
}

const SAMPLE = `1. ♘f3 ♘f6 2. c4 g6 3. ♘c3 ♗g7 4. d4 O-O 5. ♗f4 d5

Una reacción automática habría sido 5... d6. Pero quiere la Grünfeld.

6. ♕b3

6... dxc4 7. ♕xc4 c6 8. e4 ♘bd7 9. ♖d1

Si 9. e5 ♘d5! 10. ♘xd5 ♘xd5 11. ♕b3 (11. ♕xd5? ♘xe5!), 11... ♘b6 cómodo.

9... ♘b6 10. ♕c5 10... ♗g4 11. ♗g5`

/**
 * Dev/admin-only panel: shows every recognised game in the current chapter as
 * clean PGN (variations in parentheses, no prose), lets you switch recognition
 * algorithm, and parse an arbitrary test text to inspect the resulting lines.
 */
export function RecognitionDebugPanel({ chapterText }: RecognitionDebugPanelProps) {
  // The algorithm is a real setting: switching it re-recognises the chapter in
  // the reader too, not just this panel.
  const algorithm = useSettingsStore((s) => s.recognitionAlgorithm)
  const setAlgorithm = (a: 1 | 2 | 3) => useSettingsStore.getState().set({ recognitionAlgorithm: a })
  const [testText, setTestText] = useState('')
  const [showSample, setShowSample] = useState(false)

  // Games from the actual chapter under the selected algorithm.
  const chapterGames = useMemo(() => {
    if (!chapterText) return []
    try {
      return recognizeGames(chapterText, { algorithm })
    } catch {
      return []
    }
  }, [chapterText, algorithm])

  // Games from the user's test text (only when they typed something).
  const testGames = useMemo(() => {
    const t = testText.trim()
    if (!t) return null
    try {
      return recognizeGames(t, { algorithm })
    } catch {
      return []
    }
  }, [testText, algorithm])

  const renderGames = (games: ReturnType<typeof recognizeGames>) => (
    <ol className="flex flex-col gap-2">
      {games.map((g, i) => (
        <li key={i} className="rounded border border-slate-200 bg-white p-2">
          <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <span>Partida {i + 1}</span>
            {g.tree.errors.length > 0 && (
              <span className="rounded bg-amber-100 px-1 text-amber-700">{g.tree.errors.length} error(es)</span>
            )}
          </div>
          <code className="block whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-700">
            {treeToPgn(g.tree) || '(sin jugadas)'}
          </code>
        </li>
      ))}
      {games.length === 0 && <li className="text-xs text-slate-400">No se detectaron partidas.</li>}
    </ol>
  )

  return (
    <div className="mt-3 rounded-lg border border-dashed border-violet-300 bg-violet-50/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-violet-700">Debug — partidas detectadas</p>
        <div className="flex items-center gap-1 text-[11px]">
          <span className="text-slate-500">Algoritmo</span>
          {([1, 2, 3] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAlgorithm(a)}
              title={
                a === 1 ? 'Solo línea principal' : a === 2 ? 'Dos pasadas (principal + variantes)' : 'Legacy'
              }
              className={`rounded px-2 py-0.5 font-mono transition ${
                algorithm === a
                  ? 'bg-violet-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Chapter games */}
      {renderGames(chapterGames)}

      {/* Arbitrary test text */}
      <div className="mt-3 border-t border-violet-200 pt-2">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-[11px] font-semibold text-slate-600">Probar texto</label>
          <button
            onClick={() => { setTestText(SAMPLE); setShowSample(true) }}
            className="text-[10px] text-violet-600 hover:underline"
          >
            Cargar ejemplo
          </button>
        </div>
        <textarea
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder="Pegá aquí un texto con jugadas para ver las líneas detectadas…"
          rows={showSample ? 8 : 4}
          className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-[11px] focus:border-violet-400 focus:outline-none"
        />
        {testGames !== null && <div className="mt-2">{renderGames(testGames)}</div>}
      </div>
    </div>
  )
}
