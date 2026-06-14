<?php

declare(strict_types=1);

namespace App\Tests\Unit\Application\Library;

use App\Application\Library\DeleteBookCommand;
use App\Application\Library\DeleteBookHandler;
use App\Domain\Library\Book;
use App\Domain\Library\BookRepository;
use App\Domain\Library\BookStatus;
use PHPUnit\Framework\TestCase;

class DeleteBookHandlerTest extends TestCase
{
    private function makeBook(int $ownerId): Book
    {
        return new Book(10, $ownerId, 'Title', 'Author', BookStatus::Ready, '2024-01-01 00:00:00', 'desc');
    }

    public function testOwnerCanDelete(): void
    {
        $repo = $this->createMock(BookRepository::class);
        $repo->method('findById')->willReturn($this->makeBook(2));
        $repo->expects($this->once())->method('delete')->with(10);

        $handler = new DeleteBookHandler($repo);
        $handler->handle(new DeleteBookCommand(bookId: 10, ownerId: 2));
    }

    public function testNonOwnerThrowsForbidden(): void
    {
        $repo = $this->createMock(BookRepository::class);
        $repo->method('findById')->willReturn($this->makeBook(2));
        $repo->expects($this->never())->method('delete');

        $this->expectException(\RuntimeException::class);
        $handler = new DeleteBookHandler($repo);
        $handler->handle(new DeleteBookCommand(bookId: 10, ownerId: 99));
    }

    public function testAdminBypassOwnership(): void
    {
        $repo = $this->createMock(BookRepository::class);
        $repo->method('findById')->willReturn($this->makeBook(2));
        $repo->expects($this->once())->method('delete')->with(10);

        $handler = new DeleteBookHandler($repo);
        $handler->handle(new DeleteBookCommand(bookId: 10, ownerId: 99, isAdmin: true));
    }

    public function testMissingBookThrows(): void
    {
        $repo = $this->createMock(BookRepository::class);
        $repo->method('findById')->willReturn(null);
        $repo->expects($this->never())->method('delete');

        $this->expectException(\RuntimeException::class);
        $handler = new DeleteBookHandler($repo);
        $handler->handle(new DeleteBookCommand(bookId: 404, ownerId: 2));
    }
}
