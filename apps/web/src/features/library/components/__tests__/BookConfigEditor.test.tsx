import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { BookConfigEditor } from '../BookConfigEditor'
import { DEFAULT_BOOK_CONFIG } from '../../../../shared/bookConfig/bookConfig'
import * as api from '../../../../shared/bookConfig/bookConfigApi'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

describe('BookConfigEditor', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'getBookConfig').mockResolvedValue(DEFAULT_BOOK_CONFIG)
  })

  it('renders the heading-span, divider, move-line and extraCss controls', async () => {
    render(<BookConfigEditor bookId={1} onClose={vi.fn()} />, { wrapper })
    expect(await screen.findByLabelText('Divider class name')).toBeInTheDocument()
    expect(screen.getByLabelText('Extra CSS')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save config/i })).toBeInTheDocument()
  })

  it('saves the edited draft via the API', async () => {
    const saveSpy = vi
      .spyOn(api, 'saveBookConfig')
      .mockResolvedValue({ ok: true, config: DEFAULT_BOOK_CONFIG })

    render(<BookConfigEditor bookId={5} onClose={vi.fn()} />, { wrapper })
    const cls = await screen.findByLabelText('Divider class name')
    fireEvent.change(cls, { target: { value: 'separador' } })
    fireEvent.click(screen.getByRole('button', { name: /save config/i }))

    await waitFor(() => expect(saveSpy).toHaveBeenCalled())
    const [bookId, cfg] = saveSpy.mock.calls[0]
    expect(bookId).toBe(5)
    expect(cfg.barClass.name).toBe('separador')
  })
})
