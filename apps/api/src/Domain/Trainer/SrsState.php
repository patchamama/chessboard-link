<?php

declare(strict_types=1);

namespace App\Domain\Trainer;

/**
 * Immutable spaced-repetition state for a single trainer line (SM-2 variables).
 */
final class SrsState
{
    public function __construct(
        public readonly float $ease,
        public readonly int $intervalDays,
        public readonly int $reps,
        public readonly int $lapses,
    ) {
    }
}
