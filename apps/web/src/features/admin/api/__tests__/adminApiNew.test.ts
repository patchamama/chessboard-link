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
import {
  useActiveUsers,
  useBlockedUsers,
  useUserBooks,
  useSetUserPassword,
  useSendResetLink,
  useApproveUser,
  useRejectUser,
} from '../adminApi'

const mockHttp = vi.mocked(httpClient)

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

describe('adminApi — new hooks', () => {
  beforeEach(() => vi.resetAllMocks())

  it('useActiveUsers uses queryKey [admin, active-users]', async () => {
    mockHttp.mockResolvedValue({ users: [] })
    const { result } = renderHook(() => useActiveUsers(), { wrapper })
    await act(async () => {})
    expect(mockHttp).toHaveBeenCalledWith(
      '/api/admin/active-users',
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('useBlockedUsers uses queryKey [admin, blocked-users]', async () => {
    mockHttp.mockResolvedValue({ users: [] })
    const { result } = renderHook(() => useBlockedUsers(), { wrapper })
    await act(async () => {})
    expect(mockHttp).toHaveBeenCalledWith(
      '/api/admin/blocked-users',
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('useUserBooks is disabled when no id provided', async () => {
    mockHttp.mockResolvedValue({ books: [] })
    const { result } = renderHook(() => useUserBooks(undefined), { wrapper })
    await act(async () => {})
    expect(mockHttp).not.toHaveBeenCalled()
  })

  it('useUserBooks fetches when id provided', async () => {
    mockHttp.mockResolvedValue({ books: [] })
    const { result } = renderHook(() => useUserBooks(42), { wrapper })
    await act(async () => {})
    expect(mockHttp).toHaveBeenCalledWith(
      '/api/admin/users/42/books',
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('useSetUserPassword calls correct URL', async () => {
    mockHttp.mockResolvedValue({ message: 'ok' })
    const { result } = renderHook(() => useSetUserPassword(), { wrapper })
    await act(async () => { await result.current.mutateAsync({ userId: 5, password: 'Pass1!' }) })
    expect(mockHttp).toHaveBeenCalledWith(
      '/api/admin/users/5/password',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('useSendResetLink calls correct URL', async () => {
    mockHttp.mockResolvedValue({ message: 'ok' })
    const { result } = renderHook(() => useSendResetLink(), { wrapper })
    await act(async () => { await result.current.mutateAsync(7) })
    expect(mockHttp).toHaveBeenCalledWith(
      '/api/admin/users/7/send-reset',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('approve/reject invalidate active+blocked+pending keys', async () => {
    mockHttp.mockResolvedValue({ ok: true })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const w = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children)

    const { result } = renderHook(() => useApproveUser(), { wrapper: w })
    await act(async () => { await result.current.mutateAsync(1) })

    // Should have invalidated all three
    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => JSON.stringify((c[0] as any)?.queryKey))
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        JSON.stringify(['admin', 'active-users']),
        JSON.stringify(['admin', 'blocked-users']),
        JSON.stringify(['admin', 'pending-users']),
      ])
    )
  })
})
