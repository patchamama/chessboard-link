import { BaseBoardAdapter } from '../../core/BoardAdapter.js';
import type { TransportType } from '../../core/types.js';
import { WebSerialTransport } from '../../transports/WebSerialTransport.js';
import {
  applyDgtFieldUpdate,
  decodeDgtBoardDump,
  DgtCommand,
  DGT_BAUD_RATE,
  DgtMessage,
  DgtMessageReader,
} from './protocol.js';

/**
 * Adapter for DGT electronic boards over Web Serial (USB).
 *
 * Connect flow: open the port at 9600 baud, RESET, request a full BOARD_DUMP
 * for the initial position, then SEND_UPDATE_NICE to stream field updates.
 * Each field update is applied to the running snapshot, which feeds move
 * detection in the base class.
 */
export class DgtAdapter extends BaseBoardAdapter {
  readonly id = 'dgt';
  readonly name = 'DGT e-Board';
  readonly transportType: TransportType = 'serial';

  private readonly transport = new WebSerialTransport({ baudRate: DGT_BAUD_RATE });
  private readonly reader = new DgtMessageReader();

  constructor() {
    super();
    this.transport.setDataHandler((chunk) => this.handleData(chunk));
    this.transport.setDisconnectHandler(() => this.setStatus('disconnected'));
  }

  async connect(): Promise<void> {
    this.setStatus('connecting');
    try {
      await this.transport.connect();
      await this.transport.write(new Uint8Array([DgtCommand.SEND_RESET]));
      await this.transport.write(new Uint8Array([DgtCommand.SEND_BRD]));
      await this.transport.write(new Uint8Array([DgtCommand.SEND_UPDATE_NICE]));
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

  private handleData(chunk: Uint8Array): void {
    try {
      for (const message of this.reader.push(chunk)) {
        if (message.id === DgtMessage.BOARD_DUMP) {
          this.pushBoardState(decodeDgtBoardDump(message.payload));
        } else if (message.id === DgtMessage.FIELD_UPDATE) {
          this.pushBoardState(applyDgtFieldUpdate(this.getState(), message.payload));
        }
        // SERIALNR / VERSION messages are ignored for now.
      }
    } catch (error) {
      this.reportError(error as Error);
    }
  }
}
