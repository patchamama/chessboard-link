<?php

declare(strict_types=1);

namespace App\Infrastructure\Diagram;

use App\Application\Diagram\Port\DiagramRenderer;
use App\Domain\Chess\Fen;

/**
 * Renders an 8x8 chess board SVG from a FEN position using Merida piece SVGs.
 * Pieces are embedded inline as <symbol> elements so the whole output is self-contained.
 */
final class SvgBoardRenderer implements DiagramRenderer
{
    private const SQUARE_SIZE = 45;
    private const BOARD_SIZE  = self::SQUARE_SIZE * 8;
    private const FOOTER_H    = 22;

    /** Colors for light/dark squares */
    private const COLOR_LIGHT = '#f0d9b5';
    private const COLOR_DARK  = '#b58863';

    /** FEN piece char → symbol id suffix */
    private const PIECE_MAP = [
        'K' => 'wK', 'Q' => 'wQ', 'R' => 'wR', 'B' => 'wB', 'N' => 'wN', 'P' => 'wP',
        'k' => 'bK', 'q' => 'bQ', 'r' => 'bR', 'b' => 'bB', 'n' => 'bN', 'p' => 'bP',
    ];

    /** @var array<string,string> Loaded SVG paths for each piece key */
    private array $pieceSvg = [];

    public function __construct(
        private readonly string $pieceDir,
    ) {
        $this->loadPieceSvgs();
    }

