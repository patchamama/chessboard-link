import { describe, it, expect } from 'vitest'
import { recognizeGames } from '../../recognition/recognizeGames.js'
import { mainlineNodes } from '../../model/gameTree.js'

// Algorithm 2 (two-pass): pass 1 builds ONLY the mainline from paragraphs that
// start with a move; pass 2 inserts variations anchored by move NUMBER onto the
// already-built mainline. The number is authoritative end to end.
const opts = { algorithm: 2 as const }

const BYRNE = [
  '1. ♘f3 ♘f6 2. c4 g6 3. ♘c3 ♗g7 4. d4 O-O 5. ♗f4 d5',
  '',
  'Una reacción habría sido 5... d6. Pero Bobby quiere la Grünfeld.',
  '',
  '6. ♕b3',
  '',
  'Más sólido es 6. ♖c1.',
  '',
  '6... dxc4 7. ♕xc4 c6 8. e4 ♘bd7 9. ♖d1',
  '',
  'Si 9. e5 ♘d5! 10. ♘xd5 ♘xd5 11. ♕b3 (11. ♕xd5? ♘xe5!), 11... ♘b6 cómodo.',
  '',
  '9... ♘b6 10. ♕c5',
  '',
  'Más seguro es 10. ♕d3 ♗e6.',
  '',
  '10... ♗g4 11. ♗g5',
].join('\n')

describe('Algorithm 2 — two-pass, number-authoritative', () => {
  const tree = recognizeGames(BYRNE, opts)[0].tree
  const main = mainlineNodes(tree)
  const keyed = main.map((n) => `${n.moveNumber}${n.color === 'black' ? '...' : '.'}${n.san}`)

  it('builds the exact played mainline, no prose alternatives leaking in', () => {
    expect(keyed).toEqual([
      '1.Nf3', '1...Nf6', '2.c4', '2...g6', '3.Nc3', '3...Bg7',
      '4.d4', '4...O-O', '5.Bf4', '5...d5', '6.Qb3', '6...dxc4',
      '7.Qxc4', '7...c6', '8.e4', '8...Nbd7', '9.Rd1', '9...Nb6',
      '10.Qc5', '10...Bg4', '11.Bg5',
    ])
  })

  it('9...Nb6 on the mainline is the PLAYED one (move 9), not the 11...Nb6 from prose', () => {
    const nb6 = main.filter((n) => n.san === 'Nb6')
    expect(nb6).toHaveLength(1)
    expect(nb6[0].moveNumber).toBe(9)
  })

  it('keeps the prose analysis as variations (9.e5 line, 6.Rc1, 10.Qd3)', () => {
    const varSans = [...tree.variations.values()]
      .flat()
      .flatMap((line) => line.map((id) => tree.nodes.get(id)!.san))
    expect(varSans).toContain('e5')
    expect(varSans).toContain('Rc1')
    expect(varSans).toContain('Qd3')
  })
})

describe('Algorithm 1 — mainline only', () => {
  const tree = recognizeGames(BYRNE, { algorithm: 1 })[0].tree

  it('builds the same clean mainline as algorithm 2', () => {
    const keyed = mainlineNodes(tree).map((n) => `${n.moveNumber}${n.color === 'black' ? '...' : '.'}${n.san}`)
    expect(keyed).toEqual([
      '1.Nf3', '1...Nf6', '2.c4', '2...g6', '3.Nc3', '3...Bg7',
      '4.d4', '4...O-O', '5.Bf4', '5...d5', '6.Qb3', '6...dxc4',
      '7.Qxc4', '7...c6', '8.e4', '8...Nbd7', '9.Rd1', '9...Nb6',
      '10.Qc5', '10...Bg4', '11.Bg5',
    ])
  })

  it('produces NO variations at all', () => {
    expect(tree.variations.size).toBe(0)
  })
})
