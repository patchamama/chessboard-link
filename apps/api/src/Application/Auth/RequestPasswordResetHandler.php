<?php

declare(strict_types=1);

namespace App\Application\Auth;

use App\Application\Auth\Port\PasswordResetNotifier;
use App\Application\Auth\Port\TokenGenerator;
use App\Domain\Auth\PasswordReset;
use App\Domain\Auth\PasswordResetRepository;
use App\Domain\Auth\UserRepository;
use DateTimeImmutable;

final class RequestPasswordResetHandler
{
    public function __construct(
        private readonly UserRepository $userRepository,
        private readonly PasswordResetRepository $resetRepository,
        private readonly TokenGenerator $tokenGenerator,
        private readonly PasswordResetNotifier $notifier,
    ) {
    }

    public function handle(RequestPasswordResetCommand $command): void
    {
        $user = $this->userRepository->findByEmail($command->email);

        // Non-enumerating: always return void regardless
        if ($user === null) {
            return;
        }

        $rawToken  = $this->tokenGenerator->generate();
        $tokenHash = hash('sha256', $rawToken);
        $now       = new DateTimeImmutable();

        $this->resetRepository->save(new PasswordReset(
            id:         0,
            userId:     $user->id()->value(),
            tokenHash:  $tokenHash,
            expiresAt:  $now->modify('+24 hours'),
            consumedAt: null,
            createdAt:  $now,
        ));

        $this->notifier->notify($user->email(), $rawToken);
    }
}
