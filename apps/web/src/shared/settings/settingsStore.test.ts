import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore, mergeWithDefaults } from './settingsStore'

describe('settingsStore — persistence migration', () => {
  it('fills missing new keys from defaults (old persisted state lacks showEngineArrow)', () => {
    const current = useSettingsStore.getState()
    // Simulate state persisted before showEngineArrow existed (had hideEngineArrow).
    const oldPersisted = { showEval: true, engineDepth: 22, hideEngineArrow: true }
    const merged = mergeWithDefaults(current, oldPersisted)
    // Missing new key takes its default (ON) — not undefined.
    expect(merged.showEngineArrow).toBe(true)
    // Persisted values still win for keys they define.
    expect(merged.engineDepth).toBe(22)
  })

  it('persisted values override defaults for known keys', () => {
    const current = useSettingsStore.getState()
    const merged = mergeWithDefaults(current, { showEngineArrow: false, fontSize: 20 })
    expect(merged.showEngineArrow).toBe(false)
    expect(merged.fontSize).toBe(20)
  })
})

describe('settingsStore — engine settings', () => {
  beforeEach(() => {
    useSettingsStore.getState().reset()
  })

  it('defaults: eval on, depth 30, 1 variation, arrow visible', () => {
    const s = useSettingsStore.getState()
    expect(s.showEval).toBe(true)
    expect(s.engineDepth).toBe(30)
    expect(s.engineVariations).toBe(1)
    expect(s.showEngineArrow).toBe(true)
  })

  it('set patches engine fields independently', () => {
    useSettingsStore.getState().set({ showEval: true, engineDepth: 24 })
    const s = useSettingsStore.getState()
    expect(s.showEval).toBe(true)
    expect(s.engineDepth).toBe(24)
    // untouched fields keep their defaults
    expect(s.engineVariations).toBe(1)
    expect(s.showEngineArrow).toBe(true)
  })

  it('reset restores engine defaults', () => {
    useSettingsStore.getState().set({
      showEval: true,
      engineDepth: 30,
      engineVariations: 3,
      showEngineArrow: false,
    })
    useSettingsStore.getState().reset()
    const s = useSettingsStore.getState()
    expect(s.showEval).toBe(true)
    expect(s.engineDepth).toBe(30)
    expect(s.engineVariations).toBe(1)
    expect(s.showEngineArrow).toBe(true)
  })
})

describe('settingsStore — appearance & behavior settings', () => {
  beforeEach(() => {
    useSettingsStore.getState().reset()
  })

  it('defaults: light app theme, default piece theme, panel 320px, labels/highlight/sound on', () => {
    const s = useSettingsStore.getState()
    expect(s.appTheme).toBe('light')
    expect(s.pieceTheme).toBe('default')
    expect(s.studyPanelWidth).toBe(320)
    expect(s.showBoardLabels).toBe(true)
    expect(s.fullSquareHighlight).toBe(true)
    expect(s.playMoveSound).toBe(true)
    expect(s.autoplayDelay).toBe(1)
  })

  it('applyAppTheme("dark") sets dark bg/text presets', () => {
    useSettingsStore.getState().applyAppTheme('dark')
    const s = useSettingsStore.getState()
    expect(s.appTheme).toBe('dark')
    expect(s.bgColor).toBe('#1a1a1a')
    expect(s.textColor).toBe('#e8e8e8')
  })

  it('applyAppTheme("light") restores light bg/text presets', () => {
    useSettingsStore.getState().applyAppTheme('dark')
    useSettingsStore.getState().applyAppTheme('light')
    const s = useSettingsStore.getState()
    expect(s.appTheme).toBe('light')
    expect(s.bgColor).toBe('#ffffff')
    expect(s.textColor).toBe('#1a1a1a')
  })

  it('set patches appearance fields independently', () => {
    useSettingsStore.getState().set({ pieceTheme: 'alpha', studyPanelWidth: 480 })
    const s = useSettingsStore.getState()
    expect(s.pieceTheme).toBe('alpha')
    expect(s.studyPanelWidth).toBe(480)
    expect(s.showBoardLabels).toBe(true)
  })

  it('toggles behave as plain booleans', () => {
    useSettingsStore.getState().set({ showBoardLabels: false, playMoveSound: false })
    const s = useSettingsStore.getState()
    expect(s.showBoardLabels).toBe(false)
    expect(s.playMoveSound).toBe(false)
    expect(s.fullSquareHighlight).toBe(true)
  })

  it('reset restores appearance defaults', () => {
    useSettingsStore.getState().set({
      appTheme: 'dark',
      pieceTheme: 'merida',
      studyPanelWidth: 600,
      showBoardLabels: false,
      fullSquareHighlight: false,
      playMoveSound: false,
      autoplayDelay: 5,
    })
    useSettingsStore.getState().reset()
    const s = useSettingsStore.getState()
    expect(s.appTheme).toBe('light')
    expect(s.pieceTheme).toBe('default')
    expect(s.studyPanelWidth).toBe(320)
    expect(s.showBoardLabels).toBe(true)
    expect(s.fullSquareHighlight).toBe(true)
    expect(s.playMoveSound).toBe(true)
    expect(s.autoplayDelay).toBe(1)
  })
})
