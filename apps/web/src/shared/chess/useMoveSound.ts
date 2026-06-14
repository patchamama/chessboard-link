import { useCallback, useRef } from 'react'
import { useSettingsStore } from '../settings/settingsStore'

/**
 * Returns a `play()` callback that emits a short click via the Web Audio API
 * when the `playMoveSound` setting is enabled. The AudioContext is created
 * lazily (and reused) on first play to respect browser autoplay policies.
 */
export function useMoveSound(): () => void {
  const playMoveSound = useSettingsStore((s) => s.playMoveSound)
  const ctxRef = useRef<AudioContext | null>(null)

  return useCallback(() => {
    if (!playMoveSound) return
    const AC = (globalThis as typeof globalThis & {
      AudioContext?: typeof AudioContext
      webkitAudioContext?: typeof AudioContext
    }).AudioContext ??
      (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return

    if (!ctxRef.current) ctxRef.current = new AC()
    const ctx = ctxRef.current
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 440
    gain.gain.setValueAtTime(0.18, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.13)
  }, [playMoveSound])
}
