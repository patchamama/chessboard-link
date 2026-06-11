import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock the table subcomponents so we can verify they appear
vi.mock('../ActiveUsersTable', () => ({
  default: () => <div data-testid="active-users-table">ActiveUsersTable</div>,
}))
vi.mock('../BlockedUsersTable', () => ({
  default: () => <div data-testid="blocked-users-table">BlockedUsersTable</div>,
}))
vi.mock('../PendingUsersTable', () => ({
  default: () => <div data-testid="pending-users-table">PendingUsersTable</div>,
}))

import AdminPage from '../AdminPage'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('AdminPage', () => {
  it('renders three tabs: Pending, Active, Blocked', () => {
    render(<AdminPage />, { wrapper })
    expect(screen.getByRole('button', { name: /pending/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /active/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /blocked/i })).toBeDefined()
  })

  it('clicking Active tab shows ActiveUsersTable', async () => {
    render(<AdminPage />, { wrapper })
    const activeTab = screen.getByRole('button', { name: /active/i })
    await userEvent.click(activeTab)
    expect(screen.getByTestId('active-users-table')).toBeDefined()
  })

  it('clicking Blocked tab shows BlockedUsersTable', async () => {
    render(<AdminPage />, { wrapper })
    const blockedTab = screen.getByRole('button', { name: /blocked/i })
    await userEvent.click(blockedTab)
    expect(screen.getByTestId('blocked-users-table')).toBeDefined()
  })
})
