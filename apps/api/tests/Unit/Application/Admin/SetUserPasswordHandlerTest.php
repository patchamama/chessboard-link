<?php

declare(strict_types=1);

namespace App\Tests\Unit\Application\Admin;

use App\Application\Admin\SetUserPasswordCommand;
use App\Application\Admin\SetUserPasswordHandler;
use App\Application\Auth\Port\PasswordHasher;
use App\Domain\Auth\RegistrationStatus;
use App\Domain\Auth\Role;
use App\Domain\Auth\User;
use App\Domain\Auth\UserId;
use App\Domain\Auth\UserRepository;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

class SetUserPasswordHandlerTest extends TestCase
{
    private function makeUser(int $id): User
    {
        return new User(
            new UserId($id),
            'user@test.com',
            'old_hash',
            Role::User,
            RegistrationStatus::Approved,
            new DateTimeImmutable(),
        );
    }

    public function testNewPasswordIsHashedBeforeSave(): void
    {
        $user = $this->makeUser(1);

        $repo = $this->createMock(UserRepository::class);
        $repo->method('findById')->willReturn($user);
        $repo->expects($this->once())
            ->method('save')
            ->with($this->callback(fn($u) => $u->passwordHash() === 'hashed_new'))
            ->willReturn($user->withPasswordHash('hashed_new'));

        $hasher = $this->createMock(PasswordHasher::class);
        $hasher->method('hash')->with('NewPass1!')->willReturn('hashed_new');

        $handler = new SetUserPasswordHandler($repo, $hasher);
        $handler->handle(new SetUserPasswordCommand(1, 'NewPass1!'));
    }

    public function testEmptyPasswordThrows(): void
    {
        $repo = $this->createMock(UserRepository::class);
        $hasher = $this->createMock(PasswordHasher::class);

        $this->expectException(\InvalidArgumentException::class);
        $handler = new SetUserPasswordHandler($repo, $hasher);
        $handler->handle(new SetUserPasswordCommand(1, ''));
    }

    public function testSavedUserHasNewPasswordHash(): void
    {
        $user = $this->makeUser(1);
        $savedUser = $user->withPasswordHash('hashed_secure');

        $repo = $this->createMock(UserRepository::class);
        $repo->method('findById')->willReturn($user);
        $repo->method('save')->willReturn($savedUser);

        $hasher = $this->createMock(PasswordHasher::class);
        $hasher->method('hash')->willReturn('hashed_secure');

        $handler = new SetUserPasswordHandler($repo, $hasher);
        $result = $handler->handle(new SetUserPasswordCommand(1, 'Secure123!'));

        $this->assertSame('hashed_secure', $result->passwordHash());
    }
}
