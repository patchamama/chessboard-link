<?php

declare(strict_types=1);

namespace App\Application\Admin;

use App\Application\Auth\Port\PasswordHasher;
use App\Domain\Auth\User;
use App\Domain\Auth\UserId;
use App\Domain\Auth\UserRepository;
use InvalidArgumentException;

final class SetUserPasswordHandler
{
    public function __construct(
        private readonly UserRepository $userRepository,
        private readonly PasswordHasher $hasher,
    ) {
    }

    public function handle(SetUserPasswordCommand $command): User
    {
        if (trim($command->newPassword) === '') {
            throw new InvalidArgumentException('Password cannot be empty.');
        }

        $user = $this->userRepository->findById(new UserId($command->userId));

        if ($user === null) {
            throw new \RuntimeException('User not found.');
        }

        $newHash = $this->hasher->hash($command->newPassword);
        return $this->userRepository->save($user->withPasswordHash($newHash));
    }
}
