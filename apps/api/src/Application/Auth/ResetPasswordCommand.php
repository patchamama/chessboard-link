<?php

declare(strict_types=1);

namespace App\Application\Auth;

final class ResetPasswordCommand
{
    public function __construct(
        public readonly string $rawToken,
        public readonly string $newPassword,
    ) {
    }
}
