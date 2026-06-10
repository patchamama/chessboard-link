/**
 * stockfishWorker.ts
 *
 * Loads Stockfish 10 from jsDelivr CDN (CORS: *).
 * We fetch the SF10 script, wrap it in a blob URL, and use that as a
 * sub-worker so SF10's onmessage takeover is isolated from our logic.
 *
 * Message protocol (app ↔ outer worker):
 *   IN  { type: 'evaluate', fen, depth? }
 *   OUT { type: 'eval', fen, scoreCp?, mate?, bestMove?, depth }
 *
 *   IN  { type: 'lines', fen, depth?, count? }
 *   OUT { type: 'lines', fen, lines: [{idx, pv, scoreCp?, mate?, depth}] }
 */

const SF_CDN = 'https://cdn.jsdelivr.net/npm/stockfish.js@10/stockfish.js'

export function createStockfishWorker(): Worker {
  const wrapperCode = `
const SF_URL = '${SF_CDN}';

let sf            = null;
let engineReady   = false;
let pendingSetup  = null;   // { fen, depth, mode, count } to run once ready
let currentFen    = null;
let currentDepth  = 15;
let currentMode   = 'evaluate';
let currentCount  = 5;
const pvMap       = new Map();

function send(cmd) { if (sf) sf.postMessage(cmd); }

function analyze() {
  pvMap.clear();
  send('stop');
  send('setoption name MultiPV value ' + (currentMode === 'lines' ? currentCount : 1));
  send('ucinewgame');
  send('position fen ' + currentFen);
  send('go depth ' + currentDepth);
}

function attachSf(worker) {
  sf = worker;
  sf.onmessage = function(e) {
    const line = e.data;
    if (typeof line !== 'string') return;

    if (line === 'uciok')   { send('isready'); return; }
    if (line === 'readyok') {
      engineReady = true;
      if (pendingSetup) {
        const p = pendingSetup; pendingSetup = null;
        currentFen   = p.fen;
        currentDepth = p.depth;
        currentMode  = p.mode;
        currentCount = p.count;
        analyze();
      }
      return;
    }

    if (line.startsWith('bestmove')) {
      if (currentMode === 'lines' && pvMap.size > 0) {
        const lines = Array.from(pvMap.values()).sort((a, b) => a.idx - b.idx);
        self.postMessage({ type: 'lines', fen: currentFen, lines });
        pvMap.clear();
      }
      return;
    }

    if (!line.startsWith('info') || !line.includes(' score ')) return;

    const depthM = line.match(/\\bdepth\\s+(\\d+)/);
    const cpM    = line.match(/\\bscore cp\\s+(-?\\d+)/);
    const mateM  = line.match(/\\bscore mate\\s+(-?\\d+)/);
    const pvM    = line.match(/\\bpv\\s+(.+)/);
    const mpvM   = line.match(/\\bmultipv\\s+(\\d+)/);
    if (!depthM) return;

    const depth = parseInt(depthM[1]);
    const pv    = pvM ? pvM[1].trim().split(' ') : [];
    const idx   = mpvM ? parseInt(mpvM[1]) : 1;

    if (currentMode === 'evaluate') {
      const bestMove = pv[0];
      if (mateM) {
        self.postMessage({ type: 'eval', fen: currentFen, mate: parseInt(mateM[1]), bestMove, depth });
      } else if (cpM) {
        self.postMessage({ type: 'eval', fen: currentFen, scoreCp: parseInt(cpM[1]), bestMove, depth });
      }
    } else {
      if (depth < currentDepth - 2) return;
      const entry = { idx, pv, depth };
      if (mateM) entry.mate = parseInt(mateM[1]);
      if (cpM)   entry.scoreCp = parseInt(cpM[1]);
      pvMap.set(idx, entry);
    }
  };

  send('uci');
}

// Fetch SF10 and create a blob worker (avoids importScripts CORS issues)
fetch(SF_URL)
  .then(r => r.text())
  .then(code => {
    const blob = new Blob([code], { type: 'application/javascript' });
    const url  = URL.createObjectURL(blob);
    attachSf(new Worker(url));
    URL.revokeObjectURL(url);
  })
  .catch(err => {
    self.postMessage({ type: 'error', message: 'Failed to load Stockfish: ' + err.message });
  });

self.onmessage = function(e) {
  const { type, fen, depth, count } = e.data || {};
  if (type !== 'evaluate' && type !== 'lines') return;

  const setup = {
    fen,
    depth: depth  || 15,
    mode:  type,
    count: count  || 5,
  };

  if (!engineReady) {
    pendingSetup = setup;
    return;
  }

  currentFen   = setup.fen;
  currentDepth = setup.depth;
  currentMode  = setup.mode;
  currentCount = setup.count;
  analyze();
};
`

  const blob   = new Blob([wrapperCode], { type: 'application/javascript' })
  const url    = URL.createObjectURL(blob)
  const worker = new Worker(url)
  URL.revokeObjectURL(url)
  return worker
}
