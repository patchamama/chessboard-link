<?php

declare(strict_types=1);

namespace App\Infrastructure\Chess\Engine;

/**
 * Manages a long-lived Stockfish process over stdio using proc_open.
 * Speaks UCI protocol.
 */
final class StockfishProcess
{
    /** @var resource */
    private $process;
    /** @var resource */
    private $stdin;
    /** @var resource */
    private $stdout;

    public function __construct(private readonly string $binaryPath)
    {
    }

    public function start(): void
    {
        $descriptors = [
            0 => ['pipe', 'r'],  // stdin
            1 => ['pipe', 'w'],  // stdout
            2 => ['pipe', 'w'],  // stderr (ignored)
        ];

        $pipes = [];
        $this->process = proc_open($this->binaryPath, $descriptors, $pipes);

        if ($this->process === false) {
            throw new \RuntimeException("Failed to start Stockfish process: {$this->binaryPath}");
        }

        $this->stdin  = $pipes[0];
        $this->stdout = $pipes[1];

        stream_set_blocking($this->stdout, false);

        $this->send('uci');
        $this->waitFor('uciok');
        $this->send('isready');
        $this->waitFor('readyok');
    }

    public function send(string $command): void
    {
        fwrite($this->stdin, $command . "\n");
    }

    /**
     * Collect all output lines until a line starting with $marker is received.
     *
     * @return string[]
     */
    public function readUntil(string $marker): array
    {
        $lines = [];
        stream_set_blocking($this->stdout, true);

        while (!feof($this->stdout)) {
            $line = fgets($this->stdout);
            if ($line === false) {
                break;
            }
            $line    = trim($line);
            $lines[] = $line;
            if (str_starts_with($line, $marker)) {
                break;
            }
        }

        stream_set_blocking($this->stdout, false);
        return $lines;
    }

    public function stop(): void
    {
        if (isset($this->stdin)) {
            fwrite($this->stdin, "quit\n");
            fclose($this->stdin);
        }
        if (isset($this->stdout)) {
            fclose($this->stdout);
        }
        if (isset($this->process)) {
            proc_close($this->process);
        }
    }

    private function waitFor(string $marker): void
    {
        stream_set_blocking($this->stdout, true);
        while (!feof($this->stdout)) {
            $line = fgets($this->stdout);
            if ($line !== false && str_starts_with(trim($line), $marker)) {
                break;
            }
        }
        stream_set_blocking($this->stdout, false);
    }
}
