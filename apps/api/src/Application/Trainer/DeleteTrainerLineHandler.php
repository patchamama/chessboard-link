<?php

declare(strict_types=1);

namespace App\Application\Trainer;

use App\Domain\Trainer\TrainerLineRepository;

final class DeleteTrainerLineHandler
{
    public function __construct(private readonly TrainerLineRepository $repository) {}

    public function handle(DeleteTrainerLineCommand $command): void
    {
        $line = $this->repository->findById($command->lineId);
        if ($line === null) {
            throw new \RuntimeException('Trainer line not found');
        }
        if ($line->userId !== $command->userId) {
            throw new \RuntimeException('Forbidden: not the line owner');
        }
        $this->repository->delete($command->lineId);
    }
}
