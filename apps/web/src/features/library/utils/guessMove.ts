export type GuessOutcome = 'exact' | 'engine-ok' | 'wrong'

const DEFAULT_MARGIN_CP = 30

export interface CheckGuessInput {
  /** The move the user played, in UCI (e.g. "e2e4", "e7e8q"). */
  userUci: string
  /** The book/expected move, in UCI. */
  bookUci: string
  /**
   * Engine score (centipawns, from the moving side's POV) of the best move and of
   * the user's move. When both are present and the user's move is within
   * `marginCp` of best, the guess is accepted as "engine-ok".
   */
  bestScoreCp?: number
  userScoreCp?: number
  marginCp?: number
}

/** Lowercase and strip separators so "E2-E4" and "e2e4" compare equal. */
export function normalizeUci(uci: string): string {
  return uci.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

/**
 * Decide whether a guessed move counts. Exact book match wins outright; otherwise,
 * if engine scores are supplied, a move that gives up no more than `marginCp`
 * versus the best move is accepted as "engine-ok". Everything else is "wrong".
 */
export function checkGuess(input: CheckGuessInput): GuessOutcome {
  if (normalizeUci(input.userUci) === normalizeUci(input.bookUci)) {
    return 'exact'
  }

  if (input.bestScoreCp !== undefined && input.userScoreCp !== undefined) {
    const margin = input.marginCp ?? DEFAULT_MARGIN_CP
    const drop = input.bestScoreCp - input.userScoreCp
    if (drop <= margin) return 'engine-ok'
  }

  return 'wrong'
}

export function pointsFor(outcome: GuessOutcome): number {
  switch (outcome) {
    case 'exact':
      return 2
    case 'engine-ok':
      return 1
    default:
      return 0
  }
}
