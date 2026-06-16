import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecognitionDebugPanel } from '../RecognitionDebugPanel'

describe('RecognitionDebugPanel', () => {
  it('shows the chapter games as clean lines with a variation count', () => {
    render(<RecognitionDebugPanel chapterText="1. e4 e5 2. Nf3 Nc6 3. Bb5 a6" />)
    expect(screen.getByText(/Game 1/)).toBeInTheDocument()
    expect(screen.getByText(/variation\(s\)/)).toBeInTheDocument()
  })

  it('parses arbitrary test text and shows its lines', () => {
    render(<RecognitionDebugPanel chapterText="" />)
    const textarea = screen.getByPlaceholderText(/Paste a text with moves/)
    fireEvent.change(textarea, { target: { value: '1. d4 d5 2. c4 e6' } })
    expect(screen.getAllByText(/Game 1/).length).toBeGreaterThan(0)
  })

  it('loads the current chapter text into the test box', () => {
    render(<RecognitionDebugPanel chapterText="1. e4 c5 2. Nf3 d6" />)
    fireEvent.click(screen.getByText('Load current chapter'))
    const textarea = screen.getByPlaceholderText(/Paste a text with moves/) as HTMLTextAreaElement
    expect(textarea.value).toBe('1. e4 c5 2. Nf3 d6')
  })

  it('switches recognition algorithm and exposes a hint', () => {
    render(<RecognitionDebugPanel chapterText="1. e4 e5" />)
    const algo1 = screen.getByRole('button', { name: '1' })
    expect(algo1).toHaveAttribute('title', expect.stringContaining('Mainline only'))
    fireEvent.click(algo1)
    expect(screen.getByText(/Game 1/)).toBeInTheDocument()
  })
})
