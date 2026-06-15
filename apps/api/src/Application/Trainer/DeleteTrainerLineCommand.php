<?php

declare(strict_types=1);

namespace App\Application\Trainer;

final class DeleteTrainerLineCommand
{
    public function __construct(
        public readonly int $lineId,
        public readonly int $userId,
    ) {
    }
}
