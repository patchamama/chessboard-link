<?php

declare(strict_types=1);

namespace App\Tests\Unit\Application\Library;

use App\Application\Library\UpdateBookCommand;
use App\Application\Library\UpdateBookHandler;
use App\Domain\Library\Book;
use App\Domain\Library\BookRepository;
use App\Domain\Library\BookStatus;
use PHPUnit\Framework\TestCase;

class UpdateBookHandlerTest extends TestCase
{
    private function makeBook(int $ownerId): Book
    {
        return new Book(10, $ownerId, 'Old Title', 'Old Author', BookStatus::Ready, '2024-01-01 00:00:00', 'Old desc');
    }

    public function testOwnerCanUpdate(): void
    {
        $book = $this->makeBook(2);

        $repo = $this->createMock(BookRepository::class);
        $repo->method('findById')->willReturn($book);
        $repo->expects($this->once())->method('update')->with(10, 'New Title', 'New Author', 'New desc');

        $handler = new UpdateBookHandler($repo);
        $handler->handle(new UpdateBookCommand(10, ownerId: 2, title: 'New Title', author: 'New Author', description: 'New desc'));
    }

    public function testNonOwnerThrowsForbiddenException(): void
    {
        $book = $this->makeBook(2);

        $repo = $this->createMock(BookRepository::class);
        $repo->method('findById')->willReturn($book);
        $repo->expects($this->never())->method('update');

        $this->expectException(\RuntimeException::class);
        $handler = new UpdateBookHandler($repo);
        $handler->handle(new UpdateBookCommand(10, ownerId: 99, title: 'Hacked', author: 'Hacker', description: ''));
    }

    public function testAdminBypassOwnershipCheck(): void
    {
        $book = $this->makeBook(2);

        $repo = $this->createMock(BookRepository::class);
        $repo->method('findById')->willReturn($book);
        $repo->expects($this->once())->method('update');

        $handler = new UpdateBookHandler($repo);
        // pass isAdmin=true
        $handler->handle(new UpdateBookCommand(10, ownerId: 99, title: 'Admin Edit', author: 'Admin', description: '', isAdmin: true));
    }
}