    public function renderSvg(Fen $fen, ?string $footerText = null, bool $coordinates = false): string
    {
        $hasFooter  = $footerText !== null && $footerText !== '';
        $coordExtra = $coordinates ? self::SQUARE_SIZE : 0;
        $totalH     = self::BOARD_SIZE + ($hasFooter ? self::FOOTER_H : 0) + $coordExtra;
        $totalW     = self::BOARD_SIZE + $coordExtra;

        $svg  = $this->openSvg($totalW, $totalH);
        $svg .= $this->renderSymbols();
        $svg .= $this->renderSquares($coordExtra);
        $svg .= $this->renderPieces($fen, $coordExtra);

        if ($coordinates) {
            $svg .= $this->renderCoordinates();
        }

        if ($hasFooter) {
            $svg .= $this->renderFooter($footerText, $totalW, self::BOARD_SIZE + $coordExtra);
        }

        $svg .= '</svg>';
        return $svg;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private function openSvg(int $w, int $h): string
    {
        return sprintf(
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            . 'width="%d" height="%d" viewBox="0 0 %d %d">',
            $w, $h, $w, $h,
        );
    }

    private function renderSymbols(): string
    {
        $out = '';
        foreach ($this->pieceSvg as $key => $inner) {
            $out .= sprintf(
                '<symbol id="piece-%s" viewBox="0 0 50 50">%s</symbol>',
                $key,
                $inner,
            );
        }
        return $out;
    }

    private function renderSquares(int $offset): string
    {
        $out = '';
        for ($rank = 0; $rank < 8; $rank++) {
            for ($file = 0; $file < 8; $file++) {
                $isLight = ($rank + $file) % 2 === 0;
                $color   = $isLight ? self::COLOR_LIGHT : self::COLOR_DARK;
                $x       = $offset + $file * self::SQUARE_SIZE;
                $y       = $offset + $rank * self::SQUARE_SIZE;
                $out    .= sprintf(
                    '<rect class="sq" x="%d" y="%d" width="%d" height="%d" fill="%s"/>',
                    $x, $y,
                    self::SQUARE_SIZE, self::SQUARE_SIZE,
                    $color,
                );
            }
        }
        return $out;
    }

    private function renderPieces(Fen $fen, int $offset): string
    {
        $rows = explode('/', explode(' ', $fen->value())[0]);
        $out  = '';

        foreach ($rows as $rankIdx => $row) {
            $fileIdx = 0;
            for ($i = 0; $i < strlen($row); $i++) {
                $ch = $row[$i];
                if (is_numeric($ch)) {
                    $fileIdx += (int) $ch;
                    continue;
                }
                if (!isset(self::PIECE_MAP[$ch])) {
                    $fileIdx++;
                    continue;
                }
                $pieceKey = self::PIECE_MAP[$ch];
                $x        = $offset + $fileIdx * self::SQUARE_SIZE;
                $y        = $offset + $rankIdx * self::SQUARE_SIZE;
                $out     .= sprintf(
                    '<use href="#piece-%s" x="%d" y="%d" width="%d" height="%d"/>',
                    $pieceKey, $x, $y,
                    self::SQUARE_SIZE, self::SQUARE_SIZE,
                );
                $fileIdx++;
            }
        }

        return $out;
    }

    private function renderCoordinates(): string
    {
        $s   = self::SQUARE_SIZE;
        $out = '';

        // File letters: a-h (bottom row, inside board area at offset row y=8*s)
        for ($f = 0; $f < 8; $f++) {
            $letter = chr(ord('a') + $f);
            $x      = $s + $f * $s + (int) ($s / 2) - 4;
            $y      = $s * 8 + 16;
            $out   .= sprintf(
                '<text x="%d" y="%d" font-size="12" font-family="sans-serif" fill="#333">%s</text>',
                $x, $y, $letter,
            );
        }

        // Rank numbers: 8-1 (left column)
        for ($r = 0; $r < 8; $r++) {
            $num = 8 - $r;
            $x   = 4;
            $y   = $s + $r * $s + (int) ($s / 2) + 4;
            $out .= sprintf(
                '<text x="%d" y="%d" font-size="12" font-family="sans-serif" fill="#333">%d</text>',
                $x, $y, $num,
            );
        }

        return $out;
    }

    private function renderFooter(string $text, int $width, int $yOffset): string
    {
        return sprintf(
            '<rect class="footer" x="0" y="%d" width="%d" height="%d" fill="#2c2c2c"/>'
            . '<text x="%d" y="%d" font-size="13" font-family="monospace" fill="#e8e8e8" text-anchor="middle">%s</text>',
            $yOffset, $width, self::FOOTER_H,
            (int) ($width / 2), $yOffset + 15,
            htmlspecialchars($text, ENT_XML1 | ENT_QUOTES, 'UTF-8'),
        );
    }

    private function loadPieceSvgs(): void
    {
        foreach (self::PIECE_MAP as $pieceKey) {
            $file = $this->pieceDir . '/' . $pieceKey . '.svg';
            if (!file_exists($file)) {
                $this->pieceSvg[$pieceKey] = '';
                continue;
            }
            $raw = file_get_contents($file);
            // Extract inner content (strip outer <svg …> wrapper, keep inner elements)
            // Also scope gradient/filter IDs to avoid conflicts
            $inner = $this->extractSvgInner($raw, $pieceKey);
            $this->pieceSvg[$pieceKey] = $inner;
        }
    }

    /**
     * Strips the outer <svg> wrapper and scopes IDs to avoid conflicts when
     * multiple piece symbols are embedded in the same document.
     */
    private function extractSvgInner(string $svgContent, string $scope): string
    {
        // Remove XML declaration if present
        $svgContent = preg_replace('/<\?xml[^?]*\?>\s*/', '', $svgContent);
        // Extract content between first > and last </svg>
        $start = strpos($svgContent, '>');
        $end   = strrpos($svgContent, '</svg>');
        if ($start === false || $end === false) {
            return $svgContent;
        }
        $inner = substr($svgContent, $start + 1, $end - $start - 1);

        // Scope IDs: replace id="X" → id="piece-{scope}-X" and url(#X) → url(#piece-{scope}-X)
        $inner = preg_replace('/\bid="(\w+)"/', 'id="p-' . $scope . '-$1"', $inner);
        $inner = preg_replace('/url\(#(\w+)\)/', 'url(#p-' . $scope . '-$1)', $inner);
        $inner = preg_replace('/xlink:href="#(\w+)"/', 'xlink:href="#p-' . $scope . '-$1"', $inner);

        return $inner;
    }
}
