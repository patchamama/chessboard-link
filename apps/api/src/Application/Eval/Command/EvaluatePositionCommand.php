<?php

declare(strict_types=1);

namespace App\Application\Eval\Command;

use App\Domain\Chess\Fen;

final class EvaluatePositionCommand
{
    public function __construct(
        public readonly Fen $fen,
        public readonly int $depth,
    ) {
    }
}
