<?php

declare(strict_types=1);

namespace App\Application\Trainer;

use App\Application\Clock;
use App\Domain\Trainer\Sm2Scheduler;
use App\Domain\Trainer\TrainerLine;
use App\Domain\Trainer\TrainerLineRepository;

final class ReviewTrainerLineHandler
{
    public function __construct(
        private readonly TrainerLineRepository $repository,
        private readonly Sm2Scheduler $scheduler,
        private readonly Clock $clock,
    ) {
    }

    public function handle(ReviewTrainerLineCommand $command): TrainerLine
    {
        $line = $this->repository->findById($command->lineId);
        if ($line === null) {
            throw new \RuntimeException('Trainer line not found');
        }
        if ($line->userId !== $command->userId) {
            throw new \RuntimeException('Forbidden: not the line owner');
        }

        $now      = $this->clock->now();
        $schedule = $this->scheduler->review($line->srs, $command->grade, $now);

        $updated = new TrainerLine(
            id: $line->id,
            userId: $line->userId,
            bookId: $line->bookId,
            name: $line->name,
            startFen: $line->startFen,
            movesUci: $line->movesUci,
            orientation: $line->orientation,
            srs: $schedule->state,
            dueAt: $schedule->dueAt,
            lastReviewedAt: $now,
            createdAt: $line->createdAt,
        );

        $this->repository->save($updated);
        return $updated;
    }
}
