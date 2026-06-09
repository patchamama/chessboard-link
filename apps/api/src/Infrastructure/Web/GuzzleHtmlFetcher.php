<?php

declare(strict_types=1);

namespace App\Infrastructure\Web;

use App\Application\Ingestion\Port\HtmlFetcher;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

final class GuzzleHtmlFetcher implements HtmlFetcher
{
    private Client $client;

    public function __construct(?Client $client = null)
    {
        $this->client = $client ?? new Client([
            'timeout'         => 15,
            'connect_timeout' => 5,
            'headers'         => [
                'User-Agent' => 'ChessEbookParser/0.4 (+https://github.com/chess-ebook-webparser)',
                'Accept'     => 'text/html,application/xhtml+xml',
            ],
        ]);
    }

    public function fetch(string $url): string
    {
        try {
            $response = $this->client->get($url);
            return (string) $response->getBody();
        } catch (GuzzleException $e) {
            throw new \RuntimeException("Failed to fetch URL '$url': " . $e->getMessage(), 0, $e);
        }
    }
}
