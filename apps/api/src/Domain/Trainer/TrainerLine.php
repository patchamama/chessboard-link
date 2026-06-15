<?php

declare(strict_types=1);

namespace App\Domain\Trainer;

/**
 * A spaced-repetition trainer line: a saved sequence of moves a user revises.
 * Carries its SM-2 scheduling state inline.
 *
 * @phpstan-type Uci string
 */
final class TrainerLine
{
    /**
     * @param string[] $movesUci
     */
    public function __construct(
        public readonly int $id,
        public readonly int $userId,
        public readonly ?int $bookId,
        public readonly string $name,
        public readonly string $startFen,
        public readonly array $movesUci,
        public readonly string $orientation,
        public readonly SrsState $srs,
        public readonly \DateTimeImmutable $dueAt,
        public readonly ?\DateTimeImmutable $lastReviewedAt,
        public readonly \DateTimeImmutable $createdAt,
    ) {
    }

    /** @return array<string,mixed> */
    public function toArray(): array
    {
        return [
            'id'             => $this->id,
            'bookId'         => $this->bookId,
            'name'           => $this->name,
            'startFen'       => $this->startFen,
            'movesUci'       => $this->movesUci,
            'orientation'    => $this->orientation,
            'ease'           => $this->srs->ease,
            'intervalDays'   => $this->srs->intervalDays,
            'reps'           => $this->srs->reps,
            'lapses'         => $this->srs->lapses,
            'dueAt'          => $this->dueAt->format(\DateTimeInterface::ATOM),
            'lastReviewedAt' => $this->lastReviewedAt?->format(\DateTimeInterface::ATOM),
            'createdAt'      => $this->createdAt->format(\DateTimeInterface::ATOM),
        ];
    }
}
