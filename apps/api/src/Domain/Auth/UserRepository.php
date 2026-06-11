<?php

declare(strict_types=1);

namespace App\Domain\Auth;

interface UserRepository
{
    public function save(User $user): User;

    public function findByEmail(string $email): ?User;

    public function findById(UserId $id): ?User;

    /** @return User[] */
    public function findAllPending(): array;

    /** @return User[] */
    public function findAllApproved(): array;

    /** @return User[] */
    public function findAllRejected(): array;
}
