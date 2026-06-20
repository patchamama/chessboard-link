import { useMemo, useRef, useState } from 'react';
import {
  createDefaultRegistry,
  emptyBoard,
  startingBoard,
  fenToBoard,
  type BoardAdapter,
  type BoardState,
  type ConnectionStatus,
  type DetectedMove,
  MockAdapter,
} from 'chess-board-link';
import { Board } from './Board.js';
import { APP_VERSION } from './version.js';

interface LogEntry {
  ts: string;
  text: string;
}

export function App() {
  const registry = useMemo(() => createDefaultRegistry(), []);
  const [boardId, setBoardId] = useState('chessnut');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [state, setState] = useState<BoardState>(emptyBoard());
  const [log, setLog] = useState<LogEntry[]>([]);
  const adapterRef = useRef<BoardAdapter | null>(null);

  const append = (text: string) =>
    setLog((l) => [{ ts: new Date().toLocaleTimeString(), text }, ...l].slice(0, 100));

  const reg = registry.get(boardId);

  async function connect() {
    if (adapterRef.current) await adapterRef.current.disconnect().catch(() => {});
    const adapter = registry.create(boardId);
    adapterRef.current = adapter;

    adapter.on('status', (s) => {
      setStatus(s);
      append(`status: ${s}`);
    });
    adapter.on('boardState', (b) => setState([...b]));
    adapter.on('move', (m: DetectedMove) =>
      append(`move: ${m.uci}${m.san ? ` (${m.san})` : ''}`),
    );
    adapter.on('error', (e) => append(`error: ${e.message}`));

    try {
      await adapter.connect();
    } catch (e) {
      append(`connect failed: ${(e as Error).message}`);
    }
  }

  async function disconnect() {
    await adapterRef.current?.disconnect().catch(() => {});
    adapterRef.current = null;
  }

  /** Drive the Mock adapter through a short opening so the UI can be tested. */
  function runMockDemo() {
    const adapter = adapterRef.current;
    if (!(adapter instanceof MockAdapter)) {
      append('select the Mock board and connect first');
      return;
    }
    const seq = [
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR', // e4
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR', // e5
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R', // Nf3
    ].map(fenToBoard);
    adapter.playback(seq, 900);
    append('mock demo: 1.e4 e5 2.Nf3');
  }

  return (
    <div className="app">
      <header className="banner">
        <strong>chess-board-link</strong> · web test
        <span className="version">v{APP_VERSION}</span>
      </header>

      <section className="controls">
        <label>
          Board:&nbsp;
          <select value={boardId} onChange={(e) => setBoardId(e.target.value)}>
            {registry.list().map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.transportType}){b.experimental ? ' · experimental' : ''}
              </option>
            ))}
          </select>
        </label>
        <button onClick={connect}>
          Connect {reg?.transportType === 'serial' ? '(USB)' : '(Bluetooth)'}
        </button>
        <button onClick={disconnect}>Disconnect</button>
        {boardId === 'mock' && <button onClick={runMockDemo}>Run demo</button>}
        <button onClick={() => setState(startingBoard())}>Show start pos</button>
        <span className={`status status-${status}`}>{status}</span>
      </section>

      <div className="layout">
        <Board state={state} />
        <aside className="log">
          <h3>Event log</h3>
          <ul>
            {log.map((e, i) => (
              <li key={i}>
                <span className="ts">{e.ts}</span> {e.text}
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <footer className="note">
        Web Bluetooth / Web Serial require a Chromium browser over https or
        localhost. Chessnut (BLE) and DGT (USB) use real reverse-engineered
        protocols; ChessUp is an experimental stub; Mock needs no hardware.
      </footer>
    </div>
  );
}
