import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createDefaultRegistry, type BoardAdapter } from 'chess-board-link';
import {
  type BoardConfig,
  type BoardSession,
  loadActiveBoardId,
  loadSessions,
  newSession,
  saveActiveBoardId,
  saveSessions,
} from './boardStorage.js';

/**
 * Manages several board sessions at once: persistence to localStorage, the
 * active board, live adapter instances (kept across tab switches), and
 * per-board config/FEN. The game engine lives in the App and reads/writes the
 * active session's fen/pgn through here.
 */
export function useBoardSessions() {
  const registry = useMemo(() => createDefaultRegistry(), []);
  const [sessions, setSessions] = useState<Record<string, BoardSession>>(() => loadSessions());
  const [activeId, setActiveId] = useState<string>(
    () => loadActiveBoardId() ?? loadSessions()['chessnut']?.boardId ?? 'chessnut',
  );
  // Live adapters by boardId — not serialisable, kept outside React state.
  const adapters = useRef<Record<string, BoardAdapter>>({});
  const [, forceRender] = useState(0);

  // Persist whenever sessions or active board change.
  useEffect(() => saveSessions(sessions), [sessions]);
  useEffect(() => saveActiveBoardId(activeId), [activeId]);

  const ensureSession = useCallback((boardId: string): BoardSession => {
    let created: BoardSession | undefined;
    setSessions((prev) => {
      if (prev[boardId]) return prev;
      created = newSession(boardId);
      return { ...prev, [boardId]: created };
    });
    return created ?? sessions[boardId] ?? newSession(boardId);
  }, [sessions]);

  const updateSession = useCallback(
    (boardId: string, patch: Partial<BoardSession>) => {
      setSessions((prev) => ({
        ...prev,
        [boardId]: { ...(prev[boardId] ?? newSession(boardId)), ...patch },
      }));
    },
    [],
  );

  const updateConfig = useCallback(
    (boardId: string, patch: Partial<BoardConfig>) => {
      setSessions((prev) => {
        const s = prev[boardId] ?? newSession(boardId);
        return { ...prev, [boardId]: { ...s, config: { ...s.config, ...patch } } };
      });
    },
    [],
  );

  const getAdapter = useCallback((boardId: string): BoardAdapter => {
    let a = adapters.current[boardId];
    if (!a) {
      a = registry.create(boardId);
      adapters.current[boardId] = a;
    }
    return a;
  }, [registry]);

  const removeSession = useCallback(
    async (boardId: string) => {
      await adapters.current[boardId]?.disconnect().catch(() => {});
      delete adapters.current[boardId];
      setSessions((prev) => {
        const next = { ...prev };
        delete next[boardId];
        return next;
      });
    },
    [],
  );

  return {
    registry,
    sessions,
    activeId,
    setActiveId,
    ensureSession,
    updateSession,
    updateConfig,
    getAdapter,
    removeSession,
    forceRender: () => forceRender((n) => n + 1),
  };
}
