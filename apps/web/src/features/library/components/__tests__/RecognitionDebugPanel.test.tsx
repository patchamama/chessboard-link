import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecognitionDebugPanel } from '../RecognitionDebugPanel'

describe('RecognitionDebugPanel', () => {
  it('shows the chapter games as clean PGN', () => {
    render(<RecognitionDebugPanel chapterText="1. e4 e5 2. Nf3 Nc6 3. Bb5 a6" />)
    expect(screen.getByText(/1\. e4 e5 2\. Nf3 Nc6 3\. Bb5 a6/)).toBeInTheDocument()
  })

  it('parses arbitrary test text and shows its lines', () => {
    render(<RecognitionDebugPanel chapterText="" />)
    const textarea = screen.getByPlaceholderText(/Pegá aquí un texto/)
    fireEvent.change(textarea, { target: { value: '1. d4 d5 2. c4 e6' } })
    expect(screen.getAllByText(/1\. d4 d5 2\. c4 e6/).length).toBeGreaterThan(0)
  })

  it('lets you switch recognition algorithm', () => {
    render(<RecognitionDebugPanel chapterText="1. e4 e5" />)
    const algo3 = screen.getByRole('button', { name: '3' })
    fireEvent.click(algo3)
    // Still renders the game under algorithm 3.
    expect(screen.getByText(/1\. e4 e5/)).toBeInTheDocument()
  })
})
