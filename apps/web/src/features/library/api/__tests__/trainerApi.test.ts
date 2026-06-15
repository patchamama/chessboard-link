import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../../shared/api/httpClient', () => ({
  httpClient: vi.fn(),
}))

import { listTrainerLines, addTrainerLine, reviewTrainerLine, deleteTrainerLine } from '../trainerApi'
import { httpClient } from '../../../../shared/api/httpClient'

const mockHttp = vi.mocked(httpClient)

describe('trainerApi', () => {
  beforeEach(() => vi.resetAllMocks())

  it('listTrainerLines GETs /api/trainer/lines', async () => {
    mockHttp.mockResolvedValue([])
    await listTrainerLines()
    expect(mockHttp).toHaveBeenCalledWith('/api/trainer/lines', { method: 'GET' })
  })

  it('addTrainerLine POSTs the line payload', async () => {
    mockHttp.mockResolvedValue({ id: 1 })
    await addTrainerLine({
      name: 'Italian',
      startFen: 'fen',
      movesUci: ['e2e4', 'e7e5'],
      orientation: 'white',
      bookId: 7,
    })
    expect(mockHttp).toHaveBeenCalledWith('/api/trainer/lines', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Italian',
        startFen: 'fen',
        movesUci: ['e2e4', 'e7e5'],
        orientation: 'white',
        bookId: 7,
      }),
    })
  })

  it('reviewTrainerLine POSTs the grade to the review endpoint', async () => {
    mockHttp.mockResolvedValue({ id: 1, reps: 1 })
    await reviewTrainerLine(1, 'good')
    expect(mockHttp).toHaveBeenCalledWith('/api/trainer/lines/1/review', {
      method: 'POST',
      body: JSON.stringify({ grade: 'good' }),
    })
  })

  it('deleteTrainerLine DELETEs the line', async () => {
    mockHttp.mockResolvedValue({ ok: true })
    await deleteTrainerLine(5)
    expect(mockHttp).toHaveBeenCalledWith('/api/trainer/lines/5', { method: 'DELETE' })
  })
})
