import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('../../../shared/api/httpClient', () => ({
  httpClient: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public status: number, msg: string) { super(msg) }
  },
}))

import { httpClient } from '../../../shared/api/httpClient'
import { useBooks, useChapter } from '../api/libraryApi'

const mockHttp = vi.mocked(httpClient)

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

describe('libraryApi', () => {
  beforeEach(() => vi.resetAllMocks())

  it('useBooks calls GET /api/library/books', async () => {
    mockHttp.mockResolvedValue([{ id: 1, title: 'Chess Fundamentals', author: 'Capablanca', createdAt: '2024-01-01' }])
    const { result } = renderHook(() => useBooks(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockHttp).toHaveBeenCalledWith('/api/library/books')
    expect(result.current.data).toHaveLength(1)
  })

  it('useChapter calls GET /api/library/books/:id/chapters/:n', async () => {
    const chapter = { title: 'Intro', html: '<p>hi</p>', toc: [{ order: 0, title: 'Intro' }] }
    mockHttp.mockResolvedValue(chapter)
    const { result } = renderHook(() => useChapter(42, 0), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockHttp).toHaveBeenCalledWith('/api/library/books/42/chapters/0')
    expect(result.current.data?.title).toBe('Intro')
  })
})
