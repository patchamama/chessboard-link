import { useSettingsStore, BOARD_THEMES, FONT_FAMILIES, STOCKFISH_VERSIONS, type BoardTheme, type FontFamily, type EvalBarDirection, type StockfishVersion, type ImageAlign, type HeadingStyle, type EngineVariations } from './settingsStore'

interface SettingsPanelProps {
  onClose: () => void
}

const labelClass = 'block text-xs font-semibold text-gray-300 mb-1 mt-3'
const inputClass = 'w-full rounded bg-gray-700 border border-gray-600 px-2 py-1 text-sm text-white focus:outline-none focus:border-amber-400'

const stepBtn =
  'flex h-7 w-7 items-center justify-center rounded border border-gray-600 bg-gray-700 text-white hover:border-amber-400 disabled:opacity-40 disabled:cursor-not-allowed'

/** −/+ stepper row with a centred value. */
function Stepper({
  value,
  onDec,
  onInc,
  decLabel,
  incLabel,
  canDec = true,
  canInc = true,
}: {
  value: string | number
  onDec: () => void
  onInc: () => void
  decLabel: string
  incLabel: string
  canDec?: boolean
  canInc?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <button className={stepBtn} aria-label={decLabel} onClick={onDec} disabled={!canDec}>−</button>
      <span className="min-w-8 text-center text-sm font-semibold text-white">{value}</span>
      <button className={stepBtn} aria-label={incLabel} onClick={onInc} disabled={!canInc}>+</button>
    </div>
  )
}

