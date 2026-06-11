import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('../../../../shared/api/httpClient', () => ({
  httpClient: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public status: number, msg: string) { super(msg) }
  },
}))

import { httpClient } from '../../../../shared/api/httpClient'
import { useUpdateBook, useTouchBook, type Book } from '../libraryApi'

const mockHttp = vi.mocked(httpClient)

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

describe('libraryApi — new hooks', () => {
  beforeEach(() => vi.resetAllMocks())

  it('useUpdateBook calls PUT /api/library/books/:id', async () => {
    mockHttp.mockResolvedValue({ id: 1, title: 'New', author: 'A', description: 'D' })
    const { result } = renderHook(() => useUpdateBook(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ id: 1, title: 'New', author: 'A', description: 'D' })
    })
    expect(mockHttp).toHaveBeenCalledWith(
      '/api/library/books/1',
      expect.objectContaining({ method: 'PUT' })
    )
  })

  it('useUpdateBook invalidates library books cache on success', async () => {
    mockHttp.mockResolvedValue({ id: 1, title: 'New', author: 'A', description: 'D' })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const w = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children)

    const { result } = renderHook(() => useUpdateBook(), { wrapper: w })
    await act(async () => {
      await result.current.mutateAsync({ id: 1, title: 'T', author: 'A', description: 'D' })
    })

    const keys = invalidateSpy.mock.calls.map((c) => JSON.stringify((c[0] as any)?.queryKey))
    expect(keys).toEqual(expect.arrayContaining([JSON.stringify(['library', 'books'])]))
  })

  it('useTouchBook calls POST /api/library/books/:id/touch (fire-and-forget)', async () => {
    mockHttp.mockResolvedValue({ ok: true })
    const { result } = renderHook(() => useTouchBook(), { wrapper })
    await act(async () => { await result.current.mutateAsync(5) })
    expect(mockHttp).toHaveBeenCalledWith(
      '/api/library/books/5/touch',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('Book interface includes description field', () => {
    // Type-level test: construct a Book and verify description is accessible
    const book: Book = { id: 1, title: 'T', author: 'A', createdAt: '2024-01-01', description: 'Some desc' }
    expect(book.description).toBe('Some desc')
  })
})
