<?php

declare(strict_types=1);

namespace App\Tests\Integration\Infrastructure\Diagram;

use App\Domain\Chess\Fen;
use App\Infrastructure\Diagram\ResvgPngExporter;
use App\Infrastructure\Diagram\SvgBoardRenderer;
use PHPUnit\Framework\TestCase;

final class PngExporterTest extends TestCase
{
    public function test_exports_svg_to_png_bytes(): void
    {
        // Skip if no rasterizer is available — same pattern as UciStockfishEngineTest
        $available = $this->detectRasterizer();
        if ($available === null) {
            $this->markTestSkipped('No SVG rasterizer available (imagick, rsvg-convert, resvg, inkscape). Skipping PNG export test.');
        }

        // __DIR__ = apps/api/tests/Integration/Infrastructure/Diagram → up 6 = repo root
        $pieceDir = dirname(__DIR__, 6) . '/css/images/pieces/merida';
        $renderer = new SvgBoardRenderer($pieceDir);
        $svg      = $renderer->renderSvg(Fen::fromString('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'));

        $exporter = new ResvgPngExporter();
        $pngBytes = $exporter->export($svg);

        // PNG magic bytes: \x89PNG\r\n\x1a\n
        $this->assertStringStartsWith("\x89PNG\r\n\x1a\n", $pngBytes, 'Output is not a valid PNG');
        $this->assertGreaterThan(1000, strlen($pngBytes), 'PNG is suspiciously small');
    }

    private function detectRasterizer(): ?string
    {
        if (extension_loaded('imagick')) {
            return 'imagick';
        }
        foreach (['rsvg-convert', 'resvg', 'inkscape'] as $bin) {
            $path = trim(shell_exec("which {$bin} 2>/dev/null") ?? '');
            if ($path !== '' && is_executable($path)) {
                return $bin;
            }
        }
        return null;
    }
}
