import { useCallback, useEffect, useRef, useState } from 'react';
import { parseBestMove, parseInfoLine, type UciEval } from './uci.js';

/**
 * Loads Stockfish (WASM) from a CDN as a Web Worker and exposes a small UCI
 * driver: set a position, get a streamed eval, and request the best move.
 *
 * We load a single-thread build so it works without COOP/COEP headers (the
 * Vite dev server doesn't set them by default). The worker is created from a
 * blob shim that imports the CDN script via `importScripts`.
 */
// asm.js build is a single self-contained file (no separate .wasm), which
// resolves cleanly from a cross-origin blob worker — no locateFile needed.
const STOCKFISH_CDN =
  'https://cdn.jsdelivr.net/npm/stockfish@10.0.2/src/stockfish.asm.js';

export interface StockfishApi {
  ready: boolean;
  /** Latest streamed evaluation (best line) for the analysed position. */
  evaluation: UciEval | null;
  /** Top candidate lines (MultiPV), ranked best-first. */
  lines: UciEval[];
  /** Analyse a FEN progressively; `multipv` controls how many lines to return. */
  analyse: (fen: string, opts?: { maxDepth?: number; multipv?: number }) => void;
  /** Ask for the best move at a skill level; resolves with a UCI move. */
  bestMove: (fen: string, opts?: { skill?: number; movetime?: number }) => Promise<string | null>;
  stop: () => void;
}

function createWorker(): Worker {
  // Worker shim: tell Emscripten where to fetch the .wasm/.nnue (it resolves
  // them relative to the script, which has no base URL inside a blob worker),
  // then pull the engine from the CDN and relay stdin/stdout.
  // Stockfish v10's stockfish.js runs as the worker itself: it posts UCI lines
  // out via postMessage and reads commands from onmessage. importScripts wires
  // it into our blob worker; we just relay messages 1:1.
  const shim = `importScripts('${STOCKFISH_CDN}');`;
  const blob = new Blob([shim], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}

export function useStockfish(): StockfishApi {
  const workerRef = useRef<Worker | null>(null);
  const [ready, setReady] = useState(false);
  const [evaluation, setEvaluation] = useState<UciEval | null>(null);
  const [lines, setLines] = useState<UciEval[]>([]);
  const linesRef = useRef<Record<number, UciEval>>({});
  const bestMoveResolver = useRef<((uci: string | null) => void) | null>(null);

  useEffect(() => {
    let worker: Worker;
    try {
      worker = createWorker();
    } catch {
      return;
    }
    workerRef.current = worker;

    worker.onmessage = (ev: MessageEvent) => {
      const line = String(ev.data);
      if (line.includes('uciok') || line.includes('readyok')) setReady(true);
      const info = parseInfoLine(line);
      if (info) {
        const rank = info.multipv ?? 1;
        linesRef.current[rank] = info;
        if (rank === 1) setEvaluation(info);
        // Rebuild the ranked list (1..N) from what we've collected.
        const ranked = Object.keys(linesRef.current)
          .map(Number)
          .sort((a, b) => a - b)
          .map((r) => linesRef.current[r]!);
        setLines(ranked);
      }
      const best = line.startsWith('bestmove') ? parseBestMove(line) : null;
      if (line.startsWith('bestmove') && bestMoveResolver.current) {
        bestMoveResolver.current(best);
        bestMoveResolver.current = null;
      }
    };

    worker.postMessage('uci');
    worker.postMessage('isready');

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const send = useCallback((cmd: string) => {
    workerRef.current?.postMessage(cmd);
  }, []);

  /**
   * Analyse a position, refining progressively. Stockfish streams an
   * `info depth N score …` line for every depth from 1 up to `maxDepth`, so the
   * eval bar starts moving almost immediately (≈depth 10) and keeps sharpening
   * up to `maxDepth` (30). We keep the previous eval visible while it deepens
   * instead of blanking it, for a smooth refinement.
   */
  const analyse = useCallback(
    (fen: string, opts: { maxDepth?: number; multipv?: number } = {}) => {
      const maxDepth = opts.maxDepth ?? 30;
      const multipv = opts.multipv ?? 1;
      send('stop');
      linesRef.current = {};
      send(`setoption name MultiPV value ${multipv}`);
      send(`position fen ${fen}`);
      send(`go depth ${maxDepth}`);
    },
    [send],
  );

  const bestMove = useCallback(
    (fen: string, opts: { skill?: number; movetime?: number } = {}): Promise<string | null> => {
      return new Promise((resolve) => {
        if (!workerRef.current) return resolve(null);
        bestMoveResolver.current = resolve;
        if (opts.skill !== undefined) {
          send(`setoption name Skill Level value ${opts.skill}`);
        }
        send(`position fen ${fen}`);
        send(`go movetime ${opts.movetime ?? 1000}`);
      });
    },
    [send],
  );

  const stop = useCallback(() => send('stop'), [send]);

  return { ready, evaluation, lines, analyse, bestMove, stop };
}
