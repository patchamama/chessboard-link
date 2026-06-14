import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BookCard from '../components/BookCard'

const book = { id: 7, title: 'Chess Openings', author: 'Fischer', createdAt: '2024-01-01', description: '' }

describe('BookCard', () => {
  it('shows title and author', () => {
    render(<MemoryRouter><BookCard book={book} /></MemoryRouter>)
    expect(screen.getByText('Chess Openings')).toBeInTheDocument()
    expect(screen.getByText('Fischer')).toBeInTheDocument()
  })

  it('read link points to /read/:id', () => {
    render(<MemoryRouter><BookCard book={book} /></MemoryRouter>)
    const link = screen.getByRole('link', { name: /read/i })
    expect(link).toHaveAttribute('href', '/read/7')
  })

  it('renders the cover image from the cover endpoint', () => {
    render(<MemoryRouter><BookCard book={book} /></MemoryRouter>)
    const img = screen.getByRole('img', { name: /cover of chess openings/i })
    expect(img).toHaveAttribute('src', '/api/library/books/7/cover')
  })

  it('hides the cover when the image fails to load', () => {
    render(<MemoryRouter><BookCard book={book} /></MemoryRouter>)
    const img = screen.getByRole('img', { name: /cover of/i })
    fireEvent.error(img)
    expect(screen.queryByRole('img', { name: /cover of/i })).not.toBeInTheDocument()
  })
})
