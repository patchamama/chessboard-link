import type { BoardAdapter } from './BoardAdapter.js';
import type { LedState, Square } from './types.js';

/**
 * Light the from/to squares of a move on a board that supports LEDs, to guide
 * the player to make the move physically (e.g. the bot's or opponent's move).
 * No-op on boards without `setLeds`.
 */
export async function highlightMove(
  adapter: BoardAdapter,
  uci: string,
): Promise<void> {
  if (!adapter.setLeds) return;
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  await adapter.setLeds([
    { square: from, on: true },
    { square: to, on: true },
  ]);
}

/** Turn off all LEDs on a board that supports them. */
export async function clearLeds(adapter: BoardAdapter): Promise<void> {
  if (!adapter.setLeds) return;
  const all: LedState[] = [];
  const files = 'abcdefgh';
  for (const f of files) {
    for (let r = 1; r <= 8; r++) all.push({ square: `${f}${r}`, on: false });
  }
  await adapter.setLeds(all);
}
