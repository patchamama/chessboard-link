<?php

declare(strict_types=1);

namespace App\Application;

/**
 * Port for reading the current time, so time-dependent handlers stay testable.
 */
interface Clock
{
    public function now(): \DateTimeImmutable;
}
