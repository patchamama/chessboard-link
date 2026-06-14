import { describe, it, expect } from 'vitest'
import type { Arrow } from 'react-chessboard'
import {
  buildBoardArrows,
  ENGINE_ARROW_COLOR,
  PREMOVE_ARROW_COLOR,
} from './engineArrows'

const userArrow: Arrow = { startSquare: 'a1', endSquare: 'a4', color: 'red' }

describe('buildBoardArrows', () => {
  it('always keeps user annotation arrows', () => {
    const arrows = buildBoardArrows({
      userArrows: [userArrow],
      showEval: false,
      hideEngineArrow: false,
    })
    expect(arrows).toContainEqual(userArrow)
  })

  it('adds the engine best-move arrow when eval is on and arrow not hidden', () => {
    const arrows = buildBoardArrows({
      userArrows: [],
      showEval: true,
      hideEngineArrow: false,
      bestMoveUci: 'e2e4',
    })
    expect(arrows).toContainEqual({ startSquare: 'e2', endSquare: 'e4', color: ENGINE_ARROW_COLOR })
  })

  it('omits the engine arrow when hideEngineArrow is true', () => {
    const arrows = buildBoardArrows({
      userArrows: [],
      showEval: true,
      hideEngineArrow: true,
      bestMoveUci: 'e2e4',
    })
    expect(arrows).toHaveLength(0)
  })

  it('shows the tree next-move (premove) arrow when eval is off', () => {
    const arrows = buildBoardArrows({
      userArrows: [],
      showEval: false,
      hideEngineArrow: false,
      nextMove: { from: 'g1', to: 'f3' },
    })
    expect(arrows).toContainEqual({ startSquare: 'g1', endSquare: 'f3', color: PREMOVE_ARROW_COLOR })
  })

  it('does not show the premove arrow when eval is on', () => {
    const arrows = buildBoardArrows({
      userArrows: [],
      showEval: true,
      hideEngineArrow: true,
      nextMove: { from: 'g1', to: 'f3' },
    })
    expect(arrows).toHaveLength(0)
  })

  it('engine and premove arrows are mutually exclusive', () => {
    const arrows = buildBoardArrows({
      userArrows: [],
      showEval: true,
      hideEngineArrow: false,
      bestMoveUci: 'e2e4',
      nextMove: { from: 'g1', to: 'f3' },
    })
    // Only the engine arrow, never the premove, while eval is on.
    expect(arrows).toHaveLength(1)
    expect(arrows[0].color).toBe(ENGINE_ARROW_COLOR)
  })
})
