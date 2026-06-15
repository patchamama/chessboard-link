import { httpClient } from '../../../shared/api/httpClient'

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy'

export interface TrainerLine {
  id: number
  bookId: number | null
  name: string
  startFen: string
  movesUci: string[]
  orientation: 'white' | 'black'
  ease: number
  intervalDays: number
  reps: number
  lapses: number
  dueAt: string
  lastReviewedAt: string | null
  createdAt: string
}

export interface NewTrainerLine {
  name: string
  startFen: string
  movesUci: string[]
  orientation: 'white' | 'black'
  bookId?: number
}

export async function listTrainerLines(): Promise<TrainerLine[]> {
  return httpClient<TrainerLine[]>('/api/trainer/lines', { method: 'GET' })
}

export async function addTrainerLine(line: NewTrainerLine): Promise<TrainerLine> {
  return httpClient<TrainerLine>('/api/trainer/lines', {
    method: 'POST',
    body: JSON.stringify(line),
  })
}

export async function reviewTrainerLine(id: number, grade: ReviewGrade): Promise<TrainerLine> {
  return httpClient<TrainerLine>(`/api/trainer/lines/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ grade }),
  })
}

export async function deleteTrainerLine(id: number): Promise<void> {
  await httpClient(`/api/trainer/lines/${id}`, { method: 'DELETE' })
}
