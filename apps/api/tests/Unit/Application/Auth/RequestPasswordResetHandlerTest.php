<?php

declare(strict_types=1);

namespace App\Tests\Unit\Application\Auth;

use App\Application\Auth\Port\PasswordResetNotifier;
use App\Application\Auth\Port\TokenGenerator;
use App\Application\Auth\RequestPasswordResetCommand;
use App\Application\Auth\RequestPasswordResetHandler;
use App\Domain\Auth\PasswordResetRepository;
use App\Domain\Auth\RegistrationStatus;
use App\Domain\Auth\Role;
use App\Domain\Auth\User;
use App\Domain\Auth\UserId;
use App\Domain\Auth\UserRepository;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

class RequestPasswordResetHandlerTest extends TestCase
{
    private function makeUser(): User
    {
        return new User(
            new UserId(5),
            'user@test.com',
            'hash',
            Role::User,
            RegistrationStatus::Approved,
            new DateTimeImmutable(),
        );
    }

    public function testForKnownUserGeneratesTokenStoresHashAndNotifies(): void
    {
        $user = $this->makeUser();

        $repo = $this->createMock(UserRepository::class);
        $repo->method('findByEmail')->willReturn($user);

        $mockReset = new \App\Domain\Auth\PasswordReset(
            id: 1,
            userId: 5,
            tokenHash: hash('sha256', 'rawtoken123'),
            expiresAt: new DateTimeImmutable('+24 hours'),
            consumedAt: null,
            createdAt: new DateTimeImmutable(),
        );

        $resetRepo = $this->createMock(PasswordResetRepository::class);
        $resetRepo->expects($this->once())
            ->method('save')
            ->with($this->callback(fn($r) => $r->tokenHash() === hash('sha256', 'rawtoken123')))
            ->willReturn($mockReset);

        $tokenGen = $this->createMock(TokenGenerator::class);
        $tokenGen->method('generate')->willReturn('rawtoken123');

        $notifier = $this->createMock(PasswordResetNotifier::class);
        $notifier->expects($this->once())
            ->method('notify')
            ->with('user@test.com', 'rawtoken123');

        $handler = new RequestPasswordResetHandler($repo, $resetRepo, $tokenGen, $notifier);
        $handler->handle(new RequestPasswordResetCommand('user@test.com'));
    }

    public function testForUnknownUserReturnsVoidWithoutNotify(): void
    {
        $repo = $this->createMock(UserRepository::class);
        $repo->method('findByEmail')->willReturn(null);

        $resetRepo = $this->createMock(PasswordResetRepository::class);
        $resetRepo->expects($this->never())->method('save');

        $tokenGen = $this->createMock(TokenGenerator::class);

        $notifier = $this->createMock(PasswordResetNotifier::class);
        $notifier->expects($this->never())->method('notify');

        $handler = new RequestPasswordResetHandler($repo, $resetRepo, $tokenGen, $notifier);
        // Must not throw
        $handler->handle(new RequestPasswordResetCommand('ghost@test.com'));
    }

    public function testTokenExpiresAt24HoursFromNow(): void
    {
        $user = $this->makeUser();

        $repo = $this->createMock(UserRepository::class);
        $repo->method('findByEmail')->willReturn($user);

        $resetRepo = $this->createMock(PasswordResetRepository::class);
        $resetRepo->expects($this->once())
            ->method('save')
            ->with($this->callback(function ($r) {
                $diff = $r->expiresAt()->getTimestamp() - (new DateTimeImmutable())->getTimestamp();
                return $diff >= 86390 && $diff <= 86410; // ~24 hours
            }))
            ->willReturnCallback(fn($r) => $r);

        $tokenGen = $this->createMock(TokenGenerator::class);
        $tokenGen->method('generate')->willReturn('tok');

        $notifier = $this->createMock(PasswordResetNotifier::class);

        $handler = new RequestPasswordResetHandler($repo, $resetRepo, $tokenGen, $notifier);
        $handler->handle(new RequestPasswordResetCommand('user@test.com'));
    }
}
