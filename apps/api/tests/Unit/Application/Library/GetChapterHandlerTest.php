<?php

declare(strict_types=1);

namespace App\Tests\Unit\Application\Library;

use App\Application\Library\GetChapterHandler;
use App\Domain\Library\BookRepository;
use App\Domain\Library\Chapter;
use PHPUnit\Framework\TestCase;

class GetChapterHandlerTest extends TestCase
{
    public function testReturnsChapterWithToc(): void
    {
        $ch0 = new Chapter(1, 42, 0, 'Introduction', '<p>Intro html</p>');
        $ch1 = new Chapter(2, 42, 1, 'Chapter One', '<p>Chapter 1 html</p>');

        $repo = $this->createMock(BookRepository::class);
        $repo->method('findChapter')->with(42, 0)->willReturn($ch0);
        $repo->method('findChaptersByBook')->with(42)->willReturn([$ch0, $ch1]);

        $handler = new GetChapterHandler($repo);
        $result  = $handler->handle(42, 0);

        $this->assertNotNull($result);
        $this->assertSame('Introduction', $result['title']);
        $this->assertSame('<p>Intro html</p>', $result['html']);
        $this->assertCount(2, $result['toc']);
        $this->assertSame(0, $result['toc'][0]['order']);
        $this->assertSame('Introduction', $result['toc'][0]['title']);
        $this->assertSame(1, $result['toc'][1]['order']);
        $this->assertSame('Chapter One', $result['toc'][1]['title']);
    }

    public function testReturnsNullWhenChapterNotFound(): void
    {
        $repo = $this->createMock(BookRepository::class);
        $repo->method('findChapter')->with(99, 0)->willReturn(null);

        $handler = new GetChapterHandler($repo);
        $result  = $handler->handle(99, 0);

        $this->assertNull($result);
    }
}
