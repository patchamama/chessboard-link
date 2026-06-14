<?php

declare(strict_types=1);

namespace App\Application\Library;

use App\Domain\Library\BookRepository;

final class DeleteBookHandler
{
    public function __construct(private readonly BookRepository $bookRepository)
    {
    }

    public function handle(DeleteBookCommand $command): void
    {
        $book = $this->bookRepository->findById($command->bookId);

        if ($book === null) {
            throw new \RuntimeException('Book not found.');
        }

        if (!$command->isAdmin && $book->ownerId !== $command->ownerId) {
            throw new \RuntimeException('Forbidden: not the book owner.');
        }

        $this->bookRepository->delete($command->bookId);
    }
}
