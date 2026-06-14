import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockUpdateBook = vi.fn().mockResolvedValue({ id: 1, title: 'New T', author: 'New A', description: 'New D' })
const mockDeleteBook = vi.fn().mockResolvedValue({ ok: true })

vi.mock('../../api/libraryApi', () => ({
  useUpdateBook: () => ({ mutateAsync: mockUpdateBook, isPending: false }),
  useDeleteBook: () => ({ mutateAsync: mockDeleteBook, isPending: false }),
}))

import BookEditModal from '../BookEditModal'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const bookProps = { id: 1, title: 'Original Title', author: 'Original Author', description: 'Original desc' }

describe('BookEditModal', () => {
  beforeEach(() => vi.resetAllMocks())

  it('renders title, author, description textarea pre-filled', () => {
    render(<BookEditModal book={bookProps} onClose={vi.fn()} />, { wrapper })
    expect((screen.getByDisplayValue('Original Title') as HTMLInputElement).value).toBe('Original Title')
    expect((screen.getByDisplayValue('Original Author') as HTMLInputElement).value).toBe('Original Author')
    expect((screen.getByDisplayValue('Original desc') as HTMLTextAreaElement).value).toBe('Original desc')
  })

  it('on submit calls useUpdateBook and invalidates cache', async () => {
    const onClose = vi.fn()
    render(<BookEditModal book={bookProps} onClose={onClose} />, { wrapper })

    fireEvent.change(screen.getByDisplayValue('Original Title'), { target: { value: 'New T' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }))
    })

    expect(mockUpdateBook).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, title: 'New T' })
    )
  })

  it('requires a confirmation step before deleting', async () => {
    mockDeleteBook.mockResolvedValue({ ok: true })
    const onClose = vi.fn()
    render(<BookEditModal book={bookProps} onClose={onClose} />, { wrapper })

    // First click only reveals the confirmation, no delete yet.
    fireEvent.click(screen.getByRole('button', { name: /delete book/i }))
    expect(mockDeleteBook).not.toHaveBeenCalled()
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()

    // Confirm → deletes and closes.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }))
    })
    expect(mockDeleteBook).toHaveBeenCalledWith(1)
    expect(onClose).toHaveBeenCalled()
  })
})
