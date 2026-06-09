<?php

declare(strict_types=1);

namespace App\Domain\Library;

final class Chapter
{
    public function __construct(
        public readonly int    $id,
        public readonly int    $bookId,
        public readonly int    $order,
        public readonly string $title,
        public readonly string $html,
    ) {}
}
