import { useState } from 'react'
import { useBookConfig, useSaveBookConfig } from '../../../shared/bookConfig/useBookConfig'
import type { BookConfig } from '../../../shared/bookConfig/bookConfig'

interface BookConfigEditorProps {
  bookId: number
  onClose: () => void
}

const labelClass = 'block text-xs font-semibold text-gray-300 mb-1 mt-3'
const inputClass =
  'w-full rounded bg-gray-700 border border-gray-600 px-2 py-1 text-sm text-white focus:outline-none focus:border-amber-400'

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`flex-1 rounded py-1 text-xs border transition-colors ${
        on
          ? 'bg-amber-400 text-gray-900 border-amber-400 font-semibold'
          : 'bg-gray-700 text-gray-200 border-gray-600 hover:border-amber-400'
      }`}
    >
      {label}: {on ? 'On' : 'Off'}
    </button>
  )
}

/**
 * Admin-only editor for a book's custom render config. Edits a local draft and
 * saves it via the API; the reader re-renders from the refreshed cache.
 */
export function BookConfigEditor({ bookId, onClose }: BookConfigEditorProps) {
  const { config } = useBookConfig(bookId)
  const save = useSaveBookConfig(bookId)
  const [draft, setDraft] = useState<BookConfig>(config)

  const patch = (p: Partial<BookConfig>) => setDraft((d) => ({ ...d, ...p }))

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative ml-auto h-full w-96 bg-gray-900 shadow-2xl overflow-y-auto p-4 flex flex-col gap-1">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold text-white">Book config</h2>
          <button onClick={onClose} aria-label="Close book config" className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>

        {/* Heading spans */}
        <label className={labelClass}>Heading spans (treat &lt;span class="hN"&gt; as a heading)</label>
        <div className="grid grid-cols-4 gap-1">
          {(['h2', 'h3', 'h4', 'h5'] as const).map((tag) => (
            <Toggle
              key={tag}
              on={draft.headingSpans[tag]}
              onClick={() => patch({ headingSpans: { ...draft.headingSpans, [tag]: !draft.headingSpans[tag] } })}
              label={tag}
            />
          ))}
        </div>

        {/* Bar class */}
        <label className={labelClass}>Divider class (renders like &lt;hr&gt;)</label>
        <div className="flex gap-2 items-center">
          <input
            value={draft.barClass.name}
            onChange={(e) => patch({ barClass: { ...draft.barClass, name: e.target.value } })}
            placeholder="barra"
            aria-label="Divider class name"
            className={`${inputClass} flex-1`}
          />
          <Toggle
            on={draft.barClass.asHr}
            onClick={() => patch({ barClass: { ...draft.barClass, asHr: !draft.barClass.asHr } })}
            label="hr"
          />
        </div>

        {/* Move-line indent */}
        <label className={labelClass}>Move lines</label>
        <Toggle
          on={draft.moveLineIndent.zeroIndent}
          onClick={() => patch({ moveLineIndent: { zeroIndent: !draft.moveLineIndent.zeroIndent } })}
          label="Zero indent on move lines"
        />

        {/* Extra CSS */}
        <label className={labelClass}>Extra CSS (scoped to .epub-content)</label>
        <textarea
          value={draft.extraCss}
          onChange={(e) => patch({ extraCss: e.target.value })}
          aria-label="Extra CSS"
          rows={6}
          className={`${inputClass} font-mono`}
        />

        <button
          onClick={() => save.mutate(draft)}
          disabled={save.isPending}
          className="mt-4 w-full rounded py-1.5 text-xs bg-amber-400 text-gray-900 font-semibold hover:bg-amber-300 disabled:opacity-50"
        >
          {save.isPending ? 'Saving…' : 'Save config'}
        </button>
        {save.isError && <p className="mt-1 text-xs text-red-400">Failed to save (admin only).</p>}
        {save.isSuccess && <p className="mt-1 text-xs text-green-400">Saved.</p>}
      </div>
    </div>
  )
}
