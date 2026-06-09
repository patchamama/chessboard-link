<?php

declare(strict_types=1);

namespace App\Tests\Unit\Application\Eval;

use App\Application\Eval\EvaluateGameHandler;
use App\Application\Eval\Command\EvaluateGameCommand;
use App\Application\Eval\Port\ChessEngine;
use App\Domain\Chess\Evaluation;
use App\Domain\Chess\Fen;
use PHPUnit\Framework\TestCase;

class EvaluateGameHandlerTest extends TestCase
{
    public function test_evaluates_each_fen_in_order(): void
    {
        $fens = [
            Fen::start(),
            Fen::fromString('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'),
        ];

        $eval1 = Evaluation::fromCp(30, 'e2e4', 15);
        $eval2 = Evaluation::fromCp(-20, 'e7e5', 15);

        $engine = $this->createMock(ChessEngine::class);
        $engine->expects($this->exactly(2))
            ->method('evaluate')
            ->willReturnOnConsecutiveCalls($eval1, $eval2);

        $handler = new EvaluateGameHandler($engine);
        $command = new EvaluateGameCommand($fens, 15);

        $results = $handler->handle($command);

        $this->assertCount(2, $results);
        $this->assertSame($eval1, $results[0]);
        $this->assertSame($eval2, $results[1]);
    }

    public function test_returns_empty_array_for_no_fens(): void
    {
        $engine = $this->createMock(ChessEngine::class);
        $engine->expects($this->never())->method('evaluate');

        $handler = new EvaluateGameHandler($engine);
        $command = new EvaluateGameCommand([], 15);

        $this->assertSame([], $handler->handle($command));
    }
}
