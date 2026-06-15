import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecognitionErrorPanel, type FlatError } from '../RecognitionErrorPanel'

const errors: FlatError[] = [
  { kind: 'missing-move', san: 'Nf3', rawSan: '♘f3', moveNumber: 6, color: 'white', message: 'Falta una jugada antes de 6. Nf3.', gameIndex: 0 },
  { kind: 'unreferenced', san: 'Rh4', moveNumber: 9, color: 'white', message: 'Jugada sin referencia válida.', gameIndex: 0 },
]

describe('RecognitionErrorPanel', () => {
  it('lists every error with its kind label and message', () => {
    render(<RecognitionErrorPanel errors={errors} onClose={vi.fn()} onNavigate={vi.fn()} />)
    expect(screen.getByText(/Errores de reconocimiento \(2\)/)).toBeInTheDocument()
    expect(screen.getByText('Jugada faltante')).toBeInTheDocument()
    expect(screen.getByText('Sin referencia')).toBeInTheDocument()
    expect(screen.getByText(/Falta una jugada antes de 6\. Nf3/)).toBeInTheDocument()
  })

  it('calls onNavigate with the clicked error', () => {
    const onNavigate = vi.fn()
    render(<RecognitionErrorPanel errors={errors} onClose={vi.fn()} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('Jugada faltante'))
    expect(onNavigate).toHaveBeenCalledWith(errors[0])
  })

  it('shows an empty state when there are no errors', () => {
    render(<RecognitionErrorPanel errors={[]} onClose={vi.fn()} onNavigate={vi.fn()} />)
    expect(screen.getByText(/No se detectaron errores/)).toBeInTheDocument()
  })
})
