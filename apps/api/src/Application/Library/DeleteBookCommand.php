<?php

declare(strict_types=1);

namespace App\Application\Library;

final class DeleteBookCommand
{
    public function __construct(
        public readonly int $bookId,
        public readonly int $ownerId,
        public readonly bool $isAdmin = false,
    ) {
    }
}
