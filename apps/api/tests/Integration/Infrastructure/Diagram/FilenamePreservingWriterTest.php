<?php

declare(strict_types=1);

namespace App\Tests\Integration\Infrastructure\Diagram;

use App\Infrastructure\Diagram\FilenamePreservingWriter;
use PHPUnit\Framework\TestCase;
use ZipArchive;

final class FilenamePreservingWriterTest extends TestCase
{
    private string $tempEpub;

    protected function setUp(): void
    {
        $this->tempEpub = sys_get_temp_dir() . '/test_epub_' . uniqid() . '.epub';
        $this->createFixtureEpub($this->tempEpub);
    }

    protected function tearDown(): void
    {
        @unlink($this->tempEpub);
    }

    public function test_replaces_image_at_same_internal_path(): void
    {
        $writer   = new FilenamePreservingWriter();
        $newBytes = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="red"/></svg>';
        $internalPath = 'images/diagram1.svg';

        $writer->replaceImageInEpub($this->tempEpub, $internalPath, $newBytes);

        $zip = new ZipArchive();
        $zip->open($this->tempEpub);
        $content = $zip->getFromName($internalPath);
        $zip->close();

        $this->assertNotFalse($content, "Entry {$internalPath} not found after replacement");
        $this->assertSame($newBytes, $content);
    }

    public function test_replaces_multiple_images_in_batch(): void
    {
        $writer       = new FilenamePreservingWriter();
        $newSvg       = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="50" height="50"/></svg>';
        $replacements = [
            'images/diagram1.svg' => $newSvg,
            'images/diagram2.svg' => $newSvg . '<!-- 2 -->',
        ];

        $writer->batchReplaceImagesInEpub($this->tempEpub, $replacements);

        $zip = new ZipArchive();
        $zip->open($this->tempEpub);

        foreach ($replacements as $path => $expected) {
            $content = $zip->getFromName($path);
            $this->assertNotFalse($content, "Entry {$path} not found");
            $this->assertSame($expected, $content);
        }

        $zip->close();
    }

    public function test_other_entries_are_preserved(): void
    {
        $writer = new FilenamePreservingWriter();
        $writer->replaceImageInEpub(
            $this->tempEpub,
            'images/diagram1.svg',
            '<svg xmlns="http://www.w3.org/2000/svg"/>',
        );

        $zip = new ZipArchive();
        $zip->open($this->tempEpub);
        $mimetypeContent = $zip->getFromName('mimetype');
        $zip->close();

        $this->assertSame('application/epub+zip', $mimetypeContent);
    }

    private function createFixtureEpub(string $path): void
    {
        $zip = new ZipArchive();
        $zip->open($path, ZipArchive::CREATE);
        $zip->addFromString('mimetype', 'application/epub+zip');
        $zip->addFromString('images/diagram1.svg', '<svg xmlns="http://www.w3.org/2000/svg"><text>original 1</text></svg>');
        $zip->addFromString('images/diagram2.svg', '<svg xmlns="http://www.w3.org/2000/svg"><text>original 2</text></svg>');
        $zip->addFromString('OEBPS/content.opf', '<?xml version="1.0"?><package/>');
        $zip->close();
    }
}
