import { describe, expect, it } from 'vitest';
import {
  loadSessions,
  newSession,
  saveSessions,
  START_FEN,
  type BoardSession,
} from './boardStorage.js';

/** Minimal in-memory Storage for tests. */
function memStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

describe('boardStorage', () => {
  it('creates a fresh session at the starting position', () => {
    const s = newSession('chessup');
    expect(s.boardId).toBe('chessup');
    expect(s.fen).toBe(START_FEN);
    expect(s.config.flipped).toBe(false);
  });

  it('round-trips sessions through storage', () => {
    const storage = memStorage();
    const sessions: Record<string, BoardSession> = {
      chessup: { ...newSession('chessup'), deviceId: 'abc', fen: 'somefen' },
      dgt: newSession('dgt'),
    };
    saveSessions(sessions, storage);
    const loaded = loadSessions(storage);
    expect(loaded.chessup?.deviceId).toBe('abc');
    expect(loaded.chessup?.fen).toBe('somefen');
    expect(loaded.dgt?.boardId).toBe('dgt');
  });

  it('returns {} on corrupt storage', () => {
    const storage = memStorage();
    storage.setItem('cbl.sessions.v1', '{not json');
    expect(loadSessions(storage)).toEqual({});
  });
});
