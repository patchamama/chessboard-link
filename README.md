# chess-api-adapter

Workspace for **chess-board-link** — a library that connects physical chess
boards (Chessnut, DGT, ChessUp) to a web app over Web Bluetooth / Web Serial,
detects moves, and integrates with Lichess.

## Packages

- **`packages/chess-board-link`** — the library. See its
  [README](./packages/chess-board-link/README.md) for protocols, usage and the
  ChessUp capture guide.
- **`apps/web-test`** — a React 19 + Vite app to test connecting to a board and
  watching the live position, with a hardware-free Mock board.

## Quick start

```bash
pnpm install
pnpm build          # build the library
pnpm test           # run the library's unit tests
pnpm dev            # launch the web test app (http://localhost:5180)
```

Web Bluetooth / Web Serial require a Chromium browser over https or localhost.
