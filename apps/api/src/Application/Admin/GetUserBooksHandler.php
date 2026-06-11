<?php

declare(strict_types=1);

namespace App\Application\Admin;

use App\Domain\Library\BookRepository;

final class GetUserBooksHandler
{
    public function __construct(private readonly BookRepository $bookRepository)
    {
    }

    public function handle(int $ownerId): array
    {
        return array_map(fn($b) => [
            'id'     => $b->id,
            'title'  => $b->title,
            'author' => $b->author,
        ], $this->bookRepository->findByOwner($ownerId));
    }
}
