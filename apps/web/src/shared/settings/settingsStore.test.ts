import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore } from './settingsStore'

describe('settingsStore — engine settings', () => {
  beforeEach(() => {
    useSettingsStore.getState().reset()
  })

  it('defaults: eval on, depth 30, 1 variation, arrow visible', () => {
    const s = useSettingsStore.getState()
    expect(s.showEval).toBe(true)
    expect(s.engineDepth).toBe(30)
    expect(s.engineVariations).toBe(1)
    expect(s.hideEngineArrow).toBe(false)
  })

  it('set patches engine fields independently', () => {
    useSettingsStore.getState().set({ showEval: true, engineDepth: 24 })
    const s = useSettingsStore.getState()
    expect(s.showEval).toBe(true)
    expect(s.engineDepth).toBe(24)
    // untouched fields keep their defaults
    expect(s.engineVariations).toBe(1)
    expect(s.hideEngineArrow).toBe(false)
  })

  it('reset restores engine defaults', () => {
    useSettingsStore.getState().set({
      showEval: true,
      engineDepth: 30,
      engineVariations: 3,
      hideEngineArrow: true,
    })
    useSettingsStore.getState().reset()
    const s = useSettingsStore.getState()
    expect(s.showEval).toBe(true)
    expect(s.engineDepth).toBe(30)
    expect(s.engineVariations).toBe(1)
    expect(s.hideEngineArrow).toBe(false)
  })
})
