import { Chess } from 'chess.js';
import type { UciEval } from './uci.js';
import type { Candidate } from '../components/AnalysisPanel.js';

/**
 * Turn engine MultiPV lines (UCI) into display candidates: first move in SAN,
 * the FEN after that move (for the hover mini-board), and a short SAN preview
 * of the line. Lines that don't fit the position are skipped.
 */
export function buildCandidates(fen: string, lines: UciEval[], maxLine = 6): Candidate[] {
  const out: Candidate[] = [];
  for (const line of lines) {
    if (!line.pv || line.pv.length === 0) continue;
    const game = new Chess(fen);
    const firstUci = line.pv[0]!;
    let firstSan = firstUci;
    const sans: string[] = [];
    let fenAfter = fen;
    try {
      for (let i = 0; i < line.pv.length && i < maxLine; i++) {
        const uci = line.pv[i]!;
        const m = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? 'q' });
        sans.push(m.san);
        if (i === 0) {
          firstSan = m.san;
          fenAfter = game.fen();
        }
      }
    } catch {
      // Partial line is fine; keep what parsed.
      if (sans.length === 0) continue;
    }
    out.push({
      uci: firstUci,
      san: firstSan,
      lineSan: sans.join(' '),
      fenAfter,
      eval: line,
    });
  }
  return out;
}
