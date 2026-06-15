import { create } from 'zustand'
import type { GameTree, GameNode } from '@chess-ebook/chess-shared'

export type GuessResult = 'exact' | 'engine-ok' | 'wrong'
export type PracticeStatus = 'idle' | 'guessing' | 'revealed' | 'finished'

const POINTS: Record<Exclude<GuessResult, 'wrong'>, number> = {
  exact: 2,
  'engine-ok': 1,
}

export interface PracticeState {
  active: boolean
  game: GameTree | null
  /** The mainline node we are currently sitting on (whose successor must be guessed). null = start position. */
  currentNodeId: string | null
  /** FEN of the position to move from (i.e. the current node's fen, or the game start). */
  baseFen: string
  /** UCI of the book move to guess (from→to of the next mainline node), or null when finished. */
  targetUci: string | null
  score: number
  streak: number
  attempts: number
  status: PracticeStatus

  start: (game: GameTree, fromNodeId: string | null) => void
  stop: () => void
  /** Record the outcome of a guess attempt (validated elsewhere). */
  submitResult: (result: GuessResult) => void
  /** After a wrong guess was revealed, move on to the next position. */
  continueAfterReveal: () => void
}

const STANDARD_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** The mainline node id that follows `nodeId` (or the first move when nodeId is null). */
function nextMainlineId(game: GameTree, nodeId: string | null): string | null {
  if (nodeId === null) return game.mainline[0] ?? null
  const idx = game.mainline.indexOf(nodeId)
  if (idx < 0) return null
  return idx < game.mainline.length - 1 ? game.mainline[idx + 1] : null
}

/** The FEN to move from when sitting on `nodeId` (its fen, or the game start). */
function baseFenFor(game: GameTree, nodeId: string | null): string {
  if (nodeId === null) return game.startFen || STANDARD_FEN
  return game.nodes.get(nodeId)?.fen ?? game.startFen ?? STANDARD_FEN
}

/** UCI string for a node's move (from+to, plus promotion suffix if present in SAN). */
function uciOf(node: GameNode): string {
  return `${node.from}${node.to}`
}

const INITIAL = {
  active: false,
  game: null as GameTree | null,
  currentNodeId: null as string | null,
  baseFen: STANDARD_FEN,
  targetUci: null as string | null,
  score: 0,
  streak: 0,
  attempts: 0,
  status: 'idle' as PracticeStatus,
}

export const usePracticeStore = create<PracticeState>((set) => ({
  ...INITIAL,

  start: (game, fromNodeId) =>
    set(() => {
      const targetId = nextMainlineId(game, fromNodeId)
      const targetNode = targetId ? game.nodes.get(targetId) ?? null : null
      return {
        active: true,
        game,
        currentNodeId: fromNodeId,
        baseFen: baseFenFor(game, fromNodeId),
        targetUci: targetNode ? uciOf(targetNode) : null,
        score: 0,
        streak: 0,
        attempts: 0,
        status: targetNode ? 'guessing' : 'finished',
      }
    }),

  stop: () => set({ ...INITIAL }),

  submitResult: (result) =>
    set((s) => {
      if (!s.game || s.status !== 'guessing' || s.targetUci === null) return s
      const attempts = s.attempts + 1

      if (result === 'wrong') {
        return { ...s, attempts, streak: 0, status: 'revealed' }
      }

      // Correct → score and advance to the move we just guessed.
      const nextNodeId = nextMainlineId(s.game, s.currentNodeId)
      return advanceFrom(s, nextNodeId, {
        attempts,
        score: s.score + POINTS[result],
        streak: s.streak + 1,
      })
    }),

  continueAfterReveal: () =>
    set((s) => {
      if (!s.game || s.status !== 'revealed') return s
      const nextNodeId = nextMainlineId(s.game, s.currentNodeId)
      return advanceFrom(s, nextNodeId, {})
    }),
}))

/**
 * Move the cursor to `nextNodeId` (the move that was just resolved) and set up
 * the following target, or finish when the mainline is exhausted.
 */
function advanceFrom(
  s: PracticeState,
  nextNodeId: string | null,
  patch: Partial<PracticeState>,
): PracticeState {
  const game = s.game!
  if (nextNodeId === null) {
    return { ...s, ...patch, status: 'finished' }
  }
  const followingId = nextMainlineId(game, nextNodeId)
  const followingNode = followingId ? game.nodes.get(followingId) ?? null : null
  return {
    ...s,
    ...patch,
    currentNodeId: nextNodeId,
    baseFen: baseFenFor(game, nextNodeId),
    targetUci: followingNode ? uciOf(followingNode) : null,
    status: followingNode ? 'guessing' : 'finished',
  }
}
