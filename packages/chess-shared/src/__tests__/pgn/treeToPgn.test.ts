import { describe, it, expect } from 'vitest'
import { recognizeGames } from '../../recognition/recognizeGames.js'
import { treeToPgn } from '../../pgn/treeToPgn.js'

describe('treeToPgn', () => {
  it('serialises a simple mainline with move numbers', () => {
    const tree = recognizeGames('1. e4 e5 2. Nf3 Nc6 3. Bb5')[0].tree
    expect(treeToPgn(tree)).toBe('1. e4 e5 2. Nf3 Nc6 3. Bb5')
  })

  it('emits a parenthesised variation right after its branch move', () => {
    const tree = recognizeGames('1. e4 e5 2. Nf3 (2. f4 exf4) 2... Nc6')[0].tree
    const pgn = treeToPgn(tree)
    expect(pgn).toContain('2. Nf3')
    expect(pgn).toContain('(2. f4 exf4)')
    expect(pgn).toContain('2... Nc6')
  })

  it('contains no prose, only moves, numbers and parentheses', () => {
    const tree = recognizeGames(
      '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6\n\nSi 4. Ba4 Nf6 con juego cómodo.\n\n4. Bxc6 dxc6',
    )[0].tree
    const pgn = treeToPgn(tree)
    expect(pgn).not.toMatch(/[A-Za-zÀ-ÿ]{4,}/) // no long prose words like "juego"
    expect(pgn).toContain('4. Bxc6')
    expect(pgn).toContain('(')
  })
})
