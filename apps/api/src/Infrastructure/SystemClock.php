<?php

declare(strict_types=1);

namespace App\Infrastructure;

use App\Application\Clock;

final class SystemClock implements Clock
{
    public function now(): \DateTimeImmutable
    {
        return new \DateTimeImmutable();
    }
}
