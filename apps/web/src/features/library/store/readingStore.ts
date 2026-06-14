/** Reading progress persisted to localStorage, keyed by bookId. */
export interface ReadingProgress {
  chapter: number
  lastOpenedAt: string // ISO string
}

const KEY = (bookId: number) => `reading-progress-${bookId}`

export function getProgress(bookId: number): ReadingProgress | null {
  try {
    const raw = localStorage.getItem(KEY(bookId))
    return raw ? (JSON.parse(raw) as ReadingProgress) : null
  } catch {
    return null
  }
}

export function saveProgress(bookId: number, chapter: number) {
  const data: ReadingProgress = { chapter, lastOpenedAt: new Date().toISOString() }
  localStorage.setItem(KEY(bookId), JSON.stringify(data))
}
