<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence;

use App\Domain\Trainer\SrsState;
use App\Domain\Trainer\TrainerLine;
use App\Domain\Trainer\TrainerLineRepository;
use Doctrine\DBAL\Connection;

final class DbalTrainerLineRepository implements TrainerLineRepository
{
    public function __construct(private readonly Connection $connection) {}

    public function save(TrainerLine $line): int
    {
        $data = [
            'user_id'          => $line->userId,
            'book_id'          => $line->bookId,
            'name'             => $line->name,
            'start_fen'        => $line->startFen,
            'moves_uci'        => json_encode(array_values($line->movesUci)),
            'orientation'      => $line->orientation,
            'ease'             => $line->srs->ease,
            'interval_days'    => $line->srs->intervalDays,
            'reps'             => $line->srs->reps,
            'lapses'           => $line->srs->lapses,
            'due_at'           => $line->dueAt->format(\DateTimeInterface::ATOM),
            'last_reviewed_at' => $line->lastReviewedAt?->format(\DateTimeInterface::ATOM),
            'created_at'       => $line->createdAt->format(\DateTimeInterface::ATOM),
        ];

        if ($line->id === 0) {
            $this->connection->insert('trainer_lines', $data);
            return (int) $this->connection->lastInsertId();
        }

        unset($data['created_at']); // never rewrite creation time
        $this->connection->update('trainer_lines', $data, ['id' => $line->id]);
        return $line->id;
    }

    public function findByUser(int $userId): array
    {
        $rows = $this->connection->fetchAllAssociative(
            'SELECT * FROM trainer_lines WHERE user_id = ? ORDER BY due_at ASC, id ASC',
            [$userId],
        );
        return array_map($this->hydrate(...), $rows);
    }

    public function findById(int $id): ?TrainerLine
    {
        $row = $this->connection->fetchAssociative('SELECT * FROM trainer_lines WHERE id = ?', [$id]);
        return $row ? $this->hydrate($row) : null;
    }

    public function delete(int $id): void
    {
        $this->connection->delete('trainer_lines', ['id' => $id]);
    }

    /** @param array<string,mixed> $row */
    private function hydrate(array $row): TrainerLine
    {
        $moves = json_decode((string) $row['moves_uci'], true);
        return new TrainerLine(
            id: (int) $row['id'],
            userId: (int) $row['user_id'],
            bookId: $row['book_id'] !== null ? (int) $row['book_id'] : null,
            name: (string) $row['name'],
            startFen: (string) $row['start_fen'],
            movesUci: is_array($moves) ? $moves : [],
            orientation: (string) $row['orientation'],
            srs: new SrsState(
                ease: (float) $row['ease'],
                intervalDays: (int) $row['interval_days'],
                reps: (int) $row['reps'],
                lapses: (int) $row['lapses'],
            ),
            dueAt: new \DateTimeImmutable((string) $row['due_at']),
            lastReviewedAt: $row['last_reviewed_at'] !== null
                ? new \DateTimeImmutable((string) $row['last_reviewed_at'])
                : null,
            createdAt: new \DateTimeImmutable((string) $row['created_at']),
        );
    }
}
