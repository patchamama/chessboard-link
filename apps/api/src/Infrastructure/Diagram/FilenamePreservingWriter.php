<?php

declare(strict_types=1);

namespace App\Infrastructure\Diagram;

use RuntimeException;
use ZipArchive;

/**
 * Writes/replaces images inside an EPUB (zip) archive at the same internal path,
 * so substitution is transparent to any reader that opens the file.
 */
final class FilenamePreservingWriter
{
    /**
     * Replace one image entry inside an EPUB file.
     *
     * @param string $epubPath     Absolute path to the .epub file (modified in place).
     * @param string $internalPath Internal zip path, e.g. "images/diagram1.svg".
     * @param string $newBytes     New image bytes (SVG string or PNG binary).
     */
    public function replaceImageInEpub(string $epubPath, string $internalPath, string $newBytes): void
    {
        $this->batchReplaceImagesInEpub($epubPath, [$internalPath => $newBytes]);
    }

    /**
     * Replace multiple image entries in one pass.
     *
     * @param string            $epubPath     Absolute path to the .epub file.
     * @param array<string,string> $replacements Map of internalPath → newBytes.
     */
    public function batchReplaceImagesInEpub(string $epubPath, array $replacements): void
    {
        $zip = new ZipArchive();
        $res = $zip->open($epubPath);
        if ($res !== true) {
            throw new RuntimeException("Cannot open epub at {$epubPath}: ZipArchive error {$res}");
        }

        foreach ($replacements as $internalPath => $newBytes) {
            // deleteName + addFromString = replace entry at same path
            $zip->deleteName($internalPath);
            $zip->addFromString($internalPath, $newBytes);
        }

        $zip->close();
    }

    /**
     * Write a standalone image file to disk, preserving the original filename/path.
     *
     * @param string $targetPath Absolute filesystem path to write.
     * @param string $bytes      Image bytes.
     */
    public function writeFile(string $targetPath, string $bytes): void
    {
        $dir = dirname($targetPath);
        if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
            throw new RuntimeException("Cannot create directory: {$dir}");
        }
        if (file_put_contents($targetPath, $bytes) === false) {
            throw new RuntimeException("Cannot write file: {$targetPath}");
        }
    }
}
