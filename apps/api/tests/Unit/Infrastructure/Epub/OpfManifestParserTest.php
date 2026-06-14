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

    public function test_cover_falls_back_to_first_image(): void
    {
        $parser = new OpfManifestParser();
        $result = $parser->parse($this->extractDir . '/OEBPS/content.opf');

        // The fixture has no explicit cover meta/properties → first image is used.
        self::assertSame('Images/g1.jpg', $result['cover']);
    }

    public function test_cover_from_meta_name_cover(): void
    {
        $opf = <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>T</dc:title>
    <meta name="cover" content="cover-img"/>
  </metadata>
  <manifest>
    <item id="cover-img" href="Images/cover.jpg" media-type="image/jpeg"/>
    <item id="other" href="Images/other.jpg" media-type="image/jpeg"/>
  </manifest>
  <spine/>
</package>
XML;
        $tmp = sys_get_temp_dir() . '/opf_cover_' . uniqid() . '.opf';
        file_put_contents($tmp, $opf);

        $result = (new OpfManifestParser())->parse($tmp);
        unlink($tmp);

        self::assertSame('Images/cover.jpg', $result['cover']);
    }

    public function test_cover_from_epub3_properties(): void
    {
        $opf = <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>T</dc:title></metadata>
  <manifest>
    <item id="other" href="Images/other.jpg" media-type="image/jpeg"/>
    <item id="cv" href="Images/the-cover.png" media-type="image/png" properties="cover-image"/>
  </manifest>
  <spine/>
</package>
XML;
        $tmp = sys_get_temp_dir() . '/opf_cover3_' . uniqid() . '.opf';
        file_put_contents($tmp, $opf);

        $result = (new OpfManifestParser())->parse($tmp);
        unlink($tmp);

        self::assertSame('Images/the-cover.png', $result['cover']);
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
