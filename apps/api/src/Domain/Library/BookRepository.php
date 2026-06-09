<?php

declare(strict_types=1);

namespace App\Domain\Library;

interface BookRepository
{
    /** @return Book[] */
    public function findReadyByOwner(int $ownerId): array;

    public function findById(int $id): ?Book;

    public function save(Book $book): int;

    /** @return Chapter[] */
    public function findChaptersByBook(int $bookId): array;

    public function findChapter(int $bookId, int $order): ?Chapter;
}
