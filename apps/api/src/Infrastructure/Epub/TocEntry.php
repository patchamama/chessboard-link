<?php

declare(strict_types=1);

namespace App\Infrastructure\Epub;

final class TocEntry
{
    public function __construct(
        public readonly int    $order,
        public readonly string $title,
        public readonly string $href,
    ) {}
}
