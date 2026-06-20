# Reference material

Third-party material kept for reverse-engineering reference only. **Not part of
the build** and not covered by this project's license.

## `chessconnect-extension/`

A verbatim copy of the official **ChessConnect** Chrome extension
(id `dmkkcjpbclkkhbdnjgcciohfbnpoaiam`, **version 6.0.3**), as installed from the
Chrome Web Store. © Digital Game Technology — included here unmodified solely as
the source from which the board protocols in
[`../packages/chess-board-link/PROTOCOLS.md`](../packages/chess-board-link/PROTOCOLS.md)
were extracted.

### Where the useful bits live

The code is a minified production bundle, but protocol constants are string
literals, so `ripgrep` recovers them:

- `dist/background.js` (~631k) — the service worker: every board's BLE/USB
  driver, UUIDs, command bytes and decoders.
- `dist/chesscomcontent.js` — the chess.com content script (runs in the page
  `MAIN` world): board lookup + pointer-event move injection (`centerOfField`).
- `dist/chesscomhack.js` — the iOS/webkit bridge shim (not the DOM injection).
- `manifest.json` — content-script matches, permissions, world isolation.

### Re-extracting a constant

```bash
D=reference/chessconnect-extension/dist
# All UUIDs:
rg -o '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' "$D/background.js" | sort -u
# Context around a board name:
rg -o '.{100}ChessUp.{300}' "$D/background.js"
```

The board enum, all UUIDs, init/command bytes and decoders are already
catalogued in `PROTOCOLS.md` — start there.
