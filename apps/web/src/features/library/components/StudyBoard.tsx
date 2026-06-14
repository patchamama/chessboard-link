import { useEffect, useState, type CSSProperties } from 'react'
import { Chess } from 'chess.js'
import ChessBoard from '../../../shared/chess/ChessBoard'
import EvalBar from '../../viewer/components/EvalBar'
import { useSettingsStore } from '../../../shared/settings/settingsStore'
import { useStudyBoardStore } from '../store/studyBoardStore'
import { useStudyNavigation } from '../hooks/useStudyNavigation'
import { MoveStatusRow } from './TurnIndicator'
import { AnnotationToolbar } from './AnnotationToolbar'
import { PenCanvas } from './PenCanvas'
import { VariationChooser } from './VariationChooser'
import { EngineEvalPanel } from './EngineEvalPanel'
import { useEngineLines } from '../../../shared/stockfish/useEngineLines'
import { buildBoardArrows, ENGINE_ARROW_COLOR, PREMOVE_ARROW_COLOR } from '../utils/engineArrows'
import type { Arrow } from 'react-chessboard'

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/**
 * Return a FEN with `piece` placed on `square`, overlaying the given position.
 * Used for isolated prose moves: the colour alternates (white = uppercase) so
 * the reader sees that the side to move is unspecified. Falls back to the
 * original FEN if anything fails.
 */
function placePiece(
  fen: string,
  square: string,
  piece: 'p' | 'n' | 'b' | 'r' | 'q' | 'k',
  white: boolean,
): string {
  try {
    const [placement, ...rest] = fen.split(' ')
    const ranks = placement.split('/')
    const file = square.charCodeAt(0) - 97 // a..h → 0..7
    const rank = 8 - parseInt(square[1], 10) // '8'..'1' → row 0..7
    if (file < 0 || file > 7 || rank < 0 || rank > 7) return fen
    // Expand the target rank into 8 single-cell slots.
    const cells: string[] = []
    for (const ch of ranks[rank]) {
      if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) cells.push('')
      else cells.push(ch)
    }
    cells[file] = white ? piece.toUpperCase() : piece
    // Re-collapse empty runs back into digits.
    let out = ''
    let empty = 0
    for (const c of cells) {
      if (c === '') empty++
      else {
        if (empty) { out += String(empty); empty = 0 }
        out += c
      }
    }
    if (empty) out += String(empty)
    ranks[rank] = out
    return [ranks.join('/'), ...rest].join(' ')
  } catch {
    return fen
  }
}

function NavButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  )
}

