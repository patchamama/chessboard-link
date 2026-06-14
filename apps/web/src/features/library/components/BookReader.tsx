import { useMemo, useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useChapter, useTouchBook } from '../api/libraryApi'
import { recognizeGames, figurineToAscii } from '@chess-ebook/chess-shared'
import type { GameTree, GameNode } from '@chess-ebook/chess-shared'
import { useKeyboardNavigation } from '../../viewer/hooks/useKeyboardNavigation'
import { StudyBoard } from './StudyBoard'
import { VariationChooser } from './VariationChooser'
import { useStudyBoardStore } from '../store/studyBoardStore'
import { getProgress, saveProgress } from '../store/readingStore'
import { useSettingsStore } from '../../../shared/settings/settingsStore'
import { successorOf, hasAlternativesAhead, variationLinesFrom } from '../utils/proseChess'

interface ProseChooser {
  top: number
  left: number
  tree: GameTree
  successorId: string
  siblingLines: string[][]
}

interface ResolvedNode {
  tree: GameTree
  node: GameNode
  gameIndex: number
}

/** Strip trailing move annotations (!, ?, !!, ?!, …) so a DOM token matches the
 *  canonical `node.san` (chess.js strips annotations). */
function cleanSan(san: string): string {
  return figurineToAscii(san).trim().replace(/[!?]+$/, '')
}

/**
 * Ordered node resolver. Builds a flat list of every valid recognised node across
 * all games, sorted by source offset, and hands them out IN ORDER per SAN. This
 * maps the i-th DOM occurrence of a SAN to the i-th recognised node with that SAN,
 * so a move that repeats in the text highlights the correct position.
 */
function createNodeResolver(games: ReturnType<typeof recognizeGames>) {
  const bySan = new Map<string, ResolvedNode[]>()
  games.forEach((game, gameIndex) => {
    const nodes = [...game.tree.nodes.values()]
      .filter((n) => n.fen && !n.invalid)
      .sort((a, b) => (a.charStart ?? 0) - (b.charStart ?? 0))
    for (const node of nodes) {
      const list = bySan.get(node.san) ?? []
      list.push({ tree: game.tree, node, gameIndex })
      bySan.set(node.san, list)
    }
  })
  const cursor = new Map<string, number>()
  return {
    /** peek whether any node exists for this SAN (does not consume) */
    has(asciiSan: string): boolean {
      return (bySan.get(asciiSan)?.length ?? 0) > 0
    },
    /** consume the next node for this SAN in source order */
    next(asciiSan: string): ResolvedNode | null {
      const list = bySan.get(asciiSan)
      if (!list || list.length === 0) return null
      const i = cursor.get(asciiSan) ?? 0
      const resolved = list[Math.min(i, list.length - 1)]
      cursor.set(asciiSan, i + 1)
      return resolved
    },
  }
}

// SAN move regex — same as sanTokenizer but the piece class also accepts
// Unicode chess figurines (♔♚♕♛♖♜♗♝♘♞) so glyph notation in prose is matched.
const P = 'KQRBN♔♚♕♛♖♜♗♝♘♞'
const SAN_RE = new RegExp(
  `(?<![a-zA-Z])(O-O-O|O-O|[${P}][a-h1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?[!?]*|[${P}][a-h1-8]?[a-h][1-8](?:=[QRBN])?[+#]?[!?]*|[a-h]x?[a-h][1-8](?:=[QRBN])?[+#]?[!?]*|[a-h][1-8](?:=[QRBN])?[+#]?[!?]*)(?=[^a-zA-Z]|$)`,
  'g',
)

