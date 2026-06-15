import type { RecognitionError } from '@chess-ebook/chess-shared'

export interface FlatError extends RecognitionError {
  /** Index of the game this error came from (for navigation context). */
  gameIndex: number
}

interface RecognitionErrorPanelProps {
  errors: FlatError[]
  onClose: () => void
  /** Jump to the move in the prose that triggered this error. */
  onNavigate: (error: FlatError) => void
}

const KIND_LABEL: Record<RecognitionError['kind'], string> = {
  'missing-move': 'Jugada faltante',
  unreferenced: 'Sin referencia',
  'wrong-number': 'Número incorrecto',
}

const KIND_COLOR: Record<RecognitionError['kind'], string> = {
  'missing-move': 'bg-amber-100 text-amber-800 border-amber-300',
  unreferenced: 'bg-rose-100 text-rose-800 border-rose-300',
  'wrong-number': 'bg-violet-100 text-violet-800 border-violet-300',
}

/**
 * Lists recognition problems detected across all games in the chapter and lets
 * the reader jump straight to the offending spot in the prose.
 */
export function RecognitionErrorPanel({ errors, onClose, onNavigate }: RecognitionErrorPanelProps) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative ml-auto h-full w-96 bg-white shadow-2xl overflow-y-auto p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-slate-800">
            Errores de reconocimiento ({errors.length})
          </h2>
          <button onClick={onClose} aria-label="Cerrar errores" className="text-slate-400 hover:text-slate-700 text-lg leading-none">✕</button>
        </div>

        {errors.length === 0 ? (
          <p className="text-sm text-slate-500 mt-4">No se detectaron errores en este capítulo. 🎉</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {errors.map((err, i) => (
              <li key={i}>
                <button
                  onClick={() => onNavigate(err)}
                  className="w-full text-left rounded-lg border border-slate-200 bg-slate-50 p-2.5 hover:bg-slate-100 transition"
                >
                  <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${KIND_COLOR[err.kind]}`}>
                    {KIND_LABEL[err.kind]}
                  </span>
                  <span className="ml-2 text-xs font-mono text-slate-600">
                    {err.moveNumber}
                    {err.color === 'black' ? '...' : '.'} {err.rawSan ?? err.san}
                  </span>
                  <p className="mt-1 text-xs text-slate-700 leading-snug">{err.message}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
