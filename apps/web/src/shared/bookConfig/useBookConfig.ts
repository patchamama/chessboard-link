import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getBookConfig, saveBookConfig } from './bookConfigApi'
import { DEFAULT_BOOK_CONFIG, type BookConfig } from './bookConfig'

const key = (bookId: number) => ['book-config', bookId] as const

/** Read a book's render config; falls back to defaults while loading. */
export function useBookConfig(bookId: number) {
  const query = useQuery<BookConfig>({
    queryKey: key(bookId),
    queryFn: () => getBookConfig(bookId),
    enabled: bookId > 0,
  })
  return { ...query, config: query.data ?? DEFAULT_BOOK_CONFIG }
}

/** Save a book's render config (admin) and refresh the cached value. */
export function useSaveBookConfig(bookId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (config: BookConfig) => saveBookConfig(bookId, config),
    onSuccess: (res) => qc.setQueryData(key(bookId), res.config),
  })
}
