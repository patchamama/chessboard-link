<?php

declare(strict_types=1);

namespace App\Infrastructure\Auth;

use App\Application\Auth\Port\TokenGenerator;

final class RandomTokenGenerator implements TokenGenerator
{
    public function generate(): string
    {
        return bin2hex(random_bytes(32));
    }
}
