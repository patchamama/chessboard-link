<?php

declare(strict_types=1);

namespace App\Application\Library;

use App\Domain\Library\Book;
use App\Domain\Library\BookRepository;

final class UpdateBookHandler
{
    public function __construct(private readonly BookRepository $bookRepository)
    {
    }

    public function handle(UpdateBookCommand $command): Book
    {
        $book = $this->bookRepository->findById($command->bookId);

        if ($book === null) {
            throw new \RuntimeException('Book not found.');
        }

        if (!$command->isAdmin && $book->ownerId !== $command->ownerId) {
            throw new \RuntimeException('Forbidden: not the book owner.');
        }

        $this->bookRepository->update($command->bookId, $command->title, $command->author, $command->description);

        return new \App\Domain\Library\Book(
            $book->id,
            $book->ownerId,
            $command->title,
            $command->author,
            $book->status,
            $book->createdAt,
            $command->description,
        );
    }
}
