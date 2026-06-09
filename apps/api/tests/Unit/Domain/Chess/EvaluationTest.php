<?php

declare(strict_types=1);

namespace App\Tests\Unit\Domain\Chess;

use App\Domain\Chess\Evaluation;
use PHPUnit\Framework\TestCase;

class EvaluationTest extends TestCase
{
    public function test_from_cp_creates_centipawn_evaluation(): void
    {
        $eval = Evaluation::fromCp(34, 'e2e4', 20);

        $this->assertSame(34, $eval->scoreCp);
        $this->assertNull($eval->mate);
        $this->assertSame('e2e4', $eval->bestMove);
        $this->assertSame(20, $eval->depth);
        $this->assertFalse($eval->isMate());
    }

    public function test_from_mate_creates_mate_evaluation(): void
    {
        $eval = Evaluation::fromMate(3, 'd1h5', 15);

        $this->assertNull($eval->scoreCp);
        $this->assertSame(3, $eval->mate);
        $this->assertSame('d1h5', $eval->bestMove);
        $this->assertSame(15, $eval->depth);
        $this->assertTrue($eval->isMate());
    }

    public function test_to_array_cp(): void
    {
        $eval = Evaluation::fromCp(34, 'e2e4', 20);
        $arr  = $eval->toArray();

        $this->assertSame(34, $arr['scoreCp']);
        $this->assertArrayNotHasKey('mate', $arr);
        $this->assertSame('e2e4', $arr['bestMove']);
        $this->assertSame(20, $arr['depth']);
    }

    public function test_to_array_mate(): void
    {
        $eval = Evaluation::fromMate(1, 'f6f7', 10);
        $arr  = $eval->toArray();

        $this->assertSame(1, $arr['mate']);
        $this->assertArrayNotHasKey('scoreCp', $arr);
        $this->assertSame('f6f7', $arr['bestMove']);
    }

    public function test_to_array_no_best_move(): void
    {
        $eval = Evaluation::fromCp(0, null, 1);
        $arr  = $eval->toArray();

        $this->assertArrayNotHasKey('bestMove', $arr);
    }
}
