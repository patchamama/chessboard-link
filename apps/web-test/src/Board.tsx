import type { BoardState } from 'chess-board-link';

const GLYPHS: Record<string, string> = {
  P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕', K: '♔',
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
};

/** Render a 64-entry board (a8..h1 order) as an 8x8 grid. */
export function Board({ state }: { state: BoardState }) {
  return (
    <div className="board">
      {state.map((piece, i) => {
        const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
        return (
          <div key={i} className={`square ${dark ? 'dark' : 'light'}`}>
            {piece ? <span className="piece">{GLYPHS[piece]}</span> : null}
          </div>
        );
      })}
    </div>
  );
}
