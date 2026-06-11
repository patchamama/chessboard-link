<?php

declare(strict_types=1);

namespace App\Tests\Unit\Application\Admin;

use App\Application\Admin\GetUserBooksHandler;
use App\Domain\Library\Book;
use App\Domain\Library\BookRepository;
use App\Domain\Library\BookStatus;
use PHPUnit\Framework\TestCase;

class GetUserBooksHandlerTest extends TestCase
{
    public function testReturnsBookListForOwner(): void
    {
        $book1 = new Book(1, 5, 'Chess Tactics', 'Nezhmetdinov', BookStatus::Ready, '2024-01-01 00:00:00');
        $book2 = new Book(2, 5, 'My Endgames', 'Capablanca', BookStatus::Ready, '2024-01-02 00:00:00');

        $repo = $this->createMock(BookRepository::class);
        $repo->method('findByOwner')->with(5)->willReturn([$book1, $book2]);

        $handler = new GetUserBooksHandler($repo);
        $result = $handler->handle(5);

        $this->assertCount(2, $result);
        $this->assertSame(1, $result[0]['id']);
        $this->assertSame('Chess Tactics', $result[0]['title']);
        $this->assertSame('Nezhmetdinov', $result[0]['author']);
    }
}
