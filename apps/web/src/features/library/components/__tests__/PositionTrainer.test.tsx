import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../api/trainerApi', () => ({
  listTrainerLines: vi.fn(),
  reviewTrainerLine: vi.fn(),
  deleteTrainerLine: vi.fn(),
}))

// GuessTheMove is exercised separately; stub it here.
vi.mock('../GuessTheMove', () => ({
  GuessTheMove: () => <div data-testid="gtm">guessing</div>,
}))

import { PositionTrainer } from '../PositionTrainer'
import { listTrainerLines, reviewTrainerLine } from '../../api/trainerApi'
import { usePracticeStore } from '../../store/practiceStore'

const mockList = vi.mocked(listTrainerLines)
const mockReview = vi.mocked(reviewTrainerLine)

const LINE = {
  id: 1,
  bookId: null,
  name: 'Italian Game',
  startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  movesUci: ['e2e4', 'e7e5', 'g1f3'],
  orientation: 'white' as const,
  ease: 2.5,
  intervalDays: 0,
  reps: 0,
  lapses: 0,
  dueAt: '2026-06-15T12:00:00+00:00',
  lastReviewedAt: null,
  createdAt: '2026-06-15T12:00:00+00:00',
}

describe('PositionTrainer', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    usePracticeStore.getState().stop()
    mockList.mockResolvedValue([LINE])
    mockReview.mockResolvedValue({ ...LINE, reps: 1, intervalDays: 1 })
  })

  it('lists saved lines', async () => {
    render(<PositionTrainer />)
    expect(await screen.findByText('Italian Game')).toBeInTheDocument()
  })

  it('shows a due badge for lines that are due', async () => {
    render(<PositionTrainer />)
    expect(await screen.findByText(/^\d+ due$/i)).toBeInTheDocument()
  })

  it('starting a review launches the practice flow', async () => {
    render(<PositionTrainer />)
    await screen.findByText('Italian Game')

    await userEvent.click(screen.getByRole('button', { name: /review/i }))

    expect(usePracticeStore.getState().active).toBe(true)
    expect(screen.getByTestId('gtm')).toBeInTheDocument()
  })

  it('grading after a finished review calls the API and reschedules', async () => {
    render(<PositionTrainer />)
    await screen.findByText('Italian Game')
    await userEvent.click(screen.getByRole('button', { name: /review/i }))

    // Simulate the practice flow finishing.
    usePracticeStore.setState({ status: 'finished' })

    await userEvent.click(await screen.findByRole('button', { name: /good/i }))

    await waitFor(() => {
      expect(mockReview).toHaveBeenCalledWith(1, 'good')
    })
  })
})
