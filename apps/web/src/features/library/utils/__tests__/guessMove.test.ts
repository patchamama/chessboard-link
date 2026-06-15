import { describe, it, expect } from 'vitest'
import { normalizeUci, checkGuess, pointsFor, type GuessOutcome } from '../guessMove'

describe('normalizeUci', () => {
  it('lowercases and strips separators', () => {
    expect(normalizeUci('E2-E4')).toBe('e2e4')
    expect(normalizeUci('g1f3')).toBe('g1f3')
  })

  it('keeps a promotion suffix', () => {
    expect(normalizeUci('e7e8Q')).toBe('e7e8q')
  })
})

describe('checkGuess', () => {
  it('returns "exact" when the user plays the book move', () => {
    expect(checkGuess({ userUci: 'e7e5', bookUci: 'e7e5' })).toBe('exact')
  })

  it('promotion equivalence is case-insensitive', () => {
    expect(checkGuess({ userUci: 'e7e8Q', bookUci: 'e7e8q' })).toBe('exact')
  })

  it('returns "wrong" for a different move when no engine info is given', () => {
    expect(checkGuess({ userUci: 'a2a3', bookUci: 'e7e5' })).toBe('wrong')
  })

  it('returns "engine-ok" when the move is within the eval margin of best', () => {
    // user move loses only 20cp vs best → acceptable (margin 30)
    expect(
      checkGuess({
        userUci: 'g1f3',
        bookUci: 'b1c3',
        bestScoreCp: 40,
        userScoreCp: 20,
        marginCp: 30,
      }),
    ).toBe('engine-ok')
  })

  it('returns "wrong" when the move is worse than the margin', () => {
    expect(
      checkGuess({
        userUci: 'h2h4',
        bookUci: 'b1c3',
        bestScoreCp: 40,
        userScoreCp: -50,
        marginCp: 30,
      }),
    ).toBe('wrong')
  })

  it('scores are from the mover POV, so a smaller drop is better', () => {
    // exactly on the margin boundary counts as ok
    expect(
      checkGuess({
        userUci: 'g1f3',
        bookUci: 'b1c3',
        bestScoreCp: 100,
        userScoreCp: 70,
        marginCp: 30,
      }),
    ).toBe('engine-ok')
  })
})

describe('pointsFor', () => {
  it('exact=2, engine-ok=1, wrong=0', () => {
    const cases: [GuessOutcome, number][] = [
      ['exact', 2],
      ['engine-ok', 1],
      ['wrong', 0],
    ]
    for (const [outcome, pts] of cases) expect(pointsFor(outcome)).toBe(pts)
  })
})
