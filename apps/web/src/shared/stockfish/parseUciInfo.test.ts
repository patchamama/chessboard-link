import { describe, it, expect } from 'vitest'
import { parseUciInfo } from './parseUciInfo'

describe('parseUciInfo', () => {
  it('returns null for non-info lines', () => {
    expect(parseUciInfo('uciok')).toBeNull()
    expect(parseUciInfo('bestmove e2e4')).toBeNull()
    // info without a score (e.g. currmove progress) is ignored
    expect(parseUciInfo('info depth 5 currmove e2e4 currmovenumber 1')).toBeNull()
  })

  it('parses a cp-score info line with nodes/nps/time/pv', () => {
    const line =
      'info depth 19 seldepth 28 multipv 1 score cp 1211 nodes 57289 nps 526000 time 109 pv e1e2 a7a1'
    const info = parseUciInfo(line)
    expect(info).not.toBeNull()
    expect(info!.depth).toBe(19)
    expect(info!.multipv).toBe(1)
    expect(info!.scoreCp).toBe(1211)
    expect(info!.mate).toBeUndefined()
    expect(info!.nodes).toBe(57289)
    expect(info!.nps).toBe(526000)
    expect(info!.time).toBe(109)
    expect(info!.pv).toEqual(['e1e2', 'a7a1'])
  })

  it('parses a mate-score info line', () => {
    const line = 'info depth 22 multipv 1 score mate 13 nodes 100 nps 1000 time 0 pv d1d8'
    const info = parseUciInfo(line)
    expect(info!.mate).toBe(13)
    expect(info!.scoreCp).toBeUndefined()
    expect(info!.depth).toBe(22)
  })

  it('defaults multipv to 1 when absent', () => {
    const line = 'info depth 10 score cp 30 nodes 5 nps 5 time 0 pv e2e4'
    expect(parseUciInfo(line)!.multipv).toBe(1)
  })
})
