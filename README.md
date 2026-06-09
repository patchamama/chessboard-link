# ♞ ChessReader

> **Turn any chess book, EPUB or website into an interactive reading experience.**

ChessReader parses chess content — EPUBs, public URLs, plain text — recognises move notation in Spanish and English, builds a full game tree, and lets you step through every move on a live board with Stockfish evaluation. A companion browser extension brings the same experience to any chess blog you visit.

---

## Features

| Feature | Description |
|---|---|
| **EPUB Library** | Upload and read chess books with inline interactive boards |
| **Web Parser** | Paste any public URL — ChessReader extracts and renders the chess content |
| **Interactive Viewer** | Click any move in the text to jump to that position on the board |
| **Variation Trees** | Full PGN variation support with collapsible branches |
| **Stockfish Eval** | Live engine evaluation bar per move (WASM in-browser + native server-side) |
| **Diagram Regeneration** | Replace external diagram images with locally rendered SVG boards |
| **Browser Extension** | MV3 Chrome/Edge extension — makes chess blogs interactive without the app |
| **Auth & Roles** | JWT-based login with user/admin roles and approval flow |
| **Dev Bypass** | On `localhost`, login is optional — direct access to all features |

---

## Architecture

```
chessreader/
├── apps/
│   ├── api/          # PHP 8.5 · Slim 4 · Clean Architecture (Domain / Application / Infrastructure)
│   ├── web/          # React 19 · TypeScript · Vite · Tailwind CSS
│   └── extension/    # MV3 Browser Extension (Chrome / Edge)
└── packages/
    └── chess-shared/ # Shared TypeScript: move recognition, GameTree, PGN parser
```

The frontend and extension share the `chess-shared` package. The API is a standalone Slim 4 app following Hexagonal Architecture — domain logic is framework-agnostic and fully tested.

---

## Tech Stack

### Backend — `apps/api`
![PHP](https://img.shields.io/badge/PHP-8.5-777BB4?logo=php&logoColor=white)
![Slim](https://img.shields.io/badge/Slim-4-74a045?logo=php&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)

| Layer | Technology |
|---|---|
| Framework | [Slim 4](https://www.slimframework.com/) + PHP-DI |
| Database | SQLite via [Doctrine DBAL](https://www.doctrine-project.org/projects/dbal.html) |
| Auth | JWT ([firebase/php-jwt](https://github.com/firebase/php-jwt)) + bcrypt |
| Chess engine | Native [Stockfish](https://stockfishchess.org/) binary (UCI) |
| HTTP client | [Guzzle](https://docs.guzzlephp.org/) |
| Content extraction | Readability algorithm |
| Tests | PHPUnit |

### Frontend — `apps/web`
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3-38BDF8?logo=tailwindcss&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)

| Layer | Technology |
|---|---|
| UI | React 19 + [react-chessboard](https://github.com/Clariity/react-chessboard) |
| State | [Zustand](https://zustand-demo.pmnd.rs/) (local) + [TanStack Query](https://tanstack.com/query) (server) |
| Router | React Router v7 |
| Chess logic | [chess.js](https://github.com/jhlywa/chess.js) + chess-shared (monorepo) |
| Engine (browser) | [Stockfish WASM](https://github.com/nmrugg/stockfish.js) via Web Worker |
| Tests | Vitest + React Testing Library |

### Browser Extension — `apps/extension`
- Manifest V3 (Chrome / Edge)
- Pure DOM — no framework dependency
- Reuses `chess-shared` for move recognition and `GameTree`

### Shared — `packages/chess-shared`
- TypeScript: `sanTokenizer`, `recognizeGames`, `pgnToTree`, `GameTree`
- Spanish ↔ English notation normalisation
- 60+ unit tests

---

## Quick Start

### Prerequisites

| Tool | Min version | Install |
|---|---|---|
| PHP | 8.1 | [php.net](https://www.php.net/downloads) |
| Composer | 2 | [getcomposer.org](https://getcomposer.org) |
| Node.js | 18 | [nodejs.org](https://nodejs.org) |
| pnpm | 8 | `npm i -g pnpm` |
| Git | any | [git-scm.com](https://git-scm.com) |

### macOS / Linux — one command

```bash
curl -fsSL https://raw.githubusercontent.com/patchamama/chessreader/main/install.sh | bash
```

This clones the repo into `./chessreader`, installs all dependencies, then prints instructions to start.

### Windows — one command

```bat
curl -fsSL https://raw.githubusercontent.com/patchamama/chessreader/main/install.bat -o install.bat && install.bat
```

### Manual install

```bash
# 1. Clone
git clone https://github.com/patchamama/chessreader.git
cd chessreader

# 2. Install dependencies
composer install --working-dir=apps/api
pnpm install

# 3. Start
bash start.sh          # macOS / Linux
start.bat              # Windows
```

### Start

```bash
# macOS / Linux
bash start.sh

# Windows
start.bat
```

The stack starts on:

| Service | URL |
|---|---|
| **Web app** | http://127.0.0.1:5173 |
| **API** | http://127.0.0.1:8080/api/health |

> **Dev mode:** on `localhost` login is optional — you get full admin access automatically. A "dev mode" badge appears in the header.

### Environment overrides

```bash
API_PORT=9000 WEB_PORT=4000 ADMIN_EMAIL=me@example.com ADMIN_PASSWORD=secret bash start.sh
```

---

## Usage

### Library
Upload an EPUB or a book URL → chapters appear in the library. Open a chapter and click any chess move to advance the board.

### Web Parser
Go to **Webparser**, paste a URL (e.g. a chess blog post) and ChessReader fetches the page, detects all games, and renders them inline with interactive boards. Switch between **Normal** (HTML as-is) and **Substitution** (diagram images replaced by live boards) modes.

### Browser Extension
Load the unpacked extension from `apps/extension/` in Chrome (`chrome://extensions → Load unpacked`). Visit any chess site — the extension detects diagrams and game notation and makes them interactive.

### Admin Panel
Visit `/admin` to approve or reject pending user accounts.

---

## Tests

```bash
# PHP backend (183 tests)
cd apps/api && ./vendor/bin/phpunit

# Frontend (99 tests)
cd apps/web && pnpm test

# Shared chess library (61 tests)
cd packages/chess-shared && pnpm test
```

---

## Roadmap

- [ ] Dark mode
- [ ] PGN export from viewer
- [ ] Multi-language UI (ES / EN)
- [ ] PWA / offline support
- [ ] Docker Compose for production

---

## License

[MIT](LICENSE) · built with ♞ and a lot of coffee.
