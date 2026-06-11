<?php

declare(strict_types=1);

namespace App\Application\Library;

final class UpdateBookCommand
{
    public function __construct(
        public readonly int $bookId,
        public readonly int $ownerId,
        public readonly string $title,
        public readonly string $author,
        public readonly string $description,
        public readonly bool $isAdmin = false,
    ) {
    }
}
