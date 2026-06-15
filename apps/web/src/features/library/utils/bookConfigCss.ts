import type { BookConfig } from '../../../shared/bookConfig/bookConfig'
import type { EpubLayout } from '../../../shared/settings/settingsStore'

/**
 * Build the EXTRA epub CSS derived from a book's custom config:
 *  - span.hN inherits the matching heading style (font-weight/style/size),
 *  - the configured "bar" class renders like an <hr>,
 *  - move lines get text-indent: 0,
 *  - any raw extraCss is appended last (author-scoped).
 *
 * `headingDecl(tag)` returns the font declarations already computed for the
 * real <hN> so span.hN matches exactly.
 */
export function buildBookConfigCss(
  config: BookConfig,
  epub: EpubLayout,
  fontSize: number,
): string {
  const lines: string[] = []

  const headingDecl = (tag: 'h2' | 'h3' | 'h4' | 'h5') => {
    const h = epub[tag]
    return `font-weight: ${h.bold ? '700' : '400'}; font-style: ${h.italic ? 'italic' : 'normal'}; font-size: ${fontSize + h.sizeDelta}px; display: block; margin: 0.8em 0 0.3em;`
  }

  for (const tag of ['h2', 'h3', 'h4', 'h5'] as const) {
    if (config.headingSpans[tag]) {
      lines.push(`.epub-content span.${tag} { ${headingDecl(tag)} }`)
    }
  }

  if (config.barClass.asHr && config.barClass.name) {
    // Escape the class name for use in a selector (allow only word chars/-).
    const cls = config.barClass.name.replace(/[^\w-]/g, '')
    if (cls) {
      lines.push(
        `.epub-content .${cls} { display: block; border: none; border-top: 1px solid #cbd5e1; margin: 1.5em 0; height: 0; font-size: 0; color: transparent; text-indent: 0; }`,
      )
    }
  }

  if (config.moveLineIndent.zeroIndent) {
    lines.push(`.epub-content p.move-line { text-indent: 0; }`)
  }

  if (config.extraCss.trim()) {
    lines.push(config.extraCss)
  }

  return lines.join('\n')
}
