# chess-board-link

Connect physical chess boards (Chessnut, DGT, ChessUp, ...) to a web app over
**Web Bluetooth** or **Web Serial (USB)**, detect over-the-board moves, and push
them to online platforms — a from-scratch, ChessConnect-style library built by
reverse-engineering public sources.

> Status: **0.2.0**. Chessnut (BLE), DGT (USB) and **ChessUp (BLE)** use real
> protocols — the ChessUp protocol and the chess.com move-injection approach
> were extracted from the official ChessConnect Chrome extension (see
> [PROTOCOLS.md](./PROTOCOLS.md)). Lichess integration uses the official Board
> API; chess.com move submission is now available via DOM automation (fragile,
> ToS-gray — read the warning below).

## Why this exists

The official [ChessConnect](https://www.digitalgametechnology.com/news/chessconnect)
Chrome extension links smart boards (Chessnut, Certabo, DGT, Millennium) to
Lichess and Chess.com, but it's closed-source. This library re-implements the
useful core in the open, on top of browser-native `navigator.bluetooth` and
`navigator.serial`, with a clean adapter architecture so new boards are easy to
add.

## Architecture

```
your app  ─►  BoardAdapter (Chessnut | DGT | ChessUp | Mock)
                  │  decodes its protocol, emits BoardState + Move
                  ▼
              core: BoardState (64, a8..h1)  ──►  moveDetection (chess.js)
                  │
                  ▼
              PlatformAdapter (Lichess | ChessCom)  ─►  online game
```

- **Transports** (`WebBluetoothTransport`, `WebSerialTransport`) move raw bytes;
  they know nothing about chess.
- **Adapters** layer a board's protocol on a transport, decode each frame into a
  64-square `BoardState` (a8..h1 order), and let the base class diff snapshots
  into moves.
- **Move detection** diffs two snapshots and validates against `chess.js`
  (handles captures, castling, promotion; rejects mid-move "piece lifted" noise).
- **Platforms** push detected moves online and stream the opponent's moves back.

## Install

```bash
pnpm add chess-board-link chess.js
```

Requires a Chromium browser (Chrome/Edge) over **https or localhost** — Web
Bluetooth and Web Serial only work in a secure context, and the connect call
must run from a user gesture (a click).

## Usage

### Chessnut over Bluetooth

```ts
import { ChessnutAdapter } from 'chess-board-link';

const board = new ChessnutAdapter();
board.on('status', (s) => console.log('status', s));
board.on('move', (m) => console.log('move', m.uci, m.san));
board.on('boardState', (b) => console.log('snapshot', b));

document.querySelector('#connect')!.addEventListener('click', () => {
  board.connect(); // opens the BLE device picker
});
```

### DGT over USB

```ts
import { DgtAdapter } from 'chess-board-link';

const board = new DgtAdapter();
board.on('move', (m) => console.log(m.uci));
document.querySelector('#connect')!.addEventListener('click', () => board.connect());
```

### Drive Lichess from the board

```ts
import { LichessPlatform } from 'chess-board-link';

const lichess = new LichessPlatform({ token: TOKEN, gameId: 'abcd1234' });
await lichess.connect();
lichess.onRemoteMove(({ uci }) => highlightOnBoard(uci)); // opponent moved

board.on('move', async (m) => {
  try {
    await lichess.pushMove(m.uci);
  } catch (e) {
    console.warn('rejected', e);
  }
});
```

The Lichess token needs the `board:play` scope
(https://lichess.org/account/oauth/token).

### Registry (for a board-picker UI)

```ts
import { createDefaultRegistry } from 'chess-board-link';

const registry = createDefaultRegistry();
registry.list(); // [{ id:'chessnut', name, transportType, experimental? }, ...]
const adapter = registry.create('dgt');
```

## Supported boards

| Board    | Transport       | Protocol source                                   | Status        |
|----------|-----------------|---------------------------------------------------|---------------|
| Chessnut Air / Pro | Web Bluetooth | `paulvonallwoerden/chessnut-air`, `rmarabini/chessnutair` | ✅ Implemented |
| DGT e-Board | Web Serial (USB) | Official DGT protocol header (`dgtbrd13.h`), `fnogatz/dgtchess` | ✅ Implemented |
| ChessUp  | Web Bluetooth   | ChessConnect extension (Nordic UART, opcode 163)  | ✅ Implemented* |
| Mock     | — (no hardware) | —                                                 | ✅ For dev/demo |
| iChessOne, GoChess, Millennium, Certabo, Tabutronic, … | BLE / USB | ChessConnect extension | ⏳ Documented in [PROTOCOLS.md](./PROTOCOLS.md) |

\* ChessUp's protocol is verified from the extension's source, not yet tested
against a physical board, so it ships flagged `experimental` in the registry.

### Chessnut protocol (verified)

- Service `1b7e8262-2877-41c3-b46e-cf057c562023`
- Notify (board) `1b7e8273-...`, Write `1b7e8272-...`
- Enable real-time updates: write `0x21 0x01 0x00`
- Board state: notification bytes `[2, 34)` = 32 bytes → 64 nibbles
  (low nibble first), mapped to pieces via `CHESSNUT_PIECE_LUT`, in a8..h1 order.
- LEDs: command `0x0a` + length + 8-byte bitmap (one byte per rank, file a = MSB).

### DGT protocol (verified)

- 9600 baud serial. Commands: `SEND_RESET 0x40`, `SEND_BRD 0x42`,
  `SEND_UPDATE_NICE 0x4b`. Messages: `BOARD_DUMP 0x06`, `FIELD_UPDATE 0x0e`,
  3-byte header `[id|0x80, lenMSB(7b), lenLSB(7b)]`. Piece codes 0–12 per the
  protocol header. Squares reported in a8..h1 order.

### ChessUp protocol (extracted)

ChessUp speaks the **Nordic UART** service (`6e400001/2/3-b5a3-…`) and, unlike
Chessnut/DGT, reports *completed moves* (opcode `163`) rather than a 64-square
map. The frame is `[163, 53, fromRow, fromCol, toRow, toCol]`; castling is
reported king→rook and normalised to king-target UCI. See
[PROTOCOLS.md](./PROTOCOLS.md) for the full breakdown. The adapter is verified
against the extension source but not yet against physical hardware, so it ships
flagged `experimental`.

## Platforms

| Platform | Move submission | Notes                                                |
|----------|-----------------|------------------------------------------------------|
| Lichess  | ✅ Board API     | Official, robust. Needs a `board:play` token.        |
| Chess.com | ⚠️ DOM automation | No move API; simulates pointer events. See below.   |

### chess.com (DOM automation — read this)

chess.com's public Published-Data API is **read-only** — there is no endpoint to
submit a move. `ChessComPlatform.pushMove` therefore plays moves by simulating
pointer events on the board element (the approach the ChessConnect extension
uses): it computes each square's center from `getBoundingClientRect()` with
small random jitter, then fires `pointerdown → pointerup → click` on the
from-square and the to-square.

⚠️ This is **fragile** (breaks on chess.com UI changes), **likely violates the
chess.com Terms of Service**, and can trigger anti-automation measures. It must
run with access to the chess.com page DOM (a browser-extension content script).
Use only where you are authorised, at your own risk.

```ts
import { ChessComPlatform } from 'chess-board-link';
const chesscom = new ChessComPlatform({ flipped: false });
board.on('move', (m) => chesscom.pushMove(m.uci));
```

## Development

```bash
pnpm install
pnpm --filter chess-board-link build   # ESM + .d.ts via tsup
pnpm --filter chess-board-link test    # vitest (protocol + move-detection)
pnpm --filter @chess-board-link/web-test dev   # launch the web test app
```

The **web test app** (`apps/web-test`) lets you pick a board, connect over
BLE/USB, watch the live board and an event log, or run the **Mock** board demo
with no hardware.

## License

MIT. Protocol knowledge derived from open-source projects (GPL/MIT) and DGT's
published protocol; this is an independent clean-room re-implementation of the
wire formats, not a copy of any extension's code.
