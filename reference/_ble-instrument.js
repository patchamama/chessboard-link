/* === BLE INSTRUMENTATION (injected for reverse-engineering) ===
 * Monkeypatches the Web Bluetooth API so every byte written to / received from
 * the physical board is printed to the console, regardless of which internal
 * code path produced it. Look for [BLE] lines in the service-worker console.
 *
 * Safe: it only wraps and logs; it does not change behaviour.
 */
(function () {
  if (typeof self === 'undefined' || self.__BLE_INSTRUMENTED__) return;
  self.__BLE_INSTRUMENTED__ = true;

  const hex = (buf) => {
    try {
      const u =
        buf instanceof ArrayBuffer
          ? new Uint8Array(buf)
          : buf instanceof DataView
            ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
            : buf instanceof Uint8Array
              ? buf
              : new Uint8Array(buf);
      return (
        Array.from(u)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(' ') + `  (len ${u.length})`
      );
    } catch (e) {
      return '<unprintable>';
    }
  };
  const uuidOf = (chr) => {
    try {
      return chr && chr.uuid ? chr.uuid : '?';
    } catch (e) {
      return '?';
    }
  };
  const ts = () => new Date().toISOString().slice(11, 23);
  const log = (...a) => {
    try {
      console.log('[BLE]', ts(), ...a);
    } catch (e) {}
  };

  // --- requestDevice (pairing entry) ---
  try {
    const bt = self.navigator && self.navigator.bluetooth;
    if (bt && bt.requestDevice) {
      const orig = bt.requestDevice.bind(bt);
      bt.requestDevice = function (opts) {
        log('requestDevice options:', JSON.stringify(opts));
        return orig(opts).then((d) => {
          log('requestDevice -> device:', d && d.name, d && d.id);
          return d;
        });
      };
    }
  } catch (e) {}

  // --- GATT connect ---
  try {
    const P = self.BluetoothRemoteGATTServer && self.BluetoothRemoteGATTServer.prototype;
    if (P && P.connect) {
      const orig = P.connect;
      P.connect = function () {
        log('GATT connect ->', this.device && this.device.name);
        return orig.apply(this, arguments);
      };
    }
  } catch (e) {}

  // --- characteristic writes (outgoing to board) ---
  try {
    const C = self.BluetoothRemoteGATTCharacteristic && self.BluetoothRemoteGATTCharacteristic.prototype;
    if (C) {
      for (const m of ['writeValue', 'writeValueWithResponse', 'writeValueWithoutResponse']) {
        if (typeof C[m] === 'function') {
          const orig = C[m];
          C[m] = function (value) {
            log(`SEND ${m} char=${uuidOf(this)}:`, hex(value));
            return orig.apply(this, arguments);
          };
        }
      }

      // --- notifications (incoming from board) ---
      if (typeof C.startNotifications === 'function') {
        const origStart = C.startNotifications;
        C.startNotifications = function () {
          const self2 = this;
          try {
            self2.addEventListener('characteristicvaluechanged', function (ev) {
              const v = ev.target && ev.target.value;
              log(`RECV char=${uuidOf(self2)}:`, hex(v));
            });
          } catch (e) {}
          return origStart.apply(this, arguments);
        };
      }
      // also wrap readValue in case state is polled by reads
      if (typeof C.readValue === 'function') {
        const origRead = C.readValue;
        C.readValue = function () {
          const self2 = this;
          return origRead.apply(this, arguments).then((v) => {
            log(`READ char=${uuidOf(self2)}:`, hex(v));
            return v;
          });
        };
      }
    }
  } catch (e) {}

  log('BLE instrumentation active');
})();
/* === END BLE INSTRUMENTATION === */
