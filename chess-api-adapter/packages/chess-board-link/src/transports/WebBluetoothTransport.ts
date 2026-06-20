/**
 * Thin wrapper over the Web Bluetooth GATT API. It knows nothing about chess —
 * it connects to a device, subscribes to a notify characteristic, and exposes
 * a `write` to a control characteristic. Adapters layer their protocol on top.
 *
 * Web Bluetooth requires a secure context (https/localhost) and a Chromium
 * browser. The `requestDevice` call must be triggered by a user gesture.
 */
export interface WebBluetoothTransportOptions {
  /** GATT primary service UUID (lowercase). */
  serviceUuid: string;
  /** Characteristic to subscribe to for inbound notifications. */
  notifyCharacteristicUuid: string;
  /** Characteristic used to send commands to the board. */
  writeCharacteristicUuid: string;
  /** Optional name prefixes used to pre-filter the device picker. */
  namePrefixes?: string[];
}

export class WebBluetoothTransport {
  private device?: BluetoothDevice;
  private server?: BluetoothRemoteGATTServer;
  private notifyChar?: BluetoothRemoteGATTCharacteristic;
  private writeChar?: BluetoothRemoteGATTCharacteristic;

  private onData?: (data: DataView) => void;
  private onDisconnect?: () => void;

  constructor(private readonly options: WebBluetoothTransportOptions) {}

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Devices the user has already granted access to (Chrome only). Used to
   * reconnect after a page refresh without showing the picker again.
   */
  static async getKnownDevices(): Promise<BluetoothDevice[]> {
    if (!WebBluetoothTransport.isSupported()) return [];
    const bt = navigator.bluetooth as Bluetooth & {
      getDevices?: () => Promise<BluetoothDevice[]>;
    };
    if (typeof bt.getDevices !== 'function') return [];
    try {
      return await bt.getDevices();
    } catch {
      return [];
    }
  }

  /** Find a previously-granted device by id (for one-click reconnect). */
  static async findKnownDevice(
    deviceId: string,
  ): Promise<BluetoothDevice | undefined> {
    const devices = await WebBluetoothTransport.getKnownDevices();
    return devices.find((d) => d.id === deviceId);
  }

  /** The connected device's id (stable per origin), for persistence. */
  get deviceId(): string | undefined {
    return this.device?.id;
  }

  get deviceName(): string | undefined {
    return this.device?.name;
  }

  /** Register the inbound-data callback. Call before {@link connect}. */
  setDataHandler(handler: (data: DataView) => void): void {
    this.onData = handler;
  }

  setDisconnectHandler(handler: () => void): void {
    this.onDisconnect = handler;
  }

  /**
   * @param opts.device a previously-known device (from {@link getKnownDevices})
   *   to reconnect to without showing the picker.
   */
  async connect(opts: { device?: BluetoothDevice } = {}): Promise<void> {
    if (!WebBluetoothTransport.isSupported()) {
      throw new Error('Web Bluetooth is not available in this browser');
    }
    const { serviceUuid, notifyCharacteristicUuid, writeCharacteristicUuid, namePrefixes } =
      this.options;

    if (opts.device) {
      this.device = opts.device;
    } else {
      const filters: BluetoothLEScanFilter[] = [{ services: [serviceUuid] }];
      if (namePrefixes?.length) {
        for (const namePrefix of namePrefixes) filters.push({ namePrefix });
      }
      this.device = await navigator.bluetooth.requestDevice({
        filters,
        optionalServices: [serviceUuid],
      });
    }

    this.device.addEventListener('gattserverdisconnected', () => {
      this.onDisconnect?.();
    });

    const server = await this.device.gatt!.connect();
    this.server = server;
    const service = await server.getPrimaryService(serviceUuid);
    this.notifyChar = await service.getCharacteristic(notifyCharacteristicUuid);
    this.writeChar = await service.getCharacteristic(writeCharacteristicUuid);

    this.notifyChar.addEventListener('characteristicvaluechanged', (event) => {
      const target = event.target as BluetoothRemoteGATTCharacteristic;
      if (target.value) this.onData?.(target.value);
    });
    await this.notifyChar.startNotifications();
  }

  /** Send a command buffer to the write characteristic. */
  async write(data: Uint8Array): Promise<void> {
    if (!this.writeChar) throw new Error('transport not connected');
    // Copy into a fresh ArrayBuffer-backed view: the typed lib marks generic
    // Uint8Array buffers as possibly SharedArrayBuffer, which is not a valid
    // BufferSource for GATT writes.
    const buf = new Uint8Array(data);
    // writeValueWithoutResponse keeps LED/poll commands snappy; fall back when
    // the characteristic only supports acknowledged writes.
    if (this.writeChar.properties.writeWithoutResponse) {
      await this.writeChar.writeValueWithoutResponse(buf);
    } else {
      await this.writeChar.writeValue(buf);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.notifyChar?.stopNotifications();
    } catch {
      // Ignore — the device may already be gone.
    }
    this.server?.disconnect();
    this.device = undefined;
    this.server = undefined;
    this.notifyChar = undefined;
    this.writeChar = undefined;
  }
}
