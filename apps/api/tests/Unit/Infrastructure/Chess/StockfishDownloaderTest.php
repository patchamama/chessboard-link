<?php

declare(strict_types=1);

namespace App\Tests\Unit\Infrastructure\Chess;

use App\Infrastructure\Chess\Engine\StockfishDownloader;
use PHPUnit\Framework\TestCase;

class StockfishDownloaderTest extends TestCase
{
    public function test_resolve_linux_x86_64_target(): void
    {
        $downloader = new StockfishDownloader('/tmp', fn() => 'linux', fn() => 'x86_64');

        $target = $downloader->resolveTarget();

        // Stockfish releases use "ubuntu" naming for Linux x86_64
        $this->assertStringContainsString('x86_64', $target);
        $this->assertStringNotContainsString('macos', $target);
        $this->assertStringNotContainsString('windows', $target);
    }

    public function test_resolve_macos_arm64_target(): void
    {
        $downloader = new StockfishDownloader('/tmp', fn() => 'darwin', fn() => 'arm64');

        $target = $downloader->resolveTarget();

        $this->assertStringContainsString('macos', $target);
        $this->assertStringContainsString('apple', strtolower($target));
    }

    public function test_binary_path_returns_storage_path(): void
    {
        $downloader = new StockfishDownloader('/storage', fn() => 'linux', fn() => 'x86_64');

        $path = $downloader->binaryPath();

        $this->assertStringStartsWith('/storage', $path);
        $this->assertStringContainsString('stockfish', strtolower($path));
    }

    public function test_is_available_returns_false_when_missing(): void
    {
        $downloader = new StockfishDownloader('/nonexistent/path/xyz', fn() => 'linux', fn() => 'x86_64');

        $this->assertFalse($downloader->isAvailable());
    }
}
