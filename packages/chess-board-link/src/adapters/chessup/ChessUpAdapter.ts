import { Chess } from 'chess.js';
import { BaseBoardAdapter, type ConnectOptions } from '../../core/BoardAdapter.js';
import { fenToBoard, startingBoard } from '../../core/boardState.js';
import type { DetectedMove, LedState, TransportType } from '../../core/types.js';
import { WebBluetoothTransport } from '../../transports/WebBluetoothTransport.js';
import {
  applyParity,
  CHESSUP_ACK,
  ChessUpMessageReader,
  ChessUpOpcode,
  CHESSUP_HANDSHAKE_AFTER_TRADEMARK,
  CHESSUP_IN_POSITION,
  CHESSUP_IN_REQUEST,
  CHESSUP_IN_TRADEMARK,
  CHESSUP_NAME_PREFIX,
  CHESSUP_NOTIFY_UUID,
  CHESSUP_SERVICE_UUID,
  CHESSUP_WRITE_UUID,
  ChessUpCommand,
  decodeChessUpOccupancy,
  encodeChessUpLeds,
  encodeChessUpMessage,
  parseChessUpMoveFromData,
} from './protocol.js';

/**
 * Adapter for ChessUp boards over Web Bluetooth (Nordic UART).
 *
 * Protocol reverse-engineered from the official ChessConnect extension and
 * confirmed against a real board's traffic. ChessUp frames messages with a
 * bit-7 start marker + size bytes; the host's writes are parity-encoded. The
 * board reports **occupancy** (an RFID tag per square — five numbers, non-zero
 * = occupied); identifying the actual piece needs the board's learned RFID
 * table, so this adapter tracks occupancy and infers moves from the starting
 * position with chess.js (like Chessnut/DGT), which is enough to play.
 *
 * Connect flow: reset (64), request a dump (66); the board streams POSITION
 * messages (command 134). When the board asks for a dump (command 142) we
 * answer with another request.
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
  private readonly reader = new ChessUpMessageReader();
  private readonly game = new Chess();
  /** Occupancy we last applied, to ignore duplicate/transient snapshots. */
  private lastOccupancy: boolean[] | null = null;
  /** Resolves when the board answers the TRADEMARK (71) challenge with 146. */
  private trademarkResolver: (() => void) | null = null;

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
      this.lastOccupancy = occupancyOf(this._state);
      // Handshake (from the extension's initializeBoard): first the TRADEMARK
      // (71) auth challenge — wait for the board's reply (146) — then the CONFIG
      // messages that enable "app interaction" mode, then a dump request. There
      // is NO reset(64): sending one drops the board into firmware-update mode.
      await this.doTrademark();
      for (const [command, ...rest] of CHESSUP_HANDSHAKE_AFTER_TRADEMARK) {
        await this.send(command!, rest.length ? rest : undefined);
      }
      this.setStatus('connected');
      this.emit('boardState', this._state);
    } catch (error) {
      this.setStatus('error');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.trademarkResolver = null;
    await this.transport.disconnect();
    this.setStatus('disconnected');
  }

  /**
   * Send the TRADEMARK (71) challenge and resolve once the board answers with
   * command 146. Times out after 3s so a non-responding board doesn't hang the
   * connect (we then proceed with the rest of the handshake best-effort).
   */
  private async doTrademark(): Promise<void> {
    const waitReply = new Promise<void>((resolve) => {
      this.trademarkResolver = resolve;
      setTimeout(() => {
        if (this.trademarkResolver) {
          this.trademarkResolver = null;
          resolve();
        }
      }, 3000);
    });
    await this.send(ChessUpCommand.TRADEMARK);
    await waitReply;
  }

  /**
   * Light squares on the board (8-byte LED bitmap, `encodeLedStateSimple`).
   * Parity-encoded like every ChessUp BLE write. Targets non-RGB ChessUp 1.
   */
  async setLeds(leds: LedState[]): Promise<void> {
    await this.write(encodeChessUpLeds(leds));
  }

  /** Send a framed command (optionally with data). */
  private async send(command: number, data?: number[]): Promise<void> {
    await this.write(encodeChessUpMessage(command, data));
  }

  /** Parity-encode a payload and write it; logs the pre-parity bytes. */
  private async write(payload: Uint8Array): Promise<void> {
    this.reportIo('sent', payload);
    await this.transport.write(applyParity(payload));
  }

  private handleData(view: DataView): void {
    const data = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    this.reportIo('received', data);
    try {
      for (const msg of this.reader.push(data)) {
        if (msg.command === CHESSUP_IN_TRADEMARK) {
          // Board answered the auth challenge — release the connect handshake.
          this.trademarkResolver?.();
          this.trademarkResolver = null;
        } else if (msg.command === ChessUpOpcode.MOVE) {
          // Clean path: the board reports the completed move directly.
          this.handleMove(parseChessUpMoveFromData(msg.data));
          void this.write(CHESSUP_ACK).catch(() => {}); // parity-encoded ACK
        } else if (msg.command === CHESSUP_IN_POSITION) {
          // Fallback: derive the move from an occupancy snapshot.
          this.handlePosition(decodeChessUpOccupancy(msg.data));
        } else if (msg.command === CHESSUP_IN_REQUEST) {
          void this.send(ChessUpCommand.REQUEST_DUMP).catch(() => {});
        }
        // Battery (160) / clock (141) messages are ignored.
      }
    } catch (error) {
      this.reportError(error as Error);
    }
  }

  /**
   * Apply a move reported directly by the board (command 163). Validates it
   * against the tracked game; emits boardState + move when legal.
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
      this.lastOccupancy = occupancyOf(this._state);
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

  /**
   * Apply a fresh occupancy snapshot: find the legal move whose resulting
   * occupancy matches, play it, and emit boardState + move. Snapshots that
   * don't correspond to a single completed legal move are ignored (e.g. a piece
   * lifted mid-move), so we wait for the board to settle.
   */
  private handlePosition(occ: boolean[]): void {
    if (this.lastOccupancy && sameOccupancy(occ, this.lastOccupancy)) return;

    // Try to match the new occupancy to a legal move from the current position.
    const moves = this.game.moves({ verbose: true });
    for (const m of moves) {
      const probe = new Chess(this.game.fen());
      probe.move({ from: m.from, to: m.to, promotion: m.promotion ?? 'q' });
      if (sameOccupancy(occ, occupancyOf(fenToBoard(probe.fen())))) {
        const applied = this.game.move({ from: m.from, to: m.to, promotion: m.promotion ?? 'q' });
        this.lastOccupancy = occ;
        this._state = fenToBoard(this.game.fen());
        this.emit('boardState', this._state);
        const move: DetectedMove = {
          from: applied.from,
          to: applied.to,
          promotion: applied.promotion as DetectedMove['promotion'],
          uci: `${applied.from}${applied.to}${applied.promotion ?? ''}`,
          san: applied.san,
        };
        this.emit('move', move);
        return;
      }
    }
    // No single legal move matches yet — remember occupancy but don't emit.
    this.lastOccupancy = occ;
  }
}

/** Occupancy (true = piece present) of a board snapshot, a8..h1 order. */
function occupancyOf(board: ReturnType<typeof startingBoard>): boolean[] {
  return board.map((p) => p !== null);
}

function sameOccupancy(a: boolean[], b: boolean[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
