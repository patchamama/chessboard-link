<?php

declare(strict_types=1);

namespace App\Application\Admin;

final class SetUserPasswordCommand
{
    public function __construct(
        public readonly int $userId,
        public readonly string $newPassword,
    ) {
    }
}
