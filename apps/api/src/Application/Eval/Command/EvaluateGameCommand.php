<?php

declare(strict_types=1);

namespace App\Application\Eval\Command;

use App\Domain\Chess\Fen;

final class EvaluateGameCommand
{
    /**
     * @param Fen[] $fens
     */
    public function __construct(
        public readonly array $fens,
        public readonly int $depth,
    ) {
    }
}
