import type { PlatformAdapter, PlatformMoveListener } from './PlatformAdapter.js';

/**
 * Lichess integration via the official Board API.
 *
 * Requires a personal access token with the `board:play` scope
 * (https://lichess.org/account/oauth/token). The Board API streams game state
 * over a chunked NDJSON response and accepts moves over a simple POST.
 *
 * Docs: https://lichess.org/api#tag/Board
 */
export interface LichessPlatformOptions {
  token: string;
  /** The id of the game to play (the 8-char game id, not the full URL). */
  gameId: string;
  baseUrl?: string;
}

export class LichessPlatform implements PlatformAdapter {
  readonly id = 'lichess';
  readonly name = 'Lichess';

  private readonly baseUrl: string;
  private readonly listeners = new Set<PlatformMoveListener>();
  private abort?: AbortController;
  private lastMoveCount = 0;

  constructor(private readonly options: LichessPlatformOptions) {
    this.baseUrl = options.baseUrl ?? 'https://lichess.org';
  }

  /** Begin streaming the game state. Resolves once the stream is open. */
  async connect(): Promise<void> {
    this.abort = new AbortController();
    const res = await fetch(
      `${this.baseUrl}/api/board/game/stream/${this.options.gameId}`,
      {
        headers: { Authorization: `Bearer ${this.options.token}` },
        signal: this.abort.signal,
      },
    );
    if (!res.ok || !res.body) {
      throw new Error(`lichess stream failed: ${res.status} ${res.statusText}`);
    }
    void this.readStream(res.body);
  }

  private async readStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (line) this.handleStreamLine(line);
        }
      }
    } catch {
      // Stream aborted or network dropped.
    }
  }

  private handleStreamLine(line: string): void {
    let event: { type?: string; state?: { moves?: string }; moves?: string };
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }
    // gameFull carries `state.moves`; gameState carries `moves` directly.
    const moves = event.state?.moves ?? event.moves;
    if (typeof moves !== 'string') return;
    const list = moves.length ? moves.split(' ') : [];
    // Emit any moves we haven't seen yet (covers our own + opponent moves).
    for (let i = this.lastMoveCount; i < list.length; i++) {
      const uci = list[i]!;
      for (const listener of this.listeners) listener({ uci });
    }
    this.lastMoveCount = list.length;
  }

  async pushMove(uci: string): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}/api/board/game/${this.options.gameId}/move/${uci}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.options.token}` },
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`lichess move ${uci} rejected: ${res.status} ${body}`);
    }
  }

  onRemoteMove(listener: PlatformMoveListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async close(): Promise<void> {
    this.abort?.abort();
    this.listeners.clear();
  }
}
