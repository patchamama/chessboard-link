import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AppLayout from '../AppLayout'
import { APP_VERSION } from '../../version'
import { useAuthStore } from '../../features/auth/store/authStore'
import { isLocalhostHost } from '../../shared/env/devMode'

vi.mock('../../shared/env/devMode', () => ({
  isLocalhostHost: vi.fn(() => false),
}))

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/library']}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/library" element={<div>Page Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppLayout', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null })
    vi.mocked(isLocalhostHost).mockReturnValue(false)
  })

  it('renders the banner with the app version', () => {
    renderLayout()
    expect(screen.getByTestId('banner')).toBeInTheDocument()
    expect(screen.getByText(`v${APP_VERSION}`)).toBeInTheDocument()
  })

  it('renders the routed page content via Outlet', () => {
    renderLayout()
    expect(screen.getByText('Page Content')).toBeInTheDocument()
  })

  it('shows dev mode badge and Admin link on localhost without session', () => {
    vi.mocked(isLocalhostHost).mockReturnValue(true)
    renderLayout()
    expect(screen.getByText('dev mode')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument()
  })

  it('hides Admin link for non-admin logged-in user', () => {
    useAuthStore.setState({
      token: 'tok',
      user: { email: 'a@b.com', role: 'user', status: 'approved' },
    })
    renderLayout()
    expect(
      screen.queryByRole('link', { name: 'Admin' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument()
  })
})
