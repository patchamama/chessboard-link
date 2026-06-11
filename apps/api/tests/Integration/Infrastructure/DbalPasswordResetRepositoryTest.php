<?php

declare(strict_types=1);

namespace App\Tests\Integration\Infrastructure;

use App\Domain\Auth\PasswordReset;
use App\Domain\Auth\PasswordResetRepository;
use App\Infrastructure\Persistence\DbalPasswordResetRepository;
use DateTimeImmutable;
use Doctrine\DBAL\DriverManager;
use PHPUnit\Framework\TestCase;

class DbalPasswordResetRepositoryTest extends TestCase
{
    private DbalPasswordResetRepository $repo;

    protected function setUp(): void
    {
        $connection = DriverManager::getConnection([
            'driver' => 'pdo_sqlite',
            'memory' => true,
        ]);

        $connection->executeStatement(
            file_get_contents(__DIR__ . '/../../../migrations/001_create_users.sql')
        );
        $connection->executeStatement(
            file_get_contents(__DIR__ . '/../../../migrations/002_create_books.sql')
        );
        $connection->executeStatement(
            file_get_contents(__DIR__ . '/../../../migrations/003_user_metrics_and_password_resets.sql')
        );

        // Insert a user so FK is satisfied
        $connection->insert('users', [
            'id'                  => 1,
            'email'               => 'user@test.com',
            'password_hash'       => 'h',
            'role'                => 'user',
            'registration_status' => 'approved',
            'created_at'          => '2024-01-01 00:00:00',
        ]);

        $this->repo = new DbalPasswordResetRepository($connection);
    }

    public function testSavePersistsAllFields(): void
    {
        $now = new DateTimeImmutable('2024-06-01 10:00:00');
        $reset = new PasswordReset(
            id: 0,
            userId: 1,
            tokenHash: 'testhash',
            expiresAt: new DateTimeImmutable('2024-06-02 10:00:00'),
            consumedAt: null,
            createdAt: $now,
        );

        $saved = $this->repo->save($reset);
        $this->assertGreaterThan(0, $saved->id());
        $this->assertSame('testhash', $saved->tokenHash());
        $this->assertFalse($saved->isConsumed());
    }

    public function testFindValidByTokenHashReturnsRecordWhenValidAndNotConsumed(): void
    {
        $now = new DateTimeImmutable('2024-06-01 10:00:00');
        $reset = new PasswordReset(
            id: 0,
            userId: 1,
            tokenHash: 'validhash',
            expiresAt: new DateTimeImmutable('2024-06-02 10:00:00'),
            consumedAt: null,
            createdAt: $now,
        );
        $this->repo->save($reset);

        $found = $this->repo->findValidByTokenHash('validhash', $now);
        $this->assertNotNull($found);
        $this->assertSame('validhash', $found->tokenHash());
    }

    public function testFindValidByTokenHashReturnsNullWhenExpired(): void
    {
        $now = new DateTimeImmutable('2024-06-03 10:00:00'); // after expiry
        $reset = new PasswordReset(
            id: 0,
            userId: 1,
            tokenHash: 'expiredhash',
            expiresAt: new DateTimeImmutable('2024-06-02 10:00:00'),
            consumedAt: null,
            createdAt: new DateTimeImmutable('2024-06-01 10:00:00'),
        );
        $this->repo->save($reset);

        $found = $this->repo->findValidByTokenHash('expiredhash', $now);
        $this->assertNull($found);
    }

    public function testFindValidByTokenHashReturnsNullWhenConsumed(): void
    {
        $now = new DateTimeImmutable('2024-06-01 10:00:00');
        $reset = new PasswordReset(
            id: 0,
            userId: 1,
            tokenHash: 'consumedhash',
            expiresAt: new DateTimeImmutable('2024-06-02 10:00:00'),
            consumedAt: new DateTimeImmutable('2024-06-01 09:00:00'),
            createdAt: $now,
        );
        $this->repo->save($reset);

        $found = $this->repo->findValidByTokenHash('consumedhash', $now);
        $this->assertNull($found);
    }

    public function testConsumeSetConsumedAtAndSubsequentFindReturnsNull(): void
    {
        $now = new DateTimeImmutable('2024-06-01 10:00:00');
        $reset = new PasswordReset(
            id: 0,
            userId: 1,
            tokenHash: 'singleuse',
            expiresAt: new DateTimeImmutable('2024-06-02 10:00:00'),
            consumedAt: null,
            createdAt: $now,
        );
        $saved = $this->repo->save($reset);

        $this->repo->consume($saved->id(), $now);

        $found = $this->repo->findValidByTokenHash('singleuse', $now);
        $this->assertNull($found);
    }
}
