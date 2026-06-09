<?php

declare(strict_types=1);

namespace App\Domain\Chess;

/**
 * Value object for a chess position evaluation from an engine.
 */
final class Evaluation
{
    private function __construct(
        public readonly ?int $scoreCp,
        public readonly ?int $mate,
        public readonly ?string $bestMove,
        public readonly int $depth,
    ) {
    }

    public static function fromCp(int $scoreCp, ?string $bestMove, int $depth): self
    {
        return new self($scoreCp, null, $bestMove, $depth);
    }

    public static function fromMate(int $mate, ?string $bestMove, int $depth): self
    {
        return new self(null, $mate, $bestMove, $depth);
    }

    public function isMate(): bool
    {
        return $this->mate !== null;
    }

    public function toArray(): array
    {
        $result = ['depth' => $this->depth];
        if ($this->mate !== null) {
            $result['mate'] = $this->mate;
        } else {
            $result['scoreCp'] = $this->scoreCp;
        }
        if ($this->bestMove !== null) {
            $result['bestMove'] = $this->bestMove;
        }
        return $result;
    }
}