export function StudyBoard() {
  const evalDirection = useSettingsStore((s) => s.evalBarDirection)
  const showEval = useSettingsStore((s) => s.showEval)
  const hideEngineArrow = useSettingsStore((s) => s.hideEngineArrow)

  const activeGame = useStudyBoardStore((s) => s.activeGame)
  const orientation = useStudyBoardStore((s) => s.orientation)
  const flip = useStudyBoardStore((s) => s.flip)
  const toolMode = useStudyBoardStore((s) => s.toolMode)
  const annotations = useStudyBoardStore((s) => s.annotations)
  const setArrows = useStudyBoardStore((s) => s.setArrows)
  const toggleHighlight = useStudyBoardStore((s) => s.toggleHighlight)
  const eraseAt = useStudyBoardStore((s) => s.eraseAt)
  const autoplay = useStudyBoardStore((s) => s.autoplay)
  const setAutoplay = useStudyBoardStore((s) => s.setAutoplay)
  const clearGame = useStudyBoardStore((s) => s.clearGame)
  const playFen = useStudyBoardStore((s) => s.playFen)
  const selectedSquare = useStudyBoardStore((s) => s.selectedSquare)
  const legalTargets = useStudyBoardStore((s) => s.legalTargets)
  const selectSquare = useStudyBoardStore((s) => s.selectSquare)
  const playMove = useStudyBoardStore((s) => s.playMove)
  const isolatedHighlight = useStudyBoardStore((s) => s.isolatedHighlight)

  const nav = useStudyNavigation()
  const [showChooser, setShowChooser] = useState(false)
  const [fenInput, setFenInput] = useState(INITIAL_FEN)

  // An isolated move only overlays a PIECE when the notation names one (Nb5, Bf3).
  // A bare pawn move (e4, d5) specifies no piece, so we only highlight the square
  // — no pawn is placed on the board.
  const overlayPiece = !!isolatedHighlight && isolatedHighlight.piece !== 'p'

  // Alternating colour (white/black) for the isolated-move overlay piece.
  const [isoWhite, setIsoWhite] = useState(true)
  useEffect(() => {
    if (!overlayPiece) return
    setIsoWhite(true)
    const t = window.setInterval(() => setIsoWhite((w) => !w), 700)
    return () => window.clearInterval(t)
  }, [overlayPiece, isolatedHighlight])

  // The navigation/base position (game-driven or manual FEN).
  const baseFen = activeGame ? nav.fen : fenInput
  // The displayed position: a free-play position takes precedence once the user moves.
  // An isolated piece-move overlays its alternating piece on top of the current FEN.
  const fen =
    isolatedHighlight && overlayPiece
      ? placePiece(playFen ?? baseFen, isolatedHighlight.square, isolatedHighlight.piece, isoWhite)
      : playFen ?? baseFen

  // Single engine instance for the whole board: drives the eval panel AND the
  // best-move arrow. Internally gated by the `showEval` setting (no worker when off).
  const engine = useEngineLines(fen)

  // The tree's next move (premove arrow when the engine is off).
  const nextMove =
    !playFen && activeGame && nav.successorId
      ? (() => {
          const succ = activeGame.nodes.get(nav.successorId)
          return succ && succ.from ? { from: succ.from, to: succ.to } : null
        })()
      : null

  // While the engine panel is active, feed its live score into the eval bar so
  // both stay in sync (and only one worker runs). null → bar uses its own worker.
  const engineBest = engine.lines[0]
  const evalBarScore =
    showEval && engineBest
      ? { scoreCp: engineBest.scoreCp, mate: engineBest.mate, loading: engine.loading }
      : null

  const boardArrows = buildBoardArrows({
    userArrows: annotations.arrows,
    showEval,
    hideEngineArrow,
    bestMoveUci: engine.bestMove,
    nextMove,
  })

  // Keyboard navigation: ← / → step through the position shown on the board.
  // Only active while a game is loaded; ignores typing in inputs.
  useEffect(() => {
    if (!activeGame) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (nav.canNext) nav.next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (nav.canPrev) nav.prev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeGame, nav])

  // Autoplay loop.
  useEffect(() => {
    if (!autoplay) return
    const tick = () => {
      if (!nav.canNext || nav.hasChoiceAhead) {
        setAutoplay(false)
        return
      }
      nav.next()
    }
    const interval = window.setInterval(tick, 1200)
    return () => window.clearInterval(interval)
  }, [autoplay, nav, setAutoplay])

  const handleNext = () => {
    if (nav.hasChoiceAhead) {
      setShowChooser(true)
      return
    }
    nav.next()
  }

  const highlightStyles: Record<string, CSSProperties> = Object.fromEntries(
    Object.entries(annotations.highlights).map(([sq, color]) => [sq, { backgroundColor: color }]),
  )
  if (isolatedHighlight) {
    highlightStyles[isolatedHighlight.square] = {
      ...highlightStyles[isolatedHighlight.square],
      backgroundColor: 'rgba(250, 204, 21, 0.55)',
      boxShadow: 'inset 0 0 0 3px rgba(202, 138, 4, 0.9)',
    }
  }

  // react-chessboard reports ALL arrows (including our auto engine/premove ones)
  // when the user draws. Strip the auto arrows so only real annotations persist.
  const onUserArrowsChange = (arrows: Arrow[]) => {
    setArrows(
      arrows.filter((a) => a.color !== ENGINE_ARROW_COLOR && a.color !== PREMOVE_ARROW_COLOR),
    )
  }

  const onSquareClick = (square: string) => {
    if (toolMode === 'highlight') toggleHighlight(square)
    else if (toolMode === 'eraser') eraseAt(square)
    else if (toolMode === 'none') selectSquare(square, baseFen) // click-to-move
  }

  const applyFen = () => {
    try {
      new Chess(fenInput)
      clearGame()
    } catch {
      /* invalid FEN — ignore */
    }
  }

  // Pieces are draggable only when no annotation tool is active (play mode).
  const playMode = toolMode === 'none'

  const boardWrapper = (
    <div className="relative w-full">
      <ChessBoard
        fen={fen}
        orientation={orientation}
        lastMove={!playFen && activeGame ? nav.lastMove : null}
        arrows={boardArrows}
        allowDrawingArrows={toolMode === 'arrows'}
        onArrowsChange={onUserArrowsChange}
        customSquareStyles={highlightStyles}
        onSquareClick={onSquareClick}
        allowDragging={playMode}
        onPieceDrop={playMode ? (from, to) => playMove(from, to, baseFen) : undefined}
        selectedSquare={playMode ? selectedSquare : null}
        legalTargets={playMode ? legalTargets : []}
      />
      <PenCanvas />
    </div>
  )

  // Show "After …" only while following the game; once the user plays freely,
  // show whose turn it is from the live position.
  const statusRow = <MoveStatusRow fen={fen} node={!playFen && activeGame ? nav.node : null} />

  // Play an engine PV move (UCI) on the board. Splitting from/to lets us reuse
  // the click-to-move machinery; the new position re-runs the engine.
  const playUci = (uci: string) => {
    playMove(uci.slice(0, 2), uci.slice(2, 4), baseFen)
  }

  const evalPanel = showEval ? (
    <EngineEvalPanel fen={fen} onPlayUci={playUci} engine={engine} />
  ) : null

  return (
    <div className="flex flex-col gap-3">
      <p className="shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-400">Study Board</p>

      {/* Board + eval bar — layout depends on eval bar direction */}
      {evalDirection === 'vertical' ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-stretch gap-1">
            <EvalBar fen={fen} direction="vertical" score={evalBarScore} />
            <div className="flex-1">{boardWrapper}</div>
          </div>
          {statusRow}
          {evalPanel}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {boardWrapper}
          <EvalBar fen={fen} direction="horizontal" score={evalBarScore} />
          {statusRow}
          {evalPanel}
        </div>
      )}

      {/* Navigation bar */}
      <div className="relative flex items-center gap-1.5">
        <NavButton onClick={nav.goStart} disabled={!activeGame || !nav.canPrev} title="Start">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 19l-7-7 7-7M11 19l-7-7 7-7" />
          </svg>
        </NavButton>
        <NavButton onClick={nav.prev} disabled={!activeGame || !nav.canPrev} title="Previous move">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </NavButton>
        <NavButton onClick={handleNext} disabled={!activeGame || !nav.canNext} title="Next move">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </NavButton>
        <NavButton
          onClick={() => setAutoplay(!autoplay)}
          disabled={!activeGame || !nav.canNext}
          title={autoplay ? 'Pause autoplay' : 'Autoplay'}
        >
          {autoplay ? (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 5v14l11-7z" />
            </svg>
          )}
        </NavButton>

        <div className="mx-0.5 h-5 w-px bg-slate-200" />

        <NavButton onClick={nav.variationUp} disabled={!nav.hasChoiceAhead} title="Previous variation">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </NavButton>
        <NavButton onClick={nav.variationDown} disabled={!nav.hasChoiceAhead} title="Next variation">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </NavButton>

        <NavButton onClick={flip} title="Flip board">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </NavButton>

        {showChooser && activeGame && nav.hasChoiceAhead && nav.successorId && (
          <VariationChooser
            tree={activeGame}
            mainlineId={nav.successorId}
            siblingLines={nav.siblingLines}
            onPickMainline={() => {
              nav.next()
              setShowChooser(false)
            }}
            onPickLine={(i) => {
              nav.enterLine(i)
              setShowChooser(false)
            }}
            onClose={() => setShowChooser(false)}
          />
        )}
      </div>

      {/* Annotation toolbar */}
      <AnnotationToolbar />

      {/* FEN input */}
      <div className="flex gap-1.5">
        <input
          value={fenInput}
          onChange={(e) => setFenInput(e.target.value)}
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
          onClick={() => {
            setFenInput(INITIAL_FEN)
            clearGame()
          }}
          title="Reset to start position"
          className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
        >
          ↺
        </button>
      </div>
    </div>
  )
}
