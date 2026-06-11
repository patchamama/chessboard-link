<?php

declare(strict_types=1);

namespace App\Tests\Unit\Application\Auth;

use App\Application\Auth\Port\PasswordHasher;
use App\Application\Auth\ResetPasswordCommand;
use App\Application\Auth\ResetPasswordHandler;
use App\Domain\Auth\Exception\InvalidResetTokenException;
use App\Domain\Auth\PasswordReset;
use App\Domain\Auth\PasswordResetRepository;
use App\Domain\Auth\RegistrationStatus;
use App\Domain\Auth\Role;
use App\Domain\Auth\User;
use App\Domain\Auth\UserId;
use App\Domain\Auth\UserRepository;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

class ResetPasswordHandlerTest extends TestCase
{
    private function makeUser(): User
    {
        return new User(
            new UserId(5),
            'user@test.com',
            'old_hash',
            Role::User,
            RegistrationStatus::Approved,
            new DateTimeImmutable(),
        );
    }

    private function makeReset(
        bool $expired = false,
        bool $consumed = false,
    ): PasswordReset {
        return new PasswordReset(
            id: 1,
            userId: 5,
            tokenHash: hash('sha256', 'rawtoken'),
            expiresAt: $expired
                ? new DateTimeImmutable('-1 minute')
                : new DateTimeImmutable('+24 hours'),
            consumedAt: $consumed ? new DateTimeImmutable('-1 minute') : null,
            createdAt: new DateTimeImmutable(),
        );
    }

    public function testValidTokenSetsNewHashedPasswordAndConsumes(): void
    {
        $user = $this->makeUser();
        $reset = $this->makeReset();

        $resetRepo = $this->createMock(PasswordResetRepository::class);
        $resetRepo->method('findValidByTokenHash')
            ->with(hash('sha256', 'rawtoken'), $this->isInstanceOf(DateTimeImmutable::class))
            ->willReturn($reset);
        $resetRepo->expects($this->once())->method('consume')->with(1, $this->isInstanceOf(DateTimeImmutable::class));

        $userRepo = $this->createMock(UserRepository::class);
        $userRepo->method('findById')->willReturn($user);
        $userRepo->expects($this->once())
            ->method('save')
            ->with($this->callback(fn($u) => $u->passwordHash() === 'new_hashed'))
            ->willReturn($user->withPasswordHash('new_hashed'));

        $hasher = $this->createMock(PasswordHasher::class);
        $hasher->method('hash')->with('NewPass1!')->willReturn('new_hashed');

        $handler = new ResetPasswordHandler($resetRepo, $userRepo, $hasher);
        $handler->handle(new ResetPasswordCommand('rawtoken', 'NewPass1!'));
    }

    public function testExpiredTokenThrowsInvalidResetTokenException(): void
    {
        $resetRepo = $this->createMock(PasswordResetRepository::class);
        $resetRepo->method('findValidByTokenHash')->willReturn(null);

        $userRepo = $this->createMock(UserRepository::class);
        $hasher = $this->createMock(PasswordHasher::class);

        $this->expectException(InvalidResetTokenException::class);

        $handler = new ResetPasswordHandler($resetRepo, $userRepo, $hasher);
        $handler->handle(new ResetPasswordCommand('expiredtoken', 'Pass1!'));
    }

    public function testConsumedTokenThrowsInvalidResetTokenException(): void
    {
        $resetRepo = $this->createMock(PasswordResetRepository::class);
        $resetRepo->method('findValidByTokenHash')->willReturn(null); // consumed → not found

        $userRepo = $this->createMock(UserRepository::class);
        $hasher = $this->createMock(PasswordHasher::class);

        $this->expectException(InvalidResetTokenException::class);

        $handler = new ResetPasswordHandler($resetRepo, $userRepo, $hasher);
        $handler->handle(new ResetPasswordCommand('consumedtoken', 'Pass1!'));
    }

    public function testUnknownTokenThrowsInvalidResetTokenException(): void
    {
        $resetRepo = $this->createMock(PasswordResetRepository::class);
        $resetRepo->method('findValidByTokenHash')->willReturn(null);

        $userRepo = $this->createMock(UserRepository::class);
        $hasher = $this->createMock(PasswordHasher::class);

        $this->expectException(InvalidResetTokenException::class);

        $handler = new ResetPasswordHandler($resetRepo, $userRepo, $hasher);
        $handler->handle(new ResetPasswordCommand('unknowntoken', 'Pass1!'));
    }

    public function testTokenCannotBeReusedAfterFirstSuccess(): void
    {
        // After consume is called, subsequent lookups return null
        $user = $this->makeUser();
        $reset = $this->makeReset();

        $callCount = 0;
        $resetRepo = $this->createMock(PasswordResetRepository::class);
        $resetRepo->method('findValidByTokenHash')
            ->willReturnCallback(function () use ($reset, &$callCount) {
                $callCount++;
                return $callCount === 1 ? $reset : null;
            });
        $resetRepo->expects($this->once())->method('consume');

        $userRepo = $this->createMock(UserRepository::class);
        $userRepo->method('findById')->willReturn($user);
        $userRepo->method('save')->willReturn($user->withPasswordHash('new'));

        $hasher = $this->createMock(PasswordHasher::class);
        $hasher->method('hash')->willReturn('new');

        $handler = new ResetPasswordHandler($resetRepo, $userRepo, $hasher);
        $handler->handle(new ResetPasswordCommand('rawtoken', 'NewPass1!'));

        // Second attempt
        $this->expectException(InvalidResetTokenException::class);
        $handler->handle(new ResetPasswordCommand('rawtoken', 'NewPass1!'));
    }
}
