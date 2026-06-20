import { evalToWhiteProbability, type UciEval } from '../game/uci.js';

interface EvalBarProps {
  evaluation: UciEval | null;
  sideToMove: 'w' | 'b';
}

/** Vertical evaluation bar: white fills from the bottom. */
export function EvalBar({ evaluation, sideToMove }: EvalBarProps) {
  const prob = evaluation ? evalToWhiteProbability(evaluation, sideToMove) : 0.5;
  const whitePct = Math.round(prob * 100);

  const label =
    evaluation?.mate !== undefined
      ? `M${Math.abs(evaluation.mate)}`
      : evaluation?.cp !== undefined
        ? (((sideToMove === 'w' ? 1 : -1) * evaluation.cp) / 100).toFixed(1)
        : '—';

  return (
    <div className="evalbar" title={`White ${whitePct}%`}>
      <div className="evalbar-white" style={{ height: `${whitePct}%` }} />
      <span className="evalbar-label">{label}</span>
    </div>
  );
}
