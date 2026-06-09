<?php

declare(strict_types=1);

namespace App\Tests\Unit\Infrastructure\Epub;

use App\Infrastructure\Epub\OpfManifestParser;
use App\Tests\Fixtures\epub\EpubFixture;
use PHPUnit\Framework\TestCase;

final class OpfManifestParserTest extends TestCase
{
    private string $extractDir;

    protected function setUp(): void
    {
        $epubPath = EpubFixture::create();
        $zip = new \ZipArchive();
        $zip->open($epubPath);
        $this->extractDir = sys_get_temp_dir() . '/epub_opf_test_' . uniqid();
        mkdir($this->extractDir, 0777, true);
        $zip->extractTo($this->extractDir);
        $zip->close();
        unlink($epubPath);
    }

    protected function tearDown(): void
    {
        $this->rrmdir($this->extractDir);
    }

    public function test_resolves_id_href_map(): void
    {
        $parser = new OpfManifestParser();
        $result = $parser->parse($this->extractDir . '/OEBPS/content.opf');

        self::assertArrayHasKey('ch1', $result['manifest']);
        self::assertSame('Text/ch1.xhtml', $result['manifest']['ch1']);
        self::assertArrayHasKey('ch2', $result['manifest']);
        self::assertSame('Text/ch2.xhtml', $result['manifest']['ch2']);
        self::assertArrayHasKey('img1', $result['manifest']);
        self::assertSame('Images/g1.jpg', $result['manifest']['img1']);
    }

    public function test_spine_order_matches_content_opf(): void
    {
        $parser = new OpfManifestParser();
        $result = $parser->parse($this->extractDir . '/OEBPS/content.opf');

        self::assertSame(['ch1', 'ch2'], $result['spine']);
    }

    public function test_image_list_contains_g1(): void
    {
        $parser = new OpfManifestParser();
        $result = $parser->parse($this->extractDir . '/OEBPS/content.opf');

        self::assertContains('Images/g1.jpg', $result['images']);
    }

    public function test_title_and_author_extracted(): void
    {
        $parser = new OpfManifestParser();
        $result = $parser->parse($this->extractDir . '/OEBPS/content.opf');

        self::assertSame('Chess Fundamentals', $result['title']);
        self::assertSame('Capablanca', $result['author']);
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
