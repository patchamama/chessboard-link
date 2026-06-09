<?php

declare(strict_types=1);

namespace App\Tests\Unit\Application\Ingestion;

use App\Application\Ingestion\Command\ParseWebsiteCommand;
use App\Application\Ingestion\ParseWebsiteHandler;
use App\Application\Ingestion\Port\HtmlFetcher;
use App\Domain\Library\Book;
use App\Domain\Library\BookRepository;
use App\Domain\Library\BookStatus;
use App\Infrastructure\Web\ReadabilityExtractor;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\MockObject\MockObject;

final class ParseWebsiteHandlerTest extends TestCase
{
    private BookRepository&MockObject $repo;
    private HtmlFetcher&MockObject    $fetcher;
    private ReadabilityExtractor      $readability;
    private ParseWebsiteHandler       $handler;

    protected function setUp(): void
    {
        $this->repo        = $this->createMock(BookRepository::class);
        $this->fetcher     = $this->createMock(HtmlFetcher::class);
        $this->readability = new ReadabilityExtractor();
        $this->handler     = new ParseWebsiteHandler(
            $this->repo,
            $this->fetcher,
            $this->readability,
        );
    }

    public function test_creates_single_chapter_ready_book_from_url(): void
    {
        $sampleHtml = <<<HTML
<!DOCTYPE html>
<html>
<head><title>Chess Tactics</title></head>
<body>
  <nav>Site navigation</nav>
  <script>var x = 1;</script>
  <main>
    <article>
      <h1>Chess Tactics</h1>
      <p>Double attacks are powerful.</p>
    </article>
  </main>
</body>
</html>
HTML;

        $this->fetcher
            ->expects(self::once())
            ->method('fetch')
            ->with('https://example.com/chess-tactics')
            ->willReturn($sampleHtml);

        $savedBook     = null;
        $savedChapters = [];

        $this->repo
            ->expects(self::atLeastOnce())
            ->method('save')
            ->willReturnCallback(function (Book $book) use (&$savedBook) {
                $savedBook = $book;
                return 5;
            });

        $this->repo
            ->expects(self::once())
            ->method('saveChapter')
            ->willReturnCallback(function (int $bookId, int $order, string $title, string $html) use (&$savedChapters) {
                $savedChapters[] = ['bookId' => $bookId, 'order' => $order, 'title' => $title, 'html' => $html];
                return 1;
            });

        $cmd    = new ParseWebsiteCommand(ownerId: 7, url: 'https://example.com/chess-tactics');
        $bookId = $this->handler->handle($cmd);

        self::assertSame(5, $bookId);
        self::assertCount(1, $savedChapters);

        // The readable text should NOT contain nav or script content
        self::assertStringNotContainsString('Site navigation', $savedChapters[0]['html']);
        self::assertStringNotContainsString('var x = 1', $savedChapters[0]['html']);
        self::assertStringContainsString('Double attacks', $savedChapters[0]['html']);
    }

    public function test_final_book_status_is_ready(): void
    {
        $this->fetcher->method('fetch')->willReturn('<html><body><main><p>content</p></main></body></html>');

        $savedStatuses = [];
        $this->repo
            ->method('save')
            ->willReturnCallback(function (Book $book) use (&$savedStatuses) {
                $savedStatuses[] = $book->status;
                return 1;
            });
        $this->repo->method('saveChapter')->willReturn(1);

        $cmd = new ParseWebsiteCommand(ownerId: 1, url: 'https://example.com/page');
        $this->handler->handle($cmd);

        self::assertSame(BookStatus::Ready, end($savedStatuses));
    }
}
