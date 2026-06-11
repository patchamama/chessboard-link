<?php

declare(strict_types=1);

namespace App\Application\Auth\Port;

interface TokenGenerator
{
    public function generate(): string;
}
