<?php

declare(strict_types=1);

namespace App\Infrastructure\Chess\Engine;

use App\Application\Eval\Port\ChessEngine;
use App\Domain\Chess\Evaluation;
use App\Domain\Chess\Fen;

/**
 * Production ChessEngine implementation using a native Stockfish binary via UCI.
 */
final class UciStockfishEngine implements ChessEngine
{
    private readonly UciParser $parser;

    public function __construct(private readonly string $binaryPath)
    {
        $this->parser = new UciParser();
    }

    public function evaluate(Fen $fen, int $depth): Evaluation
    {
        $process = new StockfishProcess($this->binaryPath);
        $process->start();

        try {
            $process->send('ucinewgame');
            $process->send('position fen ' . $fen->value());
            $process->send("go depth {$depth}");

            $lines = $process->readUntil('bestmove');
        } finally {
            $process->stop();
        }

        return $this->parser->parse($lines);
    }
}
