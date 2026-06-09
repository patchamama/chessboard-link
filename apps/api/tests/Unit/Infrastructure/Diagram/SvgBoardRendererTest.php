<?php

declare(strict_types=1);

namespace App\Tests\Unit\Infrastructure\Diagram;

use App\Domain\Chess\Fen;
use App\Infrastructure\Diagram\SvgBoardRenderer;
use PHPUnit\Framework\TestCase;

final class SvgBoardRendererTest extends TestCase
{
    private SvgBoardRenderer $renderer;
    private const STARTPOS = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    protected function setUp(): void
    {
        // __DIR__ = apps/api/tests/Unit/Infrastructure/Diagram → go up 6 to repo root
        $pieceDir       = dirname(__DIR__, 6) . '/css/images/pieces/merida';
        $this->renderer = new SvgBoardRenderer($pieceDir);
    }

    public function test_renders_svg_root_element(): void
    {
        $svg = $this->renderer->renderSvg(Fen::fromString(self::STARTPOS));
        $this->assertStringStartsWith('<svg', $svg);
        $this->assertStringContainsString('</svg>', $svg);
        $this->assertStringContainsString('xmlns="http://www.w3.org/2000/svg"', $svg);
    }

    public function test_renders_64_squares(): void
    {
        $svg = $this->renderer->renderSvg(Fen::fromString(self::STARTPOS));
        // Each square is a <rect> element with class "sq"
        $count = substr_count($svg, 'class="sq"');
        $this->assertSame(64, $count, "Expected 64 squares, got {$count}");
    }

    public function test_renders_footer_text_when_provided(): void
    {
        $svg = $this->renderer->renderSvg(Fen::fromString(self::STARTPOS), '+1.3 best: Nf3');
        $this->assertStringContainsString('+1.3 best: Nf3', $svg);
    }

    public function test_no_footer_band_when_footer_is_empty(): void
    {
        $svg = $this->renderer->renderSvg(Fen::fromString(self::STARTPOS));
        $this->assertStringNotContainsString('class="footer"', $svg);
    }

    public function test_renders_pieces_for_startpos(): void
    {
        $svg = $this->renderer->renderSvg(Fen::fromString(self::STARTPOS));
        // Both white and black pieces should appear as <use> or <g> with piece data
        $this->assertStringContainsString('piece-wR', $svg, 'White rook not found');
        $this->assertStringContainsString('piece-bR', $svg, 'Black rook not found');
        $this->assertStringContainsString('piece-wK', $svg, 'White king not found');
        $this->assertStringContainsString('piece-bK', $svg, 'Black king not found');
        $this->assertStringContainsString('piece-wP', $svg, 'White pawn not found');
        $this->assertStringContainsString('piece-bP', $svg, 'Black pawn not found');
    }

    public function test_empty_board_has_no_pieces(): void
    {
        $emptyFen = '8/8/8/8/8/8/8/8 w - - 0 1';
        $svg      = $this->renderer->renderSvg(Fen::fromString($emptyFen));
        // No <use> elements pointing to piece symbols (symbols are defined but not used)
        $this->assertStringNotContainsString('<use href="#piece-w', $svg);
        $this->assertStringNotContainsString('<use href="#piece-b', $svg);
    }

    public function test_output_is_deterministic(): void
    {
        $fen  = Fen::fromString(self::STARTPOS);
        $svg1 = $this->renderer->renderSvg($fen, '+1.3 best: Nf3');
        $svg2 = $this->renderer->renderSvg($fen, '+1.3 best: Nf3');
        $this->assertSame($svg1, $svg2);
    }

    public function test_renders_coordinates(): void
    {
        $svg = $this->renderer->renderSvg(Fen::fromString(self::STARTPOS), null, true);
        // File letters a-h
        $this->assertStringContainsString('>a<', $svg);
        $this->assertStringContainsString('>h<', $svg);
    }
}
