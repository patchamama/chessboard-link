import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

vi.mock('../../../shared/api/httpClient', () => ({
  httpClient: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public status: number, msg: string) { super(msg) }
  },
}))

// isDemoHost must return false so LoginForm doesn't pre-fill in tests
vi.mock('../../../shared/env/devMode', () => ({
  isDemoHost: vi.fn(() => false),
  isLocalhostHost: vi.fn(() => false),
}))

import { httpClient } from '../../../shared/api/httpClient'
import { useRegisterMutation, useLoginMutation } from '../api/authApi'

const mockHttp = vi.mocked(httpClient)

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return React.createElement(
    MemoryRouter,
    null,
    React.createElement(QueryClientProvider, { client: qc }, children),
  )
}

describe('authApi', () => {
  beforeEach(() => vi.resetAllMocks())

  it('useRegisterMutation calls POST /api/auth/register', async () => {
    mockHttp.mockResolvedValue({ id: 1, email: 'a@b.com', status: 'pending' })
    const { result } = renderHook(() => useRegisterMutation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ email: 'a@b.com', password: 'pw' })
    })

    expect(mockHttp).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({ method: 'POST' }))
  })

  it('useLoginMutation calls POST /api/auth/login', async () => {
    mockHttp.mockResolvedValue({ token: 'eyJ.eyJzdWIiOjEsImVtYWlsIjoiYUBiLmNvbSIsInJvbGUiOiJ1c2VyIiwic3RhdHVzIjoiYXBwcm92ZWQifQ.sig' })
    const { result } = renderHook(() => useLoginMutation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ email: 'a@b.com', password: 'pw' })
    })

    expect(mockHttp).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({ method: 'POST' }))
  })
})
