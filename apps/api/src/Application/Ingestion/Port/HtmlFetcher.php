<?php

declare(strict_types=1);

namespace App\Application\Ingestion\Port;

interface HtmlFetcher
{
    /**
     * Fetch the HTML content of the given URL.
     *
     * @throws \RuntimeException on network/HTTP failure
     */
    public function fetch(string $url): string;
}
