<?php

declare(strict_types=1);

namespace App\Domain\Auth;

use DateTimeImmutable;

interface PasswordResetRepository
{
    public function save(PasswordReset $reset): PasswordReset;

    public function findValidByTokenHash(string $tokenHash, DateTimeImmutable $now): ?PasswordReset;

    public function consume(int $id, DateTimeImmutable $now): void;
}
