<?php

declare(strict_types=1);

namespace App\Tests\Unit\Domain\Diagram;

use App\Domain\Diagram\DiagramFooter;
use App\Domain\Chess\Evaluation;
use PHPUnit\Framework\TestCase;

final class DiagramFooterTest extends TestCase
{
    public function test_formats_centipawn_evaluation(): void
    {
        $eval   = Evaluation::fromCp(130, 'g1f3', 18);
        $footer = DiagramFooter::fromEvaluation($eval);

        $this->assertSame('+1.3 best: Nf3', $footer->text());
    }

    public function test_formats_negative_centipawn_evaluation(): void
    {
        $eval   = Evaluation::fromCp(-45, 'e7e5', 18);
        $footer = DiagramFooter::fromEvaluation($eval);

        $this->assertSame('-0.5 best: e5', $footer->text());
    }

    public function test_formats_mate_evaluation(): void
    {
        $eval   = Evaluation::fromMate(3, 'h5f7', 18);
        $footer = DiagramFooter::fromEvaluation($eval);

        $this->assertStringStartsWith('#3 best:', $footer->text());
        $this->assertStringContainsString('f7', $footer->text());
    }

    public function test_formats_mate_in_1(): void
    {
        $eval   = Evaluation::fromMate(1, 'h5f7', 18);
        $footer = DiagramFooter::fromEvaluation($eval);

        $this->assertStringStartsWith('#1 best:', $footer->text());
        $this->assertStringContainsString('f7', $footer->text());
    }

    public function test_formats_even_position(): void
    {
        $eval   = Evaluation::fromCp(0, 'e2e4', 18);
        $footer = DiagramFooter::fromEvaluation($eval);

        $this->assertSame('0.0 best: e4', $footer->text());
    }

    public function test_from_string(): void
    {
        $footer = DiagramFooter::fromString('+2.0 best: d4');
        $this->assertSame('+2.0 best: d4', $footer->text());
    }

    public function test_empty_footer(): void
    {
        $footer = DiagramFooter::empty();
        $this->assertSame('', $footer->text());
        $this->assertTrue($footer->isEmpty());
    }
}
