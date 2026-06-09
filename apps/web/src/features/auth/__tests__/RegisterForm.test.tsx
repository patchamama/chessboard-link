import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import RegisterForm from '../components/RegisterForm'

vi.mock('../api/authApi', () => ({
  useRegisterMutation: vi.fn(),
}))

import { useRegisterMutation } from '../api/authApi'
const mockUseMutation = vi.mocked(useRegisterMutation)

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return React.createElement(
    MemoryRouter,
    null,
    React.createElement(QueryClientProvider, { client: qc }, children)
  )
}

describe('RegisterForm', () => {
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
    render(<RegisterForm />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: /register/i }))

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
      expect(screen.getByText(/password is required/i)).toBeInTheDocument()
    })
  })

  it('shows email format error for invalid email', async () => {
    render(<RegisterForm />, { wrapper })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'not-an-email' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pw123' } })
    fireEvent.click(screen.getByRole('button', { name: /register/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument()
    })
  })

  it('displays API error message', async () => {
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      error: { message: 'Email already registered' },
      isSuccess: false,
    } as any)

    render(<RegisterForm />, { wrapper })
    expect(screen.getByText(/email already registered/i)).toBeInTheDocument()
  })
})
