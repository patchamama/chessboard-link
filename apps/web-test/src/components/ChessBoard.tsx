import { useState } from 'react';
import { fenToBoard, indexToSquare, squareToIndex } from 'chess-board-link';

// Piece sprites from lichess's CDN. Each set has files <Color><PieceUpper>.svg,
// e.g. wP.svg, bN.svg. All sets are free/GPL.
const PIECE_SETS = ['cburnett', 'merida', 'alpha', 'pirouetti', 'gioco'] as const;
export type PieceSet = (typeof PIECE_SETS)[number];
export const PIECE_SET_OPTIONS = PIECE_SETS;

function pieceSrc(piece: string, set: string): string {
  const color = piece === piece.toUpperCase() ? 'w' : 'b';
  return `https://lichess1.org/assets/piece/${set}/${color}${piece.toUpperCase()}.svg`;
}

const PIECE_NAMES: Record<string, string> = {
  P: 'pawn', N: 'knight', B: 'bishop', R: 'rook', Q: 'queen', K: 'king',
};

function pieceLabel(piece: string): string {
  const color = piece === piece.toUpperCase() ? 'white' : 'black';
  return `${color} ${PIECE_NAMES[piece.toUpperCase()] ?? 'piece'}`;
}

interface ChessBoardProps {
  /** Position to render (FEN placement or full FEN). */
  fen: string;
  /** Legal destination squares from a clicked square. */
  legalTargets: (square: string) => string[];
  /** Called with a UCI move when the user completes from→to. */
  onMove: (uci: string) => void;
  /** Highlight the last move's from/to squares. */
  lastMove?: { from: string; to: string };
  /** Extra highlight (e.g. a hovered engine candidate) from/to squares. */
  highlight?: { from: string; to: string } | null;
  /** Render from black's perspective. */
  flipped?: boolean;
  /** Piece sprite set (default cburnett). */
  pieceSet?: string;
  /** Board square colour theme (CSS class suffix), default 'brown'. */
  boardTheme?: string;
}

/** Interactive 8x8 board: click a piece, then a legal target, to move. */
export function ChessBoard({
  fen,
  legalTargets,
  onMove,
  lastMove,
  highlight,
  flipped,
  pieceSet = 'cburnett',
  boardTheme = 'brown',
}: ChessBoardProps) {
  const board = fenToBoard(fen);
  const [selected, setSelected] = useState<string | null>(null);
  const targets = selected ? legalTargets(selected) : [];

  const order = [...Array(64).keys()];
  if (flipped) order.reverse();

  function clickSquare(square: string, piece: string | null) {
    if (selected) {
      if (square === selected) {
        setSelected(null);
      } else if (targets.includes(square)) {
        onMove(`${selected}${square}`);
        setSelected(null);
      } else if (piece) {
        setSelected(square); // reselect another piece
      } else {
        setSelected(null);
      }
    } else if (piece) {
      setSelected(square);
    }
  }

  return (
    <div className={`board theme-${boardTheme}`} role="grid" aria-label="chess board">
      {order.map((i) => {
        const square = indexToSquare(i);
        const piece = board[i] ?? null;
        const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
        const isSel = selected === square;
        const isTarget = targets.includes(square);
        const isLast = lastMove && (lastMove.from === square || lastMove.to === square);
        const isHl = highlight && (highlight.from === square || highlight.to === square);
        return (
          <button
            key={i}
            type="button"
            className={[
              'square',
              dark ? 'dark' : 'light',
              isSel ? 'selected' : '',
              isTarget ? 'target' : '',
              isLast ? 'lastmove' : '',
              isHl ? 'candidate-hl' : '',
            ].join(' ')}
            data-square={square}
            onClick={() => clickSquare(square, piece)}
          >
            {piece ? (
              <img className="piece" src={pieceSrc(piece, pieceSet)} alt={pieceLabel(piece)} draggable={false} />
            ) : null}
            {isTarget ? <span className="dot" /> : null}
          </button>
        );
      })}
    </div>
  );
}

export { squareToIndex };
