import { TypedEventEmitter } from './EventEmitter.js';
import { boardsEqual, emptyBoard } from './boardState.js';
import { detectMove } from './moveDetection.js';
import type {
  BoardAdapterEvents,
  BoardState,
  ConnectionStatus,
  LedState,
  TransportType,
} from './types.js';

/**
 * Common contract every physical-board adapter implements.
 *
 * Concrete adapters extend {@link BaseBoardAdapter}, which handles the event
 * plumbing and move detection so subclasses only decode their protocol and
 * call {@link BaseBoardAdapter.pushBoardState} with each fresh snapshot.
 */
export interface BoardAdapter {
  readonly id: string;
  readonly name: string;
  readonly transportType: TransportType;
  readonly status: ConnectionStatus;

  connect(): Promise<void>;
  disconnect(): Promise<void>;

  /** Latest known board snapshot (a8..h1 order). */
  getState(): BoardState;

  /** Light up squares, where supported. No-op on boards without LEDs. */
  setLeds?(leds: LedState[]): Promise<void>;

  on<K extends keyof BoardAdapterEvents>(
    event: K,
    listener: (payload: BoardAdapterEvents[K]) => void,
  ): () => void;
}

export abstract class BaseBoardAdapter
  extends TypedEventEmitter<BoardAdapterEvents>
  implements BoardAdapter
{
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly transportType: TransportType;

  protected _status: ConnectionStatus = 'disconnected';
  protected _state: BoardState = emptyBoard();

  get status(): ConnectionStatus {
    return this._status;
  }

  getState(): BoardState {
    return this._state;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  protected setStatus(status: ConnectionStatus): void {
    if (this._status === status) return;
    this._status = status;
    this.emit('status', status);
  }

  /**
   * Feed a freshly decoded snapshot into the adapter. Emits `boardState` when
   * the board changed and a `move` when the diff resolves to a single move.
   *
   * @param beforeFen optional full FEN of the position before this snapshot,
   *   used to validate/annotate the detected move (SAN, promotion).
   */
  protected pushBoardState(next: BoardState, beforeFen?: string): void {
    const prev = this._state;
    if (boardsEqual(prev, next)) return;

    const move = detectMove(prev, next, { beforeFen });
    this._state = next;
    this.emit('boardState', next);
    if (move) this.emit('move', move);
  }

  protected reportError(error: Error): void {
    this.emit('error', error);
  }
}
