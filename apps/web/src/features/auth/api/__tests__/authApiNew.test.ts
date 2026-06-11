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
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

import { httpClient } from '../../../../shared/api/httpClient'
import { useConfirmPasswordReset } from '../authApi'

const mockHttp = vi.mocked(httpClient)

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

describe('authApi — new hooks', () => {
  beforeEach(() => vi.resetAllMocks())

  it('useConfirmPasswordReset calls POST /api/auth/password-reset/confirm', async () => {
    mockHttp.mockResolvedValue({ message: 'Password has been reset successfully.' })
    const { result } = renderHook(() => useConfirmPasswordReset(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ token: 'abc123', password: 'NewPass1!' })
    })
    expect(mockHttp).toHaveBeenCalledWith(
      '/api/auth/password-reset/confirm',
      expect.objectContaining({ method: 'POST' })
    )
  })
})
