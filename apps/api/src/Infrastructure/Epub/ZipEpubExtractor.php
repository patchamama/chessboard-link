<?php

declare(strict_types=1);

namespace App\Infrastructure\Epub;

use App\Application\Ingestion\Port\EpubExtractor;

final class ZipEpubExtractor implements EpubExtractor
{
    public function extract(string $epubPath): string
    {
        $zip = new \ZipArchive();
        $result = $zip->open($epubPath);

        if ($result !== true) {
            throw new \RuntimeException(
                "Cannot open EPUB archive '$epubPath': ZipArchive error code $result"
            );
        }

        $extractDir = sys_get_temp_dir() . '/epub_' . bin2hex(random_bytes(8));
        mkdir($extractDir, 0777, true);

        if (!$zip->extractTo($extractDir)) {
            $zip->close();
            throw new \RuntimeException("Failed to extract EPUB archive '$epubPath'");
        }

        $zip->close();
        return $extractDir;
    }
}
