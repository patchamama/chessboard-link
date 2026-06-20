import { Chess } from 'chess.js';
import { BaseBoardAdapter, type ConnectOptions } from '../../core/BoardAdapter.js';
import { fenToBoard, startingBoard } from '../../core/boardState.js';
import type { DetectedMove, LedState, TransportType } from '../../core/types.js';
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

  get deviceId(): string | undefined {
    return this.transport.deviceId;
  }

  get deviceName(): string | undefined {
    return this.transport.deviceName;
  }

  async connect(opts: ConnectOptions = {}): Promise<void> {
    this.setStatus('connecting');
    try {
      const device = opts.deviceId
        ? await WebBluetoothTransport.findKnownDevice(opts.deviceId)
        : undefined;
      await this.transport.connect({ device });
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

  /**
   * ChessUp's LED command is not yet reverse-engineered byte-for-byte. The
   * board's UART output applies a per-byte parity bit and the LED payload is
   * RGB; sending a guessed format could mis-drive the hardware. Until the
   * command is captured from a physical board, this records the intent and
   * warns instead of writing bytes. (Chessnut's `setLeds` is fully implemented.)
   */
  async setLeds(leds: LedState[]): Promise<void> {
    const lit = leds.filter((l) => l.on).map((l) => l.square);
    this.reportError(
      new Error(
        `ChessUp setLeds not yet implemented (would light: ${lit.join(', ') || 'none'}). ` +
          `Its LED command needs capturing from hardware.`,
      ),
    );
  }

  private handleData(view: DataView): void {
    const data = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    this.reportIo('received', data);
    try {
      switch (data[0]) {
        case ChessUpOpcode.MOVE:
          this.handleMove(parseChessUpMove(data));
          // Acknowledge receipt, mirroring the extension.
          this.reportIo('sent', CHESSUP_ACK);
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
