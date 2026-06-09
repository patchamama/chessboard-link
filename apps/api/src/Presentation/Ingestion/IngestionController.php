<?php

declare(strict_types=1);

namespace App\Presentation\Ingestion;

use App\Application\Ingestion\Command\ParseWebsiteCommand;
use App\Application\Ingestion\Command\ProcessEpubCommand;
use App\Application\Ingestion\ParseWebsiteHandler;
use App\Application\Ingestion\ProcessEpubHandler;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class IngestionController
{
    public function __construct(
        private readonly ProcessEpubHandler  $processEpub,
        private readonly ParseWebsiteHandler $parseWebsite,
    ) {}

    public function upload(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $authUser = $request->getAttribute('auth_user');
        $ownerId  = (int) $authUser->sub;

        // Check for uploaded file first
        $files = $request->getUploadedFiles();
        if (isset($files['file']) && $files['file']->getError() === UPLOAD_ERR_OK) {
            return $this->handleEpubUpload($files['file'], $ownerId, $response);
        }

        // Check for URL in JSON body
        $body = $request->getParsedBody();
        $url  = is_array($body) ? ($body['url'] ?? null) : null;
        if ($url !== null && filter_var($url, FILTER_VALIDATE_URL)) {
            return $this->handleUrlParse($url, $ownerId, $response);
        }

        $response->getBody()->write(json_encode(['error' => 'Provide an epub file or a url']));
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    private function handleEpubUpload(
        \Psr\Http\Message\UploadedFileInterface $file,
        int $ownerId,
        ResponseInterface $response,
    ): ResponseInterface {
        // Move uploaded file to a temp location
        $tmpPath = sys_get_temp_dir() . '/upload_' . bin2hex(random_bytes(8)) . '.epub';
        $file->moveTo($tmpPath);

        try {
            $cmd    = new ProcessEpubCommand(ownerId: $ownerId, epubPath: $tmpPath);
            $bookId = $this->processEpub->handle($cmd);

            $response->getBody()->write(json_encode(['bookId' => $bookId, 'status' => 'ready']));
            return $response->withStatus(202)->withHeader('Content-Type', 'application/json');
        } catch (\Throwable $e) {
            $response->getBody()->write(json_encode(['error' => 'EPUB processing failed', 'detail' => $e->getMessage()]));
            return $response->withStatus(422)->withHeader('Content-Type', 'application/json');
        } finally {
            if (is_file($tmpPath)) {
                unlink($tmpPath);
            }
        }
    }

    private function handleUrlParse(string $url, int $ownerId, ResponseInterface $response): ResponseInterface
    {
        try {
            $cmd    = new ParseWebsiteCommand(ownerId: $ownerId, url: $url);
            $bookId = $this->parseWebsite->handle($cmd);

            $response->getBody()->write(json_encode(['bookId' => $bookId, 'status' => 'ready']));
            return $response->withStatus(202)->withHeader('Content-Type', 'application/json');
        } catch (\Throwable $e) {
            $response->getBody()->write(json_encode(['error' => 'URL parsing failed', 'detail' => $e->getMessage()]));
            return $response->withStatus(422)->withHeader('Content-Type', 'application/json');
        }
    }
}
