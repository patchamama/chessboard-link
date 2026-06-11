<?php

declare(strict_types=1);

namespace App\Tests\Unit\Application\Library;

use App\Application\Library\SetLastReadBookCommand;
use App\Application\Library\SetLastReadBookHandler;
use App\Domain\Auth\RegistrationStatus;
use App\Domain\Auth\Role;
use App\Domain\Auth\User;
use App\Domain\Auth\UserId;
use App\Domain\Auth\UserRepository;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

class SetLastReadBookHandlerTest extends TestCase
{
    public function testSavesUserWithUpdatedLastReadBookId(): void
    {
        $user = new User(
            new UserId(1),
            'user@test.com',
            'hash',
            Role::User,
            RegistrationStatus::Approved,
            new DateTimeImmutable(),
        );

        $repo = $this->createMock(UserRepository::class);
        $repo->method('findById')->willReturn($user);
        $repo->expects($this->once())
            ->method('save')
            ->with($this->callback(fn($u) => $u->lastReadBookId() === 7))
            ->willReturn($user->withLastReadBookId(7));

        $handler = new SetLastReadBookHandler($repo);
        $handler->handle(new SetLastReadBookCommand(userId: 1, bookId: 7));
    }
}
