<?php

declare(strict_types=1);

namespace App\Application\Trainer;

final class AddTrainerLineCommand
{
    /**
     * @param string[] $movesUci
     */
    public function __construct(
        public readonly int $userId,
        public readonly ?int $bookId,
        public readonly string $name,
        public readonly string $startFen,
        public readonly array $movesUci,
        public readonly string $orientation,
    ) {
    }
}
