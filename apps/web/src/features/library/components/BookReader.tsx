import { useMemo, useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Chess } from 'chess.js'
import { useChapter, useTouchBook } from '../api/libraryApi'
import { recognizeGames } from '@chess-ebook/chess-shared'
import type { GameTree } from '@chess-ebook/chess-shared'
import { useKeyboardNavigation } from '../../viewer/hooks/useKeyboardNavigation'
import ChessBoard from '../../../shared/chess/ChessBoard'
import EvalBar from '../../viewer/components/EvalBar'
import { useViewerStore } from '../../viewer/store/viewerStore'
import { getProgress, saveProgress } from '../store/readingStore'

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** Given a SAN string, find its FEN across all recognised games */
function fenForSan(san: string, games: ReturnType<typeof recognizeGames>): string | null {
  for (const game of games) {
    for (const node of game.tree.nodes.values()) {
      if (node.san === san && node.fen) return node.fen
    }
  }
  return null
}

// SAN move regex (English notation) — same pattern as sanTokenizer
const SAN_RE =
  /(?<![a-zA-Z])(O-O-O|O-O|[KQRBN][a-h1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?[!?]*|[KQRBN][a-h1-8]?[a-h][1-8](?:=[QRBN])?[+#]?[!?]*|[a-h]x?[a-h][1-8](?:=[QRBN])?[+#]?[!?]*|[a-h][1-8](?:=[QRBN])?[+#]?[!?]*)(?=[^a-zA-Z]|$)/g

export default function BookReader() {
  const { bookId } = useParams<{ bookId: string }>()
  const id = Number(bookId)

  const [currentChapter, setCurrentChapter] = useState<number>(() => {
    const p = getProgress(id)
    return p?.chapter ?? 1
  })
  const [showToc, setShowToc] = useState(false)
  const [showStudy, setShowStudy] = useState(true)
  const [studyInput, setStudyInput] = useState(INITIAL_FEN)

  const studyFenFromStore = useViewerStore((s) => s.studyFen)
  const setStudyFen = useViewerStore((s) => s.setStudyFen)
  const studyFen = studyFenFromStore ?? INITIAL_FEN
  useEffect(() => {
    if (studyFenFromStore) setStudyInput(studyFenFromStore)
  }, [studyFenFromStore])

  const { data, isLoading } = useChapter(id, currentChapter)
  const touchBook = useTouchBook()
  const contentRef = useRef<HTMLDivElement>(null)

  const toc = data?.toc ?? []
  const maxChapter = toc.length > 0 ? Math.max(...toc.map((e) => e.order)) : 1

  useEffect(() => {
    if (id) touchBook.mutate(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    saveProgress(id, currentChapter)
  }, [id, currentChapter])

  const goTo = useCallback((n: number) => {
    setCurrentChapter(n)
    setShowToc(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleFenClick = useCallback((fen: string) => {
    setStudyFen(fen)
    setStudyInput(fen)
    setShowStudy(true)
  }, [setStudyFen])

  const html = data?.html ?? ''
  const plainText = useMemo(
    () => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    [html]
  )
  const games = useMemo(() => recognizeGames(plainText), [plainText])

  const treesMap = useMemo<Map<string, GameTree>>(() => {
    const m = new Map<string, GameTree>()
    games.forEach((g, i) => m.set(`book-${id}-game-${i}`, g.tree))
    return m
  }, [games, id])

  useKeyboardNavigation(treesMap)

  // After HTML renders, walk text nodes and wrap SAN moves with clickable spans
  useEffect(() => {
    const container = contentRef.current
    if (!container || !html) return

    // Remove previous markers
    container.querySelectorAll('span[data-san]').forEach((el) => {
      const parent = el.parentNode
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent ?? ''), el)
        parent.normalize()
      }
    })

    if (games.length === 0) return

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    const textNodes: Text[] = []
    let node: Node | null
    while ((node = walker.nextNode())) {
      // Skip script/style
      const parent = (node as Text).parentElement
      if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) continue
      textNodes.push(node as Text)
    }

    for (const textNode of textNodes) {
      const text = textNode.nodeValue ?? ''
      SAN_RE.lastIndex = 0
      const matches: { start: number; end: number; san: string }[] = []
      let m: RegExpExecArray | null
      while ((m = SAN_RE.exec(text)) !== null) {
        const san = m[1]
        if (fenForSan(san, games)) {
          matches.push({ start: m.index, end: m.index + m[0].length, san: m[0] })
        }
      }
      if (matches.length === 0) continue

      const frag = document.createDocumentFragment()
      let cursor = 0
      for (const match of matches) {
        if (match.start > cursor) {
          frag.appendChild(document.createTextNode(text.slice(cursor, match.start)))
        }
        const span = document.createElement('span')
        span.setAttribute('data-san', match.san.trim())
        span.textContent = match.san
        span.className =
          'cursor-pointer font-medium text-blue-700 underline-offset-2 hover:underline hover:bg-yellow-100 rounded px-0.5'
        span.addEventListener('click', () => {
          const fen = fenForSan(match.san.trim(), games)
          if (fen) handleFenClick(fen)
        })
        frag.appendChild(span)
        cursor = match.end
      }
      if (cursor < text.length) {
        frag.appendChild(document.createTextNode(text.slice(cursor)))
      }
      textNode.parentNode?.replaceChild(frag, textNode)
    }
  }, [html, games, handleFenClick])

  function applyFen() {
    try {
      new Chess(studyInput)
      setStudyFen(studyInput)
    } catch {
      // invalid FEN — ignore
    }
  }

  // Chessboard icon — 4×4 grid SVG
  const ChessboardIcon = () => (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
      <rect x="0" y="0" width="4" height="4" />
      <rect x="8" y="0" width="4" height="4" />
      <rect x="4" y="4" width="4" height="4" />
      <rect x="12" y="4" width="4" height="4" />
      <rect x="0" y="8" width="4" height="4" />
      <rect x="8" y="8" width="4" height="4" />
      <rect x="4" y="12" width="4" height="4" />
      <rect x="12" y="12" width="4" height="4" />
    </svg>
  )

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">

      {/* ── Sticky nav bar ── */}
      <nav className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-4 py-2 shadow-sm backdrop-blur">

        <button
          onClick={() => goTo(currentChapter - 1)}
          disabled={currentChapter <= 1}
          title="Previous chapter"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={() => goTo(currentChapter + 1)}
          disabled={currentChapter >= maxChapter}
          title="Next chapter"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div className="mx-1 h-5 w-px bg-slate-200" />

        <button
          onClick={() => setShowToc((v) => !v)}
          title="Table of contents"
          className={`flex h-9 w-9 items-center justify-center rounded-lg border shadow-sm transition ${
            showToc
              ? 'border-blue-400 bg-blue-50 text-blue-600'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
          </svg>
        </button>

        <span className="ml-2 truncate text-sm font-medium text-slate-700 max-w-[200px]">
          {data?.title ?? '…'}
        </span>
        <span className="ml-auto text-xs text-slate-400 shrink-0">
          {toc.length > 0 ? `${currentChapter} / ${maxChapter}` : ''}
        </span>

        <div className="mx-1 h-5 w-px bg-slate-200" />

        {/* Study board toggle — chessboard grid icon */}
        <button
          onClick={() => setShowStudy((v) => !v)}
          title={showStudy ? 'Hide study board' : 'Show study board'}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border shadow-sm transition ${
            showStudy
              ? 'border-emerald-400 bg-emerald-50 text-emerald-600'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <ChessboardIcon />
        </button>
      </nav>

      {/* ── TOC drawer ── */}
      {showToc && toc.length > 0 && (
        <div className="sticky top-[53px] z-20 border-b border-slate-200 bg-white shadow-md">
          <div className="max-h-72 overflow-y-auto px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Table of Contents</p>
            <ul className="space-y-0.5">
              {toc.map((entry) => (
                <li key={entry.order}>
                  <button
                    onClick={() => goTo(entry.order)}
                    className={`w-full rounded-md px-3 py-1.5 text-left text-sm transition ${
                      entry.order === currentChapter
                        ? 'bg-blue-50 font-semibold text-blue-700'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {entry.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex flex-1 min-h-0">

        {/* Reading pane — always shows original HTML */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto px-6 py-8 min-w-0">
          {isLoading ? (
            <div role="status" className="flex justify-center p-16">
              <span className="sr-only">Loading…</span>
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            </div>
          ) : (
            <div
              ref={contentRef}
              className="prose prose-slate max-w-none
                [&_img]:max-w-full [&_img]:h-auto [&_img]:my-4 [&_img]:rounded
                [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1
                [&_th]:border [&_th]:border-slate-300 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-slate-50"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </main>

        {/* Study board pane — sticky, always mounted, visibility toggled */}
        <aside
          className={`shrink-0 flex flex-col gap-3 border-l border-slate-200 bg-white px-4 py-5 overflow-y-auto transition-all duration-200 ${
            showStudy ? 'w-72 xl:w-80' : 'w-0 overflow-hidden px-0 py-0 border-0'
          }`}
        >
          {showStudy && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 shrink-0">Study Board</p>

              {/* Board */}
              <div className="w-full shrink-0">
                <ChessBoard fen={studyFen} orientation="white" />
              </div>

              {/* Stockfish eval bar */}
              <div className="shrink-0">
                <EvalBar fen={studyFen} />
              </div>

              {/* FEN input */}
              <div className="flex gap-1.5 shrink-0">
                <input
                  value={studyInput}
                  onChange={(e) => setStudyInput(e.target.value)}
                  placeholder="FEN…"
                  className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1.5 text-xs font-mono focus:border-blue-400 focus:outline-none"
                />
                <button
                  onClick={applyFen}
                  className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Set
                </button>
                <button
                  onClick={() => { setStudyFen(INITIAL_FEN); setStudyInput(INITIAL_FEN) }}
                  title="Reset to start position"
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
                >
                  ↺
                </button>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* ── Bottom prev/next ── */}
      <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3 shrink-0">
        <button
          onClick={() => goTo(currentChapter - 1)}
          disabled={currentChapter <= 1}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Previous
        </button>
        <button
          onClick={() => goTo(currentChapter + 1)}
          disabled={currentChapter >= maxChapter}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
        >
          Next
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </footer>
    </div>
  )
}
