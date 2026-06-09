<?php

declare(strict_types=1);

namespace App\Application\Ingestion;

use App\Application\Ingestion\Command\ProcessEpubCommand;
use App\Application\Ingestion\Port\EpubExtractor;
use App\Domain\Library\Book;
use App\Domain\Library\BookRepository;
use App\Domain\Library\BookStatus;
use App\Infrastructure\Epub\NcxTocParser;
use App\Infrastructure\Epub\OpfManifestParser;

/**
 * Processes an uploaded EPUB file:
 *   Uploaded → Processing → (parse) → Ready
 *                                   → Failed (on error)
 *
 * Synchronous for now; the state transitions are modelled explicitly so a
 * future queue worker can drop in without changing the domain logic.
 */
final class ProcessEpubHandler
{
    public function __construct(
        private readonly BookRepository    $books,
        private readonly EpubExtractor     $extractor,
        private readonly NcxTocParser      $tocParser,
        private readonly OpfManifestParser $opfParser,
    ) {}

    public function handle(ProcessEpubCommand $cmd): int
    {
        // 1. Persist as Uploaded
        $book = new Book(
            id:        0,
            ownerId:   $cmd->ownerId,
            title:     '',
            author:    '',
            status:    BookStatus::Uploaded,
            createdAt: (new \DateTimeImmutable())->format('Y-m-d H:i:s'),
        );
        $bookId = $this->books->save($book);

        try {
            // 2. Move to Processing
            $this->books->save(new Book(
                id:        $bookId,
                ownerId:   $cmd->ownerId,
                title:     '',
                author:    '',
                status:    BookStatus::Processing,
                createdAt: $book->createdAt,
            ));

            // 3. Extract archive
            $extractDir = $this->extractor->extract($cmd->epubPath);

            // 4. Locate content.opf via META-INF/container.xml
            $opfPath = $this->resolveOpfPath($extractDir);

            // 5. Parse manifest + metadata
            $opf     = $this->opfParser->parse($opfPath);
            $opfDir  = dirname($opfPath);

            // 6. Parse TOC
            $ncxHref = $opf['manifest']['ncx'] ?? null;
            $ncxPath = $ncxHref ? $opfDir . '/' . $ncxHref : $opfDir . '/toc.ncx';
            $tocEntries = is_file($ncxPath) ? $this->tocParser->parse($ncxPath) : [];

            // 7. Build chapters from spine + xhtml files
            $order = 1;
            foreach ($opf['spine'] as $idref) {
                $href   = $opf['manifest'][$idref] ?? null;
                if ($href === null) {
                    continue;
                }
                $xhtmlPath = $opfDir . '/' . $href;
                $html      = is_file($xhtmlPath) ? file_get_contents($xhtmlPath) : '';

                // Find matching TOC title
                $title = "Chapter $order";
                foreach ($tocEntries as $entry) {
                    if (trim($entry->href, '/') === trim($href, '/')) {
                        $title = $entry->title;
                        break;
                    }
                }

                $this->books->saveChapter($bookId, $order, $title, (string) $html);
                $order++;
            }

            // 8. Persist as Ready with real title/author
            $this->books->save(new Book(
                id:        $bookId,
                ownerId:   $cmd->ownerId,
                title:     $opf['title'] ?: 'Untitled',
                author:    $opf['author'] ?: 'Unknown',
                status:    BookStatus::Ready,
                createdAt: $book->createdAt,
            ));

            // 9. Cleanup extracted dir
            $this->rrmdir($extractDir);

            return $bookId;
        } catch (\Throwable $e) {
            // Transition to Failed
            $this->books->save(new Book(
                id:        $bookId,
                ownerId:   $cmd->ownerId,
                title:     '',
                author:    '',
                status:    BookStatus::Failed,
                createdAt: $book->createdAt,
            ));
            throw new \RuntimeException('EPUB processing failed: ' . $e->getMessage(), 0, $e);
        }
    }

    private function resolveOpfPath(string $extractDir): string
    {
        $containerXml = $extractDir . '/META-INF/container.xml';
        if (is_file($containerXml)) {
            $dom = new \DOMDocument();
            @$dom->load($containerXml);
            $elements = $dom->getElementsByTagName('rootfile');
            if ($elements->length > 0) {
                /** @var \DOMElement $rootfile */
                $rootfile = $elements->item(0);
                $fullPath = $rootfile->getAttribute('full-path');
                if ($fullPath !== '') {
                    return $extractDir . '/' . $fullPath;
                }
            }
        }
        // Fallback: look for any .opf file
        $opfFiles = glob($extractDir . '/**/*.opf') ?: glob($extractDir . '/*.opf') ?: [];
        if (!empty($opfFiles)) {
            return $opfFiles[0];
        }
        throw new \RuntimeException("Cannot find content.opf in EPUB at $extractDir");
    }

    private function rrmdir(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        foreach (scandir($dir) as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }
            $path = "$dir/$item";
            is_dir($path) ? $this->rrmdir($path) : unlink($path);
        }
        rmdir($dir);
    }
}
