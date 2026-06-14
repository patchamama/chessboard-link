import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { getPieceSet, PIECE_CODES } from './index'

describe('piece sets', () => {
  it('default theme returns null (use library built-in pieces)', () => {
    expect(getPieceSet('default')).toBeNull()
  })

  it.each(['alpha', 'merida'] as const)('%s set defines all 12 piece codes', (theme) => {
    const set = getPieceSet(theme)
    expect(set).not.toBeNull()
    for (const code of PIECE_CODES) {
      expect(typeof set![code]).toBe('function')
    }
  })

  it.each(['alpha', 'merida'] as const)('%s pieces render an <svg>', (theme) => {
    const set = getPieceSet(theme)!
    const { container } = render(set.wN())
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
