import { describe, it, expect } from 'vitest'
import {
  formatScore,
  formatNps,
  formatNodes,
  formatTime,
  sanToFigurine,
  pvToFigurineSegments,
} from './engineFormat'

describe('formatScore', () => {
  it('formats a centipawn advantage as pawns with parentheses', () => {
    expect(formatScore({ scoreCp: 1211 })).toBe('(12.11)')
    expect(formatScore({ scoreCp: 35 })).toBe('(0.35)')
  })

  it('formats a negative score with sign', () => {
    expect(formatScore({ scoreCp: -250 })).toBe('(-2.50)')
  })

  it('formats mate as (#N)', () => {
    expect(formatScore({ mate: 13 })).toBe('(#13)')
    expect(formatScore({ mate: -4 })).toBe('(#-4)')
  })

  it('returns (?) when no score is present', () => {
    expect(formatScore({})).toBe('(?)')
  })
})

describe('formatNps / formatNodes', () => {
  it('abbreviates nps with K/M suffixes', () => {
    expect(formatNps(526000)).toBe('526K')
    expect(formatNps(1500000)).toBe('1.5M')
    expect(formatNps(900)).toBe('900')
  })

  it('formats raw node counts', () => {
    expect(formatNodes(57289)).toBe('57289')
  })
})

describe('formatTime', () => {
  it('formats milliseconds as whole seconds', () => {
    expect(formatTime(0)).toBe('0s')
    expect(formatTime(109)).toBe('0s')
    expect(formatTime(1500)).toBe('1s')
    expect(formatTime(12000)).toBe('12s')
  })
})

describe('sanToFigurine', () => {
  it('replaces piece letters with black figurine glyphs', () => {
    expect(sanToFigurine('Ke1')).toBe('♚e1')
    expect(sanToFigurine('Qa7')).toBe('♛a7')
    expect(sanToFigurine('Rad1')).toBe('♜ad1')
    expect(sanToFigurine('Nf3')).toBe('♞f3')
    expect(sanToFigurine('Bb5+')).toBe('♝b5+')
  })

  it('leaves pawn moves and castling untouched', () => {
    expect(sanToFigurine('e4')).toBe('e4')
    expect(sanToFigurine('exd5')).toBe('exd5')
    expect(sanToFigurine('O-O')).toBe('O-O')
  })
})

describe('pvToFigurineSegments', () => {
  const FEN_BLACK_TO_MOVE =
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

  it('numbers a PV starting with a black move as "1... ♚.."-style', () => {
    // Black to move on move 1: first label uses the ellipsis number.
    const segs = pvToFigurineSegments(FEN_BLACK_TO_MOVE, ['e7e5', 'g1f3'])
    expect(segs[0].label).toBe('1... e5')
    expect(segs[1].label).toBe('2. ♞f3')
    // Each segment carries the ply index for click handling.
    expect(segs[0].pvIndex).toBe(0)
    expect(segs[1].pvIndex).toBe(1)
  })

  it('numbers a PV starting with a white move as "N. .."', () => {
    const FEN_WHITE =
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const segs = pvToFigurineSegments(FEN_WHITE, ['e2e4', 'e7e5'])
    expect(segs[0].label).toBe('1. e4')
    expect(segs[1].label).toBe('e5')
  })
})
