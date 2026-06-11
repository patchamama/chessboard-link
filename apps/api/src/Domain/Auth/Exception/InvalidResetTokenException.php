<?php

declare(strict_types=1);

namespace App\Domain\Auth\Exception;

final class InvalidResetTokenException extends \RuntimeException
{
    public function __construct()
    {
        parent::__construct('Invalid or expired reset token.');
    }
}
