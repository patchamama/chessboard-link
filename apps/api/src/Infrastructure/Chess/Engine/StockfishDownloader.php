<?php

declare(strict_types=1);

namespace App\Infrastructure\Chess\Engine;

/**
 * Resolves and downloads the Stockfish binary for the current platform.
 * URL resolver and OS/arch detectors are injectable for testability.
 */
final class StockfishDownloader
{
    /** @param callable(): string $osResolver   Returns OS family (linux, darwin, windows) */
    /** @param callable(): string $archResolver Returns CPU arch (x86_64, arm64, aarch64) */
    public function __construct(
        private readonly string $storageDir,
        private readonly mixed $osResolver = null,
        private readonly mixed $archResolver = null,
    ) {
    }

    public function resolveTarget(): string
    {
        $os   = strtolower(($this->osResolver)());
        $arch = strtolower(($this->archResolver)());

        if (str_contains($os, 'darwin') || str_contains($os, 'mac')) {
            $archSuffix = str_contains($arch, 'arm') ? 'apple-silicon' : 'x86-64-modern';
            return "stockfish-macos-{$archSuffix}";
        }

        if (str_contains($os, 'win')) {
            return 'stockfish-windows-x86-64-modern';
        }

        // Linux default
        $archSuffix = (str_contains($arch, 'arm') || str_contains($arch, 'aarch'))
            ? 'armv8'
            : 'x86_64-modern';
        return "stockfish-ubuntu-x86_64-{$archSuffix}";
    }

    public function binaryPath(): string
    {
        return rtrim($this->storageDir, '/') . '/stockfish';
    }

    public function isAvailable(): bool
    {
        $path = $this->binaryPath();
        return file_exists($path) && is_executable($path);
    }

    /**
     * Download the binary to storageDir/stockfish.
     * Throws RuntimeException on failure.
     */
    public function download(): void
    {
        $target = $this->resolveTarget();
        // Latest Stockfish release from GitHub
        $url = "https://github.com/official-stockfish/Stockfish/releases/latest/download/{$target}.tar";

        if (!is_dir($this->storageDir)) {
            mkdir($this->storageDir, 0755, true);
        }

        $tmpTar = $this->storageDir . '/stockfish.tar';
        $result = file_put_contents($tmpTar, fopen($url, 'r'));
        if ($result === false) {
            throw new \RuntimeException("Failed to download Stockfish from {$url}");
        }

        // Extract binary
        $tmpDir = $this->storageDir . '/stockfish_tmp';
        shell_exec("mkdir -p {$tmpDir} && tar -xf " . escapeshellarg($tmpTar) . " -C " . escapeshellarg($tmpDir));
        $bins = glob("{$tmpDir}/*/stockfish") ?: glob("{$tmpDir}/stockfish*");
        if (empty($bins)) {
            throw new \RuntimeException('Stockfish binary not found in downloaded archive.');
        }
        copy($bins[0], $this->binaryPath());
        chmod($this->binaryPath(), 0755);

        // Cleanup
        shell_exec("rm -rf " . escapeshellarg($tmpTar) . " " . escapeshellarg($tmpDir));
    }
}
