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
 *   OUT { type: 'lines', fen, lines: [{idx, pv, scoreCp?, mate?, depth, nodes?, nps?, time?}], final }
 *        — streamed: one message per completed depth (progressive analysis),
 *          plus a final message (final:true) when `bestmove` arrives.
 */

export const SF_DEFAULT_URL = 'https://cdn.jsdelivr.net/npm/stockfish.js@10/stockfish.js'

export function createStockfishWorker(sfUrl: string = SF_DEFAULT_URL): Worker {
  const wrapperCode = `
const SF_URL = '${sfUrl}';

let sf            = null;
let engineReady   = false;
let pendingSetup  = null;   // { fen, depth, mode, count } to run once ready
let currentFen    = null;
let currentDepth  = 15;
let currentMode   = 'evaluate';
let currentCount  = 5;
let lastEmitDepth = 0;      // last depth streamed to the app (lines mode)
let lastEmitAt    = 0;      // timestamp (ms) of the last streamed emit
const EMIT_THROTTLE_MS = 60;
const pvMap       = new Map();

function send(cmd) { if (sf) sf.postMessage(cmd); }

function analyze() {
  pvMap.clear();
  lastEmitDepth = 0;
  lastEmitAt = 0;
  send('stop');
  send('setoption name MultiPV value ' + (currentMode === 'lines' ? currentCount : 1));
  send('ucinewgame');
  send('position fen ' + currentFen);
  send('go depth ' + currentDepth);
}

// Emit the current MultiPV set as a 'lines' message. final=true marks the
// message produced when the engine reports bestmove (target depth reached).
function emitLines(final) {
  if (pvMap.size === 0) return;
  const lines = Array.from(pvMap.values()).sort((a, b) => a.idx - b.idx);
  self.postMessage({ type: 'lines', fen: currentFen, lines: lines, final: final });
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
      if (currentMode === 'lines') emitLines(true);
      pvMap.clear();
      return;
    }

    if (!line.startsWith('info') || !line.includes(' score ')) return;

    const depthM = line.match(/\\bdepth\\s+(\\d+)/);
    const cpM    = line.match(/\\bscore cp\\s+(-?\\d+)/);
    const mateM  = line.match(/\\bscore mate\\s+(-?\\d+)/);
    const pvM    = line.match(/\\bpv\\s+(.+)/);
    const mpvM   = line.match(/\\bmultipv\\s+(\\d+)/);
    const nodesM = line.match(/\\bnodes\\s+(\\d+)/);
    const npsM   = line.match(/\\bnps\\s+(\\d+)/);
    const timeM  = line.match(/\\btime\\s+(\\d+)/);
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
      // A 'pv' is required: SF also emits bound-only score lines (upperbound/
      // lowerbound) with no usable variation — skip those, they would blank the PV.
      if (pv.length === 0) return;

      const entry = { idx: idx, pv: pv, depth: depth };
      if (mateM)  entry.mate    = parseInt(mateM[1]);
      if (cpM)    entry.scoreCp = parseInt(cpM[1]);
      if (nodesM) entry.nodes   = parseInt(nodesM[1]);
      if (npsM)   entry.nps     = parseInt(npsM[1]);
      if (timeM)  entry.time    = parseInt(timeM[1]);
      pvMap.set(idx, entry);

      // Progressive streaming: forward every refined score as it arrives so the
      // bar/panel update live while depth ramps up. Emit once we have the full
      // MultiPV set for this round (idx reached count), throttled to ~60ms to
      // avoid flooding the main thread, but always emit on a new depth.
      if (idx >= currentCount) {
        const now = Date.now();
        if (now - lastEmitAt >= EMIT_THROTTLE_MS || depth > lastEmitDepth) {
          lastEmitAt = now;
          lastEmitDepth = depth;
          emitLines(false);
        }
      }
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
