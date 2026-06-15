/**
 * Per-book custom render configuration. Mirrors the backend JSON shape
 * (BookConfigController::defaults). Used by the reader to drive epub CSS and by
 * the admin editor to author it.
 */
export interface BookConfig {
  version: 1
  /** Treat <span class="hN"> like a real <hN> heading. */
  headingSpans: { h2: boolean; h3: boolean; h4: boolean; h5: boolean }
  /** A paragraph/span with this class renders like an <hr>. */
  barClass: { name: string; asHr: boolean }
  /** Lines beginning with a chess move/annotation get text-indent: 0. */
  moveLineIndent: { zeroIndent: boolean }
  /** Raw CSS appended (scoped to .epub-content) for one-off books. */
  extraCss: string
}

export const DEFAULT_BOOK_CONFIG: BookConfig = {
  version: 1,
  headingSpans: { h2: true, h3: true, h4: true, h5: true },
  barClass: { name: 'barra', asHr: true },
  moveLineIndent: { zeroIndent: true },
  extraCss: '',
}
