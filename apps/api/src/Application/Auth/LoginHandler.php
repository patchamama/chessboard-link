<?php

declare(strict_types=1);

namespace App\Application\Auth;

use App\Application\Auth\Command\LoginCommand;
use App\Application\Auth\Port\PasswordHasher;
use App\Application\Auth\Port\TokenIssuer;
use App\Domain\Auth\Exception\InvalidCredentialsException;
use App\Domain\Auth\Exception\UserNotApprovedException;
use App\Domain\Auth\RegistrationStatus;
use App\Domain\Auth\UserRepository;

final class LoginHandler
{
    public function __construct(
        private readonly UserRepository $repository,
        private readonly PasswordHasher $hasher,
        private readonly TokenIssuer $issuer,
    ) {
    }

    public function handle(LoginCommand $command): string
    {
        $user = $this->repository->findByEmail($command->email);

        if ($user === null) {
            throw new InvalidCredentialsException();
        }

        if ($user->status() !== RegistrationStatus::Approved) {
            throw new UserNotApprovedException();
        }

        if (!$this->hasher->verify($command->password, $user->passwordHash())) {
            throw new InvalidCredentialsException();
        }

        $user = $this->repository->save($user->withLoginCount($user->loginCount() + 1));

        return $this->issuer->issue($user);
    }
}
