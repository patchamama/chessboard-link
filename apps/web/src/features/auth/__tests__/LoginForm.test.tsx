import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import LoginForm from '../components/LoginForm'

vi.mock('../api/authApi', () => ({
  useLoginMutation: vi.fn(),
}))

import { useLoginMutation } from '../api/authApi'
const mockUseMutation = vi.mocked(useLoginMutation)

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return React.createElement(
    MemoryRouter,
    null,
    React.createElement(QueryClientProvider, { client: qc }, children)
  )
}

describe('LoginForm', () => {
  beforeEach(() => {
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
      isSuccess: false,
    } as any)
  })

  it('shows required errors on empty submit', async () => {
    render(<LoginForm />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
      expect(screen.getByText(/password is required/i)).toBeInTheDocument()
    })
  })
})
