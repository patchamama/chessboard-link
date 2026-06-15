<?php

declare(strict_types=1);

namespace App\Domain\Trainer;

/**
 * SM-2 spaced-repetition scheduler (SuperMemo 2, Anki-flavoured).
 *
 * Maps the four self-grades to quality values and produces the next interval,
 * ease factor and due date. Pure: no clock, no storage — the caller passes
 * "now" so it is fully testable.
 */
final class Sm2Scheduler
{
    private const EASE_FLOOR = 1.3;

    public function review(SrsState $state, ReviewGrade $grade, \DateTimeImmutable $now): ScheduleResult
    {
        $quality = $this->quality($grade);

        // A failed recall (Again) resets the learning progress and counts a lapse.
        if ($grade === ReviewGrade::Again) {
            $ease  = max(self::EASE_FLOOR, $state->ease - 0.20);
            $next  = new SrsState(
                ease: $ease,
                intervalDays: 1,
                reps: 0,
                lapses: $state->lapses + 1,
            );
            return new ScheduleResult($next, $now->modify('+1 day'));
        }

        // Standard SM-2 ease update for a successful recall.
        $ease = $state->ease + (0.1 - (5 - $quality) * (0.08 + (5 - $quality) * 0.02));
        $ease = max(self::EASE_FLOOR, $ease);

        $reps     = $state->reps + 1;
        $interval = match (true) {
            $reps === 1 => 1,
            $reps === 2 => 6,
            default     => (int) round($state->intervalDays * $ease),
        };

        $next = new SrsState(
            ease: $ease,
            intervalDays: $interval,
            reps: $reps,
            lapses: $state->lapses,
        );

        return new ScheduleResult($next, $now->modify("+{$interval} day"));
    }

    /** Map a grade to an SM-2 quality value (0..5). */
    private function quality(ReviewGrade $grade): int
    {
        return match ($grade) {
            ReviewGrade::Again => 2,
            ReviewGrade::Hard  => 3,
            ReviewGrade::Good  => 4,
            ReviewGrade::Easy  => 5,
        };
    }
}
