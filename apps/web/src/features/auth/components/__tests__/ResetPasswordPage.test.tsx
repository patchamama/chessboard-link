import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const mockConfirmReset = vi.fn()

vi.mock('../../api/authApi', () => ({
  useConfirmPasswordReset: () => ({
    mutateAsync: mockConfirmReset,
    isPending: false,
  }),
}))

import ResetPasswordPage from '../ResetPasswordPage'

function renderWithToken(token = 'abc123') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/reset-password?token=${token}`]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ResetPasswordPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('renders password input and submit button on load', () => {
    renderWithToken()
    expect(screen.getByPlaceholderText(/new password/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /reset password/i })).toBeDefined()
  })

  it('on success shows success message and hides form', async () => {
    mockConfirmReset.mockResolvedValue({ message: 'Password has been reset successfully.' })
    renderWithToken()
    const input = screen.getByPlaceholderText(/new password/i)
    fireEvent.change(input, { target: { value: 'NewPass1!' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /reset password/i }))
    })
    expect(screen.queryByPlaceholderText(/new password/i)).toBeNull()
    expect(screen.getByText(/password has been reset/i)).toBeDefined()
  })

  it('on error (400) shows error message', async () => {
    mockConfirmReset.mockRejectedValue(new Error('Invalid or expired reset token.'))
    renderWithToken('badtoken')
    fireEvent.change(screen.getByPlaceholderText(/new password/i), { target: { value: 'AnyPass1!' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /reset password/i }))
    })
    expect(screen.getByText(/invalid or expired/i)).toBeDefined()
  })

  it('reads token from URL query param', async () => {
    mockConfirmReset.mockResolvedValue({ message: 'ok' })
    renderWithToken('myspecialtoken')
    fireEvent.change(screen.getByPlaceholderText(/new password/i), { target: { value: 'Pass1!' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /reset password/i }))
    })
    expect(mockConfirmReset).toHaveBeenCalledWith({ token: 'myspecialtoken', password: 'Pass1!' })
  })
})
