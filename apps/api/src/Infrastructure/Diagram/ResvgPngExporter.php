<?php

declare(strict_types=1);

namespace App\Infrastructure\Diagram;

use App\Application\Diagram\Port\PngExporter;
use RuntimeException;

/**
 * Rasterizes SVG → PNG using the first available rasterizer:
 * 1. PHP imagick extension
 * 2. rsvg-convert CLI
 * 3. resvg CLI
 * 4. inkscape CLI
 *
 * Throws RuntimeException if none are available — callers should markTestSkipped
 * in test environments.
 */
final class ResvgPngExporter implements PngExporter
{
    public function export(string $svg): string
    {
        if (extension_loaded('imagick')) {
            return $this->exportViaImagick($svg);
        }

        foreach (['rsvg-convert', 'resvg', 'inkscape'] as $bin) {
            $path = trim(shell_exec("which {$bin} 2>/dev/null") ?? '');
            if ($path !== '' && is_executable($path)) {
                return $this->exportViaCli($bin, $svg);
            }
        }

        throw new RuntimeException(
            'No SVG rasterizer available. Install imagick, rsvg-convert, resvg, or inkscape.'
        );
    }

    private function exportViaImagick(string $svg): string
    {
        $im = new \Imagick();
        $im->readImageBlob($svg);
        $im->setImageFormat('png');
        return $im->getImageBlob();
    }

    private function exportViaCli(string $bin, string $svg): string
    {
        $tmpIn  = tempnam(sys_get_temp_dir(), 'chess_svg_');
        $tmpOut = $tmpIn . '.png';

        try {
            file_put_contents($tmpIn, $svg);

            $cmd = match ($bin) {
                'rsvg-convert' => "rsvg-convert -f png -o " . escapeshellarg($tmpOut) . " " . escapeshellarg($tmpIn),
                'resvg'        => "resvg " . escapeshellarg($tmpIn) . " " . escapeshellarg($tmpOut),
                'inkscape'     => "inkscape --export-type=png --export-filename=" . escapeshellarg($tmpOut) . " " . escapeshellarg($tmpIn),
                default        => throw new RuntimeException("Unknown rasterizer: {$bin}"),
            };

            exec($cmd . ' 2>/dev/null', $output, $exitCode);

            if ($exitCode !== 0 || !file_exists($tmpOut)) {
                throw new RuntimeException("Rasterizer {$bin} failed with exit code {$exitCode}");
            }

            return file_get_contents($tmpOut);
        } finally {
            @unlink($tmpIn);
            @unlink($tmpOut);
        }
    }
}
