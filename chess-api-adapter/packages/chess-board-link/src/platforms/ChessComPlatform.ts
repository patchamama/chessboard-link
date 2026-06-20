import type { PlatformAdapter, PlatformMoveListener } from './PlatformAdapter.js';

/**
 * chess.com integration via DOM automation.
 *
 * chess.com has **no public API to submit a move** (its Published-Data API is
 * read-only). The official ChessConnect extension plays moves by simulating
 * pointer events on the board element, and this adapter ports that approach.
 *
 * ⚠️  IMPORTANT — read before using:
 *   - This drives the page like a user (pointerdown -> pointerup -> click on the
 *     from-square then the to-square). It is **fragile**: any chess.com UI change
 *     can break it.
 *   - Automating play likely violates the chess.com Terms of Service and can
 *     trigger anti-automation measures or account action. Use only where you are
 *     authorised to (e.g. your own analysis board) and at your own risk.
 *   - It must run in a context with access to the chess.com page DOM — i.e. a
 *     browser-extension content script injected into chess.com, not a sandboxed
 *     iframe or a different origin.
 *
 * The coordinate math (square center with slight random jitter, board
 * orientation handling) mirrors the extension's `centerOfField`.
 */
export interface ChessComPlatformOptions {
  /**
   * The board element. Defaults to looking up `wc-chess-board` / `cg-board`
   * in the current document.
   */
  boardElement?: HTMLElement;
  /** Whether the board is shown from black's side (flipped). */
  flipped?: boolean;
  /** Delay between pointerdown and pointerup, ms (extension uses 100). */
  clickHoldMs?: number;
}

interface Point {
  x: number;
  y: number;
}

const FILES = 'abcdefgh';

export class ChessComPlatform implements PlatformAdapter {
  readonly id = 'chesscom';
  readonly name = 'Chess.com (DOM automation — experimental)';

  private readonly clickHoldMs: number;

  constructor(private readonly options: ChessComPlatformOptions = {}) {
    this.clickHoldMs = options.clickHoldMs ?? 100;
  }

  private resolveBoard(): HTMLElement {
    if (this.options.boardElement) return this.options.boardElement;
    const el =
      document.querySelector<HTMLElement>('wc-chess-board') ??
      document.querySelector<HTMLElement>('cg-board') ??
      document.querySelector<HTMLElement>('chess-board');
    if (!el) {
      throw new Error(
        'chess.com board element not found; pass options.boardElement',
      );
    }
    return el;
  }

  /** Center of a square, mirroring the extension's centerOfField (+ jitter). */
  private centerOfField(
    board: HTMLElement,
    col: number,
    row: number,
    flipped: boolean,
  ): Point {
    const rect = board.getBoundingClientRect();
    const s = rect.width / 8;
    const o = rect.height / 8;
    const jx = s * (Math.random() - 0.5) * 0.9;
    const jy = o * (Math.random() - 0.5) * 0.9;
    if (flipped) {
      return {
        x: rect.left + s * col + s / 2 + jx,
        y: rect.top + rect.height - o * row - o / 2 + jy,
      };
    }
    return {
      x: rect.left + rect.width - s * col - s / 2 + jx,
      y: rect.top + o * row + o / 2 + jy,
    };
  }

  private dispatchPointer(
    board: HTMLElement,
    type: 'pointerdown' | 'pointerup' | 'click',
    at: Point,
  ): void {
    const target =
      (document.elementFromPoint(at.x, at.y) as HTMLElement | null) ?? board;
    const Ctor: typeof PointerEvent =
      typeof PointerEvent !== 'undefined'
        ? PointerEvent
        : (MouseEvent as unknown as typeof PointerEvent);
    target.dispatchEvent(
      new Ctor(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: at.x,
        clientY: at.y,
        ...(type !== 'click' ? { pointerId: 1, pointerType: 'mouse' } : {}),
      }),
    );
  }

  private async clickSquare(board: HTMLElement, at: Point): Promise<void> {
    this.dispatchPointer(board, 'pointerdown', at);
    await new Promise((r) => setTimeout(r, this.clickHoldMs));
    this.dispatchPointer(board, 'pointerup', at);
    this.dispatchPointer(board, 'click', at);
  }

  private squareToColRow(square: string): { col: number; row: number } {
    const col = FILES.indexOf(square[0]!);
    const row = Number(square[1]) - 1;
    if (col < 0 || row < 0 || row > 7) {
      throw new Error(`invalid square: ${square}`);
    }
    return { col, row };
  }

  /** Play a UCI move by clicking the from-square then the to-square. */
  async pushMove(uci: string): Promise<void> {
    const board = this.resolveBoard();
    const flipped = this.options.flipped ?? false;
    const from = this.squareToColRow(uci.slice(0, 2));
    const to = this.squareToColRow(uci.slice(2, 4));

    await this.clickSquare(
      board,
      this.centerOfField(board, from.col, from.row, flipped),
    );
    await this.clickSquare(
      board,
      this.centerOfField(board, to.col, to.row, flipped),
    );
    // Promotion (uci[4]) would require clicking the promotion picker; left to
    // the caller for now since the picker layout varies.
  }

  /**
   * Reading the opponent's move would require observing the board DOM with a
   * MutationObserver. Not implemented here; returns a no-op unsubscribe.
   */
  onRemoteMove(_listener: PlatformMoveListener): () => void {
    return () => {};
  }

  async close(): Promise<void> {
    // Nothing to release.
  }
}
