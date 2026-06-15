<?php

declare(strict_types=1);

namespace App\Application\Trainer;

use App\Domain\Trainer\TrainerLine;
use App\Domain\Trainer\TrainerLineRepository;

final class ListTrainerLinesHandler
{
    public function __construct(private readonly TrainerLineRepository $repository) {}

    /** @return TrainerLine[] */
    public function handle(int $userId): array
    {
        return $this->repository->findByUser($userId);
    }
}
