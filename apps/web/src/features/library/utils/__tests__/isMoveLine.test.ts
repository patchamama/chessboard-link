import { describe, it, expect } from 'vitest'
import { isMoveLine } from '../isMoveLine'

describe('isMoveLine', () => {
  it.each([
    '1. e4 e5',
    '12... Nf6',
    'e4 is the best',
    'Nf3 develops',
    'O-O and the king is safe',
    'exd5 opens the file',
    'Qxf7+ wins',
    '♘f3 controls the centre',
    '!? an interesting try',
    '+/- white is better',
  ])('treats %j as a move line', (line) => {
    expect(isMoveLine(line)).toBe(true)
  })

  it.each([
    'The position is balanced.',
    'White has a slight edge.',
    'In this chapter we study the Sicilian.',
    '',
    'A pawn structure analysis follows.',
  ])('treats %j as prose (not a move line)', (line) => {
    expect(isMoveLine(line)).toBe(false)
  })
})
