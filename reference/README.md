# Reference material

Third-party material kept for reverse-engineering reference only. **Not part of
the build** and not covered by this project's license. All folders here are
gitignored (proprietary); they are regenerated locally as needed.

## Tooling used for reverse-engineering

- **`chessconnect-beautified/`** — `background.js` run through `js-beautify`
  (`npx js-beautify dist/background.js`) so the minified bundle is readable
  (~7.8k lines). Generate with the command above against the extension copy.
- **`chessconnect-instrumented/`** — a copy of the extension with its internal
  logger patched to also `console.log` every message (`[CC-LOG]` lines), used to
  capture the exact bytes a real ChessUp board exchanges. See its
  `CAPTURE-GUIDE.md` for how to load it and capture. This is how the ChessUp
  connect handshake (TRADEMARK 71 → CONFIG …, **no reset 64**) was confirmed.

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
