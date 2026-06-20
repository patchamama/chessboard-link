import { BaseBoardAdapter } from '../../core/BoardAdapter.js';
import { startingBoard } from '../../core/boardState.js';
import type { BoardState, TransportType } from '../../core/types.js';

/**
 * Hardware-free adapter for developing and demoing the web app without a
 * physical board. It starts from the standard position and exposes
 * {@link applyBoardState} so tests/UI can drive snapshots manually, plus an
 * optional scripted playback of snapshots.
 */
export class MockAdapter extends BaseBoardAdapter {
  readonly id = 'mock';
  readonly name = 'Mock board (no hardware)';
  readonly transportType: TransportType = 'bluetooth';

  private timer?: ReturnType<typeof setInterval>;

  async connect(): Promise<void> {
    this.setStatus('connecting');
    this._state = startingBoard();
    this.setStatus('connected');
    this.emit('boardState', this._state);
  }

  async disconnect(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.setStatus('disconnected');
  }

  /** Push a snapshot, emitting boardState/move exactly like a real adapter. */
  applyBoardState(next: BoardState): void {
    this.pushBoardState(next);
  }

  /** Play a sequence of snapshots at a fixed interval (for demos). */
  playback(states: BoardState[], intervalMs = 1000): void {
    let i = 0;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (i >= states.length) {
        clearInterval(this.timer);
        this.timer = undefined;
        return;
      }
      this.pushBoardState(states[i]!);
      i += 1;
    }, intervalMs);
  }
}
