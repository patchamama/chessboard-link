import { describe, it, expect } from 'vitest'
import { recognizeGames } from '../../recognition/recognizeGames.js'
import { mainlineNodes } from '../../model/gameTree.js'

// The Byrne–Fischer "Game of the Century" prose: mainline interleaved with
// analysis variations, including a parenthesised variation NESTED inside a
// prose variation. The number written for each move is authoritative.
const BYRNE = [
  '1. ♘f3 ♘f6 2. c4 g6 3. ♘c3 ♗g7 4. d4 O-O 5. ♗f4 d5',
  '',
  'Una reacción automática habría sido 5... d6. Pero Bobby quiere la Grünfeld.',
  '',
  '6. ♕b3',
  '',
  'Las blancas mezclan dos sistemas. Más sólido es 6. ♖c1.',
  '',
  '6... dxc4 7. ♕xc4 c6 8. e4 ♘bd7 9. ♖d1',
  '',
  'Reforzando al PD. Si 9. e5 ♘d5! 10. ♘xd5 ♘xd5 11. ♕b3 (11. ♕xd5? ♘xe5!), 11... ♘b6 las negras están cómodas.',
  '',
  '9... ♘b6 10. ♕c5',
  '',
  'Más seguro es 10. ♕d3 ♗e6 con equilibrio.',
  '',
  '10... ♗g4 11. ♗g5',
].join('\n')

describe('Byrne–Fischer recognition (number is authoritative)', () => {
  const tree = recognizeGames(BYRNE)[0].tree
  const main = mainlineNodes(tree)
  const mainKeyed = main.map((n) => `${n.moveNumber}${n.color === 'black' ? '...' : '.'}${n.san}`)

  it('keeps the full played mainline through 11.Bg5', () => {
    // The real game: 1.Nf3 … 9.Rd1 9...Nb6 10.Qc5 10...Bg4 11.Bg5
    expect(mainKeyed).toContain('9.Rd1')
    expect(mainKeyed).toContain('9...Nb6')
    expect(mainKeyed).toContain('10.Qc5')
    expect(mainKeyed).toContain('10...Bg4')
    expect(mainKeyed).toContain('11.Bg5')
  })

  it('never renames a move number: 10...Bg4 stays move 10, not 6', () => {
    const bg4 = main.find((n) => n.san === 'Bg4')
    expect(bg4).toBeDefined()
    expect(bg4!.moveNumber).toBe(10)
  })

  it('keeps prose alternatives (9.Rc1-style, 9.e5 line) OFF the mainline', () => {
    expect(mainKeyed).not.toContain('6.Rc1')
    // The 9.e5 analysis line is a variation, not mainline.
    expect(main.find((n) => n.san === 'e5' && n.moveNumber === 9)).toBeUndefined()
  })
})

describe('parenthesised variation nested inside a prose variation', () => {
  // "Si 4. Ba4 Nf6 5. O-O (5. d3 b5) 5... Be7" then mainline 4. Bxc6 resumes.
  const NESTED = [
    '1. e4 e5 2. ♘f3 ♘c6 3. ♗b5 a6',
    '',
    'Si 4. ♗a4 ♘f6 5. O-O (5. d3 b5) 5... ♗e7 con juego cómodo.',
    '',
    '4. ♗xc6 dxc6',
  ].join('\n')

  it('resumes the real mainline 4.Bxc6 after the prose+nested variation', () => {
    const tree = recognizeGames(NESTED)[0].tree
    const mainKeyed = mainlineNodes(tree).map((n) => `${n.moveNumber}${n.color === 'black' ? '...' : '.'}${n.san}`)
    expect(mainKeyed).toContain('4.Bxc6')
    expect(mainKeyed).toContain('4...dxc6')
    // The "Si 4. Ba4 …" line is a variation, not mainline.
    expect(mainKeyed).not.toContain('4.Ba4')
  })
})
