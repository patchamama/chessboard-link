import { useMemo, useState } from 'react'
import {
  recognizeGames,
  countVariations,
  type GameTree,
  type GameNode,
  type RecognitionError,
} from '@chess-ebook/chess-shared'
import ChessBoard from '../../../shared/chess/ChessBoard'
import { useSettingsStore } from '../../../shared/settings/settingsStore'

interface RecognitionDebugPanelProps {
  /** The current chapter's plain text (already HTML-stripped, newline-preserving). */
  chapterText: string
}

const ALGO_HINTS: Record<1 | 2 | 3, string> = {
  1: 'Mainline only — builds just the main line, no variations',
  2: 'Two-pass — clean mainline first, then variations anchored by move number',
  3: 'Legacy single-pass — validation-anchored (kept for comparison)',
}

const KIND_LABEL: Record<RecognitionError['kind'], string> = {
  'missing-move': 'Missing move',
  unreferenced: 'Unreferenced',
  'wrong-number': 'Wrong number',
}

const KIND_COLOR: Record<RecognitionError['kind'], string> = {
  'missing-move': 'bg-amber-200 text-amber-900',
  unreferenced: 'bg-rose-200 text-rose-900',
  'wrong-number': 'bg-violet-200 text-violet-900',
}

/** One token of a serialised line: a move (with a node for hover) or punctuation. */
type PgnToken =
  | { kind: 'move'; text: string; node: GameNode }
  | { kind: 'punct'; text: string }

/**
 * Walk a tree into renderable tokens (mainline + variations) so each MOVE can
 * carry its node (for a board thumbnail on hover). Mirrors treeToPgn ordering.
 */
function tokenizeTree(tree: GameTree, multiline: boolean): PgnToken[] {
  const out: PgnToken[] = []
  const emitted = new Set<string[]>()

  const prefix = (n: GameNode, dots: boolean) =>
    n.color === 'white' ? `${n.moveNumber}. ` : dots ? `${n.moveNumber}... ` : ''

  const walk = (ids: string[], starts: boolean, depth: number) => {
    if (emitted.has(ids)) return
    emitted.add(ids)
    let needNumber = starts
    ids.forEach((id, i) => {
      const node = tree.nodes.get(id)
      if (!node) return
      const dots = node.color === 'black' && (needNumber || i === 0)
      out.push({ kind: 'move', text: prefix(node, dots) + (node.rawSan ?? node.san), node })
      needNumber = false

      const altKey = node.parentId ?? 'root'
      const altLines = (tree.variations.get(altKey) ?? []).filter(
        (l) => l.length > 0 && l !== ids && !emitted.has(l) && l[0] !== id,
      )
      const isLast = i === ids.length - 1
      const subLines = isLast
        ? (tree.variations.get(id) ?? []).filter((l) => l.length > 0 && l !== ids && !emitted.has(l))
        : []

      for (const line of [...altLines, ...subLines]) {
        out.push({ kind: 'punct', text: multiline ? `\n${'   '.repeat(depth + 1)}(` : '(' })
        walk(line, true, depth + 1)
        out.push({ kind: 'punct', text: ')' })
        needNumber = true
      }
    })
  }
  walk(tree.mainline, true, 0)
  return out
}

/** Floating board thumbnail anchored near the cursor. */
function Thumb({ fen }: { fen: string }) {
  return (
    <div className="pointer-events-none absolute z-50 mt-1 w-32 rounded border border-slate-300 bg-white p-0.5 shadow-lg">
      <ChessBoard fen={fen} orientation="white" />
    </div>
  )
}

