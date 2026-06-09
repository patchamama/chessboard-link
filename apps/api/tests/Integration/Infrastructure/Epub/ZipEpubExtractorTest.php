<?php

declare(strict_types=1);

namespace App\Tests\Integration\Infrastructure\Epub;

use App\Infrastructure\Epub\ZipEpubExtractor;
use App\Tests\Fixtures\epub\EpubFixture;
use PHPUnit\Framework\TestCase;

final class ZipEpubExtractorTest extends TestCase
{
    private ?string $extractDir = null;

    protected function tearDown(): void
    {
        if ($this->extractDir !== null && is_dir($this->extractDir)) {
            $this->rrmdir($this->extractDir);
        }
    }

    public function test_extracts_fixture_epub_to_temp_dir(): void
    {
        $epubPath = EpubFixture::create();
        $extractor = new ZipEpubExtractor();

        $this->extractDir = $extractor->extract($epubPath);

        self::assertDirectoryExists($this->extractDir);
        self::assertFileExists($this->extractDir . '/OEBPS/content.opf');
        self::assertFileExists($this->extractDir . '/OEBPS/toc.ncx');
        self::assertFileExists($this->extractDir . '/OEBPS/Text/ch1.xhtml');
        self::assertFileExists($this->extractDir . '/OEBPS/Text/ch2.xhtml');
        self::assertFileExists($this->extractDir . '/OEBPS/Images/g1.jpg');

        unlink($epubPath);
    }

    public function test_throws_on_corrupt_epub(): void
    {
        $epubPath = EpubFixture::createCorrupt();
        $extractor = new ZipEpubExtractor();

        $this->expectException(\RuntimeException::class);
        $extractor->extract($epubPath);

        unlink($epubPath);
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
