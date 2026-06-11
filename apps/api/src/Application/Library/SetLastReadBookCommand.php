<?php

declare(strict_types=1);

namespace App\Application\Library;

final class SetLastReadBookCommand
{
    public function __construct(
        public readonly int $userId,
        public readonly int $bookId,
    ) {
    }
}