function GameView({ tree, index }: { tree: GameTree; index: number }) {
  const [multiline, setMultiline] = useState(false)
  const [hoverFen, setHoverFen] = useState<string | null>(null)
  const tokens = useMemo(() => tokenizeTree(tree, multiline), [tree, multiline])
  const varCount = useMemo(() => countVariations(tree), [tree])

  return (
    <li className="relative rounded border border-slate-200 bg-white p-2">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <span>Game {index + 1}</span>
        <span className="rounded bg-slate-100 px-1 text-slate-600">{varCount} variation(s)</span>
        {tree.errors.length > 0 && (
          <span className="rounded bg-amber-100 px-1 text-amber-700">{tree.errors.length} error(s)</span>
        )}
        <button
          onClick={() => setMultiline((m) => !m)}
          className="ml-auto rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 hover:bg-slate-50"
        >
          {multiline ? 'Inline' : 'Split lines'}
        </button>
      </div>

      <code className="block whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-700">
        {tokens.map((t, i) => {
          const prev = tokens[i - 1]
          // Space before this token unless it follows an "(" / line break, or is
          // itself a ")".
          const openParen = !!prev && prev.kind === 'punct' && prev.text.endsWith('(')
          const lineBreak = !!prev && prev.kind === 'punct' && prev.text.startsWith('\n')
          const isClose = t.kind === 'punct' && t.text === ')'
          const sep = i === 0 || openParen || lineBreak || isClose ? '' : ' '
          return (
            <span key={i}>
              {sep}
              {t.kind === 'move' ? (
                <span
                  className="cursor-help rounded hover:bg-amber-200"
                  onMouseEnter={() => setHoverFen(t.node.fen)}
                  onMouseLeave={() => setHoverFen(null)}
                >
                  {t.text}
                </span>
              ) : (
                t.text
              )}
            </span>
          )
        })}
      </code>

      {hoverFen && <Thumb fen={hoverFen} />}

      {/* Errors, highlighted */}
      {tree.errors.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 border-t border-slate-100 pt-2">
          {tree.errors.map((e, i) => (
            <li key={i} className="text-[11px]">
              <span className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase ${KIND_COLOR[e.kind]}`}>
                {KIND_LABEL[e.kind]}
              </span>
              <span className="ml-1 font-mono text-slate-600">
                {e.moveNumber}
                {e.color === 'black' ? '...' : '.'} {e.rawSan ?? e.san}
              </span>
              <span className="ml-1 text-slate-500">— {e.message}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * Dev/admin-only panel: every recognised game in the current chapter as clean
 * lines (variations in parentheses, no prose). Switch algorithm (re-recognises
 * the reader too), split variations onto their own lines, hover a move for a
 * board thumbnail, see per-game variation/error counts, and parse a test text.
 */
export function RecognitionDebugPanel({ chapterText }: RecognitionDebugPanelProps) {
  const algorithm = useSettingsStore((s) => s.recognitionAlgorithm)
  const setAlgorithm = (a: 1 | 2 | 3) => useSettingsStore.getState().set({ recognitionAlgorithm: a })
  const [testText, setTestText] = useState('')

  const chapterGames = useMemo(() => {
    if (!chapterText) return []
    try {
      return recognizeGames(chapterText, { algorithm })
    } catch {
      return []
    }
  }, [chapterText, algorithm])

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
        <GameView key={i} tree={g.tree} index={i} />
      ))}
      {games.length === 0 && <li className="text-xs text-slate-400">No games detected.</li>}
    </ol>
  )

  return (
    <div className="mt-3 rounded-lg border border-dashed border-violet-300 bg-violet-50/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-violet-700">Debug — detected games</p>
        <div className="flex items-center gap-1 text-[11px]">
          <span className="text-slate-500">Algorithm</span>
          {([1, 2, 3] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAlgorithm(a)}
              title={ALGO_HINTS[a]}
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

      {renderGames(chapterGames)}

      <div className="mt-3 border-t border-violet-200 pt-2">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-[11px] font-semibold text-slate-600">Test text</label>
          <button
            onClick={() => setTestText(chapterText)}
            className="text-[10px] text-violet-600 hover:underline"
          >
            Load current chapter
          </button>
        </div>
        <textarea
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder="Paste a text with moves to inspect the detected lines…"
          rows={4}
          className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-[11px] focus:border-violet-400 focus:outline-none"
        />
        {testGames !== null && <div className="mt-2">{renderGames(testGames)}</div>}
      </div>
    </div>
  )
}
