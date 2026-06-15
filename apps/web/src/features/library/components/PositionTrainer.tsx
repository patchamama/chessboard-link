import { useCallback, useEffect, useState } from 'react'
import {
  listTrainerLines,
  reviewTrainerLine,
  deleteTrainerLine,
  type TrainerLine,
  type ReviewGrade,
} from '../api/trainerApi'
import { buildTreeFromMoves } from '../utils/buildTreeFromMoves'
import { usePracticeStore } from '../store/practiceStore'
import { GuessTheMove } from './GuessTheMove'

const GRADES: { grade: ReviewGrade; label: string; tone: string }[] = [
  { grade: 'again', label: 'Again', tone: 'border-red-300 text-red-600 hover:bg-red-50' },
  { grade: 'hard', label: 'Hard', tone: 'border-amber-300 text-amber-600 hover:bg-amber-50' },
  { grade: 'good', label: 'Good', tone: 'border-emerald-300 text-emerald-600 hover:bg-emerald-50' },
  { grade: 'easy', label: 'Easy', tone: 'border-sky-300 text-sky-600 hover:bg-sky-50' },
]

function isDue(line: TrainerLine): boolean {
  return new Date(line.dueAt).getTime() <= Date.now()
}

export function PositionTrainer() {
  const [lines, setLines] = useState<TrainerLine[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewingId, setReviewingId] = useState<number | null>(null)

  const practiceActive = usePracticeStore((s) => s.active)
  const practiceStatus = usePracticeStore((s) => s.status)
  const startPractice = usePracticeStore((s) => s.start)
  const stopPractice = usePracticeStore((s) => s.stop)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setLines(await listTrainerLines())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const startReview = (line: TrainerLine) => {
    const tree = buildTreeFromMoves(line.startFen, line.movesUci)
    setReviewingId(line.id)
    startPractice(tree, null)
  }

  const grade = async (g: ReviewGrade) => {
    if (reviewingId === null) return
    await reviewTrainerLine(reviewingId, g)
    setReviewingId(null)
    stopPractice()
    refresh()
  }

  const remove = async (id: number) => {
    await deleteTrainerLine(id)
    refresh()
  }

  // Active review: show the guessing board and (when finished) the grade buttons.
  if (practiceActive && reviewingId !== null) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Position Trainer — Review</p>
        <GuessTheMove />
        {practiceStatus === 'finished' && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">How well did you recall this line?</span>
            <div className="flex gap-2">
              {GRADES.map(({ grade: g, label, tone }) => (
                <button
                  key={g}
                  onClick={() => grade(g)}
                  className={`rounded border px-2 py-0.5 text-xs font-medium transition ${tone}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const dueCount = lines.filter(isDue).length

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Position Trainer</p>
        {dueCount > 0 && (
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
            {dueCount} due
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : lines.length === 0 ? (
        <p className="text-xs text-slate-400">
          No lines yet. Right-click a move and choose “Add to Position Trainer”.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {lines.map((line) => (
            <li
              key={line.id}
              className="flex items-center justify-between gap-2 rounded border border-slate-200 px-2 py-1 text-xs"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-slate-700">{line.name || 'Untitled line'}</div>
                <div className="text-[10px] text-slate-400">
                  {line.movesUci.length} moves · {isDue(line) ? 'due' : `due ${new Date(line.dueAt).toLocaleDateString()}`}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => startReview(line)}
                  className="rounded border border-indigo-300 px-2 py-0.5 font-medium text-indigo-600 hover:bg-indigo-50"
                >
                  Review
                </button>
                <button
                  onClick={() => remove(line.id)}
                  aria-label={`Delete ${line.name}`}
                  className="rounded px-1 text-slate-400 hover:text-red-600"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
