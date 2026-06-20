import type { UciEval } from '../game/uci.js';
import type { GameResult } from '../game/useChessGame.js';

interface FenPanelProps {
  fen: string;
  turn: 'w' | 'b';
  result: GameResult;
  evaluation: UciEval | null;
}

function formatEval(e: UciEval | null, turn: 'w' | 'b'): string {
  if (!e) return '—';
  if (e.mate !== undefined) return `mate in ${Math.abs(e.mate)}`;
  if (e.cp !== undefined) {
    const white = ((turn === 'w' ? 1 : -1) * e.cp) / 100;
    return `${white >= 0 ? '+' : ''}${white.toFixed(2)}`;
  }
  return '—';
}

const RESULT_LABEL: Record<GameResult, string> = {
  in_progress: 'in progress',
  checkmate: 'checkmate',
  stalemate: 'stalemate',
  draw: 'draw',
};

export function FenPanel({ fen, turn, result, evaluation }: FenPanelProps) {
  return (
    <div className="fenpanel">
      <div className="fenpanel-row">
        <span className="label">Turn</span>
        <span>{turn === 'w' ? 'White' : 'Black'}</span>
        <span className="label">Eval</span>
        <span>{formatEval(evaluation, turn)}</span>
        {evaluation?.depth ? <span className="muted">d{evaluation.depth}</span> : null}
        <span className="label">State</span>
        <span>{RESULT_LABEL[result]}</span>
      </div>
      <div className="fenpanel-fen">
        <input readOnly value={fen} onFocus={(e) => e.currentTarget.select()} aria-label="FEN" />
        <button type="button" onClick={() => navigator.clipboard?.writeText(fen)}>
          Copy
        </button>
      </div>
    </div>
  );
}
