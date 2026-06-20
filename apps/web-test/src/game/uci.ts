/** Parsed evaluation from a UCI `info` line. */
export interface UciEval {
  /** Centipawns from the side-to-move's perspective (positive = better). */
  cp?: number;
  /** Mate in N (positive = side-to-move mates, negative = gets mated). */
  mate?: number;
  depth?: number;
  /** MultiPV rank (1 = best line), when MultiPV is enabled. */
  multipv?: number;
  /** Principal variation (UCI moves), first is the candidate move. */
  pv?: string[];
}

/** Parse an engine `info ... score cp/mate ... [multipv N] [pv ...]` line. */
export function parseInfoLine(line: string): UciEval | null {
  if (!line.startsWith('info')) return null;
  const out: UciEval = {};
  const depth = /\bdepth (\d+)/.exec(line);
  if (depth) out.depth = Number(depth[1]);
  const multipv = /\bmultipv (\d+)/.exec(line);
  if (multipv) out.multipv = Number(multipv[1]);
  const cp = /\bscore cp (-?\d+)/.exec(line);
  const mate = /\bscore mate (-?\d+)/.exec(line);
  if (cp) out.cp = Number(cp[1]);
  else if (mate) out.mate = Number(mate[1]);
  else return null;
  // The pv (move list) is everything after " pv " to end of line.
  const pv = / pv (.+)$/.exec(line);
  if (pv && pv[1]) out.pv = pv[1].trim().split(/\s+/);
  return out;
}

/** Extract the best move (UCI) from a `bestmove <uci> ...` line. */
export function parseBestMove(line: string): string | null {
  const m = /^bestmove (\S+)/.exec(line);
  if (!m || m[1] === '(none)') return null;
  return m[1] ?? null;
}

/**
 * Convert an eval to a white-perspective win probability in [0,1], for the eval
 * bar. `sideToMove` is whose turn it is, since engine scores are from that side.
 */
export function evalToWhiteProbability(
  evalResult: UciEval,
  sideToMove: 'w' | 'b',
): number {
  let cpWhite: number;
  if (evalResult.mate !== undefined) {
    const mateForSide = evalResult.mate > 0 ? 1 : -1;
    cpWhite = (sideToMove === 'w' ? mateForSide : -mateForSide) * 10000;
  } else {
    const cp = evalResult.cp ?? 0;
    cpWhite = sideToMove === 'w' ? cp : -cp;
  }
  // Logistic curve (same shape lichess uses, k≈0.004).
  return 1 / (1 + Math.exp(-0.004 * cpWhite));
}
