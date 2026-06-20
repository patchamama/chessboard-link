/**
 * Per-board session persisted to localStorage so the page survives a refresh:
 * which board, which paired device (for one-click reconnect), and the current
 * game (FEN/PGN) + config (orientation, bot settings).
 */
export interface BoardConfig {
  flipped: boolean;
  botEnabled: boolean;
  botSkill: number; // 0..20
  botPlaysWhite: boolean;
  pieceSet: string; // cburnett, merida, alpha, …
  boardTheme: string; // square colours: brown, blue, green, grey
}

export interface BoardSession {
  /** Registry board id, e.g. "chessup". */
  boardId: string;
  /** Paired Bluetooth device id, if known (for reconnect). */
  deviceId?: string;
  deviceName?: string;
  fen: string;
  pgn: string;
  config: BoardConfig;
}

const STORAGE_KEY = 'cbl.sessions.v1';
const ACTIVE_KEY = 'cbl.active.v1';

export const DEFAULT_CONFIG: BoardConfig = {
  flipped: false,
  botEnabled: false,
  botSkill: 5,
  botPlaysWhite: false,
  pieceSet: 'cburnett',
  boardTheme: 'brown',
};

export const START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function newSession(boardId: string): BoardSession {
  return { boardId, fen: START_FEN, pgn: '', config: { ...DEFAULT_CONFIG } };
}

/** Load all sessions, keyed by boardId. Returns {} on any parse error. */
export function loadSessions(storage: Storage = localStorage): Record<string, BoardSession> {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, BoardSession>;
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed;
  } catch {
    return {};
  }
}

export function saveSessions(
  sessions: Record<string, BoardSession>,
  storage: Storage = localStorage,
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Quota/availability errors are non-fatal for a test app.
  }
}

export function loadActiveBoardId(storage: Storage = localStorage): string | null {
  try {
    return storage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveBoardId(boardId: string, storage: Storage = localStorage): void {
  try {
    storage.setItem(ACTIVE_KEY, boardId);
  } catch {
    // ignore
  }
}
