<?php

declare(strict_types=1);

namespace App\Application\Ingestion\Port;

interface EpubExtractor
{
    /**
     * Extract the EPUB zip to a temporary working directory.
     * Returns the absolute path to the extracted directory.
     *
     * @throws \RuntimeException on corrupt/unreadable archive
     */
    public function extract(string $epubPath): string;
}
