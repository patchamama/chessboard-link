import { describe, it, expect } from 'vitest'
import { recognizeGames } from '../../recognition/recognizeGames.js'
import { mainlineNodes, type GameTree } from '../../model/gameTree.js'

// The Anderssen "Evergreen-style" game: full mainline ending in 1-0, followed by
// analysis prose with variations that reference earlier move numbers.
const ANDERSSEN =
  '1. e4 e5 2. ♘f3 ♘c6 3. ♗c4 ♗c5 4. b4 ♗xb4 5. c3 ♗a5 6. d4 exd4 ' +
  '7. O-O d3 8. ♕b3 ♕f6 9. e5 ♕g6 10. ♖e1 ♘ge7 11. ♗a3 b5 12. ♕xb5 ♖b8 ' +
  '13. ♕a4 ♗b6 14. ♘bd2 ♗b7 15. ♘e4 ♕f5 16. ♗xd3 ♕h5 17. ♘f6+ gxf6 ' +
  '18. exf6 ♖g8 19. ♖ad1!! ♕xf3 20. ♖xe7+ ♘xe7 21. ♕xd7+! ♔xd7 ' +
  '22. ♗f5+ ♔e8 23. ♗d7+ ♔f8 24. ♗xe7# mate 1-0 ' +
  'Se comprende por qué Anderssen fue agasajado. Posteriores analistas dijeron que ' +
  '19. ♗e4 era más fuerte. 19... ♖g4 habría sido fuerte, evitando el mate. ' +
  'Y en la jugada siguiente las negras podrían haber tenido chances con 20... ♔d8. ' +
  'El mejor juego sería entonces 21. ♖xd7+ ♔c8 22. ♖d8+ ♔xd8 ' +
  '(22... ♘xd8 23. ♕d7+!) 23. ♗f5+ (23. ♗e2+ ♘d4!) ♕xd1+ 24. ♕xd1+ ♘d4 25. ♗h3 ♗d5 ' +
  'y el resultado es incierto.'

function sansOf(tree: GameTree, ids: string[]) {
  return ids.map((id) => tree.nodes.get(id)!.san)
}
function allVariationSans(tree: GameTree) {
  return [...tree.variations.values()].flat().flatMap((line) => sansOf(tree, line))
}

describe('prose analysis variations (validation-anchored)', () => {
  it('keeps post-result analysis in the SAME game', () => {
    const games = recognizeGames(ANDERSSEN, { algorithm: 3 })
    expect(games).toHaveLength(1)
  })

  it('recognises the full 47-move mainline', () => {
    const tree = recognizeGames(ANDERSSEN, { algorithm: 3 })[0].tree
    const sans = mainlineNodes(tree).map((n) => n.san)
    expect(sans).toHaveLength(47)
    expect(sans[0]).toBe('e4')
    expect(sans.at(-1)).toBe('Bxe7#')
    expect(sans).toContain('Rad1')
  })

  it('marks NO intended variation move as invalid', () => {
    const tree = recognizeGames(ANDERSSEN, { algorithm: 3 })[0].tree
    // Every node placed in mainline or a variation line must be legal.
    const placed = new Set<string>([
      ...tree.mainline,
      ...[...tree.variations.values()].flat().flat(),
    ])
    for (const id of placed) {
      expect(tree.nodes.get(id)!.invalid).toBeFalsy()
    }
  })

  it('attaches single-move alternatives Be4, Rg4, Kd8 as variations', () => {
    const tree = recognizeGames(ANDERSSEN, { algorithm: 3 })[0].tree
    const vs = allVariationSans(tree)
    expect(vs).toContain('Be4') // alt to 19. Rad1
    expect(vs).toContain('Rg4') // alt to 19... Qxf3
    expect(vs).toContain('Kd8') // alt to 20... Nxe7
  })

  it('builds the long analysis line as a continuous variation', () => {
    const tree = recognizeGames(ANDERSSEN, { algorithm: 3 })[0].tree
    // The long line: Kd8 Rxd7+ Kc8 Rd8+ Kxd8 Bf5+ Qxd1+ Qxd1+ Nd4 Bh3 Bd5
    const lines = [...tree.variations.values()].flat()
    const longLine = lines.find((l) => sansOf(tree, l).includes('Rd8+'))
    expect(longLine).toBeDefined()
    const sans = sansOf(tree, longLine!)
    expect(sans).toContain('Rxd7+')
    expect(sans).toContain('Kc8')
    expect(sans).toContain('Bd5')
  })

  it('builds nested parenthesised sub-variations', () => {
    const tree = recognizeGames(ANDERSSEN, { algorithm: 3 })[0].tree
    const vs = allVariationSans(tree)
    expect(vs).toContain('Nxd8') // (22... Nxd8 23. Qd7+)
    expect(vs).toContain('Qd7+')
    expect(vs).toContain('Be2+') // (23. Be2+ Nd4)
  })
})

describe('multi-game segmentation still works', () => {
  it('splits two distinct games separated by a result', () => {
    const games = recognizeGames('1. e4 e5 2. Nf3 Nc6 1-0 1. d4 d5 2. c4 e6 0-1')
    expect(games).toHaveLength(2)
  })
})
