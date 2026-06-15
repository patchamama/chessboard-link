import { describe, it, expect } from 'vitest'
import { buildBookConfigCss } from '../bookConfigCss'
import { DEFAULT_BOOK_CONFIG } from '../../../../shared/bookConfig/bookConfig'
import type { EpubLayout } from '../../../../shared/settings/settingsStore'

const epub: EpubLayout = {
  h1: { bold: true, italic: false, sizeDelta: 10 },
  h2: { bold: true, italic: false, sizeDelta: 6 },
  h3: { bold: true, italic: false, sizeDelta: 3 },
  h4: { bold: true, italic: false, sizeDelta: 1 },
  h5: { bold: false, italic: true, sizeDelta: 0 },
  paragraphSpacing: 1,
  paragraphIndent: 1.5,
  imageAlign: 'center',
}

describe('buildBookConfigCss', () => {
  it('emits span.hN rules when heading spans are enabled', () => {
    const css = buildBookConfigCss(DEFAULT_BOOK_CONFIG, epub, 16)
    expect(css).toContain('.epub-content span.h3 {')
    expect(css).toContain('font-size: 19px') // 16 + h3 sizeDelta 3
  })

  it('omits a span.hN rule when that heading span is disabled', () => {
    const cfg = { ...DEFAULT_BOOK_CONFIG, headingSpans: { h2: false, h3: true, h4: false, h5: false } }
    const css = buildBookConfigCss(cfg, epub, 16)
    expect(css).not.toContain('span.h2 {')
    expect(css).toContain('span.h3 {')
  })

  it('emits an hr-like rule for the configured bar class', () => {
    const css = buildBookConfigCss(DEFAULT_BOOK_CONFIG, epub, 16)
    expect(css).toContain('.epub-content .barra {')
    expect(css).toContain('border-top: 1px solid')
  })

  it('honors a custom bar class name and sanitizes it', () => {
    const cfg = { ...DEFAULT_BOOK_CONFIG, barClass: { name: 'sep ; }evil', asHr: true } }
    const css = buildBookConfigCss(cfg, epub, 16)
    // Non-word chars stripped: "sep ; }evil" → "sepevil"
    expect(css).toContain('.epub-content .sepevil {')
    expect(css).not.toContain('; }evil')
  })

  it('emits the move-line indent rule when enabled', () => {
    const css = buildBookConfigCss(DEFAULT_BOOK_CONFIG, epub, 16)
    expect(css).toContain('.epub-content p.move-line { text-indent: 0; }')
  })

  it('appends raw extraCss last', () => {
    const cfg = { ...DEFAULT_BOOK_CONFIG, extraCss: '.epub-content p { color: navy; }' }
    const css = buildBookConfigCss(cfg, epub, 16)
    expect(css.trimEnd().endsWith('.epub-content p { color: navy; }')).toBe(true)
  })
})
