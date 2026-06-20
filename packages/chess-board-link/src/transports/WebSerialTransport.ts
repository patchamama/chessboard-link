/**
 * Thin wrapper over the Web Serial API for USB boards (e.g. DGT). It opens the
 * port, streams raw bytes to a handler, and exposes `write`. Adapters layer
 * their message framing on top.
 *
 * Web Serial requires a secure context and a Chromium browser. `requestPort`
 * must be triggered by a user gesture.
 */
export interface WebSerialTransportOptions {
  /** Baud rate. DGT boards run at 9600. */
  baudRate: number;
  /** Optional USB vendor/product filters for the port picker. */
  filters?: SerialPortFilter[];
}

export class WebSerialTransport {
  private port?: SerialPort;
  private reader?: ReadableStreamDefaultReader<Uint8Array>;
  private writer?: WritableStreamDefaultWriter<Uint8Array>;
  private reading = false;

  private onData?: (chunk: Uint8Array) => void;
  private onDisconnect?: () => void;

  constructor(private readonly options: WebSerialTransportOptions) {}

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  setDataHandler(handler: (chunk: Uint8Array) => void): void {
    this.onData = handler;
  }

  setDisconnectHandler(handler: () => void): void {
    this.onDisconnect = handler;
  }

  async connect(): Promise<void> {
    if (!WebSerialTransport.isSupported()) {
      throw new Error('Web Serial is not available in this browser');
    }
    this.port = await navigator.serial.requestPort(
      this.options.filters?.length ? { filters: this.options.filters } : {},
    );
    await this.port.open({ baudRate: this.options.baudRate });

    if (!this.port.readable || !this.port.writable) {
      throw new Error('serial port is not readable/writable');
    }
    this.reader = this.port.readable.getReader();
    this.writer = this.port.writable.getWriter();
    void this.readLoop();
  }

  private async readLoop(): Promise<void> {
    this.reading = true;
    try {
      while (this.reading && this.reader) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value && value.length) this.onData?.(value);
      }
    } catch {
      // Port closed / device unplugged.
    } finally {
      this.onDisconnect?.();
    }
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.writer) throw new Error('transport not connected');
    await this.writer.write(data);
  }

  async disconnect(): Promise<void> {
    this.reading = false;
    try {
      await this.reader?.cancel();
      this.reader?.releaseLock();
    } catch {
      // Ignore teardown races.
    }
    try {
      await this.writer?.close();
      this.writer?.releaseLock();
    } catch {
      // Ignore teardown races.
    }
    try {
      await this.port?.close();
    } catch {
      // Ignore teardown races.
    }
    this.reader = undefined;
    this.writer = undefined;
    this.port = undefined;
  }
}
