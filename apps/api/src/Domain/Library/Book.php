<?php

declare(strict_types=1);

namespace App\Domain\Library;

final class Book
{
    public function __construct(
        public readonly int        $id,
        public readonly int        $ownerId,
        public readonly string     $title,
        public readonly string     $author,
        public readonly BookStatus $status,
        public readonly string     $createdAt,
    ) {}
}
