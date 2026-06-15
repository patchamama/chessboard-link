<?php

declare(strict_types=1);

namespace App\Application\Trainer;

use App\Application\Clock;
use App\Domain\Trainer\SrsState;
use App\Domain\Trainer\TrainerLine;
use App\Domain\Trainer\TrainerLineRepository;

final class AddTrainerLineHandler
{
    public function __construct(
        private readonly TrainerLineRepository $repository,
        private readonly Clock $clock,
    ) {
    }

    public function handle(AddTrainerLineCommand $command): TrainerLine
    {
        $now = $this->clock->now();

        // A new line is due immediately (interval 0, default ease).
        $line = new TrainerLine(
            id: 0,
            userId: $command->userId,
            bookId: $command->bookId,
            name: $command->name,
            startFen: $command->startFen,
            movesUci: $command->movesUci,
            orientation: $command->orientation,
            srs: new SrsState(ease: 2.5, intervalDays: 0, reps: 0, lapses: 0),
            dueAt: $now,
            lastReviewedAt: null,
            createdAt: $now,
        );

        $id = $this->repository->save($line);
        return $this->repository->findById($id) ?? $line;
    }
}
