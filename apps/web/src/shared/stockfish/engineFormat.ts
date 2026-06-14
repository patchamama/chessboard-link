import { Chess, type Square } from 'chess.js'

/**
 * Formatting helpers for the engine evaluation panel. All pure / unit-tested.
 *
 * Output mirrors the requested line shape, e.g.:
 *   (12.11) 1... ♚e1 2. ♛a7 ♚f1 … d=19 n=57289 nps=526K time:0s
 */

export interface ScoreLike {
  scoreCp?: number
  mate?: number
}

/** "(12.11)" for a cp score, "(#13)" for mate, "(?)" when unknown. */
export function formatScore(s: ScoreLike): string {
  if (s.mate !== undefined) return `(#${s.mate})`
  if (s.scoreCp !== undefined) {
    const p = s.scoreCp / 100
    return `(${p.toFixed(2)})`
  }
  return '(?)'
}

/** Abbreviate nodes-per-second: 526000 → "526K", 1.5e6 → "1.5M". */
export function formatNps(nps: number): string {
  if (nps >= 1_000_000) {
    const m = nps / 1_000_000
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`
  }
  if (nps >= 1000) {
    return `${Math.round(nps / 1000)}K`
  }
  return String(nps)
}

/** Raw node count, no abbreviation (matches n=57289 in the spec). */
export function formatNodes(nodes: number): string {
  return String(nodes)
}

/** UCI `time` is in milliseconds; render as whole seconds ("0s", "12s"). */
export function formatTime(ms: number): string {
  return `${Math.floor(ms / 1000)}s`
}

// Black figurine glyphs (lichess convention: both colours rendered with the
// black silhouette inside running PV text).
const PIECE_GLYPH: Record<string, string> = {
  K: '♚',
  Q: '♛',
  R: '♜',
  B: '♝',
  N: '♞',
}

/** Replace the leading piece letter of a SAN move with its figurine glyph. */
export function sanToFigurine(san: string): string {
  const first = san[0]
  const glyph = PIECE_GLYPH[first]
  return glyph ? glyph + san.slice(1) : san
}

export interface PvSegment {
  label: string
  pvIndex: number
}

/**
 * Convert a UCI principal variation into numbered, figurine-rendered segments.
 * The move number / ellipsis is derived from the position's FEN so a PV that
 * starts with black is labelled "N... ..." correctly.
 */
export function pvToFigurineSegments(fen: string, pv: string[]): PvSegment[] {
  try {
    const chess = new Chess(fen)
    const parts = fen.split(' ')
    let moveNum = parseInt(parts[5] ?? '1', 10)
    let isWhiteTurn = (parts[1] ?? 'w') === 'w'
    const out: PvSegment[] = []

    for (let i = 0; i < pv.length; i++) {
      const uci = pv[i]
      const from = uci.slice(0, 2) as Square
      const to = uci.slice(2, 4) as Square
      const promo = uci[4] as 'q' | 'r' | 'b' | 'n' | undefined
      const move = chess.move({ from, to, promotion: promo ?? 'q' })
      if (!move) break

      const san = sanToFigurine(move.san)
      let label: string
      if (isWhiteTurn) {
        label = `${moveNum}. ${san}`
      } else {
        label = i === 0 ? `${moveNum}... ${san}` : san
        moveNum++
      }
      out.push({ label, pvIndex: i })
      isWhiteTurn = !isWhiteTurn
    }
    return out
  } catch {
    return pv.map((uci, i) => ({ label: uci, pvIndex: i }))
  }
}
