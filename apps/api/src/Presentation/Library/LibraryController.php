<?php

declare(strict_types=1);

namespace App\Presentation\Library;

use App\Application\Library\GetChapterHandler;
use App\Application\Library\ListBooksHandler;
use App\Application\Library\SetLastReadBookCommand;
use App\Application\Library\SetLastReadBookHandler;
use App\Application\Library\UpdateBookCommand;
use App\Application\Library\UpdateBookHandler;
use App\Domain\Auth\Role;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class LibraryController
{
    public function __construct(
        private readonly ListBooksHandler      $listBooks,
        private readonly GetChapterHandler     $getChapter,
        private readonly UpdateBookHandler     $updateBook,
        private readonly SetLastReadBookHandler $setLastReadBook,
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

    public function updateBook(ServerRequestInterface $request, ResponseInterface $response, int $id): ResponseInterface
    {
        $authUser  = $request->getAttribute('auth_user');
        $ownerId   = (int) $authUser->sub;
        $isAdmin   = isset($authUser->role) && $authUser->role === Role::Admin->value;
        $body      = (array) json_decode((string) $request->getBody(), true);
        $title       = $body['title'] ?? '';
        $author      = $body['author'] ?? '';
        $description = $body['description'] ?? '';

        // If partial update: load existing book to fill missing fields
        // For simplicity, require all fields or use '' as default
        try {
            $book = $this->updateBook->handle(new UpdateBookCommand(
                bookId:      $id,
                ownerId:     $ownerId,
                title:       $title,
                author:      $author,
                description: $description,
                isAdmin:     $isAdmin,
            ));
        } catch (\RuntimeException $e) {
            $msg = $e->getMessage();
            if (str_contains($msg, 'Forbidden') || str_contains($msg, 'not the book owner')) {
                $response->getBody()->write(json_encode(['error' => $msg]));
                return $response->withStatus(403)->withHeader('Content-Type', 'application/json');
            }
            $response->getBody()->write(json_encode(['error' => $msg]));
            return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
        }

        $response->getBody()->write(json_encode([
            'id'          => $book->id,
            'title'       => $book->title,
            'author'      => $book->author,
            'description' => $book->description,
        ]));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function touch(ServerRequestInterface $request, ResponseInterface $response, int $id): ResponseInterface
    {
        $authUser = $request->getAttribute('auth_user');
        $userId   = (int) $authUser->sub;

        $this->setLastReadBook->handle(new SetLastReadBookCommand(userId: $userId, bookId: $id));

        $response->getBody()->write(json_encode(['ok' => true]));
        return $response->withHeader('Content-Type', 'application/json');
    }
}
