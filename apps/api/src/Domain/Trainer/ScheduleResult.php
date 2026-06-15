<?php

declare(strict_types=1);

namespace App\Domain\Trainer;

/**
 * Outcome of scheduling a review: the new SRS state plus the next due date.
 */
final class ScheduleResult
{
    public function __construct(
        public readonly SrsState $state,
        public readonly \DateTimeImmutable $dueAt,
    ) {
    }
}
