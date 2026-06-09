<?php

declare(strict_types=1);

namespace App\Presentation\Eval;

use App\Application\Eval\Command\EvaluateGameCommand;
use App\Application\Eval\Command\EvaluatePositionCommand;
use App\Application\Eval\EvaluateGameHandler;
use App\Application\Eval\EvaluatePositionHandler;
use App\Domain\Chess\Fen;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class EvalController
{
    public function __construct(
        private readonly EvaluatePositionHandler $positionHandler,
        private readonly EvaluateGameHandler $gameHandler,
    ) {
    }

    public function position(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $body  = (array) ($request->getParsedBody() ?? []);
        $fenStr = $body['fen'] ?? null;

        if ($fenStr === null || trim((string) $fenStr) === '') {
            $response->getBody()->write(json_encode(['error' => 'fen is required']));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        $depth = isset($body['depth']) ? (int) $body['depth'] : 0;

        $eval = $this->positionHandler->handle(
            new EvaluatePositionCommand(Fen::fromString((string) $fenStr), $depth)
        );

        $response->getBody()->write(json_encode($eval->toArray()));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function game(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $body  = (array) ($request->getParsedBody() ?? []);
        $fenStrs = $body['fens'] ?? null;

        if (!is_array($fenStrs)) {
            $response->getBody()->write(json_encode(['error' => 'fens array is required']));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        $depth = isset($body['depth']) ? (int) $body['depth'] : 0;
        $fens  = array_map(fn(string $f) => Fen::fromString($f), $fenStrs);

        $evals = $this->gameHandler->handle(new EvaluateGameCommand($fens, $depth));

        $response->getBody()->write(json_encode(array_map(fn($e) => $e->toArray(), $evals)));
        return $response->withHeader('Content-Type', 'application/json');
    }
}
