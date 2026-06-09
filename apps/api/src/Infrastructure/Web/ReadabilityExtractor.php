<?php

declare(strict_types=1);

namespace App\Infrastructure\Web;

/**
 * Extracts the main readable content from a fetched HTML page.
 *
 * Heuristic approach (no external lib required):
 *  1. Strip <script>, <style>, <nav>, <header>, <footer>, <aside> elements.
 *  2. Prefer <main> or <article> container if present.
 *  3. Fall back to <body>.
 *  4. Return inner HTML of the chosen container.
 */
final class ReadabilityExtractor
{
    public function extract(string $html): string
    {
        if (trim($html) === '') {
            return '';
        }

        $dom = new \DOMDocument();
        // Suppress warnings from malformed HTML
        @$dom->loadHTML('<?xml encoding="utf-8" ?>' . $html, LIBXML_NOERROR | LIBXML_NOWARNING);

        $xpath = new \DOMXPath($dom);

        // Remove noise elements
        foreach (['script', 'style', 'nav', 'header', 'footer', 'aside', 'noscript'] as $tag) {
            $nodes = $dom->getElementsByTagName($tag);
            // Iterate backwards to avoid live-list mutation issues
            for ($i = $nodes->length - 1; $i >= 0; $i--) {
                $node = $nodes->item($i);
                if ($node && $node->parentNode) {
                    $node->parentNode->removeChild($node);
                }
            }
        }

        // Try <main>, then <article>, then <body>
        foreach (['main', 'article', 'body'] as $candidate) {
            $elements = $dom->getElementsByTagName($candidate);
            if ($elements->length > 0) {
                return $this->innerHtml($elements->item(0));
            }
        }

        return '';
    }

    private function innerHtml(\DOMNode $node): string
    {
        $html = '';
        foreach ($node->childNodes as $child) {
            $html .= $node->ownerDocument->saveHTML($child);
        }
        return trim($html);
    }
}
