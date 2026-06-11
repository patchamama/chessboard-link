<?php

declare(strict_types=1);

namespace App\Tests\Integration\Infrastructure;

use App\Domain\Library\Book;
use App\Domain\Library\BookStatus;
use App\Infrastructure\Persistence\DbalBookRepository;
use App\Tests\TestCase;

class DbalBookRepositoryTest extends TestCase
{
    private DbalBookRepository $repo;

    protected function setUp(): void
    {
        parent::setUp();
        $connection = $this->buildContainer()->get(\Doctrine\DBAL\Connection::class);
        $this->repo = new DbalBookRepository($connection);
    }

    public function testSaveAndFindReadyByOwner(): void
    {
        $book = new Book(0, 1, 'My Chess Book', 'Author A', BookStatus::Ready, '2024-01-01 00:00:00');
        $id   = $this->repo->save($book);

        $this->assertGreaterThan(0, $id);

        $found = $this->repo->findReadyByOwner(1);
        $this->assertCount(1, $found);
        $this->assertSame('My Chess Book', $found[0]->title);
        $this->assertSame(BookStatus::Ready, $found[0]->status);
    }

    public function testFindReadyByOwnerExcludesNonReadyStatuses(): void
    {
        foreach ([BookStatus::Uploaded, BookStatus::Processing, BookStatus::Failed] as $status) {
            $this->repo->save(new Book(0, 2, 'Book', 'Auth', $status, '2024-01-01 00:00:00'));
        }

        $found = $this->repo->findReadyByOwner(2);
        $this->assertCount(0, $found);
    }

    public function testFindReadyByOwnerExcludesOtherOwners(): void
    {
        $this->repo->save(new Book(0, 3, 'Owner3 Book', 'Auth', BookStatus::Ready, '2024-01-01 00:00:00'));

        $found = $this->repo->findReadyByOwner(4); // different owner
        $this->assertCount(0, $found);
    }

    public function testFindByIdReturnsBook(): void
    {
        $id   = $this->repo->save(new Book(0, 5, 'Title', 'Auth', BookStatus::Ready, '2024-01-01 00:00:00'));
        $book = $this->repo->findById($id);

        $this->assertNotNull($book);
        $this->assertSame('Title', $book->title);
    }

    public function testFindByIdReturnsNullWhenMissing(): void
    {
        $this->assertNull($this->repo->findById(9999));
    }

    public function testSavePersistsAndHydratesDescriptionRoundTrip(): void
    {
        $book = new Book(0, 1, 'Chess Tactics', 'Nezhmetdinov', BookStatus::Ready, '2024-01-01 00:00:00', 'A great tactics book');
        $id   = $this->repo->save($book);

        $found = $this->repo->findById($id);
        $this->assertNotNull($found);
        $this->assertSame('A great tactics book', $found->description);
    }

    public function testUpdateModifiesAllFields(): void
    {
        $id = $this->repo->save(new Book(0, 1, 'Old Title', 'Old Author', BookStatus::Ready, '2024-01-01 00:00:00', 'Old desc'));

        $this->repo->update($id, 'New Title', 'New Author', 'New description');

        $found = $this->repo->findById($id);
        $this->assertSame('New Title', $found->title);
        $this->assertSame('New Author', $found->author);
        $this->assertSame('New description', $found->description);
    }

    public function testFindByOwnerReturnsAllBooksForOwner(): void
    {
        $this->repo->save(new Book(0, 10, 'Book A', 'Auth', BookStatus::Ready, '2024-01-01 00:00:00'));
        $this->repo->save(new Book(0, 10, 'Book B', 'Auth', BookStatus::Uploaded, '2024-01-02 00:00:00'));
        $this->repo->save(new Book(0, 99, 'Other', 'Auth', BookStatus::Ready, '2024-01-03 00:00:00'));

        $result = $this->repo->findByOwner(10);
        $this->assertCount(2, $result);
    }

    public function testSaveAndFindChapters(): void
    {
        $bookId = $this->repo->save(new Book(0, 6, 'With Chapters', 'Auth', BookStatus::Ready, '2024-01-01 00:00:00'));

        $this->repo->saveChapter($bookId, 0, 'Intro', '<p>Hello</p>');
        $this->repo->saveChapter($bookId, 1, 'Part 1', '<p>World</p>');

        $chapters = $this->repo->findChaptersByBook($bookId);
        $this->assertCount(2, $chapters);
        $this->assertSame(0, $chapters[0]->order);
        $this->assertSame('Intro', $chapters[0]->title);

        $ch = $this->repo->findChapter($bookId, 1);
        $this->assertNotNull($ch);
        $this->assertSame('<p>World</p>', $ch->html);
    }
}
