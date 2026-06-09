/**
 * stockfishWorker.ts
 *
 * Factory that creates a Web Worker running stockfish.wasm (stockfish npm v18).
 * The worker speaks a simple JSON message protocol:
 *
 *   Incoming (host → worker):  { type: 'evaluate', fen: string, depth?: number }
 *   Outgoing (worker → host):  { type: 'eval', fen: string, scoreCp?: number, mate?: number, bestMove?: string, depth: number }
 *
 * In Vitest, this module is mocked entirely — no WASM runs in tests.
 *
 * WASM package: `stockfish` npm (v18) — stockfish.js by nmrugg, Stockfish 18.
 * We use stockfish-18-lite-single.js (no CORS headers needed, smaller, still superhuman).
 */

export function createStockfishWorker(): Worker {
  // The worker script is inlined via Vite's ?worker&url import pattern.
  // We use a blob URL so we can control the source.
  const workerCode = `
import Stockfish from 'stockfish/src/stockfish-lite-single.js';

let engineReady = false;
const pending = new Map(); // fen -> {depth}

let sf = null;
let currentFen = null;
let currentDepth = 15;

Stockfish().then(engine => {
  sf = engine;
  sf.addMessageListener(onMessage);
  sf.postMessage('uci');
});

function onMessage(line) {
  if (line === 'uciok') {
    sf.postMessage('isready');
    return;
  }
  if (line === 'readyok') {
    engineReady = true;
    // Process any queued request
    if (currentFen) sendEval();
    return;
  }
  if (line.startsWith('bestmove') && currentFen) {
    const bestMove = line.split(' ')[1];
    if (bestMove && bestMove !== '(none)') {
      // bestMove might update the last posted result
      self.postMessage({ type: 'evalBestMove', fen: currentFen, bestMove });
    }
    return;
  }
  if (line.startsWith('info') && line.includes('score')) {
    const depthMatch = line.match(/\\bdepth\\s+(\\d+)/);
    const cpMatch    = line.match(/\\bscore cp\\s+(-?\\d+)/);
    const mateMatch  = line.match(/\\bscore mate\\s+(-?\\d+)/);
    const pvMatch    = line.match(/\\bpv\\s+(\\S+)/);
    if (!depthMatch) return;
    const depth    = parseInt(depthMatch[1]);
    const bestMove = pvMatch ? pvMatch[1] : undefined;
    if (mateMatch) {
      self.postMessage({ type: 'eval', fen: currentFen, mate: parseInt(mateMatch[1]), bestMove, depth });
    } else if (cpMatch) {
      self.postMessage({ type: 'eval', fen: currentFen, scoreCp: parseInt(cpMatch[1]), bestMove, depth });
    }
  }
}

function sendEval() {
  sf.postMessage('ucinewgame');
  sf.postMessage('position fen ' + currentFen);
  sf.postMessage('go depth ' + currentDepth);
}

self.onmessage = (e) => {
  const { type, fen, depth } = e.data;
  if (type === 'evaluate') {
    currentFen   = fen;
    currentDepth = depth || 15;
    if (engineReady) sendEval();
  }
};
`
  const blob = new Blob([workerCode], { type: 'application/javascript' })
  const url  = URL.createObjectURL(blob)
  const worker = new Worker(url, { type: 'module' })
  URL.revokeObjectURL(url)
  return worker
}
