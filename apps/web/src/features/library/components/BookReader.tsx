import { useMemo, useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Chess } from 'chess.js'
import { useChapter, useTouchBook } from '../api/libraryApi'
import { recognizeGames } from '@chess-ebook/chess-shared'
import type { GameTree } from '@chess-ebook/chess-shared'
import InlineGame from '../../viewer/components/InlineGame'
import { useKeyboardNavigation } from '../../viewer/hooks/useKeyboardNavigation'
import ChessBoard from '../../../shared/chess/ChessBoard'
import { useViewerStore } from '../../viewer/store/viewerStore'
import { getProgress, saveProgress } from '../store/readingStore'

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export default function BookReader() {
  const { bookId } = useParams<{ bookId: string }>()
  const id = Number(bookId)

  const [currentChapter, setCurrentChapter] = useState<number>(() => {
    const p = getProgress(id)
    return p?.chapter ?? 1
  })
  const [showToc, setShowToc] = useState(false)
  const [showStudy, setShowStudy] = useState(false)
  const [studyInput, setStudyInput] = useState(INITIAL_FEN)

  // Study board FEN from store (set when user clicks a move)
  const studyFenFromStore = useViewerStore((s) => s.studyFen)
  const setStudyFen = useViewerStore((s) => s.setStudyFen)
  const studyFen = studyFenFromStore ?? INITIAL_FEN

  // Sync studyInput when store changes
  useEffect(() => {
    if (studyFenFromStore) setStudyInput(studyFenFromStore)
  }, [studyFenFromStore])

  const { data, isLoading } = useChapter(id, currentChapter)
  const touchBook = useTouchBook()

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

  // When user clicks a move notation → send FEN to study board and show it
  const handleFenClick = useCallback((fen: string) => {
    setStudyFen(fen)
    setStudyInput(fen)
    setShowStudy(true)
  }, [setStudyFen])

  const html = data?.html ?? ''
  const plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const games = useMemo(() => recognizeGames(plainText), [plainText])

  const treesMap = useMemo<Map<string, GameTree>>(() => {
    const m = new Map<string, GameTree>()
    games.forEach((g, i) => m.set(`book-${id}-game-${i}`, g.tree))
    return m
  }, [games, id])

  useKeyboardNavigation(treesMap)

  function applyFen() {
    try {
      new Chess(studyInput)
      setStudyFen(studyInput)
    } catch {
      // invalid FEN — ignore
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">

      {/* ── Sticky nav bar ── */}
      <nav className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white/90 px-4 py-2 shadow-sm backdrop-blur">

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

        <span className="ml-2 truncate text-sm font-medium text-slate-700 max-w-xs">
          {data?.title ?? '…'}
        </span>
        <span className="ml-auto text-xs text-slate-400">
          {toc.length > 0 ? `${currentChapter} / ${maxChapter}` : ''}
        </span>

        <div className="mx-1 h-5 w-px bg-slate-200" />

        <button
          onClick={() => setShowStudy((v) => !v)}
          title={showStudy ? 'Hide study board' : 'Show study board'}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border shadow-sm transition ${
            showStudy
              ? 'border-emerald-400 bg-emerald-50 text-emerald-600'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 22H5v-2h14v2M13 2c-1.1 0-2 .9-2 2 0 .56.23 1.05.59 1.41C9.42 6.46 8 8.58 8 11c0 1.38.47 2.63 1.24 3.62L8 16h8l-1.24-1.38C15.53 13.63 16 12.38 16 11c0-2.42-1.42-4.54-3.59-5.59C12.77 5.05 13 4.56 13 4c0-1.1-.9-2-2-2z" />
          </svg>
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
      <div className={`flex flex-1 gap-0 ${showStudy ? 'divide-x divide-slate-200' : ''}`}>

        {/* Reading pane */}
        <main className={`flex-1 overflow-x-hidden px-6 py-8 ${showStudy ? 'min-w-0' : 'max-w-3xl mx-auto w-full'}`}>
          {isLoading ? (
            <div role="status" className="flex justify-center p-16">
              <span className="sr-only">Loading…</span>
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            </div>
          ) : games.length === 0 ? (
            <div
              className="prose prose-slate max-w-none [&_img]:max-w-full [&_img]:h-auto [&_img]:my-4 [&_img]:rounded"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <div className="space-y-6">
              {games.map((game, i) => {
                const treeId = `book-${id}-game-${i}`
                return (
                  <InlineGame
                    key={treeId}
                    treeId={treeId}
                    game={game}
                    fullText={plainText}
                    onFenClick={handleFenClick}
                  />
                )
              })}
            </div>
          )}
        </main>

        {/* Study board pane */}
        {showStudy && (
          <aside className="w-80 shrink-0 flex flex-col gap-4 bg-white px-4 py-6 xl:w-96">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Study Board</p>
            <div className="w-full">
              <ChessBoard fen={studyFen} orientation="white" />
            </div>
            <div className="flex gap-2">
              <input
                value={studyInput}
                onChange={(e) => setStudyInput(e.target.value)}
                placeholder="FEN…"
                className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1.5 text-xs font-mono focus:border-blue-400 focus:outline-none"
              />
              <button
                onClick={applyFen}
                className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
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
          </aside>
        )}
      </div>

      {/* ── Bottom prev/next ── */}
      <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3">
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
