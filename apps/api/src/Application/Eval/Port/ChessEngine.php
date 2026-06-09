<?php

declare(strict_types=1);

namespace App\Application\Eval\Port;

use App\Domain\Chess\Evaluation;
use App\Domain\Chess\Fen;

/**
 * Port: chess engine capable of evaluating positions.
 * Implementations: UciStockfishEngine (production), FakeChessEngine (tests).
 */
interface ChessEngine
{
    /**
     * Evaluate a single FEN position to the given depth.
     */
    public function evaluate(Fen $fen, int $depth): Evaluation;
}
