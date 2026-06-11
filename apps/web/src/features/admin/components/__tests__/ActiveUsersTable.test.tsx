import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../../api/adminApi', () => ({
  useActiveUsers: () => ({
    data: [
      {
        id: 1,
        email: 'alice@test.com',
        name: 'alice@test.com',
        registration_status: 'approved',
        login_count: 7,
        last_read_book_id: 3,
        last_read_book_title: 'Chess Tactics',
        book_count: 2,
        storage_bytes: 204800,
      },
    ],
    isLoading: false,
  }),
  useRejectUser: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetUserPassword: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSendResetLink: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUserBooks: () => ({ data: [{ id: 1, title: 'Chess Tactics', author: 'Author' }], isLoading: false }),
}))

vi.mock('../UserBooksList', () => ({
  default: ({ userId }: { userId: number }) => <div data-testid={`user-books-${userId}`}>Books</div>,
}))

vi.mock('../PasswordModal', () => ({
  default: ({ userId, onClose }: { userId: number; onClose: () => void }) => (
    <div data-testid={`password-modal-${userId}`}>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

import ActiveUsersTable from '../ActiveUsersTable'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('ActiveUsersTable', () => {
  it('renders email, loginCount, lastReadTitle, bookCount, storage, and action buttons', () => {
    render(<ActiveUsersTable />, { wrapper })
    expect(screen.getByText('alice@test.com')).toBeDefined()
    expect(screen.getByText('7')).toBeDefined() // login count
    expect(screen.getByText('Chess Tactics')).toBeDefined() // last read title
    expect(screen.getByText('2')).toBeDefined() // book count clickable
    expect(screen.getByText(/200 KB/i)).toBeDefined() // storage formatted
    expect(screen.getByRole('button', { name: /reject/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /set password/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /send reset/i })).toBeDefined()
  })

  it('clicking book count expands UserBooksList', () => {
    render(<ActiveUsersTable />, { wrapper })
    const bookCountCell = screen.getByText('2')
    fireEvent.click(bookCountCell)
    expect(screen.getByTestId('user-books-1')).toBeDefined()
  })

  it('clicking Set Password opens PasswordModal', () => {
    render(<ActiveUsersTable />, { wrapper })
    const setPasswordBtn = screen.getByRole('button', { name: /set password/i })
    fireEvent.click(setPasswordBtn)
    expect(screen.getByTestId('password-modal-1')).toBeDefined()
  })
})
