import { useQuery } from '@tanstack/react-query'
import { httpClient } from '../../../shared/api/httpClient'

export interface Book {
  id: number
  title: string
  author: string
  createdAt: string
}

export interface ChapterTocEntry {
  order: number
  title: string
}

export interface Chapter {
  title: string
  html: string
  toc: ChapterTocEntry[]
}

export function useBooks() {
  return useQuery<Book[]>({
    queryKey: ['library', 'books'],
    queryFn: () => httpClient<Book[]>('/api/library/books'),
  })
}

export function useChapter(bookId: number, chapterOrder: number) {
  return useQuery<Chapter>({
    queryKey: ['library', 'chapter', bookId, chapterOrder],
    queryFn: () => httpClient<Chapter>(`/api/library/books/${bookId}/chapters/${chapterOrder}`),
  })
}
