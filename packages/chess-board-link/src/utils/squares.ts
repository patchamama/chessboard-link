import type { Square } from '../core/types.js';

/**
 * Square <-> index helpers for the canonical a8..h1 board order used across
 * the library (rank 8 first, file a first). Index 0 = a8, index 63 = h1.
 */

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

/** Convert an a8..h1 array index (0-63) to an algebraic square. */
export function indexToSquare(index: number): Square {
  if (index < 0 || index > 63) {
    throw new RangeError(`square index out of range: ${index}`);
  }
  const file = index % 8; // 0 = a
  const rank = 8 - Math.floor(index / 8); // index 0 -> rank 8
  return `${FILES[file]}${rank}`;
}

/** Convert an algebraic square to its a8..h1 array index (0-63). */
export function squareToIndex(square: Square): number {
  const file = square.charCodeAt(0) - 97; // 'a' -> 0
  const rank = Number(square[1]);
  if (file < 0 || file > 7 || rank < 1 || rank > 8) {
    throw new RangeError(`invalid square: ${square}`);
  }
  return (8 - rank) * 8 + file;
}
