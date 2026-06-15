<?php

declare(strict_types=1);

namespace App\Presentation\Trainer;

use App\Application\Trainer\AddTrainerLineCommand;
use App\Application\Trainer\AddTrainerLineHandler;
use App\Application\Trainer\DeleteTrainerLineCommand;
use App\Application\Trainer\DeleteTrainerLineHandler;
use App\Application\Trainer\ListTrainerLinesHandler;
use App\Application\Trainer\ReviewTrainerLineCommand;
use App\Application\Trainer\ReviewTrainerLineHandler;
use App\Domain\Trainer\ReviewGrade;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class TrainerController
{
    public function __construct(
        private readonly AddTrainerLineHandler $addHandler,
        private readonly ListTrainerLinesHandler $listHandler,
        private readonly ReviewTrainerLineHandler $reviewHandler,
        private readonly DeleteTrainerLineHandler $deleteHandler,
    ) {
    }

    public function list(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $userId = (int) $request->getAttribute('auth_user')->sub;
        $lines  = $this->listHandler->handle($userId);

        return $this->json($response, array_map(fn($l) => $l->toArray(), $lines));
    }

    public function add(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $userId = (int) $request->getAttribute('auth_user')->sub;
        $body   = (array) ($request->getParsedBody() ?? []);

        $startFen = trim((string) ($body['startFen'] ?? ''));
        $moves    = $body['movesUci'] ?? [];
        if ($startFen === '' || !is_array($moves) || $moves === []) {
            return $this->json($response, ['error' => 'startFen and movesUci are required'], 400);
        }

        $line = $this->addHandler->handle(new AddTrainerLineCommand(
            userId:      $userId,
            bookId:      isset($body['bookId']) ? (int) $body['bookId'] : null,
            name:        (string) ($body['name'] ?? ''),
            startFen:    $startFen,
            movesUci:    array_values(array_map('strval', $moves)),
            orientation: ($body['orientation'] ?? 'white') === 'black' ? 'black' : 'white',
        ));

        return $this->json($response, $line->toArray(), 201);
    }

    public function review(ServerRequestInterface $request, ResponseInterface $response, int $id): ResponseInterface
    {
        $userId = (int) $request->getAttribute('auth_user')->sub;
        $body   = (array) ($request->getParsedBody() ?? []);

        try {
            $grade = ReviewGrade::fromString((string) ($body['grade'] ?? ''));
        } catch (\ValueError) {
            return $this->json($response, ['error' => 'Invalid grade'], 400);
        }

        try {
            $line = $this->reviewHandler->handle(new ReviewTrainerLineCommand($id, $userId, $grade));
        } catch (\RuntimeException $e) {
            return $this->mapError($response, $e);
        }

        return $this->json($response, $line->toArray());
    }

    public function delete(ServerRequestInterface $request, ResponseInterface $response, int $id): ResponseInterface
    {
        $userId = (int) $request->getAttribute('auth_user')->sub;

        try {
            $this->deleteHandler->handle(new DeleteTrainerLineCommand($id, $userId));
        } catch (\RuntimeException $e) {
            return $this->mapError($response, $e);
        }

        return $this->json($response, ['ok' => true]);
    }

    private function mapError(ResponseInterface $response, \RuntimeException $e): ResponseInterface
    {
        $status = str_contains($e->getMessage(), 'Forbidden') ? 403 : 404;
        return $this->json($response, ['error' => $e->getMessage()], $status);
    }

    /** @param mixed $payload */
    private function json(ResponseInterface $response, $payload, int $status = 200): ResponseInterface
    {
        $response->getBody()->write(json_encode($payload));
        return $response->withStatus($status)->withHeader('Content-Type', 'application/json');
    }
}
