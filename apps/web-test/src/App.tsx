import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearLeds,
  highlightMove,
  WebBluetoothTransport,
  type BoardAdapter,
  type ConnectionStatus,
  type DetectedMove,
} from 'chess-board-link';
import { ChessBoard } from './components/ChessBoard.js';
import { EvalBar } from './components/EvalBar.js';
import { FenPanel } from './components/FenPanel.js';
import { BoardTabs } from './components/BoardTabs.js';
import { PhysicalControls } from './components/PhysicalControls.js';
import { EventLog, type LogEntry } from './components/EventLog.js';
import { useChessGame } from './game/useChessGame.js';
import { useStockfish } from './game/useStockfish.js';
import { useBoardSessions } from './boards/useBoardSessions.js';
import { START_FEN } from './boards/boardStorage.js';
import { useTheme } from './useTheme.js';
import { PlayIcon, PauseIcon, SunIcon, MoonIcon } from './components/Icons.js';
import { APP_VERSION } from './version.js';

export function App() {
  const sessionsApi = useBoardSessions();
  const { registry, sessions, activeId, setActiveId, ensureSession, updateSession, updateConfig, getAdapter, removeSession } = sessionsApi;

  const active = sessions[activeId];
  const game = useChessGame(active?.fen ?? START_FEN);
  const sf = useStockfish();
  const { theme, toggle: toggleTheme } = useTheme();

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [knownDevices, setKnownDevices] = useState<string[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const adapterRef = useRef<BoardAdapter | null>(null);

  const append = useCallback((text: string) => {
    setLog((l) => [{ ts: new Date().toLocaleTimeString(), text }, ...l].slice(0, 100));
  }, []);

  // Make sure the active board has a session.
  useEffect(() => {
    if (!sessions[activeId]) ensureSession(activeId);
  }, [activeId, sessions, ensureSession]);

  // List paired BLE devices (for one-click reconnect after refresh).
  useEffect(() => {
    WebBluetoothTransport.getKnownDevices()
      .then((d) => setKnownDevices(d.map((x) => x.id)))
      .catch(() => {});
  }, []);

  // When switching tabs, load that board's saved position into the game.
  useEffect(() => {
    if (active?.fen) game.loadFen(active.fen);
    adapterRef.current = getAdapter(activeId);
    setStatus(adapterRef.current.status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Analyse the current position whenever it changes and the engine is ready.
  useEffect(() => {
    if (sf.ready) sf.analyse(game.fen, 30); // progressive: streams depth 1→30
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.fen, sf.ready]);

  // Persist the active board's game on every move.
  useEffect(() => {
    updateSession(activeId, { fen: game.fen, pgn: game.pgn });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.fen]);

  // Bot: when it's the bot's turn, ask Stockfish and apply its move.
  useEffect(() => {
    const cfg = active?.config;
    if (!cfg?.botEnabled || game.result !== 'in_progress') return;
    const botColor = cfg.botPlaysWhite ? 'w' : 'b';
    if (game.turn !== botColor) return;
    let cancelled = false;
    sf.bestMove(game.fen, { skill: cfg.botSkill, movetime: 800 }).then((uci) => {
      if (!cancelled && uci) {
        const m = game.move(uci);
        if (m) {
          append(`bot: ${m.san}`);
          void highlightOnPhysical(uci);
        }
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.fen, active?.config]);

  function wireAdapter(adapter: BoardAdapter) {
    adapter.on('status', (s) => {
      setStatus(s);
      append(`[${adapter.id}] status: ${s}`);
      if (s === 'connected' && adapter.deviceId) {
        updateSession(adapter.id, { deviceId: adapter.deviceId, deviceName: adapter.deviceName });
      }
    });
    adapter.on('move', (m: DetectedMove) => {
      // A move made on the physical board — apply it to the game if legal.
      const applied = game.move(m.uci);
      append(`[${adapter.id}] board move: ${m.uci}${applied ? ` (${applied.san})` : ' (ignored)'}`);
    });
    adapter.on('error', (e) => append(`[${adapter.id}] error: ${e.message}`));
  }

  async function connect(useKnownDevice: boolean) {
    const adapter = getAdapter(activeId);
    adapterRef.current = adapter;
    wireAdapter(adapter);
    try {
      const deviceId = useKnownDevice ? active?.deviceId : undefined;
      await adapter.connect(deviceId ? { deviceId } : undefined);
    } catch (e) {
      append(`connect failed: ${(e as Error).message}`);
    }
  }

  async function disconnect() {
    await adapterRef.current?.disconnect().catch(() => {});
  }

  async function highlightOnPhysical(uci: string) {
    const adapter = adapterRef.current;
    if (adapter?.status === 'connected' && adapter.setLeds) {
      await highlightMove(adapter, uci).catch((e) => append(`led: ${(e as Error).message}`));
    }
  }

  // User moves on the on-screen board: validated by chess.js, then mirrored to
  // the physical board by lighting the move's squares.
  function onUserMove(uci: string) {
    const m = game.move(uci);
    if (!m) return;
    append(`you: ${m.san}`);
    void highlightOnPhysical(uci);
  }

  const reg = registry.get(activeId);
  const supportsLeds = !!adapterRef.current?.setLeds;
  const cfg = active?.config;

  return (
    <div className="app">
      <header className="banner">
        <strong>chess-board-link</strong> · web test
        <span className="version">v{APP_VERSION}</span>
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      <BoardTabs
        boards={registry.list()}
        sessions={sessions}
        activeId={activeId}
        onSelect={setActiveId}
        onAdd={(id) => {
          ensureSession(id);
          setActiveId(id);
        }}
        onRemove={(id) => void removeSession(id)}
      />

      <PhysicalControls
        status={status}
        transportType={reg?.transportType ?? 'bluetooth'}
        hasKnownDevice={!!active?.deviceId && knownDevices.includes(active.deviceId)}
        supportsLeds={supportsLeds}
        canHighlight={!!game.lastMove}
        onConnect={() => void connect(false)}
        onReconnect={() => void connect(true)}
        onDisconnect={() => void disconnect()}
        onHighlightLast={() => game.lastMove && void highlightOnPhysical(game.lastMove.uci)}
        onClearLeds={() => adapterRef.current && void clearLeds(adapterRef.current)}
        onSyncFromPhysical={() => {
          game.reset();
          updateSession(activeId, { fen: START_FEN, pgn: '' });
          append('synced: reset to starting position');
        }}
        onShowPhysicalState={() => {
          const a = adapterRef.current;
          if (a) append(`physical state has ${a.getState().filter(Boolean).length} pieces`);
        }}
      />

      <section className="controls">
        <label>
          <input
            type="checkbox"
            checked={cfg?.flipped ?? false}
            onChange={(e) => updateConfig(activeId, { flipped: e.target.checked })}
          />
          Flip
        </label>
        <button
          type="button"
          className={`play-btn ${cfg?.botEnabled ? 'playing' : ''}`}
          disabled={!sf.ready}
          onClick={() => updateConfig(activeId, { botEnabled: !cfg?.botEnabled })}
          title={cfg?.botEnabled ? 'Stop playing vs bot' : 'Play vs bot'}
        >
          {cfg?.botEnabled ? <PauseIcon /> : <PlayIcon />}
          {cfg?.botEnabled ? 'Stop bot' : sf.ready ? 'Play vs bot' : 'Bot loading…'}
        </button>
        <label>
          Bot plays&nbsp;
          <select
            value={cfg?.botPlaysWhite ? 'w' : 'b'}
            onChange={(e) => updateConfig(activeId, { botPlaysWhite: e.target.value === 'w' })}
          >
            <option value="b">Black</option>
            <option value="w">White</option>
          </select>
        </label>
        <label>
          Skill&nbsp;
          <input
            type="range"
            min={0}
            max={20}
            value={cfg?.botSkill ?? 5}
            onChange={(e) => updateConfig(activeId, { botSkill: Number(e.target.value) })}
          />
          {cfg?.botSkill ?? 5}
        </label>
        <button type="button" onClick={() => { game.reset(); updateSession(activeId, { fen: START_FEN, pgn: '' }); }}>
          New game
        </button>
        <button type="button" onClick={() => game.undo()}>Undo</button>
      </section>

      <div className="layout">
        <EvalBar evaluation={sf.evaluation} sideToMove={game.turn} />
        <ChessBoard
          fen={game.fen}
          legalTargets={game.legalTargets}
          onMove={onUserMove}
          lastMove={game.lastMove}
          flipped={cfg?.flipped}
        />
        <div className="side">
          <FenPanel fen={game.fen} turn={game.turn} result={game.result} evaluation={sf.evaluation} />
          <EventLog log={log} />
        </div>
      </div>

      <footer className="note">
        Web Bluetooth / Web Serial need a Chromium browser over https or localhost.
        Moving on screen lights the move on the physical board (boards with LEDs).
        Physical moves are applied to the game when legal. Sessions persist across
        refreshes; click Reconnect to re-link a paired board.
      </footer>
    </div>
  );
}
