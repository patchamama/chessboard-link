import { useMemo, useEffect, useState, useCallback, useRef, memo, forwardRef } from 'react'
import { useParams } from 'react-router-dom'
import { useChapter, useTouchBook } from '../api/libraryApi'
import { recognizeGames, figurineToAscii } from '@chess-ebook/chess-shared'
import type { GameTree, GameNode, IsolatedMove } from '@chess-ebook/chess-shared'
import ChessBoardThemed from '../../../shared/chess/ChessBoard'
import { StudyBoard } from './StudyBoard'
import { StudyPanelResizer } from './StudyPanelResizer'
import { VariationChooser } from './VariationChooser'
import { useStudyBoardStore } from '../store/studyBoardStore'
import { getProgress, saveProgress } from '../store/readingStore'
import { useSettingsStore } from '../../../shared/settings/settingsStore'
import { successorOf, hasAlternativesAhead, variationLinesFrom } from '../utils/proseChess'
import { useBookConfig } from '../../../shared/bookConfig/useBookConfig'
import { buildBookConfigCss } from '../utils/bookConfigCss'
import { isMoveLine } from '../utils/isMoveLine'
import { BookConfigEditor } from './BookConfigEditor'
import { useAuthStore } from '../../auth/store/authStore'
import { RecognitionErrorPanel, type FlatError } from './RecognitionErrorPanel'
import { RecognitionDebugPanel } from './RecognitionDebugPanel'
import { isDevMode } from '../../../shared/env/devMode'
import { createRoot, type Root } from 'react-dom/client'
import { DiagramImage } from './DiagramImage'
import { inferDiagramFen } from '../utils/inferDiagramFen'

