import { useState } from 'react';
import { fenToBoard, indexToSquare, squareToIndex } from 'chess-board-link';

// Piece sprites from lichess's CDN (Cburnett set, free/GPL). Filenames are
// <Color><PieceUpper>.svg, e.g. wP.svg, bN.svg.
const PIECE_BASE = 'https://lichess1.org/assets/piece/cburnett';

function pieceSrc(piece: string): string {
  const color = piece === piece.toUpperCase() ? 'w' : 'b';
  return `${PIECE_BASE}/${color}${piece.toUpperCase()}.svg`;
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
  /** Render from black's perspective. */
  flipped?: boolean;
}

/** Interactive 8x8 board: click a piece, then a legal target, to move. */
export function ChessBoard({ fen, legalTargets, onMove, lastMove, flipped }: ChessBoardProps) {
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
    <div className="board" role="grid" aria-label="chess board">
      {order.map((i) => {
        const square = indexToSquare(i);
        const piece = board[i] ?? null;
        const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
        const isSel = selected === square;
        const isTarget = targets.includes(square);
        const isLast = lastMove && (lastMove.from === square || lastMove.to === square);
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
            ].join(' ')}
            data-square={square}
            onClick={() => clickSquare(square, piece)}
          >
            {piece ? (
              <img className="piece" src={pieceSrc(piece)} alt={pieceLabel(piece)} draggable={false} />
            ) : null}
            {isTarget ? <span className="dot" /> : null}
          </button>
        );
      })}
    </div>
  );
}

export { squareToIndex };
