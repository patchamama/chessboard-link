<?php

declare(strict_types=1);

namespace App\Tests\Unit\Application\Ingestion;

use App\Application\Ingestion\Command\ProcessEpubCommand;
use App\Application\Ingestion\ProcessEpubHandler;
use App\Domain\Library\Book;
use App\Domain\Library\BookRepository;
use App\Domain\Library\BookStatus;
use App\Domain\Library\Chapter;
use App\Infrastructure\Epub\NcxTocParser;
use App\Infrastructure\Epub\OpfManifestParser;
use App\Infrastructure\Epub\ZipEpubExtractor;
use App\Tests\Fixtures\epub\EpubFixture;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\MockObject\MockObject;

final class ProcessEpubHandlerTest extends TestCase
{
    private BookRepository&MockObject $repo;
    private ZipEpubExtractor $extractor;
    private NcxTocParser $tocParser;
    private OpfManifestParser $opfParser;
    private ProcessEpubHandler $handler;

    protected function setUp(): void
    {
        $this->repo      = $this->createMock(BookRepository::class);
        $this->extractor = new ZipEpubExtractor();
        $this->tocParser = new NcxTocParser();
        $this->opfParser = new OpfManifestParser();
        $this->handler   = new ProcessEpubHandler(
            $this->repo,
            $this->extractor,
            $this->tocParser,
            $this->opfParser,
        );
    }

    public function test_valid_epub_creates_ready_book_with_two_chapters(): void
    {
        $epubPath = EpubFixture::create();
        $savedChapters = [];

        // First save (Uploaded) returns id=1; subsequent saves return same id
        $this->repo
            ->expects(self::atLeastOnce())
            ->method('save')
            ->willReturnCallback(function (Book $book) {
                return 1;
            });

        $this->repo
            ->expects(self::exactly(2))
            ->method('saveChapter')
            ->willReturnCallback(function (int $bookId, int $order, string $title, string $html) use (&$savedChapters) {
                $savedChapters[] = ['order' => $order, 'title' => $title, 'html' => $html];
                return $order;
            });

        $cmd    = new ProcessEpubCommand(ownerId: 42, epubPath: $epubPath);
        $bookId = $this->handler->handle($cmd);

        self::assertSame(1, $bookId);
        self::assertCount(2, $savedChapters);
        self::assertSame('Introduction', $savedChapters[0]['title']);
        self::assertSame('Basic Endgames', $savedChapters[1]['title']);

        unlink($epubPath);
    }

    public function test_corrupt_epub_saves_failed_status_and_throws(): void
    {
        $epubPath = EpubFixture::createCorrupt();

        $savedStatuses = [];
        $this->repo
            ->expects(self::atLeastOnce())
            ->method('save')
            ->willReturnCallback(function (Book $book) use (&$savedStatuses) {
                $savedStatuses[] = $book->status;
                return 99;
            });

        $cmd = new ProcessEpubCommand(ownerId: 42, epubPath: $epubPath);

        $this->expectException(\RuntimeException::class);
        $this->handler->handle($cmd);

        $lastStatus = end($savedStatuses);
        self::assertSame(BookStatus::Failed, $lastStatus);

        unlink($epubPath);
    }
}
