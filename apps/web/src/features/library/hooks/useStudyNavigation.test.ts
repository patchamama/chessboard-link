import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { recognizeGames } from '@chess-ebook/chess-shared'
import { useStudyNavigation } from './useStudyNavigation'
import { useStudyBoardStore } from '../store/studyBoardStore'

// Legacy single-line fixtures (paren variations without paragraph structure).
const tree = () =>
  recognizeGames('1. e4 e5 2. Nf3 Nc6 3. Bb5 (3. Bc4 Bc5) a6 4. Ba4', { algorithm: 3 })[0].tree

beforeEach(() => useStudyBoardStore.getState().reset())

function load(nodeIndex: number | null) {
  const t = tree()
  const id = nodeIndex === null ? null : t.mainline[nodeIndex]
  act(() => useStudyBoardStore.getState().loadPosition(t, id, false))
  return t
}

describe('useStudyNavigation', () => {
  it('reports the current fen and node', () => {
    const t = load(0) // after e4
    const { result } = renderHook(() => useStudyNavigation())
    expect(result.current.node?.san).toBe('e4')
    expect(result.current.fen).toBe(t.nodes.get(t.mainline[0])!.fen)
  })

  it('next advances along the mainline', () => {
    load(0)
    const { result } = renderHook(() => useStudyNavigation())
    act(() => result.current.next())
    expect(useStudyBoardStore.getState().currentNodeId).toBe(tree().mainline[1])
  })

  it('prev steps back; goStart returns to start position', () => {
    load(2)
    const { result } = renderHook(() => useStudyNavigation())
    act(() => result.current.prev())
    expect(useStudyBoardStore.getState().currentNodeId).toBe(tree().mainline[1])
    act(() => result.current.goStart())
    expect(useStudyBoardStore.getState().currentNodeId).toBeNull()
  })

  it('detects a choice ahead at a branch point', () => {
    // mainline index 3 = Nc6; its successor Bb5 has a variation
    load(3)
    const { result } = renderHook(() => useStudyNavigation())
    expect(result.current.hasChoiceAhead).toBe(true)
    expect(result.current.siblingLines.length).toBeGreaterThan(0)
  })

  it('enterLine jumps into a variation line', () => {
    const t = load(3) // at Nc6
    const { result } = renderHook(() => useStudyNavigation())
    act(() => result.current.enterLine(0)) // first variation: Bc4...
    const cur = useStudyBoardStore.getState().currentNodeId
    expect(t.nodes.get(cur!)!.san).toBe('Bc4')
    expect(useStudyBoardStore.getState().isInVariation).toBe(true)
  })

  it('no choice ahead on a plain mainline node', () => {
    load(0) // e4 -> e5, no variation
    const { result } = renderHook(() => useStudyNavigation())
    expect(result.current.hasChoiceAhead).toBe(false)
  })

  it('detects a fork while INSIDE an analysis variation line', () => {
    // Real Anderssen analysis: the long line "...Rd8+ Kxd8 Bf5+..." is a
    // variation, and Kxd8 inside it has its own sub-fork (Nxd8 / Be2+ ahead).
    const t = recognizeGames(
      '1. e4 e5 2. ♘f3 ♘c6 3. ♗c4 ♗c5 4. b4 ♗xb4 5. c3 ♗a5 6. d4 exd4 7. O-O d3 ' +
        '8. ♕b3 ♕f6 9. e5 ♕g6 10. ♖e1 ♘ge7 11. ♗a3 b5 12. ♕xb5 ♖b8 13. ♕a4 ♗b6 ' +
        '14. ♘bd2 ♗b7 15. ♘e4 ♕f5 16. ♗xd3 ♕h5 17. ♘f6+ gxf6 18. exf6 ♖g8 ' +
        '19. ♖ad1!! ♕xf3 20. ♖xe7+ ♘xe7 21. ♕xd7+! ♔xd7 22. ♗f5+ ♔e8 23. ♗d7+ ♔f8 24. ♗xe7# mate 1-0 ' +
        '19... ♖g4 fuerte. con 20... ♔d8. el mejor juego sería 21. ♖xd7+ ♔c8 22. ♖d8+ ♔xd8 ' +
        '(22... ♘xd8 23. ♕d7+! lleva a mate); 23. ♗f5+ (23. ♗e2+ ♘d4!) ♕xd1+ 24. ♕xd1+ ♘d4 25. ♗h3 ♗d5 incierto.',
      { algorithm: 3 },
    )[0].tree
    // Sit on Rd8+ (inside the analysis variation line); successor Kxd8 has the Nxd8 alt.
    const rd8 = [...t.nodes.values()].find((n) => n.san === 'Rd8+' && !n.invalid)!
    act(() => useStudyBoardStore.getState().loadPosition(t, rd8.id, true))

    const { result } = renderHook(() => useStudyNavigation())
    expect(result.current.hasChoiceAhead).toBe(true)
    // The variation chooser data: Kxd8 (line continuation) + Nxd8 (sub-variation).
    expect(result.current.siblingLines.length).toBeGreaterThan(0)
  })
})
