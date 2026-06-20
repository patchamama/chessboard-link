/**
 * Contract for an online chess platform integration (lichess, chess.com, ...).
 *
 * A platform adapter is the bridge between a physical board and a web game:
 * it pushes the player's over-the-board moves to the platform and surfaces the
 * opponent's moves so the app can prompt the player (e.g. by lighting LEDs).
 */
export type PlatformMoveListener = (move: {
  /** UCI of the move played online, e.g. "e7e5". */
  uci: string;
  /** Full FEN after the move, when the platform provides it. */
  fen?: string;
}) => void;

export interface PlatformAdapter {
  readonly id: string;
  readonly name: string;

  /** Push a move played on the physical board to the online game. */
  pushMove(uci: string): Promise<void>;

  /** Subscribe to moves arriving from the online game (opponent/sync). */
  onRemoteMove(listener: PlatformMoveListener): () => void;

  /** Stop streaming / release resources. */
  close(): Promise<void>;
}

/** Thrown by platform adapters whose move-submission path is not available. */
export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}