// The reading pane's innerHTML is set ONCE per chapter and then mutated
// imperatively (SAN spans, highlight classes) by effects. If React re-rendered
// this div on every parent state change (click, hover tooltip, variation
// chooser), its dangerouslySetInnerHTML commit would RESET the innerHTML to the
// raw `html` string — wiping every span and class we injected, which killed all
// highlights and interactions. memo() on `html` keeps React's hands off the
// subtree: it only re-commits when the chapter content actually changes.
const ProseContent = memo(
  forwardRef<HTMLDivElement, { html: string }>(function ProseContent({ html }, ref) {
    return (
      <div
        ref={ref}
        className="epub-content max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }),
)

interface ProseChooser {
  top: number
  left: number
  tree: GameTree
  successorId: string
  siblingLines: string[][]
}

interface MoveTooltip {
  top: number
  left: number
  fen: string
  lastMove: { from: string; to: string } | null
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

/** A resolved SAN occurrence: either a reproducible game move or an isolated one. */
type ResolvedSan =
  | { kind: 'node'; value: ResolvedNode }
  | { kind: 'iso'; value: IsolatedMove }

/**
 * Unified, source-ordered SAN resolver.
 *
 * The DOM and the recognised game stream visit the SAME SAN tokens in the SAME
 * order. So the i-th DOM occurrence of a SAN must map to the i-th recognised
 * occurrence of that SAN — REGARDLESS of whether it is a real move or an isolated
 * prose move. The previous design kept two independent cursors (real vs isolated)
 * which desynced: an isolated `d4` in one paragraph would consume a REAL `d4`
 * node belonging to a different game later in the chapter, painting prose as a
 * playable move. Here every occurrence (node or isolated), across all games, is
 * merged into ONE list per SAN, ordered by charStart, and handed out in order.
 */
export function createSanResolver(games: ReturnType<typeof recognizeGames>) {
  type Entry = {
    charStart: number
    resolved: ResolvedSan
    /** For node entries: the authoritative move number/color from the tree. */
    moveNumber?: number
    color?: 'white' | 'black'
  }
  const bySan = new Map<string, Entry[]>()

  const push = (san: string, charStart: number, resolved: ResolvedSan, moveNumber?: number, color?: 'white' | 'black') => {
    const list = bySan.get(san) ?? []
    list.push({ charStart, resolved, moveNumber, color })
    bySan.set(san, list)
  }

  games.forEach((game, gameIndex) => {
    for (const node of game.tree.nodes.values()) {
      if (!node.fen || node.invalid) continue
      push(
        node.san,
        node.charStart ?? 0,
        { kind: 'node', value: { tree: game.tree, node, gameIndex } },
        node.moveNumber,
        node.color,
      )
    }
    for (const iso of game.tree.isolatedMoves) {
      push(cleanSan(iso.san), iso.charStart ?? 0, { kind: 'iso', value: iso })
    }
  })

  // Order each SAN's occurrences by their position in the source text so the
  // sequence matches the DOM walk order.
  for (const list of bySan.values()) list.sort((a, b) => a.charStart - b.charStart)

  // Track which entries are already consumed (so each node maps to ONE DOM span).
  const used = new Set<Entry>()
  return {
    /**
     * Resolve a DOM occurrence of `asciiSan` to a recognised entry. THE NUMBER IS
     * AUTHORITATIVE: when the DOM token carries a move number (e.g. "9..."), only
     * a node with that exact (moveNumber,color) may match — this prevents a
     * "11... Nb6" in prose from being painted as the mainline "9... Nb6". When no
     * number is present, fall back to next-in-source-order.
     */
    nextKeyed(asciiSan: string, moveNumber: number | null, color: 'white' | 'black' | null): ResolvedSan | null {
      const list = bySan.get(asciiSan)
      if (!list || list.length === 0) return null
      if (moveNumber !== null && color !== null) {
        // Exact (number,color) match, first unused, in source order.
        const hit = list.find(
          (e) => !used.has(e) && e.moveNumber === moveNumber && e.color === color,
        )
        if (hit) { used.add(hit); return hit.resolved }
        return null // numbered token with no matching node → leave as plain text
      }
      // No number on the DOM token: next unused in order (isolated/bare moves).
      const next = list.find((e) => !used.has(e))
      if (next) { used.add(next); return next.resolved }
      return null
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
  const [tooltip, setTooltip] = useState<MoveTooltip | null>(null)
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Stable ref so the wrapping effect can call setTooltip without being in deps.
  const setTooltipRef = useRef(setTooltip)

  const loadStudyPosition = useStudyBoardStore((s) => s.loadPosition)
  const setIsolatedHighlight = useStudyBoardStore((s) => s.setIsolatedHighlight)
  const epub = useSettingsStore((s) => s.epub)
  const studyPanelWidth = useSettingsStore((s) => s.studyPanelWidth)
  const fontSize = useSettingsStore((s) => s.fontSize)
  const { config: bookConfig } = useBookConfig(id)
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin')
  // The recognition debug tooling shows for admins OR in any developer context
  // (Vite dev build / localhost), so you can use it without an admin login.
  const showDebugTools = isAdmin || isDevMode()
  const [showBookConfig, setShowBookConfig] = useState(false)

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

  // Navigate the prose to the move that triggered a recognition error. Find the
  // first text occurrence of its written notation and scroll/flash it.
  const navigateToError = useCallback((err: FlatError) => {
    const container = contentRef.current
    if (!container) return
    setShowErrors(false)
    const needle = err.rawSan ?? err.san
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    let node: Node | null
    while ((node = walker.nextNode())) {
      const idx = (node.nodeValue ?? '').indexOf(needle)
      if (idx >= 0) {
        const range = document.createRange()
        range.setStart(node, idx)
        range.setEnd(node, idx + needle.length)
        const rect = range.getBoundingClientRect()
        const el = (node.parentElement ?? container)
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Brief highlight flash on the surrounding element.
        const prev = el.style.backgroundColor
        el.style.transition = 'background-color 0.4s'
        el.style.backgroundColor = 'rgba(251, 191, 36, 0.5)'
        window.setTimeout(() => { el.style.backgroundColor = prev }, 1400)
        void rect
        return
      }
    }
  }, [])

  // Stable refs for callbacks used inside the wrapping effect (stable deps = no re-wrap on click).
  const loadStudyNodeRef = useRef(loadStudyNode)
  const setChooserRef = useRef(setChooser)
  const setIsolatedHighlightRef = useRef(setIsolatedHighlight)
  useEffect(() => { setIsolatedHighlightRef.current = setIsolatedHighlight }, [setIsolatedHighlight])

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

  // Flatten HTML to text for move recognition. Block-level boundaries become
  // NEWLINES so the recognizer can use "a move that starts a paragraph resumes
  // the mainline" (its strongest mainline signal). Inline tags become spaces.
  const plainText = useMemo(
    () =>
      rawHtml
        // Close/open of block elements → a paragraph break.
        .replace(/<\/(p|div|h[1-6]|li|blockquote|tr|section|article)\s*>/gi, '\n')
        .replace(/<(br|hr)\s*\/?>/gi, '\n')
        // Any remaining tag → a single space.
        .replace(/<[^>]+>/g, ' ')
        // Collapse spaces/tabs but PRESERVE newlines; collapse runs of newlines.
        .replace(/[^\S\n]+/g, ' ')
        .replace(/ *\n+ */g, '\n')
        .trim(),
    [rawHtml]
  )
  const recognitionAlgorithm = useSettingsStore((s) => s.recognitionAlgorithm)
  const games = useMemo(
    () => recognizeGames(plainText, { algorithm: recognitionAlgorithm }),
    [plainText, recognitionAlgorithm],
  )

  // When the algorithm changes the recognised trees are rebuilt, so any game
  // open in the study board points at a stale tree. Close it so the viewer and
  // the debug panel always reflect the SAME algorithm.
  const clearStudyGame = useStudyBoardStore((s) => s.clearGame)
  useEffect(() => {
    clearStudyGame()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recognitionAlgorithm])

  // Flatten every game's recognition errors for the error panel.
  const recognitionErrors = useMemo<FlatError[]>(
    () =>
      games.flatMap((g, gameIndex) =>
        g.tree.errors.map((e) => ({ ...e, gameIndex })),
      ),
    [games],
  )
  const [showErrors, setShowErrors] = useState(false)

  // Keep refs in sync so the wrapping effect (stable deps) always calls latest version.
  useEffect(() => { loadStudyNodeRef.current = loadStudyNode }, [loadStudyNode])
  useEffect(() => { setChooserRef.current = setChooser }, [setChooser])

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

  // Registry mapping a span key → its resolved game move, rebuilt on every wrap.
  // Event handlers (delegated, mounted once) look up rich objects here by the
  // span's data-node-id, so re-wrapping never detaches behaviour from spans.
  const moveRegistry = useRef(new Map<string, ResolvedNode>())
  // Registry for isolated prose moves: span key → { square, piece }.
  const isoRegistry = useRef(new Map<string, IsolatedMove>())

  // Wraps SAN moves in spans. Re-runs ONLY when the content changes (new
  // chapter), NOT on click/hover — the active-move highlight is a separate,
  // cheap effect below that just toggles a class. This keeps the heavy DOM
  // surgery out of the click path, so opening the tooltip / variation chooser
  // never re-wraps (and never wipes) the prose.
  useEffect(() => {
    const container = contentRef.current
    if (!container || !html) return

    // Remove previous markers (idempotent re-wrap) — moves and isolated tokens.
    container.querySelectorAll('span[data-san], span[data-iso-square]').forEach((el) => {
      const parent = el.parentNode
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent ?? ''), el)
        parent.normalize()
      }
    })

    moveRegistry.current.clear()
    isoRegistry.current.clear()

    // Mark paragraphs that begin with a chess move/annotation so the config CSS
    // can zero their first-line indent. Idempotent: clears the class first.
    container.querySelectorAll('p.move-line').forEach((p) => p.classList.remove('move-line'))
    if (bookConfig.moveLineIndent.zeroIndent) {
      container.querySelectorAll('p').forEach((p) => {
        if (isMoveLine(p.textContent ?? '')) p.classList.add('move-line')
      })
    }

    if (games.length > 0) {
      const resolver = createSanResolver(games)
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
      const textNodes: Text[] = []
      let n: Node | null
      while ((n = walker.nextNode())) {
        const parent = (n as Text).parentElement
        if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) continue
        textNodes.push(n as Text)
      }

      let isoSeq = 0
      for (const textNode of textNodes) {
        const text = textNode.nodeValue ?? ''
        SAN_RE.lastIndex = 0
        const matches: { start: number; end: number; san: string; wrapText: string }[] = []
        let m: RegExpExecArray | null
        let prevEnd = 0
        while ((m = SAN_RE.exec(text)) !== null) {
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
          const ascii = cleanSan(match.san)
          // Extract the move number/color from the wrapped token ("9... ♘b6" →
          // 9, black). The NUMBER is authoritative for the match.
          const numM = /^(\d+)(\.\.\.|\.)/.exec(match.wrapText.trim())
          const moveNumber = numM ? parseInt(numM[1], 10) : null
          const color: 'white' | 'black' | null = numM ? (numM[2] === '...' ? 'black' : 'white') : null
          const resolved = resolver.nextKeyed(ascii, moveNumber, color)

          if (!resolved) {
            // Neither a game move nor isolated — leave as plain text.
            frag.appendChild(document.createTextNode(text.slice(match.start, match.end)))
            cursor = match.end
            continue
          }

          if (resolved.kind === 'iso') {
            // Isolated prose move (—d5—, "casilla e4", "Cb5") → board-square highlight.
            const iso = resolved.value
            const isoKey = `iso-${isoSeq++}`
            isoRegistry.current.set(isoKey, iso)
            const span = document.createElement('span')
            span.setAttribute('data-iso-square', iso.square)
            span.setAttribute('data-iso-key', isoKey)
            span.textContent = match.wrapText
            span.className =
              'cursor-pointer rounded px-0.5 font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 ring-1 ring-amber-300'
            span.title = `Casilla ${iso.square} (jugada aislada)`
            frag.appendChild(span)
            cursor = match.end
            continue
          }

          const rn = resolved.value
          const spanKey = `${rn.gameIndex}:${rn.node.id}`
          moveRegistry.current.set(spanKey, rn)
          const hasAlt = hasAlternativesAhead(rn.tree, rn.node)
          const span = document.createElement('span')
          span.setAttribute('data-san', ascii)
          span.setAttribute('data-node-id', spanKey)
          span.setAttribute('data-game-index', String(rn.gameIndex))
          span.setAttribute('data-has-alt', hasAlt ? '1' : '0')
          span.setAttribute('data-fen', rn.node.fen)
          if (rn.node.from) span.setAttribute('data-from', rn.node.from)
          if (rn.node.to) span.setAttribute('data-to', rn.node.to)
          span.textContent = match.wrapText
          // Inactive base styling; the active highlight is applied separately.
          const baseClass =
            'cursor-pointer font-medium text-blue-700 underline-offset-2 hover:bg-yellow-100 rounded px-0.5'
          span.className = hasAlt ? `${baseClass} underline decoration-dotted decoration-2` : baseClass

          frag.appendChild(span)
          cursor = match.end
        }
        if (cursor < text.length) {
          frag.appendChild(document.createTextNode(text.slice(cursor)))
        }
        textNode.parentNode?.replaceChild(frag, textNode)
      }
    }
  }, [html, games, bookConfig.moveLineIndent.zeroIndent])

  // Wrap each book diagram <img> with an interactive DiagramImage overlay
  // (original ↔ autogenerated board toggle + eval footer + config menu). The
  // image's FEN is inferred from the mainline moves that precede it in the text.
  const diagramRoots = useRef<Root[]>([])
  useEffect(() => {
    const container = contentRef.current
    if (!container) return

    // Tear down any previously-mounted overlays before re-mounting.
    diagramRoots.current.forEach((r) => r.unmount())
    diagramRoots.current = []

    const images = Array.from(container.querySelectorAll('img')).filter(
      (img) => !img.closest('[data-diagram-overlay]'),
    )

    for (const img of images) {
      // Character offset of this image = length of all text before it in the DOM.
      const range = document.createRange()
      range.setStart(container, 0)
      range.setEndBefore(img)
      const offset = range.toString().length

      const fen = inferDiagramFen(games, offset)
      const src = img.getAttribute('src') ?? ''
      const alt = img.getAttribute('alt') ?? 'diagram'

      const mount = document.createElement('span')
      mount.setAttribute('data-diagram-overlay', '1')
      img.replaceWith(mount)

      const root = createRoot(mount)
      root.render(<DiagramImage src={src} alt={alt} fen={fen} />)
      diagramRoots.current.push(root)
    }

    return () => {
      diagramRoots.current.forEach((r) => r.unmount())
      diagramRoots.current = []
    }
  }, [html, games])

  // Active-move highlight — cheap class toggle, decoupled from wrapping. Runs on
  // every active-node change WITHOUT touching the DOM structure, so clicks and
  // the tooltip/chooser never disturb the wrapped prose.
  useEffect(() => {
    const container = contentRef.current
    if (!container) return
    container.querySelectorAll('span[data-node-id]').forEach((el) => {
      const span = el as HTMLElement
      const active = span.dataset.nodeId === activeSpanKey
      span.classList.toggle('font-bold', active)
      span.classList.toggle('bg-yellow-300', active)
      // Keep the link colour only while inactive (active is yellow + bold).
      span.classList.toggle('text-blue-700', !active)
      if (active) span.scrollIntoView?.({ block: 'nearest' })
    })
  }, [activeSpanKey, html, games])

  // Delegated pointer/click handlers — mounted ONCE on the content container.
  // They read data-* attributes + the registries, so re-wrapping spans (which
  // destroys per-span listeners) never breaks hover tooltips or clicks.
  useEffect(() => {
    const container = contentRef.current
    if (!container) return

    const findSpan = (target: EventTarget | null): HTMLElement | null => {
      let el = target as HTMLElement | null
      while (el && el !== container) {
        if (el.dataset.nodeId || el.dataset.isoKey) return el
        el = el.parentElement
      }
      return null
    }

    const onOver = (e: Event) => {
      const span = findSpan(e.target)
      if (!span) return
      // Isolated prose move → preview its square on the study board on hover.
      const isoKey = span.dataset.isoKey
      if (isoKey) {
        const iso = isoRegistry.current.get(isoKey)
        if (iso) setIsolatedHighlightRef.current({ square: iso.square, piece: iso.piece })
        return
      }
      const fen = span.dataset.fen
      if (!fen) return
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
      const from = span.dataset.from
      const to = span.dataset.to
      tooltipTimer.current = setTimeout(() => {
        const rect = span.getBoundingClientRect()
        setTooltipRef.current({
          top: rect.bottom + 6,
          left: rect.left,
          fen,
          lastMove: from && to ? { from, to } : null,
        })
      }, 200)
    }

    const onOut = (e: Event) => {
      const span = findSpan(e.target)
      if (!span || !span.dataset.fen) return
      // Don't hide if moving into the tooltip itself.
      const related = (e as MouseEvent).relatedTarget as HTMLElement | null
      if (related?.closest?.('[data-move-tooltip]')) return
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
      tooltipTimer.current = setTimeout(() => setTooltipRef.current(null), 150)
    }

    const onClick = (e: Event) => {
      const span = findSpan(e.target)
      if (!span) return
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
      setTooltipRef.current(null)

      // Isolated prose move → highlight its square on the study board.
      const isoKey = span.dataset.isoKey
      if (isoKey) {
        const iso = isoRegistry.current.get(isoKey)
        if (iso) setIsolatedHighlightRef.current({ square: iso.square, piece: iso.piece })
        return
      }

      const spanKey = span.dataset.nodeId
      if (!spanKey) return
      const resolved = moveRegistry.current.get(spanKey)
      if (!resolved) return
      const hasAlt = span.dataset.hasAlt === '1'
      if (hasAlt) {
        e.stopPropagation()
        const successorId = successorOf(resolved.tree, resolved.node)
        if (!successorId) return
        const rect = span.getBoundingClientRect()
        setChooserRef.current({
          top: rect.bottom + 4,
          left: rect.left,
          tree: resolved.tree,
          successorId,
          siblingLines: variationLinesFrom(resolved.tree, resolved.node),
        })
      } else {
        loadStudyNodeRef.current(resolved.tree, resolved.node)
      }
    }

    container.addEventListener('mouseover', onOver)
    container.addEventListener('mouseout', onOut)
    container.addEventListener('click', onClick)
    return () => {
      container.removeEventListener('mouseover', onOver)
      container.removeEventListener('mouseout', onOut)
      container.removeEventListener('click', onClick)
    }
    // Re-bind when the content container (re)mounts. It does NOT exist on the
    // first render while the chapter is loading (isLoading=true), so binding
    // once with [] would attach to nothing. Re-run once the div appears.
  }, [isLoading, html])

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
    ${buildBookConfigCss(bookConfig, epub, fontSize)}
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

        {/* Book config editor — admin / dev-bypass only */}
        {isAdmin && (
          <button
            onClick={() => setShowBookConfig(true)}
            title="Edit book render config"
            aria-label="Edit book render config"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}

        {/* Recognition errors — only when there are any. */}
        {recognitionErrors.length > 0 && (
          <button
            onClick={() => setShowErrors(true)}
            title={`Mostrar ${recognitionErrors.length} error(es) de reconocimiento`}
            aria-label="Mostrar errores de reconocimiento"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-amber-300 bg-amber-50 text-amber-700 shadow-sm transition hover:bg-amber-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
              {recognitionErrors.length}
            </span>
          </button>
        )}
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
            <ProseContent ref={contentRef} html={html} />
          )}
        </main>

        {/* Drag handle to resize the study panel — only while it's visible. */}
        {showStudy && <StudyPanelResizer />}

        {/* Study board pane — sticky, always mounted, visibility toggled.
            Width is user-resizable (px) via the handle; the board fills it. */}
        <aside
          style={showStudy ? { width: studyPanelWidth } : undefined}
          className={`shrink-0 flex flex-col gap-3 bg-white overflow-y-auto ${
            showStudy ? 'px-4 py-5' : 'w-0 overflow-hidden px-0 py-0'
          }`}
        >
          {showStudy && <StudyBoard />}
          {showStudy && showDebugTools && <RecognitionDebugPanel chapterText={plainText} />}
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

      {/* Move hover tooltip — mini board anchored under the hovered move */}
      {tooltip && (
        <div
          data-move-tooltip
          className="fixed z-50 shadow-xl rounded-lg overflow-hidden border border-slate-200 bg-white"
          style={{ top: tooltip.top, left: tooltip.left }}
          onMouseEnter={() => { if (tooltipTimer.current) clearTimeout(tooltipTimer.current) }}
          onMouseLeave={() => { if (tooltipTimer.current) clearTimeout(tooltipTimer.current); setTooltip(null) }}
        >
          <div style={{ width: 220 }}>
            <ChessBoardThemed fen={tooltip.fen} orientation="white" lastMove={tooltip.lastMove} hideLabels />
          </div>
        </div>
      )}

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

      {/* Admin book-config editor */}
      {showBookConfig && isAdmin && (
        <BookConfigEditor bookId={id} onClose={() => setShowBookConfig(false)} />
      )}

      {/* Recognition error panel */}
      {showErrors && (
        <RecognitionErrorPanel
          errors={recognitionErrors}
          onClose={() => setShowErrors(false)}
          onNavigate={navigateToError}
        />
      )}
    </div>
  )
}
