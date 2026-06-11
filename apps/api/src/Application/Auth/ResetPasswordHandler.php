<?php

declare(strict_types=1);

namespace App\Application\Auth;

use App\Application\Auth\Port\PasswordHasher;
use App\Domain\Auth\Exception\InvalidResetTokenException;
use App\Domain\Auth\PasswordResetRepository;
use App\Domain\Auth\UserRepository;
use App\Domain\Auth\UserId;
use DateTimeImmutable;

final class ResetPasswordHandler
{
    public function __construct(
        private readonly PasswordResetRepository $resetRepository,
        private readonly UserRepository $userRepository,
        private readonly PasswordHasher $hasher,
    ) {
    }

    public function handle(ResetPasswordCommand $command): void
    {
        $now       = new DateTimeImmutable();
        $tokenHash = hash('sha256', $command->rawToken);
        $reset     = $this->resetRepository->findValidByTokenHash($tokenHash, $now);

        if ($reset === null) {
            throw new InvalidResetTokenException();
        }

        $user = $this->userRepository->findById(new UserId($reset->userId()));

        if ($user === null) {
            throw new InvalidResetTokenException();
        }

        $newHash = $this->hasher->hash($command->newPassword);
        $this->userRepository->save($user->withPasswordHash($newHash));
        $this->resetRepository->consume($reset->id(), $now);
    }
}
