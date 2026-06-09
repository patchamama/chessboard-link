<?php

declare(strict_types=1);

namespace App\Presentation\Diagram;

use App\Application\Diagram\Command\RegenerateDiagramCommand;
use App\Application\Diagram\RegenerateDiagramHandler;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Slim\Psr7\Factory\ResponseFactory;

final class DiagramController
{
    public function __construct(
        private readonly RegenerateDiagramHandler $regenerateHandler,
    ) {
    }

    /**
     * POST /api/diagrams/regenerate
     *
     * Body: { fen: string, filename?: string, depth?: int, exportPng?: bool }
     * Response 200: { svg: string, footer: string, png?: base64 string }
     */
    public function regenerate(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $body      = (array) ($request->getParsedBody() ?? []);
        $fenValue  = trim((string) ($body['fen'] ?? ''));
        $filename  = isset($body['filename']) ? (string) $body['filename'] : null;
        $depth     = isset($body['depth']) ? (int) $body['depth'] : 18;
        $exportPng = isset($body['exportPng']) && (bool) $body['exportPng'];

        if ($fenValue === '') {
            $response->getBody()->write(json_encode(['error' => 'Missing required field: fen']));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        $command = new RegenerateDiagramCommand($fenValue, $filename, $depth, $exportPng);
        $result  = $this->regenerateHandler->handle($command);

        $payload = [
            'svg'    => $result['svg'],
            'footer' => $result['footer'],
        ];

        if (isset($result['png'])) {
            // Return PNG as base64 so it can travel in JSON
            $payload['png'] = base64_encode($result['png']);
        }

        $response->getBody()->write(json_encode($payload));
        return $response->withStatus(200)->withHeader('Content-Type', 'application/json');
    }
}
