<?php

declare(strict_types=1);

namespace App\Application\Auth\Port;

interface PasswordResetNotifier
{
    public function notify(string $email, string $rawToken): void;
}
