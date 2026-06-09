<?php

declare(strict_types=1);

namespace App\Application\Eval;

use App\Application\Eval\Command\EvaluatePositionCommand;
use App\Application\Eval\Port\ChessEngine;
use App\Domain\Chess\Evaluation;

final class EvaluatePositionHandler
{
    private const DEFAULT_DEPTH = 15;

    public function __construct(private readonly ChessEngine $engine)
    {
    }

    public function handle(EvaluatePositionCommand $command): Evaluation
    {
        $depth = $command->depth > 0 ? $command->depth : self::DEFAULT_DEPTH;
        return $this->engine->evaluate($command->fen, $depth);
    }
}
