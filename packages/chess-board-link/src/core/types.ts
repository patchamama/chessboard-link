/**
 * Core domain types shared by every board adapter and platform integration.
 *
 * Board state is modelled as a flat array of 64 entries. The canonical index
 * order used across this library is **a8 -> h8 -> a7 -> ... -> h1**, i.e. rank
 * 8 first, file a first. This matches the byte order emitted by Chessnut
 * boards and the FEN piece-placement order, which keeps the conversions cheap.
 */

/** Algebraic square name, e.g. "e4". */
export type Square = string;

/**
 * A piece encoded as a single FEN letter: uppercase = white, lowercase = black.
 * `P N B R Q K` / `p n b r q k`. `null` means an empty square.
 */
export type Piece =
  | 'P'
  | 'N'
  | 'B'
  | 'R'
  | 'Q'
  | 'K'
  | 'p'
  | 'n'
  | 'b'
  | 'r'
  | 'q'
  | 'k'
  | null;

/** 64-entry board snapshot in a8..h1 order. */
export type BoardState = Piece[];

/** A detected move in UCI long-algebraic form, e.g. "e2e4" or "e7e8q". */
export interface DetectedMove {
  from: Square;
  to: Square;
  /** Promotion piece letter, lowercase, when the move is a promotion. */
  promotion?: 'q' | 'r' | 'b' | 'n';
  /** UCI string, e.g. "e2e4", "e1g1", "e7e8q". */
  uci: string;
  /** SAN when it could be derived from a legal position, e.g. "Nf3". */
  san?: string;
}

/** How an adapter talks to its hardware. */
export type TransportType = 'bluetooth' | 'serial';

/** Connection lifecycle for an adapter. */
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

/** Per-square LED instruction for boards that expose LEDs (e.g. Chessnut). */
export interface LedState {
  square: Square;
  on: boolean;
}

/** Raw bytes exchanged with the board, for logging/debugging. */
export interface IoEvent {
  direction: 'sent' | 'received';
  bytes: Uint8Array;
}

/** Events emitted by a {@link BoardAdapter}. */
export interface BoardAdapterEvents {
  /** Full board snapshot changed. */
  boardState: BoardState;
  /** A move was detected from consecutive board snapshots / field updates. */
  move: DetectedMove;
  /** Connection status changed. */
  status: ConnectionStatus;
  /** Non-fatal error or protocol warning. */
  error: Error;
  /** Raw bytes sent to / received from the board (for the event log). */
  io: IoEvent;
}
