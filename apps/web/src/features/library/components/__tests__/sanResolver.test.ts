import { describe, it, expect } from 'vitest'
import { recognizeGames } from '@chess-ebook/chess-shared'
import { createSanResolver } from '../BookReader'

/**
 * The resolver must use the MOVE NUMBER, not just the SAN, so a "11... Nb6" that
 * appears in prose is never painted as the mainline "9... Nb6".
 */
describe('createSanResolver — number is authoritative', () => {
  const TEXT = [
    '1. ♘f3 ♘f6 2. c4 g6 3. ♘c3 ♗g7 4. d4 O-O 5. ♗f4 d5',
    '',
    '6. ♕b3 6... dxc4 7. ♕xc4 c6 8. e4 ♘bd7 9. ♖d1',
    '',
    'Si 9. e5 ♘d5! 10. ♘xd5 ♘xd5 11. ♕b3 (11. ♕xd5? ♘xe5!), 11... ♘b6.',
    '',
    '9... ♘b6 10. ♕c5',
  ].join('\n')

  for (const algorithm of [1, 2] as const) {
    it(`alg ${algorithm}: "9... Nb6" resolves to the move-9 node, not 11...Nb6`, () => {
      const games = recognizeGames(TEXT, { algorithm })
      const resolver = createSanResolver(games)
      // The DOM walk would call nextKeyed for "9... ♘b6": san=Nb6, number=9, black.
      const resolved = resolver.nextKeyed('Nb6', 9, 'black')
      expect(resolved).not.toBeNull()
      expect(resolved!.kind).toBe('node')
      if (resolved!.kind === 'node') {
        expect(resolved!.value.node.moveNumber).toBe(9)
        expect(resolved!.value.node.color).toBe('black')
      }
    })

    it(`alg ${algorithm}: a "9... Nb6" token never grabs an 11...Nb6 variation node`, () => {
      const games = recognizeGames(TEXT, { algorithm })
      const resolver = createSanResolver(games)
      const r = resolver.nextKeyed('Nb6', 9, 'black')
      // The resolved node's move number must be 9 (not 11).
      if (r && r.kind === 'node') expect(r.value.node.moveNumber).not.toBe(11)
    })
  }
})

describe('createSanResolver — two games, no cross-game leakage', () => {
  const TWO = [
    '1. ♘f3 ♘f6 2. c4 g6 3. ♘c3 ♗g7 4. d4 O-O 5. ♗f4 d5 6. ♕b3 6... dxc4 7. ♕xc4 c6 8. e4 ♘bd7 9. ♖d1 9... ♘b6 10. ♕c5',
    '',
    '1. e4 c5 2. ♘f3 ♘c6 3. d4 ♘xd4 4. ♘xd4 ♘f6 5. ♘c3 d6 6. ♗c4',
  ].join('\n')

  it('detects two separate games', () => {
    expect(recognizeGames(TWO, { algorithm: 2 })).toHaveLength(2)
  })

  it('"1. Nf3" maps to game 0 and "1. e4" maps to game 1', () => {
    const games = recognizeGames(TWO, { algorithm: 2 })
    const resolver = createSanResolver(games)
    const nf3 = resolver.nextKeyed('Nf3', 1, 'white')
    const e4 = resolver.nextKeyed('e4', 1, 'white')
    expect(nf3?.kind).toBe('node')
    expect(e4?.kind).toBe('node')
    if (nf3?.kind === 'node') expect(nf3.value.gameIndex).toBe(0)
    if (e4?.kind === 'node') expect(e4.value.gameIndex).toBe(1)
  })
})
