<?php

declare(strict_types=1);

namespace App\Application\Ingestion\Command;

final class ParseWebsiteCommand
{
    public function __construct(
        public readonly int    $ownerId,
        public readonly string $url,
    ) {}
}
