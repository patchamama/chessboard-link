<?php

declare(strict_types=1);

namespace App\Domain\Trainer;

/**
 * Self-assessment of a spaced-repetition review, in Anki-style buckets.
 * Mapped to SM-2 quality values internally by the scheduler.
 */
enum ReviewGrade: string
{
    case Again = 'again';
    case Hard  = 'hard';
    case Good  = 'good';
    case Easy  = 'easy';

    public static function fromString(string $value): self
    {
        return self::from(strtolower(trim($value)));
    }
}
