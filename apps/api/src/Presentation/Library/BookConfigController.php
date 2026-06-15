<?php

declare(strict_types=1);

namespace App\Presentation\Library;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

/**
 * Per-book custom rendering configuration, stored as a JSON file
 * (book.<bookId>.json) under the storage directory. Like notes, the config
 * carries no domain invariants, so no model or DB row is needed.
 *
 * Reading is open to any approved user (the reader needs it to render);
 * writing is gated to admins by RequireAdminMiddleware on the route.
 */
final class BookConfigController
{
    public function __construct(
        private readonly string $storageDir,
    ) {}

    /** The default config returned when a book has no saved file yet. */
    public static function defaults(): array
    {
        return [
            'version' => 1,
            'headingSpans' => ['h2' => true, 'h3' => true, 'h4' => true, 'h5' => true],
            'barClass' => ['name' => 'barra', 'asHr' => true],
            'moveLineIndent' => ['zeroIndent' => true],
            'extraCss' => '',
        ];
    }

    public function get(ServerRequestInterface $request, ResponseInterface $response, int $id): ResponseInterface
    {
        $file = $this->fileFor($id);

        $config = self::defaults();
        if (is_file($file)) {
            $saved = json_decode((string) file_get_contents($file), true);
            if (is_array($saved)) {
                // Merge saved over defaults so a config saved before a key existed
                // still returns that key with its default.
                $config = array_replace_recursive($config, $saved);
            }
        }

        $response->getBody()->write(json_encode($config));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function save(ServerRequestInterface $request, ResponseInterface $response, int $id): ResponseInterface
    {
        $body = json_decode((string) $request->getBody(), true);
        if (!is_array($body)) {
            $response->getBody()->write(json_encode(['error' => 'Invalid config body']));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        // Normalise over defaults so the stored file is always complete & valid.
        $config = array_replace_recursive(self::defaults(), $body);
        $config['version'] = 1;

        $dir = $this->configDir();
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }

        // Atomic write: temp file + rename, so a concurrent read never sees a partial file.
        $file = $this->fileFor($id);
        $tmp  = $file . '.' . bin2hex(random_bytes(4)) . '.tmp';
        if (file_put_contents($tmp, json_encode($config, JSON_PRETTY_PRINT)) === false || !@rename($tmp, $file)) {
            @unlink($tmp);
            $response->getBody()->write(json_encode(['error' => 'Failed to save book config']));
            return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
        }

        $response->getBody()->write(json_encode(['ok' => true, 'config' => $config]));
        return $response->withHeader('Content-Type', 'application/json');
    }

    private function configDir(): string
    {
        return rtrim($this->storageDir, '/') . '/book-config';
    }

    /** bookId is cast to int by the caller, so the filename can never traverse. */
    private function fileFor(int $bookId): string
    {
        return $this->configDir() . '/book.' . $bookId . '.json';
    }
}
