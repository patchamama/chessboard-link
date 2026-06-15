import { describe, it, expect } from 'vitest'
import { recognizeGames } from '../../recognition/recognizeGames.js'
import { mainlineNodes } from '../../model/gameTree.js'

// User-reported case: an embedded "5... d6" in mid-paragraph prose is an
// alternative that was NOT played; the real game continues with "6. ♕b3" which
// the author wrote at the START of a NEW paragraph. The newline boundary is the
// signal that 6.Qb3 resumes the mainline rather than extending the 5...d6 line.
const FISCHER = [
  '1. ♘f3 ♘f6 2. c4 g6 3. ♘c3 ♗g7 4. d4 O-O 5. ♗f4 d5',
  '',
  'Una reacción automática a la última jugada de las blancas habría sido 5... d6. Pero Bobby quiere ahora la Grünfeld.',
  '',
  '6. ♕b3',
].join('\n')

describe('paragraph-start move resumes the mainline (newline-aware)', () => {
  it('keeps the played moves on the mainline, including 6.Qb3', () => {
    const tree = recognizeGames(FISCHER)[0].tree
    const sans = mainlineNodes(tree).map((n) => n.san)
    // The real game: 1.Nf3 ... 5.Bf4 d5 6.Qb3
    expect(sans).toContain('Qb3')
    expect(sans.at(-1)).toBe('Qb3')
    expect(sans).toContain('d5')
    // d6 was the unplayed alternative — it must NOT be on the mainline.
    expect(sans).not.toContain('d6')
  })

  it('files the unplayed 5...d6 as a variation (or isolated), never mainline', () => {
    const tree = recognizeGames(FISCHER)[0].tree
    const mainSans = mainlineNodes(tree).map((n) => n.san)
    expect(mainSans).not.toContain('d6')

    const variationSans = [...tree.variations.values()]
      .flat()
      .flatMap((line) => line.map((id) => tree.nodes.get(id)!.san))
    const isolatedSans = tree.isolatedMoves.map((i) => i.san)

    // d6 appears somewhere off the mainline.
    expect(variationSans.includes('d6') || isolatedSans.includes('d6')).toBe(true)
    // And critically, 6.Qb3 did NOT get sucked into the d6 variation.
    expect(variationSans).not.toContain('Qb3')
  })
})

// An embedded move that is LEGAL on the mainline but is followed by the real
// move (same number) leading a new paragraph: the embedded one is the unplayed
// alternative, the paragraph-leading one is the mainline.
const EMBEDDED = [
  '1. e4 e5 2. ♘f3 ♘c6 3. ♗b5',
  '',
  'Aquí las negras podían jugar 3... ♘f6 con idea de contraatacar.',
  '',
  '3... a6 4. ♗a4',
].join('\n')

describe('embedded legal move vs paragraph-leading real move (lookahead)', () => {
  it('keeps the paragraph-leading 3...a6 4.Ba4 on the mainline', () => {
    const tree = recognizeGames(EMBEDDED)[0].tree
    const sans = mainlineNodes(tree).map((n) => n.san)
    expect(sans).toContain('a6')
    expect(sans).toContain('Ba4')
    expect(sans).not.toContain('Nf6')
  })

  it('files the embedded 3...Nf6 as a variation', () => {
    const tree = recognizeGames(EMBEDDED)[0].tree
    const variationSans = [...tree.variations.values()]
      .flat()
      .flatMap((line) => line.map((id) => tree.nodes.get(id)!.san))
    const isolatedSans = tree.isolatedMoves.map((i) => i.san)
    expect(variationSans.includes('Nf6') || isolatedSans.includes('Nf6')).toBe(true)
  })
})
