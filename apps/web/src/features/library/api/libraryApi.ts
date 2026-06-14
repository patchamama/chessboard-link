import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { httpClient } from '../../../shared/api/httpClient'

export interface Book {
  id: number
  title: string
  author: string
  createdAt: string
  description: string
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

export interface UploadInput {
  file?: File
  url?: string
}

export interface UploadResult {
  bookId: number
  status: string
}

export function useUpdateBook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, title, author, description }: { id: number; title: string; author: string; description: string }) =>
      httpClient<Book>(`/api/library/books/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ title, author, description }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['library', 'books'] }),
  })
}

export function useDeleteBook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      httpClient(`/api/library/books/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['library', 'books'] }),
  })
}

export function useTouchBook() {
  return useMutation({
    mutationFn: (bookId: number) =>
      httpClient(`/api/library/books/${bookId}/touch`, { method: 'POST' }),
  })
}

export function useUploadBook() {
  const queryClient = useQueryClient()

  return useMutation<UploadResult, Error, UploadInput>({
    mutationFn: async (input: UploadInput) => {
      if (input.file) {
        const formData = new FormData()
        formData.append('file', input.file)
        // For multipart we skip the default Content-Type header (browser sets boundary)
        return httpClient<UploadResult>('/api/library/upload', {
          method: 'POST',
          headers: {},
          body: formData,
        })
      }
      if (input.url) {
        return httpClient<UploadResult>('/api/library/upload', {
          method: 'POST',
          body: JSON.stringify({ url: input.url }),
        })
      }
      throw new Error('Provide a file or a URL')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library', 'books'] })
    },
  })
}
