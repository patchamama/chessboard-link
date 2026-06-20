import { useState } from 'react';
import { ChessBoard } from './ChessBoard.js';
import { evalToWhiteProbability, type UciEval } from '../game/uci.js';

export interface Candidate {
  /** First move of the line, UCI (e.g. "e2e4"). */
  uci: string;
  /** First move in SAN (e.g. "e4"). */
  san: string;
  /** Short preview of the line in SAN, e.g. "e4 e5 Nf3". */
  lineSan: string;
  /** FEN after playing the first move (for the hover mini-board). */
  fenAfter: string;
  eval: UciEval;
}

interface AnalysisPanelProps {
  depth?: number;
  candidates: Candidate[];
  sideToMove: 'w' | 'b';
  pieceSet: string;
  /** Play the candidate's first move on the real game. */
  onPlay: (uci: string) => void;
  /** Hover a candidate to highlight it on the main board (null = none). */
  onHover: (uci: string | null) => void;
}

function evalText(e: UciEval, sideToMove: 'w' | 'b'): string {
  if (e.mate !== undefined) return `#${Math.abs(e.mate)}`;
  if (e.cp !== undefined) {
    const white = ((sideToMove === 'w' ? 1 : -1) * e.cp) / 100;
    return `${white >= 0 ? '+' : ''}${white.toFixed(2)}`;
  }
  return '—';
}

/** Continuous Stockfish analysis with clickable candidate moves. */
export function AnalysisPanel({
  depth,
  candidates,
  sideToMove,
  pieceSet,
  onPlay,
  onHover,
}: AnalysisPanelProps) {
  const [preview, setPreview] = useState<Candidate | null>(null);

  return (
    <div className="analysis">
      <div className="analysis-head">
        <strong>Engine</strong>
        {depth ? <span className="muted">depth {depth}</span> : <span className="muted">…</span>}
      </div>
      <div className="analysis-body">
        <ol className="candidates">
          {candidates.length === 0 ? <li className="muted">analysing…</li> : null}
          {candidates.map((c, i) => (
            <li
              key={i}
              className="candidate"
              onMouseEnter={() => {
                setPreview(c);
                onHover(c.uci);
              }}
              onMouseLeave={() => {
                setPreview(null);
                onHover(null);
              }}
            >
              <span className="cand-eval">{evalText(c.eval, sideToMove)}</span>
              {i === 0 ? (
                <button type="button" className="cand-play" onClick={() => onPlay(c.uci)} title="Play this move">
                  {c.san} ▶
                </button>
              ) : (
                <span className="cand-san">{c.san}</span>
              )}
              <span className="cand-line muted">{c.lineSan}</span>
            </li>
          ))}
        </ol>
        {preview ? (
          <div className="cand-preview">
            <div className="bar">
              <div
                className="bar-white"
                style={{ height: `${Math.round(evalToWhiteProbability(preview.eval, sideToMove) * 100)}%` }}
              />
            </div>
            <div className="mini">
              <ChessBoard
                fen={preview.fenAfter}
                legalTargets={() => []}
                onMove={() => {}}
                pieceSet={pieceSet}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
