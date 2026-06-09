<?php

declare(strict_types=1);

namespace App\Tests\Integration\Infrastructure\Chess;

use App\Domain\Chess\Fen;
use App\Infrastructure\Chess\Engine\StockfishDownloader;
use App\Infrastructure\Chess\Engine\UciStockfishEngine;
use PHPUnit\Framework\TestCase;

/**
 * Integration test — SKIPPED if no stockfish binary is available.
 * Runs locally when stockfish is installed; never breaks CI.
 */
class UciStockfishEngineTest extends TestCase
{
    private string $binaryPath;

    protected function setUp(): void
    {
        // Try system stockfish first, then storage path
        $systemBin  = trim(shell_exec('which stockfish 2>/dev/null') ?? '');
        $downloader = new StockfishDownloader(
            dirname(__DIR__, 4) . '/storage',
            fn() => PHP_OS_FAMILY,
            fn() => php_uname('m'),
        );
        $storageBin = $downloader->binaryPath();

        if ($systemBin !== '' && is_executable($systemBin)) {
            $this->binaryPath = $systemBin;
        } elseif (file_exists($storageBin) && is_executable($storageBin)) {
            $this->binaryPath = $storageBin;
        } else {
            $this->markTestSkipped('No stockfish binary available — skipping integration test.');
        }
    }

    public function test_evaluates_startpos_returns_small_advantage(): void
    {
        $engine = new UciStockfishEngine($this->binaryPath);
        $eval   = $engine->evaluate(Fen::start(), 10);

        // Start position is close to 0 — white has slight advantage, allow ±100cp
        $this->assertNotNull($eval->scoreCp);
        $this->assertNull($eval->mate);
        $this->assertGreaterThanOrEqual(-100, $eval->scoreCp);
        $this->assertLessThanOrEqual(100, $eval->scoreCp);
        $this->assertNotEmpty($eval->bestMove);
    }

    public function test_evaluates_mate_in_1(): void
    {
        // Scholar's mate position — Qh5xf7# is forced mate in 1
        $mateFen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
        $engine  = new UciStockfishEngine($this->binaryPath);
        $eval    = $engine->evaluate(Fen::fromString($mateFen), 10);

        $this->assertTrue($eval->isMate());
        $this->assertSame(1, $eval->mate);
        $this->assertSame('h5f7', $eval->bestMove);
    }
}
