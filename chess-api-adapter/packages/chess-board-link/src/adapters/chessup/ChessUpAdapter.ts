import { Chess } from 'chess.js';
import { BaseBoardAdapter } from '../../core/BoardAdapter.js';
import { fenToBoard, startingBoard } from '../../core/boardState.js';
import type { DetectedMove, TransportType } from '../../core/types.js';
import { WebBluetoothTransport } from '../../transports/WebBluetoothTransport.js';
import {
  CHESSUP_ACK,
  CHESSUP_NAME_PREFIX,
  CHESSUP_NOTIFY_UUID,
  CHESSUP_SERVICE_UUID,
  CHESSUP_WRITE_UUID,
  ChessUpOpcode,
  parseChessUpMove,
} from './protocol.js';

/**
 * Adapter for ChessUp boards over Web Bluetooth (Nordic UART).
 *
 * Protocol verified against the official ChessConnect extension. Unlike
 * Chessnut/DGT, ChessUp reports completed moves (opcode 163) rather than a
 * 64-square occupancy map, so this adapter emits `move` directly and keeps an
 * internal chess.js game to derive the board snapshot + SAN.
 */
export class ChessUpAdapter extends BaseBoardAdapter {
  readonly id = 'chessup';
  readonly name = 'ChessUp';
  readonly transportType: TransportType = 'bluetooth';

  private readonly transport = new WebBluetoothTransport({
    serviceUuid: CHESSUP_SERVICE_UUID,
    notifyCharacteristicUuid: CHESSUP_NOTIFY_UUID,
    writeCharacteristicUuid: CHESSUP_WRITE_UUID,
    namePrefixes: [CHESSUP_NAME_PREFIX],
  });
  private readonly game = new Chess();

  constructor() {
    super();
    this.transport.setDataHandler((data) => this.handleData(data));
    this.transport.setDisconnectHandler(() => this.setStatus('disconnected'));
  }

  async connect(): Promise<void> {
    this.setStatus('connecting');
    try {
      await this.transport.connect();
      this.game.reset();
      this._state = startingBoard();
      this.setStatus('connected');
      this.emit('boardState', this._state);
    } catch (error) {
      this.setStatus('error');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.transport.disconnect();
    this.setStatus('disconnected');
  }

  private handleData(view: DataView): void {
    const data = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    try {
      switch (data[0]) {
        case ChessUpOpcode.MOVE:
          this.handleMove(parseChessUpMove(data));
          // Acknowledge receipt, mirroring the extension.
          void this.transport.write(CHESSUP_ACK).catch(() => {});
          break;
        case ChessUpOpcode.ERROR:
          this.reportError(new Error(`ChessUp board reported error (opcode 38)`));
          break;
        // PROMOTION (151) and PIECE_TOUCHED (184) are informational; the
        // completed move arrives as a MOVE frame.
        default:
          break;
      }
    } catch (error) {
      this.reportError(error as Error);
    }
  }

  private handleMove(move: DetectedMove | null): void {
    if (!move) return;
    try {
      const applied = this.game.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion ?? 'q',
      });
      this._state = fenToBoard(this.game.fen());
      this.emit('boardState', this._state);
      this.emit('move', {
        ...move,
        promotion: applied.promotion as DetectedMove['promotion'],
        uci: `${move.from}${move.to}${applied.promotion ?? ''}`,
        san: applied.san,
      });
    } catch {
      // The board's move didn't fit our tracked position (e.g. we missed a
      // frame). Emit the raw move so the app can still react.
      this.emit('move', move);
    }
  }
}
