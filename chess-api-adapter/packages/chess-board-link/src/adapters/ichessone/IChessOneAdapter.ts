import { BaseBoardAdapter } from '../../core/BoardAdapter.js';
import type { TransportType } from '../../core/types.js';
import { WebBluetoothTransport } from '../../transports/WebBluetoothTransport.js';
import {
  NORDIC_UART_NOTIFY,
  NORDIC_UART_SERVICE,
  NORDIC_UART_WRITE,
} from '../nordicUart.js';
import {
  decodeIChessOnePosition,
  ICHESSONE_NAME,
  isIChessOnePositionFrame,
} from './protocol.js';

/**
 * Adapter for iChessOne boards over Web Bluetooth (Nordic UART, ASCII frames).
 *
 * Verified against the ChessConnect extension source, not physical hardware —
 * ships flagged `experimental`.
 */
export class IChessOneAdapter extends BaseBoardAdapter {
  readonly id = 'ichessone';
  readonly name = 'iChessOne';
  readonly transportType: TransportType = 'bluetooth';

  private readonly transport = new WebBluetoothTransport({
    serviceUuid: NORDIC_UART_SERVICE,
    notifyCharacteristicUuid: NORDIC_UART_NOTIFY,
    writeCharacteristicUuid: NORDIC_UART_WRITE,
    namePrefixes: [ICHESSONE_NAME],
  });
  private readonly decoder = new TextDecoder();

  constructor() {
    super();
    this.transport.setDataHandler((data) => this.handleData(data));
    this.transport.setDisconnectHandler(() => this.setStatus('disconnected'));
  }

  async connect(): Promise<void> {
    this.setStatus('connecting');
    try {
      await this.transport.connect();
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

  private handleData(view: DataView): void {
    try {
      const frame = this.decoder.decode(
        new Uint8Array(view.buffer, view.byteOffset, view.byteLength),
      );
      if (isIChessOnePositionFrame(frame)) {
        this.pushBoardState(decodeIChessOnePosition(frame));
      }
    } catch (error) {
      this.reportError(error as Error);
    }
  }
}
