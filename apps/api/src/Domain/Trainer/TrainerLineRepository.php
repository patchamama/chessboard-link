<?php

declare(strict_types=1);

namespace App\Domain\Trainer;

/**
 * Persistence port for spaced-repetition trainer lines.
 */
interface TrainerLineRepository
{
    public function save(TrainerLine $line): int;

    /** @return TrainerLine[] ordered by due date ascending (most-due first). */
    public function findByUser(int $userId): array;

    public function findById(int $id): ?TrainerLine;

    public function delete(int $id): void;
}
