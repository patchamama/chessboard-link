import { describe, it, expect } from 'vitest';
import { spanishTokenToEnglish, spanishToEnglish } from '../../notation/spanishToEnglish.js';

describe('spanishTokenToEnglish', () => {
  it.each([
    // Piece mappings
    ['Cf3', 'Nf3'],
    ['Cc6', 'Nc6'],
    ['Ae2', 'Be2'],
    ['Axf7', 'Bxf7'],
    ['Dd5', 'Qd5'],
    ['Dxd5', 'Qxd5'],
    ['Tf1', 'Rf1'],
    ['Txe5', 'Rxe5'],
    ['Re1', 'Ke1'],  // Rey = King
    // Castling normalisation
    ['0-0', 'O-O'],
    ['0-0-0', 'O-O-O'],
    ['O-O', 'O-O'],
    ['O-O-O', 'O-O-O'],
    // Pawn moves unchanged
    ['e4', 'e4'],
    ['exd5', 'exd5'],
    ['e8=Q', 'e8=Q'],
    // Checks/mates preserved
    ['Nf3+', 'Nf3+'],
    ['Qxd5#', 'Qxd5#'],
  ])('converts %s -> %s', (input, expected) => {
    expect(spanishTokenToEnglish(input)).toBe(expected);
  });

  it('T->R does not clobber King (R->K processed after T->R)', () => {
    // If T (Rook) is processed first, Torre->R, then R->K only catches the ORIGINAL R
    // No T should be in King moves, but T->R must not accidentally become K
    expect(spanishTokenToEnglish('Tf1')).toBe('Rf1');  // Rook f1
    expect(spanishTokenToEnglish('Re1')).toBe('Ke1');  // King e1
  });

  it('disambiguating R: only uppercase R at start is King', () => {
    // Rxe5 in Spanish = Rook capture = English Rxe5 (wait, T=Rook, R=King)
    // So Spanish Rxe5 means King takes e5
    expect(spanishTokenToEnglish('Rxe5')).toBe('Kxe5');
  });
});

describe('spanishToEnglish (full text)', () => {
  it('converts Spanish notation in a full PGN string', () => {
    const input = '1. e4 e5 2. Cf3 Cc6 3. Ac4 Ac5';
    const result = spanishToEnglish(input);
    expect(result).toBe('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5');
  });

  it('handles 0-0 castling normalisation', () => {
    expect(spanishToEnglish('4. 0-0')).toBe('4. O-O');
    expect(spanishToEnglish('4. 0-0-0')).toBe('4. O-O-O');
  });

  it('preserves pawn moves and ranks unchanged', () => {
    const input = '1. d4 d5 2. c4';
    expect(spanishToEnglish(input)).toBe('1. d4 d5 2. c4');
  });

  it('converts ellipsis variants', () => {
    expect(spanishToEnglish('2… Nc6')).toBe('2... Nc6');
    expect(spanishToEnglish('2&#8230; Nc6')).toBe('2... Nc6');
  });

  it('Torre (T) -> Rook (R) without clobbering King', () => {
    // In a string: T = Torre (Rook), R = Rey (King)
    const input = '1. e4 e5 10. Tf1 Re1';
    const result = spanishToEnglish(input);
    expect(result).toContain('Rf1');
    expect(result).toContain('Ke1');
  });

  it('Dama (D) -> Queen (Q)', () => {
    expect(spanishToEnglish('5. Dd5 Dxd5')).toContain('Qd5');
  });

  it('does NOT convert Re1 to Ke1 in English notation (regression)', () => {
    // English text uses K/N/Q — Re1 means Rook e1, must not become Ke1
    const english = '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 10. Re1 Nge7'
    const result = spanishToEnglish(english)
    expect(result).toContain('Re1')
    expect(result).not.toContain('Ke1')
  });

  it('does NOT convert O-O to mangled form in English notation', () => {
    const english = '7. O-O d3 8. Qb3 Qf6'
    expect(spanishToEnglish(english)).toBe('7. O-O d3 8. Qb3 Qf6')
  });
});
