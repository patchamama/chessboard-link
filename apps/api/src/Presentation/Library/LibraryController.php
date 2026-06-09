<?php

declare(strict_types=1);

namespace App\Presentation\Library;

use App\Application\Library\GetChapterHandler;
use App\Application\Library\ListBooksHandler;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class LibraryController
{
    public function __construct(
        private readonly ListBooksHandler  $listBooks,
        private readonly GetChapterHandler $getChapter,
    ) {}

    public function books(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $authUser = $request->getAttribute('auth_user');
        $userId   = (int) $authUser->sub;
        $books  = $this->listBooks->handle($userId);

        $response->getBody()->write(json_encode($books));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function chapter(
        ServerRequestInterface $request,
        ResponseInterface $response,
        int $id,
        int $n,
    ): ResponseInterface {
        $result = $this->getChapter->handle($id, $n);

        if ($result === null) {
            $response->getBody()->write(json_encode(['error' => 'Not found']));
            return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
        }

        $response->getBody()->write(json_encode($result));
        return $response->withHeader('Content-Type', 'application/json');
    }
}
