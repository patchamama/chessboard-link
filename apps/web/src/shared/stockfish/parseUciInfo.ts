/**
 * parseUciInfo: parse a single Stockfish UCI `info ... pv ...` line.
 *
 * Returns null for any line that is not an `info` line carrying a score
 * (progress lines like `info depth N currmove ...` have no score → ignored).
 *
 * The same parser is embedded (as a stringified copy) inside the Stockfish
 * worker wrapper; this module exists so the logic is unit-testable.
 */

export interface UciInfo {
  depth: number
  multipv: number
  scoreCp?: number
  mate?: number
  nodes?: number
  nps?: number
  /** elapsed time in milliseconds (UCI `time`) */
  time?: number
  /** principal variation as UCI move strings */
  pv: string[]
}

export function parseUciInfo(line: string): UciInfo | null {
  if (typeof line !== 'string') return null
  if (!line.startsWith('info') || !line.includes(' score ')) return null

  const depthM = line.match(/\bdepth\s+(\d+)/)
  if (!depthM) return null

  const cpM = line.match(/\bscore cp\s+(-?\d+)/)
  const mateM = line.match(/\bscore mate\s+(-?\d+)/)
  const pvM = line.match(/\bpv\s+(.+)/)
  const mpvM = line.match(/\bmultipv\s+(\d+)/)
  const nodesM = line.match(/\bnodes\s+(\d+)/)
  const npsM = line.match(/\bnps\s+(\d+)/)
  const timeM = line.match(/\btime\s+(\d+)/)

  const info: UciInfo = {
    depth: parseInt(depthM[1], 10),
    multipv: mpvM ? parseInt(mpvM[1], 10) : 1,
    pv: pvM ? pvM[1].trim().split(/\s+/) : [],
  }
  if (mateM) info.mate = parseInt(mateM[1], 10)
  if (cpM) info.scoreCp = parseInt(cpM[1], 10)
  if (nodesM) info.nodes = parseInt(nodesM[1], 10)
  if (npsM) info.nps = parseInt(npsM[1], 10)
  if (timeM) info.time = parseInt(timeM[1], 10)

  return info
}
