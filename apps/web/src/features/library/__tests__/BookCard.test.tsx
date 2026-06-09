import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BookCard from '../components/BookCard'

const book = { id: 7, title: 'Chess Openings', author: 'Fischer', createdAt: '2024-01-01' }

describe('BookCard', () => {
  it('shows title and author', () => {
    render(<MemoryRouter><BookCard book={book} /></MemoryRouter>)
    expect(screen.getByText('Chess Openings')).toBeInTheDocument()
    expect(screen.getByText('Fischer')).toBeInTheDocument()
  })

  it('link href points to /read/:id', () => {
    render(<MemoryRouter><BookCard book={book} /></MemoryRouter>)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/read/7')
  })
})
