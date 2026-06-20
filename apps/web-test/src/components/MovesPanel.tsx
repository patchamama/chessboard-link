/**
 * PGN move list, e.g. "1. e4 e5 2. Nf3 …", with piece glyphs for major pieces.
 * Takes SAN history (white, black, white, …) and pairs it into numbered moves.
 */
const SAN_PIECE_GLYPH: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘',
};

/** Replace the leading piece letter of a SAN with its glyph (pawns unchanged). */
function withGlyph(san: string): string {
  const first = san[0];
  if (first && SAN_PIECE_GLYPH[first]) {
    return SAN_PIECE_GLYPH[first] + san.slice(1);
  }
  return san;
}

export function MovesPanel({ history }: { history: string[] }) {
  const pairs: { n: number; white: string; black?: string }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({
      n: i / 2 + 1,
      white: history[i]!,
      black: history[i + 1],
    });
  }

  return (
    <div className="moves-panel">
      <h3>Moves</h3>
      {pairs.length === 0 ? (
        <p className="muted">No moves yet.</p>
      ) : (
        <ol className="moves">
          {pairs.map((p) => (
            <li key={p.n}>
              <span className="moveno">{p.n}.</span>
              <span className="san">{withGlyph(p.white)}</span>
              {p.black ? <span className="san">{withGlyph(p.black)}</span> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
