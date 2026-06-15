import { describe, it, expect } from 'vitest'
import { recognizeGames } from '../../recognition/recognizeGames.js'
import { mainlineNodes } from '../../model/gameTree.js'

describe('bracket/brace variations are isolated lines (priority to their own line)', () => {
  it('[ ] and { } open a variation line just like ( )', () => {
    const tree = recognizeGames('1. e4 e5 2. ♘f3 [2. f4 exf4] 2... ♘c6')[0].tree
    const main = mainlineNodes(tree).map((n) => n.san)
    expect(main).toEqual(['e4', 'e5', 'Nf3', 'Nc6'])
    const vars = [...tree.variations.values()].flat().flatMap((l) => l.map((id) => tree.nodes.get(id)!.san))
    expect(vars).toContain('f4')
    expect(vars).toContain('exf4')
  })

  it('a move inside brackets validates against ITS line before the mainline', () => {
    // Inside the bracket, after 2.f4 the move exf4 is only legal in the bracket
    // line (not on the mainline where it would be black's 2nd from e5/Nf3).
    const tree = recognizeGames('1. e4 e5 2. ♘f3 [2. f4 exf4 3. ♘f3] 2... ♘c6')[0].tree
    const vars = [...tree.variations.values()].flat().flatMap((l) => l.map((id) => tree.nodes.get(id)!.san))
    expect(vars).toContain('exf4')
  })
})

describe('move-number contiguity: cannot place a move when an earlier ply is missing', () => {
  it('reports a missing-move when a white move skips the prior black ply', () => {
    // After 5.Bd3 (white), the next ply should be 5...black. The source jumps to
    // 6.Nf3 (white, legal) — 5...? is missing → contiguity gap flagged.
    const tree = recognizeGames('1. d4 ♘f6 2. c4 e6 3. ♘c3 ♗b4 4. e3 O-O 5. ♗d3 6. ♘f3')[0].tree
    const kinds = tree.errors.map((e) => e.kind)
    expect(kinds).toContain('missing-move')
  })
})

describe('wrong-number: a move whose written number does not fit its line position', () => {
  it('flags a variation move whose number jumps past its line position', () => {
    // Inside the bracket the line is at move 2 (after 2.f4), but the source
    // writes "8. exf4" — the number 8 cannot occupy that position.
    const tree = recognizeGames('1. e4 e5 2. ♘f3 [2. f4 8. exf4] 2... ♘c6')[0].tree
    const kinds = tree.errors.map((e) => e.kind)
    expect(kinds).toContain('wrong-number')
  })
})

describe('unreferenced numbered moves: report only the first of each run', () => {
  it('reports the FIRST unreferenced numbered move of a run, not every one', () => {
    // After 2...Nc6, these are valid SAN but ILLEGAL continuations (no such
    // pieces can reach those squares). They anchor to no legal line.
    const tree = recognizeGames('1. e4 e5 2. ♘f3 ♘c6 9. ♖h4 10. ♖h5 11. ♖h6')[0].tree
    const unref = tree.errors.filter((e) => e.kind === 'unreferenced')
    // Exactly one for the whole contiguous run of illegal numbered moves.
    expect(unref.length).toBe(1)
    expect(unref[0].moveNumber).toBe(9)
  })
})
