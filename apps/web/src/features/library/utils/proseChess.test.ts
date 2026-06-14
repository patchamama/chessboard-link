import { describe, it, expect } from 'vitest'
import { recognizeGames } from '@chess-ebook/chess-shared'
import { successorOf, hasAlternativesAhead, variationLinesFrom } from './proseChess'

const ANDERSSEN =
  '1. e4 e5 2. ♘f3 ♘c6 3. ♗c4 ♗c5 4. b4 ♗xb4 5. c3 ♗a5 6. d4 exd4 7. O-O d3 ' +
  '8. ♕b3 ♕f6 9. e5 ♕g6 10. ♖e1 ♘ge7 11. ♗a3 b5 12. ♕xb5 ♖b8 13. ♕a4 ♗b6 ' +
  '14. ♘bd2 ♗b7 15. ♘e4 ♕f5 16. ♗xd3 ♕h5 17. ♘f6+ gxf6 18. exf6 ♖g8 ' +
  '19. ♖ad1!! ♕xf3 20. ♖xe7+ ♘xe7 21. ♕xd7+! ♔xd7 22. ♗f5+ ♔e8 23. ♗d7+ ♔f8 24. ♗xe7# 1-0 ' +
  '19. ♗e4 era más fuerte. 19... ♖g4 fuerte. con 20... ♔d8. sería 21. ♖xd7+ ♔c8 22. ♖d8+ ♔xd8 ' +
  '(22... ♘xd8 23. ♕d7+!); 23. ♗f5+ (23. ♗e2+ ♘d4!) ♕xd1+ 24. ♕xd1+ ♘d4 25. ♗h3 ♗d5.'

const tree = () => recognizeGames(ANDERSSEN)[0].tree

function nodeBySan(t: ReturnType<typeof tree>, san: string) {
  return [...t.nodes.values()].find((n) => n.san === san && !n.invalid)!
}

describe('successorOf', () => {
  it('returns the next mainline node', () => {
    const t = tree()
    const succ = successorOf(t, nodeBySan(t, 'e4'))
    expect(succ && t.nodes.get(succ)!.san).toBe('e5')
  })

  it('returns the next node inside a variation line', () => {
    const t = tree()
    const succ = successorOf(t, nodeBySan(t, 'Rd8+'))
    expect(succ && t.nodes.get(succ)!.san).toBe('Kxd8')
  })
})

describe('hasAlternativesAhead — fork is AT the node, not at its successor', () => {
  it('marks Rg8 (18...) because move 19 forks into Rad1 (main) and Be4 (var)', () => {
    const t = tree()
    // The fork is at Rg8: the next move can be Rad1 or Be4.
    expect(hasAlternativesAhead(t, nodeBySan(t, 'Rg8'))).toBe(true)
  })

  it('does NOT mark exf6 (the move BEFORE the fork node)', () => {
    const t = tree()
    expect(hasAlternativesAhead(t, nodeBySan(t, 'exf6'))).toBe(false)
  })

  it('marks Rd8+ (next move forks into Kxd8 / Nxd8)', () => {
    const t = tree()
    expect(hasAlternativesAhead(t, nodeBySan(t, 'Rd8+'))).toBe(true)
  })

  it('marks Kxd8 (next move forks into Bf5+ / Be2+)', () => {
    const t = tree()
    expect(hasAlternativesAhead(t, nodeBySan(t, 'Kxd8'))).toBe(true)
  })

  it('is false for a plain move with no fork', () => {
    const t = tree()
    expect(hasAlternativesAhead(t, nodeBySan(t, 'e4'))).toBe(false)
  })
})

describe('variationLinesFrom', () => {
  it('returns the variation line branching from Rg8 (Be4 …)', () => {
    const t = tree()
    const lines = variationLinesFrom(t, nodeBySan(t, 'Rg8'))
    expect(lines).toHaveLength(1)
    expect(t.nodes.get(lines[0][0])!.san).toBe('Be4')
  })

  it('returns empty for a node with no fork', () => {
    const t = tree()
    expect(variationLinesFrom(t, nodeBySan(t, 'e4'))).toEqual([])
  })
})
