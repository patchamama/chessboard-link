<?php

declare(strict_types=1);

namespace App\Domain\Library;

interface BookRepository
{
    /** @return Book[] */
    public function findReadyByOwner(int $ownerId): array;

    public function findById(int $id): ?Book;

    /** @return Book[] */
    public function findByOwner(int $ownerId): array;

    public function update(int $id, string $title, string $author, string $description): void;

    /** Deletes a book and all of its chapters. */
    public function delete(int $id): void;

    public function save(Book $book): int;

    public function saveChapter(int $bookId, int $order, string $title, string $html): int;

    /** @return Chapter[] */
    public function findChaptersByBook(int $bookId): array;

    public function findChapter(int $bookId, int $order): ?Chapter;
}
