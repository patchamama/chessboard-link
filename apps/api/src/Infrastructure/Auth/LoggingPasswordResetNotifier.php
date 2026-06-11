<?php

declare(strict_types=1);

namespace App\Infrastructure\Auth;

use App\Application\Auth\Port\PasswordResetNotifier;

final class LoggingPasswordResetNotifier implements PasswordResetNotifier
{
    public function __construct(private readonly string $appBaseUrl = '')
    {
    }

    public function notify(string $email, string $rawToken): void
    {
        $url = rtrim($this->appBaseUrl, '/') . '/reset-password?token=' . $rawToken;
        error_log(sprintf('[PasswordReset] email=%s url=%s', $email, $url));
        echo sprintf('[PasswordReset] email=%s url=%s' . PHP_EOL, $email, $url);
    }
}
