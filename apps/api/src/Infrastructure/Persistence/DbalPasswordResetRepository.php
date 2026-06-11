<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence;

use App\Domain\Auth\PasswordReset;
use App\Domain\Auth\PasswordResetRepository;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;

final class DbalPasswordResetRepository implements PasswordResetRepository
{
    public function __construct(private readonly Connection $connection)
    {
    }

    public function save(PasswordReset $reset): PasswordReset
    {
        $this->connection->insert('password_resets', [
            'user_id'     => $reset->userId(),
            'token_hash'  => $reset->tokenHash(),
            'expires_at'  => $reset->expiresAt()->format('Y-m-d H:i:s'),
            'consumed_at' => $reset->consumedAt()?->format('Y-m-d H:i:s'),
            'created_at'  => $reset->createdAt()->format('Y-m-d H:i:s'),
        ]);

        $id = (int) $this->connection->lastInsertId();

        return new PasswordReset(
            id:         $id,
            userId:     $reset->userId(),
            tokenHash:  $reset->tokenHash(),
            expiresAt:  $reset->expiresAt(),
            consumedAt: $reset->consumedAt(),
            createdAt:  $reset->createdAt(),
        );
    }

    public function findValidByTokenHash(string $tokenHash, DateTimeImmutable $now): ?PasswordReset
    {
        $row = $this->connection->fetchAssociative(
            'SELECT * FROM password_resets WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?',
            [$tokenHash, $now->format('Y-m-d H:i:s')]
        );

        return $row ? $this->hydrate($row) : null;
    }

    public function consume(int $id, DateTimeImmutable $now): void
    {
        $this->connection->update(
            'password_resets',
            ['consumed_at' => $now->format('Y-m-d H:i:s')],
            ['id' => $id]
        );
    }

    private function hydrate(array $row): PasswordReset
    {
        return new PasswordReset(
            id:         (int) $row['id'],
            userId:     (int) $row['user_id'],
            tokenHash:  $row['token_hash'],
            expiresAt:  new DateTimeImmutable($row['expires_at']),
            consumedAt: $row['consumed_at'] !== null ? new DateTimeImmutable($row['consumed_at']) : null,
            createdAt:  new DateTimeImmutable($row['created_at']),
        );
    }
}