export default function BookReader() {
  const { bookId } = useParams<{ bookId: string }>()
  const id = Number(bookId)

  const [currentChapter, setCurrentChapter] = useState<number>(() => {
    const p = getProgress(id)
    return p?.chapter ?? 1
  })
  const [showToc, setShowToc] = useState(false)
  const [showStudy, setShowStudy] = useState(true)
  const [chooser, setChooser] = useState<ProseChooser | null>(null)

  const loadStudyPosition = useStudyBoardStore((s) => s.loadPosition)
  const epub = useSettingsStore((s) => s.epub)
  const fontSize = useSettingsStore((s) => s.fontSize)

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

  const loadStudyNode = useCallback(
    (tree: GameTree, node: GameNode) => {
      loadStudyPosition(tree, node.id, !tree.mainline.includes(node.id))
      setShowStudy(true)
    },
    [loadStudyPosition],
  )

  const rawHtml = data?.html ?? ''

  // Rewrite relative img/image src paths to the backend image endpoint
  const html = useMemo(() => {
    if (!rawHtml || !id) return rawHtml
    const rewrite = (_match: string, _dots: string, imgPath: string) =>
      `src="/api/library/books/${id}/images/${imgPath}"`
    return rawHtml
      // <img src="../Images/x.jpg">
      .replace(/src=["'](?!data:|https?:|\/)(\.\.\/)*([^"']+)["']/g, rewrite)
      // SVG <image xlink:href="../Images/x.jpg"> or href="..."
      .replace(/(xlink:href|href)=["'](?!data:|https?:|#|\/)(\.\.\/)*([^"']+\.(jpe?g|png|gif|webp|svg))["']/gi,
        (_m, attr, _d, imgPath) => `${attr}="/api/library/books/${id}/images/${imgPath}"`)
  }, [rawHtml, id])

  const plainText = useMemo(
    () => rawHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    [rawHtml]
  )
  const games = useMemo(() => recognizeGames(plainText), [plainText])

  const treesMap = useMemo<Map<string, GameTree>>(() => {
    const m = new Map<string, GameTree>()
    games.forEach((g, i) => m.set(`book-${id}-game-${i}`, g.tree))
    return m
  }, [games, id])

  useKeyboardNavigation(treesMap)

  const activeNodeId = useStudyBoardStore((s) => s.currentNodeId)
  const activeGame = useStudyBoardStore((s) => s.activeGame)
  // node ids are only unique WITHIN a game (the counter resets per game), so the
  // same "node-1" exists in every recognised game. Identify the active game so a
  // click highlights only the clicked occurrence, not every game's "node-1".
  const activeGameIndex = useMemo(
    () => games.findIndex((g) => g.tree === activeGame),
    [games, activeGame],
  )
  // Composite, globally-unique span key.
  const activeSpanKey = activeNodeId !== null && activeGameIndex >= 0
    ? `${activeGameIndex}:${activeNodeId}`
    : null

  // After the HTML renders (and on every re-render that restores it), wrap SAN
  // moves in clickable spans and highlight the move currently active on the
  // study board. Wrapping and highlighting live in ONE effect because React's
  // dangerouslySetInnerHTML restores the raw HTML on re-render, wiping spans —
  // so we must re-wrap before re-highlighting.
  useEffect(() => {
    const container = contentRef.current
    if (!container || !html) return

    // Remove previous markers (idempotent re-wrap).
    container.querySelectorAll('span[data-san]').forEach((el) => {
      const parent = el.parentNode
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent ?? ''), el)
        parent.normalize()
      }
    })

    if (games.length > 0) {
      const resolver = createNodeResolver(games)
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
      const textNodes: Text[] = []
      let node: Node | null
      while ((node = walker.nextNode())) {
        const parent = (node as Text).parentElement
        if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) continue
        textNodes.push(node as Text)
      }

      for (const textNode of textNodes) {
        const text = textNode.nodeValue ?? ''
        SAN_RE.lastIndex = 0
        // start = wrap start (may include a glued move number), san = the SAN group,
        // wrapText = the visible text (number + SAN).
        const matches: { start: number; end: number; san: string; wrapText: string }[] = []
        let m: RegExpExecArray | null
        let prevEnd = 0
        while ((m = SAN_RE.exec(text)) !== null) {
          if (!resolver.has(cleanSan(m[1]))) continue
          // Glue an immediately-preceding move number ("19." / "20...") onto the
          // move when only whitespace separates them, within the same text node.
          let wrapStart = m.index
          const before = text.slice(prevEnd, m.index)
          const numMatch = /(\d+\.(?:\.\.)?)\s*$/.exec(before)
          if (numMatch) wrapStart = prevEnd + numMatch.index
          matches.push({
            start: wrapStart,
            end: m.index + m[0].length,
            san: m[1],
            wrapText: text.slice(wrapStart, m.index + m[0].length),
          })
          prevEnd = m.index + m[0].length
        }
        if (matches.length === 0) continue

        const frag = document.createDocumentFragment()
        let cursor = 0
        for (const match of matches) {
          if (match.start > cursor) {
            frag.appendChild(document.createTextNode(text.slice(cursor, match.start)))
          }
          // Resolve the SPECIFIC node for this occurrence (by SAN only).
          const resolved = resolver.next(cleanSan(match.san))
          const span = document.createElement('span')
          span.setAttribute('data-san', cleanSan(match.san))
          let isActive = false
          let hasAlt = false
          if (resolved) {
            // Composite key so identical node ids across games don't collide.
            const spanKey = `${resolved.gameIndex}:${resolved.node.id}`
            span.setAttribute('data-node-id', spanKey)
            span.setAttribute('data-game-index', String(resolved.gameIndex))
            isActive = spanKey === activeSpanKey
            hasAlt = hasAlternativesAhead(resolved.tree, resolved.node)
            const captured = resolved
            span.addEventListener('click', (e) => {
              if (hasAlt) {
                e.stopPropagation()
                // The fork is AT this node: mainline successor vs. variation lines.
                const successorId = successorOf(captured.tree, captured.node)
                if (!successorId) return
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                setChooser({
                  top: rect.bottom + 4,
                  left: rect.left,
                  tree: captured.tree,
                  successorId,
                  siblingLines: variationLinesFrom(captured.tree, captured.node),
                })
              } else {
                loadStudyNode(captured.tree, captured.node)
              }
            })
          }
          span.textContent = match.wrapText
          const base = isActive
            ? 'cursor-pointer font-bold bg-yellow-300 rounded px-0.5'
            : 'cursor-pointer font-medium text-blue-700 underline-offset-2 hover:bg-yellow-100 rounded px-0.5'
          // A persistent dotted underline signals "this move has alternatives — click to choose".
          span.className = hasAlt ? `${base} underline decoration-dotted decoration-2` : base
          frag.appendChild(span)
          cursor = match.end
        }
        if (cursor < text.length) {
          frag.appendChild(document.createTextNode(text.slice(cursor)))
        }
        textNode.parentNode?.replaceChild(frag, textNode)
      }
    }

    // Scroll the active move into view, if present.
    if (activeSpanKey) {
      const el = container.querySelector(`span[data-node-id="${CSS.escape(activeSpanKey)}"]`)
      el?.scrollIntoView?.({ block: 'nearest' })
    }
  }, [html, games, loadStudyNode, activeSpanKey])

  const pickChooser = useCallback(
    (targetId: string, isVariation: boolean) => {
      if (!chooser) return
      loadStudyPosition(chooser.tree, targetId, isVariation)
      setShowStudy(true)
      setChooser(null)
    },
    [chooser, loadStudyPosition],
  )

  // Scoped CSS for EPUB rendering based on user settings
  const epubCss = `
    .epub-content h1 { font-weight: ${epub.h1.bold ? '700' : '400'}; font-style: ${epub.h1.italic ? 'italic' : 'normal'}; font-size: ${fontSize + epub.h1.sizeDelta}px; margin: 1.2em 0 0.4em; }
    .epub-content h2 { font-weight: ${epub.h2.bold ? '700' : '400'}; font-style: ${epub.h2.italic ? 'italic' : 'normal'}; font-size: ${fontSize + epub.h2.sizeDelta}px; margin: 1em 0 0.3em; }
    .epub-content h3 { font-weight: ${epub.h3.bold ? '700' : '400'}; font-style: ${epub.h3.italic ? 'italic' : 'normal'}; font-size: ${fontSize + epub.h3.sizeDelta}px; margin: 0.9em 0 0.3em; }
    .epub-content h4 { font-weight: ${epub.h4.bold ? '700' : '400'}; font-style: ${epub.h4.italic ? 'italic' : 'normal'}; font-size: ${fontSize + epub.h4.sizeDelta}px; margin: 0.8em 0 0.2em; }
    .epub-content h5 { font-weight: ${epub.h5.bold ? '700' : '400'}; font-style: ${epub.h5.italic ? 'italic' : 'normal'}; font-size: ${fontSize + epub.h5.sizeDelta}px; margin: 0.7em 0 0.2em; }
    .epub-content p  { margin-bottom: ${epub.paragraphSpacing}rem; text-indent: ${epub.paragraphIndent}rem; line-height: 1.7; }
    .epub-content hr { border: none; border-top: 1px solid #cbd5e1; margin: 1.5em 0; }
    .epub-content img { max-width: 100%; height: auto; display: block; margin: 1rem ${epub.imageAlign === 'center' ? 'auto' : epub.imageAlign === 'right' ? '0 0 auto' : '0 auto 0 0'}; border-radius: 4px; }
    .epub-content ul { list-style: disc; padding-left: 1.5rem; margin-bottom: ${epub.paragraphSpacing}rem; }
    .epub-content ol { list-style: decimal; padding-left: 1.5rem; margin-bottom: ${epub.paragraphSpacing}rem; }
    .epub-content li { margin-bottom: 0.25rem; line-height: 1.6; }
    .epub-content blockquote { border-left: 3px solid #94a3b8; padding-left: 1rem; margin: 1rem 0; color: #64748b; font-style: italic; }
    .epub-content table { border-collapse: collapse; width: 100%; margin-bottom: ${epub.paragraphSpacing}rem; }
    .epub-content td, .epub-content th { border: 1px solid #cbd5e1; padding: 0.4rem 0.6rem; }
    .epub-content th { background: #f1f5f9; font-weight: 600; }
  `

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
      <style dangerouslySetInnerHTML={{ __html: epubCss }} />

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
              className="epub-content max-w-none"
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
          {showStudy && <StudyBoard />}
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

      {/* Prose variation chooser — anchored under the clicked move */}
      {chooser && (
        <div className="fixed z-50" style={{ top: chooser.top, left: chooser.left }}>
          <VariationChooser
            tree={chooser.tree}
            mainlineId={chooser.successorId}
            siblingLines={chooser.siblingLines}
            onPickMainline={() => pickChooser(chooser.successorId, false)}
            onPickLine={(i) => pickChooser(chooser.siblingLines[i][0], true)}
            onClose={() => setChooser(null)}
          />
        </div>
      )}
    </div>
  )
}
