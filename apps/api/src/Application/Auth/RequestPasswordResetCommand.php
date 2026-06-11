<?php

declare(strict_types=1);

namespace App\Application\Auth;

final class RequestPasswordResetCommand
{
    public function __construct(public readonly string $email)
    {
    }
}
