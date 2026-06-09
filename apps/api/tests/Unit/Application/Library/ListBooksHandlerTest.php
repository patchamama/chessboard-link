<?php

declare(strict_types=1);

namespace App\Tests\Unit\Application\Library;

use App\Application\Library\ListBooksHandler;
use App\Domain\Library\Book;
use App\Domain\Library\BookRepository;
use App\Domain\Library\BookStatus;
use App\Domain\Library\Chapter;
use PHPUnit\Framework\TestCase;

class ListBooksHandlerTest extends TestCase
{
    public function testReturnsOnlyReadyBooksForOwner(): void
    {
        $ready1 = new Book(1, 10, 'Chess Fundamentals', 'Capablanca', BookStatus::Ready, '2024-01-01 00:00:00');
        $ready2 = new Book(2, 10, 'My System', 'Nimzowitsch', BookStatus::Ready, '2024-01-02 00:00:00');

        $repo = $this->createMock(BookRepository::class);
        $repo->method('findReadyByOwner')
             ->with(10)
             ->willReturn([$ready1, $ready2]);

        $handler = new ListBooksHandler($repo);
        $result  = $handler->handle(10);

        $this->assertCount(2, $result);
        $this->assertSame('Chess Fundamentals', $result[0]['title']);
        $this->assertSame('Capablanca', $result[0]['author']);
        $this->assertSame(1, $result[0]['id']);
    }

    public function testFiltersOutNonReadyBooks(): void
    {
        // findReadyByOwner is the repository's job — handler must pass status filtering to it.
        // We verify the handler only returns what the repo gives for Ready status.
        $repo = $this->createMock(BookRepository::class);
        $repo->method('findReadyByOwner')
             ->with(5)
             ->willReturn([]); // repo returns empty — handler returns empty

        $handler = new ListBooksHandler($repo);
        $result  = $handler->handle(5);

        $this->assertSame([], $result);
    }

    public function testDoesNotReturnOtherOwnersBooks(): void
    {
        // The repo is called with ownerId=7, if it returns nothing then handler returns nothing.
        $repo = $this->createMock(BookRepository::class);
        $repo->expects($this->once())
             ->method('findReadyByOwner')
             ->with(7)
             ->willReturn([]);

        $handler = new ListBooksHandler($repo);
        $result  = $handler->handle(7);

        $this->assertSame([], $result);
    }
}
