import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('../api/libraryApi', () => ({
  useBooks: vi.fn(),
  useUploadBook: vi.fn(),
}))

import { useUploadBook } from '../api/libraryApi'
import UploadBookForm from '../components/UploadBookForm'

const mockUseUploadBook = vi.mocked(useUploadBook)

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

describe('UploadBookForm', () => {
  const mutateAsync = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    mockUseUploadBook.mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as any)
  })

  it('renders file tab and url tab', () => {
    render(<UploadBookForm />, { wrapper })
    expect(screen.getByRole('tab', { name: /epub file/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /url/i })).toBeInTheDocument()
  })

  it('file tab shows file input by default', () => {
    render(<UploadBookForm />, { wrapper })
    expect(screen.getByLabelText(/epub file/i)).toBeInTheDocument()
  })

  it('url tab shows url input when selected', async () => {
    render(<UploadBookForm />, { wrapper })
    await userEvent.click(screen.getByRole('tab', { name: /url/i }))
    expect(screen.getByLabelText(/url/i)).toBeInTheDocument()
  })

  it('submitting file calls mutateAsync with file', async () => {
    mutateAsync.mockResolvedValue({ bookId: 1, status: 'ready' })
    render(<UploadBookForm />, { wrapper })

    const file = new File(['epub content'], 'test.epub', { type: 'application/epub+zip' })
    const input = screen.getByLabelText(/epub file/i)
    await userEvent.upload(input, file)

    const submitBtn = screen.getByRole('button', { name: /upload/i })
    await userEvent.click(submitBtn)

    expect(mutateAsync).toHaveBeenCalledWith({ file })
  })

  it('submitting url calls mutateAsync with url string', async () => {
    mutateAsync.mockResolvedValue({ bookId: 2, status: 'ready' })
    render(<UploadBookForm />, { wrapper })

    await userEvent.click(screen.getByRole('tab', { name: /url/i }))
    const urlInput = screen.getByLabelText(/url/i)
    await userEvent.type(urlInput, 'https://example.com/chess')

    const submitBtn = screen.getByRole('button', { name: /upload/i })
    await userEvent.click(submitBtn)

    expect(mutateAsync).toHaveBeenCalledWith({ url: 'https://example.com/chess' })
  })

  it('shows uploading state while pending', () => {
    mockUseUploadBook.mockReturnValue({
      mutateAsync,
      isPending: true,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as any)

    render(<UploadBookForm />, { wrapper })
    expect(screen.getByRole('button', { name: /uploading/i })).toBeDisabled()
  })

  it('shows error message on failure', () => {
    mockUseUploadBook.mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: true,
      error: new Error('EPUB processing failed'),
      reset: vi.fn(),
    } as any)

    render(<UploadBookForm />, { wrapper })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/EPUB processing failed/i)).toBeInTheDocument()
  })
})
