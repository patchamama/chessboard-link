<?php

declare(strict_types=1);

namespace App\Application\Eval;

use App\Application\Eval\Command\EvaluateGameCommand;
use App\Application\Eval\Port\ChessEngine;
use App\Domain\Chess\Evaluation;

final class EvaluateGameHandler
{
    private const DEFAULT_DEPTH = 15;

    public function __construct(private readonly ChessEngine $engine)
    {
    }

    /**
     * @return Evaluation[]
     */
    public function handle(EvaluateGameCommand $command): array
    {
        $depth = $command->depth > 0 ? $command->depth : self::DEFAULT_DEPTH;
        return array_map(
            fn($fen) => $this->engine->evaluate($fen, $depth),
            $command->fens
        );
    }
}
