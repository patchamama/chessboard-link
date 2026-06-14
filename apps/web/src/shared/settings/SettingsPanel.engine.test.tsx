import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingsPanel from './SettingsPanel'
import { useSettingsStore } from './settingsStore'

describe('SettingsPanel — Engine section', () => {
  beforeEach(() => {
    useSettingsStore.getState().reset()
  })

  it('toggles Show evaluation', () => {
    render(<SettingsPanel onClose={vi.fn()} />)
    expect(useSettingsStore.getState().showEval).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /show evaluation/i }))
    expect(useSettingsStore.getState().showEval).toBe(false)
  })

  it('increments and decrements engine depth within bounds', () => {
    render(<SettingsPanel onClose={vi.fn()} />)
    expect(useSettingsStore.getState().engineDepth).toBe(30)
    fireEvent.click(screen.getByRole('button', { name: 'Increase depth' }))
    expect(useSettingsStore.getState().engineDepth).toBe(31)
    fireEvent.click(screen.getByRole('button', { name: 'Decrease depth' }))
    expect(useSettingsStore.getState().engineDepth).toBe(30)
  })

  it('clamps variations between 1 and 3', () => {
    render(<SettingsPanel onClose={vi.fn()} />)
    const inc = screen.getByRole('button', { name: 'Increase variations' })
    const dec = screen.getByRole('button', { name: 'Decrease variations' })
    expect(useSettingsStore.getState().engineVariations).toBe(1)
    fireEvent.click(dec) // already at min
    expect(useSettingsStore.getState().engineVariations).toBe(1)
    fireEvent.click(inc)
    fireEvent.click(inc)
    fireEvent.click(inc) // would be 4, clamps at 3
    expect(useSettingsStore.getState().engineVariations).toBe(3)
  })

  it('toggles Hide engine move arrow', () => {
    render(<SettingsPanel onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /hide engine move arrow/i }))
    expect(useSettingsStore.getState().hideEngineArrow).toBe(true)
  })
})
