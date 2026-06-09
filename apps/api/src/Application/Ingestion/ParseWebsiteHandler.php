<?php

declare(strict_types=1);

namespace App\Application\Ingestion;

use App\Application\Ingestion\Command\ParseWebsiteCommand;
use App\Application\Ingestion\Port\HtmlFetcher;
use App\Domain\Library\Book;
use App\Domain\Library\BookRepository;
use App\Domain\Library\BookStatus;
use App\Infrastructure\Web\ReadabilityExtractor;

final class ParseWebsiteHandler
{
    public function __construct(
        private readonly BookRepository      $books,
        private readonly HtmlFetcher         $fetcher,
        private readonly ReadabilityExtractor $readability,
    ) {}

    public function handle(ParseWebsiteCommand $cmd): int
    {
        $now = (new \DateTimeImmutable())->format('Y-m-d H:i:s');

        // 1. Persist Uploaded placeholder
        $bookId = $this->books->save(new Book(
            id:        0,
            ownerId:   $cmd->ownerId,
            title:     $cmd->url,
            author:    '',
            status:    BookStatus::Uploaded,
            createdAt: $now,
        ));

        // 2. Fetch HTML
        $html    = $this->fetcher->fetch($cmd->url);
        $content = $this->readability->extract($html);

        // 3. Save single chapter
        $this->books->saveChapter($bookId, 1, $cmd->url, $content);

        // 4. Mark Ready
        $this->books->save(new Book(
            id:        $bookId,
            ownerId:   $cmd->ownerId,
            title:     $cmd->url,
            author:    '',
            status:    BookStatus::Ready,
            createdAt: $now,
        ));

        return $bookId;
    }
}
