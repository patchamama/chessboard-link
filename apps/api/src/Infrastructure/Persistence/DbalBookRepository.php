<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence;

use App\Domain\Library\Book;
use App\Domain\Library\BookRepository;
use App\Domain\Library\BookStatus;
use App\Domain\Library\Chapter;
use Doctrine\DBAL\Connection;

final class DbalBookRepository implements BookRepository
{
    public function __construct(private readonly Connection $connection) {}

    public function findReadyByOwner(int $ownerId): array
    {
        $rows = $this->connection->fetchAllAssociative(
            'SELECT * FROM books WHERE owner_id = ? AND status = ? ORDER BY created_at DESC',
            [$ownerId, BookStatus::Ready->value],
        );
        return array_map($this->hydrate(...), $rows);
    }

    public function findById(int $id): ?Book
    {
        $row = $this->connection->fetchAssociative(
            'SELECT * FROM books WHERE id = ?',
            [$id],
        );
        return $row ? $this->hydrate($row) : null;
    }

    public function save(Book $book): int
    {
        if ($book->id === 0) {
            $this->connection->insert('books', [
                'owner_id'   => $book->ownerId,
                'title'      => $book->title,
                'author'     => $book->author,
                'status'     => $book->status->value,
                'created_at' => $book->createdAt,
            ]);
            return (int) $this->connection->lastInsertId();
        }

        $this->connection->update('books', [
            'title'      => $book->title,
            'author'     => $book->author,
            'status'     => $book->status->value,
        ], ['id' => $book->id]);

        return $book->id;
    }

    public function findChaptersByBook(int $bookId): array
    {
        $rows = $this->connection->fetchAllAssociative(
            'SELECT * FROM chapters WHERE book_id = ? ORDER BY ord ASC',
            [$bookId],
        );
        return array_map($this->hydrateChapter(...), $rows);
    }

    public function findChapter(int $bookId, int $order): ?Chapter
    {
        $row = $this->connection->fetchAssociative(
            'SELECT * FROM chapters WHERE book_id = ? AND ord = ?',
            [$bookId, $order],
        );
        return $row ? $this->hydrateChapter($row) : null;
    }

    public function saveChapter(int $bookId, int $order, string $title, string $html): int
    {
        $this->connection->insert('chapters', [
            'book_id' => $bookId,
            'ord'     => $order,
            'title'   => $title,
            'html'    => $html,
        ]);
        return (int) $this->connection->lastInsertId();
    }

    private function hydrate(array $row): Book
    {
        return new Book(
            id:        (int) $row['id'],
            ownerId:   (int) $row['owner_id'],
            title:     (string) $row['title'],
            author:    (string) $row['author'],
            status:    BookStatus::from($row['status']),
            createdAt: (string) $row['created_at'],
        );
    }

    private function hydrateChapter(array $row): Chapter
    {
        return new Chapter(
            id:     (int) $row['id'],
            bookId: (int) $row['book_id'],
            order:  (int) $row['ord'],
            title:  (string) $row['title'],
            html:   (string) $row['html'],
        );
    }
}
