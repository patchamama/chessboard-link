import { describe, expect, it } from 'vitest';
import { indexToSquare, squareToIndex } from './squares.js';

describe('square <-> index (a8..h1 order)', () => {
  it('maps the corners', () => {
    expect(indexToSquare(0)).toBe('a8');
    expect(indexToSquare(7)).toBe('h8');
    expect(indexToSquare(56)).toBe('a1');
    expect(indexToSquare(63)).toBe('h1');
  });

  it('is a bijection over all 64 squares', () => {
    for (let i = 0; i < 64; i++) {
      expect(squareToIndex(indexToSquare(i))).toBe(i);
    }
  });

  it('maps known squares', () => {
    expect(squareToIndex('e4')).toBe(36);
    expect(squareToIndex('e2')).toBe(52);
    expect(indexToSquare(36)).toBe('e4');
  });

  it('rejects out-of-range', () => {
    expect(() => indexToSquare(64)).toThrow();
    expect(() => squareToIndex('z9')).toThrow();
  });
});
