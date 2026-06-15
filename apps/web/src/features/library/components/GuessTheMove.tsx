import { useMemo, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { usePracticeStore } from '../store/practiceStore'
import { checkGuess, normalizeUci, type GuessOutcome } from '../utils/guessMove'
import { useStudyBoardStore } from '../store/studyBoardStore'
import { useStockfishEval } from '../../../shared/stockfish/useStockfishEval'

/** Build the UCI string for a played move (incl. promotion). null if illegal. */
function moveToUci(fen: string, from: string, to: string): string | null {
  try {
    const chess = new Chess(fen)
    const move = chess.move({ from, to, promotion: 'q' })
    if (!move) return null
    return `${move.from}${move.to}${move.promotion ?? ''}`
  } catch {
    return null
  }
}

export function GuessTheMove() {
  const active = usePracticeStore((s) => s.active)
  const baseFen = usePracticeStore((s) => s.baseFen)
  const targetUci = usePracticeStore((s) => s.targetUci)
  const score = usePracticeStore((s) => s.score)
  const streak = usePracticeStore((s) => s.streak)
  const status = usePracticeStore((s) => s.status)
  const submitResult = usePracticeStore((s) => s.submitResult)
  const continueAfterReveal = usePracticeStore((s) => s.continueAfterReveal)
  const stop = usePracticeStore((s) => s.stop)
  const orientation = useStudyBoardStore((s) => s.orientation)

  const [feedback, setFeedback] = useState<GuessOutcome | null>(null)

  // Evaluate the base position so an off-book-but-best move can still count.
  const evalRes = useStockfishEval(baseFen, active && status === 'guessing')

  const onPieceDrop = ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
    if (!targetSquare || status !== 'guessing' || !targetUci) return false
    const userUci = moveToUci(baseFen, sourceSquare, targetSquare)
    if (!userUci) return false

    // Engine-equivalence: accept when the user's move IS the engine's best move.
    const engineBest = evalRes.bestMove
    const engineOk =
      engineBest !== undefined && normalizeUci(userUci) === normalizeUci(engineBest)

    const outcome: GuessOutcome = engineOk
      ? checkGuess({ userUci, bookUci: targetUci, bestScoreCp: 0, userScoreCp: 0 })
      : checkGuess({ userUci, bookUci: targetUci })

    setFeedback(outcome)
    submitResult(outcome)
    return outcome !== 'wrong'
  }

  const boardOptions = useMemo(
    () => ({
      position: baseFen,
      boardOrientation: orientation,
      allowDragging: status === 'guessing',
      onPieceDrop,
      showAnimations: true,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseFen, orientation, status, targetUci, evalRes.bestMove],
  )

  if (!active) return null

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Guess the Move</span>
        <button
          onClick={stop}
          className="text-xs text-slate-400 hover:text-slate-700"
          aria-label="Exit practice"
        >
          Exit
        </button>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-600">
        <span>
          Score: <strong data-testid="practice-score">{score}</strong>
        </span>
        <span>
          Streak: <strong>{streak}</strong>
        </span>
        {evalRes.loading && status === 'guessing' && (
          <span className="text-slate-400">engine…</span>
        )}
      </div>

      {status === 'finished' ? (
        <div className="rounded bg-emerald-50 p-3 text-center text-sm text-emerald-700">
          Line complete — final score {score}.
        </div>
      ) : (
        <>
          <div className="max-w-[360px]">
            <Chessboard options={boardOptions} />
          </div>

          {feedback && (
            <div
              data-testid="practice-feedback"
              className={`text-xs font-medium ${
                feedback === 'wrong' ? 'text-red-600' : 'text-emerald-600'
              }`}
            >
              {feedback === 'exact' && 'Correct!'}
              {feedback === 'engine-ok' && "Correct — engine approves (not the book move)."}
              {feedback === 'wrong' && targetUci && `Not quite. The move was ${targetUci}.`}
            </div>
          )}

          {status === 'revealed' && (
            <button
              onClick={() => {
                setFeedback(null)
                continueAfterReveal()
              }}
              className="self-start rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50"
            >
              Continue
            </button>
          )}
        </>
      )}
    </div>
  )
}
