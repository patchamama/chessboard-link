<?php

declare(strict_types=1);

namespace App\Tests\Unit\Application\Eval;

use App\Application\Eval\EvaluatePositionHandler;
use App\Application\Eval\Command\EvaluatePositionCommand;
use App\Application\Eval\Port\ChessEngine;
use App\Domain\Chess\Evaluation;
use App\Domain\Chess\Fen;
use PHPUnit\Framework\TestCase;

class EvaluatePositionHandlerTest extends TestCase
{
    public function test_delegates_to_engine_and_returns_evaluation(): void
    {
        $expectedEval = Evaluation::fromCp(34, 'e2e4', 20);
        $engine = $this->createMock(ChessEngine::class);
        $engine->expects($this->once())
            ->method('evaluate')
            ->willReturn($expectedEval);

        $handler = new EvaluatePositionHandler($engine);
        $command = new EvaluatePositionCommand(Fen::start(), 20);

        $result = $handler->handle($command);

        $this->assertSame($expectedEval, $result);
    }

    public function test_default_depth_is_used_when_zero(): void
    {
        $engine = $this->createMock(ChessEngine::class);
        $engine->expects($this->once())
            ->method('evaluate')
            ->with($this->anything(), $this->greaterThan(0))
            ->willReturn(Evaluation::fromCp(0, null, 15));

        $handler = new EvaluatePositionHandler($engine);
        $command = new EvaluatePositionCommand(Fen::start(), 0);

        $handler->handle($command);
    }
}
