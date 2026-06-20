import { BaseBoardAdapter, type ConnectOptions } from '../../core/BoardAdapter.js';
import type { LedState, TransportType } from '../../core/types.js';
import { WebBluetoothTransport } from '../../transports/WebBluetoothTransport.js';
import {
  CHESSNUT_ENABLE_REALTIME,
  CHESSNUT_NOTIFY_UUID,
  CHESSNUT_SERVICE_UUID,
  CHESSNUT_WRITE_UUID,
  decodeChessnutBoard,
  encodeChessnutLeds,
} from './protocol.js';

/**
 * Adapter for Chessnut Air / Pro boards over Web Bluetooth.
 *
 * Connect flow: pick device by service UUID, subscribe to the notify
 * characteristic, write {@link CHESSNUT_ENABLE_REALTIME}, then decode each
 * notification into a board snapshot and let the base class detect moves.
 */
export class ChessnutAdapter extends BaseBoardAdapter {
  readonly id = 'chessnut';
  readonly name = 'Chessnut Air / Pro';
  readonly transportType: TransportType = 'bluetooth';

  private readonly transport = new WebBluetoothTransport({
    serviceUuid: CHESSNUT_SERVICE_UUID,
    notifyCharacteristicUuid: CHESSNUT_NOTIFY_UUID,
    writeCharacteristicUuid: CHESSNUT_WRITE_UUID,
    namePrefixes: ['Chessnut'],
  });

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
      await this.transport.write(CHESSNUT_ENABLE_REALTIME);
      this.setStatus('connected');
    } catch (error) {
      this.setStatus('error');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.transport.disconnect();
    this.setStatus('disconnected');
  }

  async setLeds(leds: LedState[]): Promise<void> {
    await this.transport.write(encodeChessnutLeds(leds));
  }

  private handleData(data: DataView): void {
    this.reportIo('received', new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    try {
      const board = decodeChessnutBoard(data);
      this.pushBoardState(board);
    } catch (error) {
      this.reportError(error as Error);
    }
  }
}
