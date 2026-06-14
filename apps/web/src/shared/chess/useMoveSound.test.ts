import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMoveSound } from './useMoveSound'
import { useSettingsStore } from '../settings/settingsStore'

describe('useMoveSound', () => {
  beforeEach(() => {
    useSettingsStore.getState().reset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a play() function', () => {
    const { result } = renderHook(() => useMoveSound())
    expect(typeof result.current).toBe('function')
  })

  it('does nothing when playMoveSound is OFF', () => {
    useSettingsStore.getState().set({ playMoveSound: false })
    const ctor = vi.fn()
    globalThis.AudioContext = ctor as unknown as typeof AudioContext
    const { result } = renderHook(() => useMoveSound())
    result.current()
    expect(ctor).not.toHaveBeenCalled()
  })

  it('creates an oscillator when playMoveSound is ON', () => {
    useSettingsStore.getState().set({ playMoveSound: true })
    const start = vi.fn()
    const stop = vi.fn()
    const connect = vi.fn()
    const osc = { connect, start, stop, frequency: { value: 0 }, type: '' }
    const gain = { connect, gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } }
    const ctx = {
      createOscillator: vi.fn(() => osc),
      createGain: vi.fn(() => gain),
      currentTime: 0,
      destination: {},
    }
    globalThis.AudioContext = vi.fn(() => ctx) as unknown as typeof AudioContext
    const { result } = renderHook(() => useMoveSound())
    result.current()
    expect(ctx.createOscillator).toHaveBeenCalled()
    expect(start).toHaveBeenCalled()
  })
})
