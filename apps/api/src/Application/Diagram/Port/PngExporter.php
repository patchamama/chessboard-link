<?php

declare(strict_types=1);

namespace App\Application\Diagram\Port;

/**
 * Port: rasterizes an SVG string to PNG bytes.
 */
interface PngExporter
{
    /**
     * Convert an SVG string to PNG binary data.
     *
     * @param  string $svg Complete SVG markup.
     * @return string      Raw PNG bytes.
     * @throws \RuntimeException If no rasterizer is available.
     */
    public function export(string $svg): string;
}
