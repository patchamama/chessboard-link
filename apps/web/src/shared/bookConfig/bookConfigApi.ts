import { httpClient } from '../api/httpClient'
import type { BookConfig } from './bookConfig'

/** Fetch a book's custom render config (any approved user). */
export async function getBookConfig(bookId: number): Promise<BookConfig> {
  return httpClient<BookConfig>(`/api/library/books/${bookId}/config`)
}

/** Save a book's custom render config (admin only — 403 otherwise). */
export async function saveBookConfig(
  bookId: number,
  config: BookConfig,
): Promise<{ ok: boolean; config: BookConfig }> {
  return httpClient(`/api/library/books/${bookId}/config`, {
    method: 'PUT',
    body: JSON.stringify(config),
  })
}
