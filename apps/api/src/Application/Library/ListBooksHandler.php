<?php

declare(strict_types=1);

namespace App\Application\Library;

use App\Domain\Library\BookRepository;

final class ListBooksHandler
{
    public function __construct(
        private readonly BookRepository $books,
    ) {}

    /** @return array<array{id:int,title:string,author:string,createdAt:string}> */
    public function handle(int $ownerId): array
    {
        return array_map(
            fn($b) => [
                'id'        => $b->id,
                'title'     => $b->title,
                'author'    => $b->author,
                'createdAt' => $b->createdAt,
            ],
            $this->books->findReadyByOwner($ownerId),
        );
    }
}
