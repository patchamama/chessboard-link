import { Chess } from 'chess.js';
import { BaseBoardAdapter, type ConnectOptions } from '../../core/BoardAdapter.js';
import { boardToFen, fenToBoard, startingBoard } from '../../core/boardState.js';
import type { DetectedMove, LedState, TransportType } from '../../core/types.js';
import { WebBluetoothTransport } from '../../transports/WebBluetoothTransport.js';
import {
  applyParity,
  CHESSUP_ACK,
  CHESSUP_GAME_SETTINGS,
  CHESSUP_NAME_PREFIX,
  CHESSUP_NOTIFY_UUID,
  CHESSUP_SERVICE_UUID,
  CHESSUP_WRITE_UUID,
  ChessUpCommand,
  ChessUpInbound,
  encodeChessUpFen,
  encodeChessUpLeds,
  parseChessUpMove,
} from './protocol.js';

const FULL_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Adapter for ChessUp boards over Web Bluetooth (Nordic UART).
 *
 * Protocol verified against ChessConnect **v5.9.1** (what shipping boards run).
 * Messages are NOT bit-7 framed: the first byte is the opcode directly. Outgoing
 * BLE bytes are parity-encoded; incoming bytes are not.
 *
 * Connect (the extension's `startGame`):
 *   1. RESET `[100]`
 *   2. SEND_FEN `[102, len, …fenBytes]` — board replies opcode 177
 *   3. GAME_SETTINGS `[185, 2,0,1,1,0,1,1,0, …]` — board replies opcode 36
 *
 * The board then reports completed moves as `[163, 53, fromRow, fromCol, toRow,
 * toCol]`; the host ACKs with `[33]`. (No reset variant other than 100; an
 * earlier 6.0.3-based guess used different bytes and put the board into
 * firmware-update mode.)
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
  /** Pending one-shot waiters for an inbound opcode, keyed by opcode. */
  private readonly opcodeWaiters = new Map<number, () => void>();

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

      // Handshake (mirrors the extension's startGame): reset, send the starting
      // FEN and WAIT for the board's reply (opcode 177), then game settings and
      // WAIT for its reply (opcode 36). The board needs each round-trip before
      // the next step — sending all three back-to-back leaves it idle.
      await this.send(ChessUpCommand.RESET);
      await this.send(ChessUpCommand.SEND_FEN, encodeChessUpFen(FULL_START_FEN));
      await this.waitForOpcode(ChessUpInbound.FEN_OK, 2000);
      await this.send(ChessUpCommand.GAME_SETTINGS, CHESSUP_GAME_SETTINGS);
      await this.waitForOpcode(ChessUpInbound.SETTINGS_OK, 2000);

      this.setStatus('connected');
      this.emit('boardState', this._state);
    } catch (error) {
      this.setStatus('error');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    for (const done of this.opcodeWaiters.values()) done();
    this.opcodeWaiters.clear();
    await this.transport.disconnect();
    this.setStatus('disconnected');
  }

  /**
   * Light squares on the board (8-byte LED bitmap, `encodeLedStateSimple`),
   * parity-encoded like every ChessUp BLE write. Targets non-RGB ChessUp 1.
   */
  async setLeds(leds: LedState[]): Promise<void> {
    await this.write(encodeChessUpLeds(leds));
  }

  /**
   * Resolve once an inbound message with `opcode` arrives, or after `timeoutMs`
   * (best-effort: a non-answering board shouldn't hang the connect forever).
   */
  private waitForOpcode(opcode: number, timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const done = () => {
        this.opcodeWaiters.delete(opcode);
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(done, timeoutMs);
      this.opcodeWaiters.set(opcode, done);
    });
  }

  /** Send `[command, ...data]` (raw opcode, no framing). */
  private async send(command: number, data?: number[]): Promise<void> {
    const payload =
      data && data.length
        ? Uint8Array.from([command, ...data])
        : Uint8Array.from([command]);
    await this.write(payload);
  }

  /** Parity-encode a payload and write it; logs the pre-parity bytes. */
  private async write(payload: Uint8Array): Promise<void> {
    this.reportIo('sent', payload);
    await this.transport.write(applyParity(payload));
  }

  private handleData(view: DataView): void {
    const data = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    this.reportIo('received', data);
    // Release any handshake step waiting on this opcode.
    const waiter = this.opcodeWaiters.get(data[0] ?? -1);
    if (waiter) waiter();
    try {
      switch (data[0]) {
        case ChessUpInbound.MOVE:
          this.handleMove(parseChessUpMove(data));
          void this.write(CHESSUP_ACK).catch(() => {}); // parity-encoded ACK
          break;
        case ChessUpInbound.ERROR:
          this.reportError(new Error('ChessUp board reported an error (opcode 38)'));
          break;
        // FEN_OK (177), SETTINGS_OK (36), PROMOTION (151), PIECE_TOUCHED (184)
        // are informational; the completed move arrives as opcode 163.
        default:
          break;
      }
    } catch (error) {
      this.reportError(error as Error);
    }
  }

  /**
   * Apply a move reported by the board (opcode 163). Validates it against the
   * tracked game; emits boardState + move when legal, raw otherwise.
   */
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
        from: applied.from,
        to: applied.to,
        promotion: applied.promotion as DetectedMove['promotion'],
        uci: `${applied.from}${applied.to}${applied.promotion ?? ''}`,
        san: applied.san,
      });
    } catch {
      // Board move didn't fit our tracked position (missed a frame); emit raw.
      this.emit('move', move);
    }
  }

  /** Current board as a FEN placement (used by tests/consumers). */
  getFenPlacement(): string {
    return boardToFen(this._state);
  }
}