/** On/off pill toggle. */
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

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const s = useSettingsStore()

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto h-full w-80 bg-gray-900 shadow-2xl overflow-y-auto p-4 flex flex-col gap-1">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg leading-none"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Board theme */}
        <label className={labelClass}>Board theme</label>
        <div className="grid grid-cols-3 gap-1">
          {(Object.entries(BOARD_THEMES) as [BoardTheme, typeof BOARD_THEMES[BoardTheme]][]).map(([key, t]) => (
            <button
              key={key}
              onClick={() => s.set({ boardTheme: key })}
              className={`rounded p-1 text-[11px] font-medium border-2 transition-colors ${
                s.boardTheme === key ? 'border-amber-400' : 'border-transparent'
              }`}
              style={{ background: `linear-gradient(135deg, ${t.light} 50%, ${t.dark} 50%)` }}
              title={t.label}
            >
              <span className="block bg-black/40 rounded px-1 text-white">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Eval bar direction */}
        <label className={labelClass}>Eval bar direction</label>
        <div className="flex gap-2">
          {(['horizontal', 'vertical'] as EvalBarDirection[]).map((d) => (
            <button
              key={d}
              onClick={() => s.set({ evalBarDirection: d })}
              className={`flex-1 rounded py-1 text-xs border transition-colors ${
                s.evalBarDirection === d
                  ? 'bg-amber-400 text-gray-900 border-amber-400 font-semibold'
                  : 'bg-gray-700 text-gray-200 border-gray-600 hover:border-amber-400'
              }`}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>

        {/* Stockfish version */}
        <label className={labelClass}>Stockfish engine</label>
        <select
          value={s.stockfishVersion}
          onChange={(e) => s.set({ stockfishVersion: e.target.value as StockfishVersion })}
          className={inputClass}
        >
          {(Object.entries(STOCKFISH_VERSIONS) as [StockfishVersion, typeof STOCKFISH_VERSIONS[StockfishVersion]][]).map(([key, v]) => (
            <option key={key} value={key}>{v.label}</option>
          ))}
        </select>

        {/* ── Engine ── */}
        <div className="mt-4 border-t border-gray-700 pt-3">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">Engine</p>

          <label className={labelClass}>Evaluation</label>
          <div className="flex gap-2">
            <Toggle
              on={s.showEval}
              onClick={() => s.set({ showEval: !s.showEval })}
              label="Show evaluation"
            />
          </div>

          <label className={labelClass}>Depth (plies)</label>
          <Stepper
            value={s.engineDepth}
            decLabel="Decrease depth"
            incLabel="Increase depth"
            canDec={s.engineDepth > 1}
            canInc={s.engineDepth < 40}
            onDec={() => s.set({ engineDepth: Math.max(1, s.engineDepth - 1) })}
            onInc={() => s.set({ engineDepth: Math.min(40, s.engineDepth + 1) })}
          />

          <label className={labelClass}>Variations (max 3)</label>
          <Stepper
            value={s.engineVariations}
            decLabel="Decrease variations"
            incLabel="Increase variations"
            canDec={s.engineVariations > 1}
            canInc={s.engineVariations < 3}
            onDec={() =>
              s.set({ engineVariations: Math.max(1, s.engineVariations - 1) as EngineVariations })
            }
            onInc={() =>
              s.set({ engineVariations: Math.min(3, s.engineVariations + 1) as EngineVariations })
            }
          />

          <label className={labelClass}>Engine arrow</label>
          <div className="flex gap-2">
            <Toggle
              on={s.hideEngineArrow}
              onClick={() => s.set({ hideEngineArrow: !s.hideEngineArrow })}
              label="Hide engine move arrow"
            />
          </div>
        </div>

        {/* Font family */}
        <label className={labelClass}>Font family</label>
        <select
          value={s.fontFamily}
          onChange={(e) => s.set({ fontFamily: e.target.value as FontFamily })}
          className={inputClass}
        >
          {(Object.entries(FONT_FAMILIES) as [FontFamily, typeof FONT_FAMILIES[FontFamily]][]).map(([key, f]) => (
            <option key={key} value={key}>{f.label}</option>
          ))}
        </select>

        {/* Font size */}
        <label className={labelClass}>Font size — {s.fontSize}px</label>
        <input
          type="range" min={12} max={22} step={1}
          value={s.fontSize}
          onChange={(e) => s.set({ fontSize: Number(e.target.value) })}
          className="w-full accent-amber-400"
        />

        {/* Background color */}
        <label className={labelClass}>Background color</label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={s.bgColor}
            onChange={(e) => s.set({ bgColor: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
          />
          <input
            type="text"
            value={s.bgColor}
            onChange={(e) => s.set({ bgColor: e.target.value })}
            className={`${inputClass} flex-1`}
            maxLength={7}
          />
        </div>

        {/* Text color */}
        <label className={labelClass}>Text color</label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={s.textColor}
            onChange={(e) => s.set({ textColor: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
          />
          <input
            type="text"
            value={s.textColor}
            onChange={(e) => s.set({ textColor: e.target.value })}
            className={`${inputClass} flex-1`}
            maxLength={7}
          />
        </div>

        {/* Horizontal margin */}
        <label className={labelClass}>Horizontal margin — {s.marginH}rem</label>
        <input
          type="range" min={0} max={6} step={0.5}
          value={s.marginH}
          onChange={(e) => s.set({ marginH: Number(e.target.value) })}
          className="w-full accent-amber-400"
        />

        {/* ── EPUB Layout ── */}
        <div className="mt-4 border-t border-gray-700 pt-3">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">EPUB Layout</p>

          {/* Headings */}
          {(['h1','h2','h3','h4','h5'] as const).map((tag) => {
            const h = s.epub[tag] as HeadingStyle
            const patchH = (patch: Partial<HeadingStyle>) =>
              s.set({ epub: { ...s.epub, [tag]: { ...h, ...patch } } })
            return (
              <div key={tag} className="mb-2">
                <label className={labelClass}>{tag.toUpperCase()}</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => patchH({ bold: !h.bold })}
                    className={`rounded px-2 py-0.5 text-xs font-bold border transition-colors ${h.bold ? 'bg-amber-400 text-gray-900 border-amber-400' : 'bg-gray-700 text-gray-300 border-gray-600'}`}
                  >B</button>
                  <button
                    onClick={() => patchH({ italic: !h.italic })}
                    className={`rounded px-2 py-0.5 text-xs italic border transition-colors ${h.italic ? 'bg-amber-400 text-gray-900 border-amber-400' : 'bg-gray-700 text-gray-300 border-gray-600'}`}
                  >I</button>
                  <span className="text-xs text-gray-400 ml-auto">Size +{h.sizeDelta}px</span>
                </div>
                <input
                  type="range" min={-4} max={16} step={1}
                  value={h.sizeDelta}
                  onChange={(e) => patchH({ sizeDelta: Number(e.target.value) })}
                  className="w-full accent-amber-400 mt-1"
                />
              </div>
            )
          })}

          {/* Paragraph spacing */}
          <label className={labelClass}>Paragraph spacing — {s.epub.paragraphSpacing}rem</label>
          <input
            type="range" min={0} max={4} step={0.25}
            value={s.epub.paragraphSpacing}
            onChange={(e) => s.set({ epub: { ...s.epub, paragraphSpacing: Number(e.target.value) } })}
            className="w-full accent-amber-400"
          />

          {/* Paragraph indent */}
          <label className={labelClass}>First-line indent — {s.epub.paragraphIndent}rem</label>
          <input
            type="range" min={0} max={4} step={0.25}
            value={s.epub.paragraphIndent}
            onChange={(e) => s.set({ epub: { ...s.epub, paragraphIndent: Number(e.target.value) } })}
            className="w-full accent-amber-400"
          />

          {/* Image alignment */}
          <label className={labelClass}>Image alignment</label>
          <div className="flex gap-2">
            {(['left','center','right'] as ImageAlign[]).map((align) => (
              <button
                key={align}
                onClick={() => s.set({ epub: { ...s.epub, imageAlign: align } })}
                className={`flex-1 rounded py-1 text-xs border capitalize transition-colors ${
                  s.epub.imageAlign === align
                    ? 'bg-amber-400 text-gray-900 border-amber-400 font-semibold'
                    : 'bg-gray-700 text-gray-200 border-gray-600 hover:border-amber-400'
                }`}
              >{align}</button>
            ))}
          </div>
        </div>

        {/* Reset */}
        <button
          onClick={s.reset}
          className="mt-4 w-full rounded py-1.5 text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  )
}
