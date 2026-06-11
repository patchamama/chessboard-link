<?php

declare(strict_types=1);

namespace App\Application\Library;

use App\Domain\Auth\UserId;
use App\Domain\Auth\UserRepository;

final class SetLastReadBookHandler
{
    public function __construct(private readonly UserRepository $userRepository)
    {
    }

    public function handle(SetLastReadBookCommand $command): void
    {
        $user = $this->userRepository->findById(new UserId($command->userId));

        if ($user === null) {
            return;
        }

        $this->userRepository->save($user->withLastReadBookId($command->bookId));
    }
}
