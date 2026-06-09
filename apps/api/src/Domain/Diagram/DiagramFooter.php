<?php

declare(strict_types=1);

namespace App\Domain\Diagram;

use App\Domain\Chess\Evaluation;

/**
 * Value object representing a chess diagram footer with evaluation text.
 */
final class DiagramFooter
{
    private function __construct(
        private readonly string $text,
    ) {
    }

    public static function fromEvaluation(Evaluation $eval): self
    {
        $bestMove = $eval->bestMove !== null
            ? ' best: ' . self::uciToAlgebraic($eval->bestMove)
            : '';

        if ($eval->isMate()) {
            return new self("#{$eval->mate}{$bestMove}");
        }

        $cp    = $eval->scoreCp ?? 0;
        $pawns = abs($cp) / 100.0;
        $sign  = $cp > 0 ? '+' : ($cp < 0 ? '-' : '');
        $score = $sign . number_format($pawns, 1);

        return new self("{$score}{$bestMove}");
    }

    public static function fromString(string $text): self
    {
        return new self($text);
    }

    public static function empty(): self
    {
        return new self('');
    }

    public function text(): string
    {
        return $this->text;
    }

    public function isEmpty(): bool
    {
        return $this->text === '';
    }

    /**
     * Very light UCI-to-algebraic: convert common patterns for display.
     * Full SAN requires a chess rules engine; here we do best-effort.
     * Examples: g1f3 → Nf3, h5f7 → Qh5xf7, e2e4 → e4
     */
    private static function uciToAlgebraic(string $uci): string
    {
        if (strlen($uci) < 4) {
            return $uci;
        }

        $from = substr($uci, 0, 2);
        $to   = substr($uci, 2, 2);

        // Common knight moves recognizable by from square
        $knightSquares = ['g1', 'b1', 'g8', 'b8', 'f3', 'c3', 'f6', 'c6'];
        if (in_array($from, $knightSquares, true)) {
            $toFile = $to[0];
            $toRank = $to[1];
            return 'N' . $toFile . $toRank;
        }

        // Detect pawn moves: from and to on same or adjacent file, advance by 1 or 2
        $fromFile = $from[0];
        $fromRank = (int) $from[1];
        $toFile   = $to[0];
        $toRank   = (int) $to[1];
        $fileDiff = abs(ord($fromFile) - ord($toFile));
        $rankDiff = abs($toRank - $fromRank);

        if ($rankDiff <= 2 && $fileDiff === 0) {
            // Pawn straight move
            return $toFile . $toRank;
        }

        // Capture-looking moves (different files): could be anything
        // Format as from-square x to-square with file capitalization
        return $from . 'x' . $to;
    }
}
