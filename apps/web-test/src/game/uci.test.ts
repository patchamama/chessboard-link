import { describe, expect, it } from 'vitest';
import { evalToWhiteProbability, parseBestMove, parseInfoLine } from './uci.js';

describe('UCI parsing', () => {
  it('parses a centipawn score with depth and pv', () => {
    const e = parseInfoLine('info depth 18 seldepth 24 score cp 35 nodes 1000 pv e2e4 e7e5');
    expect(e).toEqual({ depth: 18, cp: 35, pv: ['e2e4', 'e7e5'] });
  });

  it('parses a mate score', () => {
    const e = parseInfoLine('info depth 20 score mate -3 pv a1a2');
    expect(e).toEqual({ depth: 20, mate: -3, pv: ['a1a2'] });
  });

  it('parses a MultiPV rank', () => {
    const e = parseInfoLine('info depth 15 multipv 3 score cp -12 pv d2d4 d7d5');
    expect(e?.multipv).toBe(3);
    expect(e?.pv).toEqual(['d2d4', 'd7d5']);
  });

  it('returns null for an info line without a score', () => {
    expect(parseInfoLine('info string NNUE evaluation using net')).toBeNull();
  });

  it('parses bestmove', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toBe('e2e4');
    expect(parseBestMove('bestmove (none)')).toBeNull();
  });

  it('maps eval to white probability (white better -> >0.5)', () => {
    expect(evalToWhiteProbability({ cp: 200 }, 'w')).toBeGreaterThan(0.5);
    // +200 cp for black to move means white is worse -> < 0.5
    expect(evalToWhiteProbability({ cp: 200 }, 'b')).toBeLessThan(0.5);
  });

  it('maps mate to near-certain probability', () => {
    expect(evalToWhiteProbability({ mate: 1 }, 'w')).toBeGreaterThan(0.99);
    expect(evalToWhiteProbability({ mate: 1 }, 'b')).toBeLessThan(0.01);
  });
});
