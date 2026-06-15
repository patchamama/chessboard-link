<?php

declare(strict_types=1);

namespace App\Application\Trainer;

use App\Domain\Trainer\ReviewGrade;

final class ReviewTrainerLineCommand
{
    public function __construct(
        public readonly int $lineId,
        public readonly int $userId,
        public readonly ReviewGrade $grade,
    ) {
    }
}
