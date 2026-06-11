import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockApprove = vi.fn().mockResolvedValue({})

vi.mock('../../api/adminApi', () => ({
  useBlockedUsers: () => ({
    data: [
      { id: 2, email: 'bob@test.com', name: 'bob@test.com', registration_status: 'rejected' },
    ],
    isLoading: false,
  }),
  useApproveUser: () => ({ mutateAsync: mockApprove, isPending: false }),
}))

import BlockedUsersTable from '../BlockedUsersTable'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('BlockedUsersTable', () => {
  it('renders email, name, and Approve button', () => {
    render(<BlockedUsersTable />, { wrapper })
    const cells = screen.getAllByText('bob@test.com')
    expect(cells.length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /approve/i })).toBeDefined()
  })

  it('clicking Approve calls approve mutation', async () => {
    render(<BlockedUsersTable />, { wrapper })
    await userEvent.click(screen.getByRole('button', { name: /approve/i }))
    expect(mockApprove).toHaveBeenCalledWith(2)
  })
})
