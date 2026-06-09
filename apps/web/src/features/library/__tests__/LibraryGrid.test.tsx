import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/libraryApi', () => ({
  useBooks: vi.fn(),
}))

import type { UseQueryResult } from '@tanstack/react-query'
import type { Book } from '../api/libraryApi'
import { useBooks } from '../api/libraryApi'
import LibraryGrid from '../components/LibraryGrid'

const mockUseBooks = vi.mocked(useBooks)

function makeQuery(overrides: Partial<UseQueryResult<Book[], Error>>): UseQueryResult<Book[], Error> {
  return {
    data: undefined,
    error: null,
    isError: false,
    isPending: false,
    isLoading: false,
    isLoadingError: false,
    isRefetchError: false,
    isSuccess: false,
    isFetching: false,
    isFetched: false,
    isFetchedAfterMount: false,
    isInitialLoading: false,
    isPlaceholderData: false,
    isRefetching: false,
    isStale: false,
    status: 'success',
    fetchStatus: 'idle',
    dataUpdatedAt: 0,
    errorUpdateCount: 0,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    refetch: vi.fn(),
    promise: Promise.resolve(undefined as unknown as Book[]),
    ...overrides,
  } as unknown as UseQueryResult<Book[], Error>
}

describe('LibraryGrid', () => {
  beforeEach(() => vi.resetAllMocks())

  it('shows loading spinner when fetching', () => {
    mockUseBooks.mockReturnValue(makeQuery({ isLoading: true, isPending: true, status: 'pending' }))
    render(<MemoryRouter><LibraryGrid /></MemoryRouter>)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows empty state when no books', () => {
    mockUseBooks.mockReturnValue(makeQuery({ isLoading: false, isSuccess: true, data: [] }))
    render(<MemoryRouter><LibraryGrid /></MemoryRouter>)
    expect(screen.getByText(/no books yet/i)).toBeInTheDocument()
  })

  it('renders BookCards from query data', () => {
    const books = [
      { id: 1, title: 'Chess Fundamentals', author: 'Capablanca', createdAt: '2024-01-01' },
      { id: 2, title: 'My System', author: 'Nimzowitsch', createdAt: '2024-01-02' },
    ]
    mockUseBooks.mockReturnValue(makeQuery({ isLoading: false, isSuccess: true, data: books }))
    render(<MemoryRouter><LibraryGrid /></MemoryRouter>)
    expect(screen.getByText('Chess Fundamentals')).toBeInTheDocument()
    expect(screen.getByText('My System')).toBeInTheDocument()
  })
})
