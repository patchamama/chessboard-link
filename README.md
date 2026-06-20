# chess-api-adapter

Workspace for **chess-board-link** — a library that connects physical chess
boards (Chessnut, DGT, ChessUp, iChessOne) to a web app over **Web Bluetooth**
or **Web Serial (USB)**, detects moves, and integrates with Lichess and
Chess.com. Built by reverse-engineering the official ChessConnect Chrome
extension and open-source projects.

## Packages

- **`packages/chess-board-link`** — the library. See its
  [README](./packages/chess-board-link/README.md) for usage and
  [PROTOCOLS.md](./packages/chess-board-link/PROTOCOLS.md) for the wire formats
  of all 15 boards in the extension.
- **`apps/web-test`** — a React 19 + Vite **play app**. Features:
  - Interactive board; moves validated by **chess.js**.
  - Play vs a **Stockfish** bot (CDN) with adjustable skill.
  - **Progressive analysis** (depth 1→30) with a live **eval bar** + FEN, and a
    **candidate-moves** panel (MultiPV ~10): each line shows its eval and SAN,
    hovering previews it on a mini-board and highlights it on the main board,
    and the top move is clickable to play it.
  - **PGN move list** with piece glyphs; **colour-coded event log** (your moves,
    bot, data received from / sent to the board).
  - Choose **piece set** and **board colour theme**; **light/dark** mode.
  - Several boards at once (**tabs**), each with its own session; **persistence**
    across refreshes; one-click Bluetooth **reconnect**; physical-board controls
    (light a move, sync, etc.). A hardware-free **Mock** board needs no hardware.

## Tech stack

React 19 · TypeScript · Vite · Zustand-free local hooks · chess.js · Stockfish
(WASM/asm.js via CDN) · Web Bluetooth / Web Serial · Vitest · pnpm workspaces ·
GitHub Actions + GitHub Pages.

## Getting started

```bash
pnpm install            # install workspace deps (Node >= 20, pnpm 11)
pnpm dev                # build the lib, then launch the web test app
```

Then open **http://localhost:5180** in Chrome or Edge.

> ⚠️ Web Bluetooth / Web Serial only work in a **Chromium** browser over
> **https or localhost**, and the connect button must be clicked by you (browser
> security requires a user gesture).

### No hardware? Use the Mock board

In the app, pick **“Mock board (no hardware)”**, click **Connect**, then
**Run demo** — it plays `1.e4 e5 2.Nf3` so you can see the board and event log
update without any physical board.

## Scripts

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Build the library, then start the web test app (alias: `pnpm start`) |
| `pnpm dev:app` | Start the app only (use after the lib is built) |
| `pnpm build` | Build the library (ESM + types via tsup) |
| `pnpm build:app` | Build the web test app for production |
| `pnpm test` | Run the library unit tests (Vitest) |
| `pnpm typecheck` | Typecheck the library and the app |
| `pnpm preview` | Preview the production app build |

## Boards at a glance

| Board | What it does | Transport |
|-------|--------------|-----------|
| Chessnut Air / Pro | ✅ Live board reads | Web Bluetooth |
| DGT e-Board | ✅ Move/position reads | Web Serial (USB) |
| ChessUp | 🧪 Move events (verified from source) | Web Bluetooth |
| iChessOne | 🧪 Position reads (verified from source) | Web Bluetooth |
| Mock | ✅ Dev/demo, no hardware | — |
| GoChess, Millennium, Certabo, … | ⏳ Documented, not ported | BLE / USB |

🧪 = verified from the ChessConnect extension source, not yet against physical
hardware (ships flagged `experimental`). Full details and the remaining boards:
[PROTOCOLS.md](./packages/chess-board-link/PROTOCOLS.md).

## Deploy

Pushing to `main` runs CI (typecheck + tests + build) and deploys the web test
app to **GitHub Pages** via `.github/workflows/deploy.yml`. Enable Pages in the
repo settings (Source: GitHub Actions). The published app lives at
`https://patchamama.github.io/chessboard-link/`. The Vite `base` path is set
automatically in CI through the `GITHUB_PAGES` env var.

## Online platforms

- **Lichess** — official Board API (needs a `board:play` token).
- **Chess.com** — DOM pointer-event injection (no move API exists). Fragile and
  ToS-gray; read the warning in the library README before using.
