<?php

declare(strict_types=1);

namespace App\Infrastructure\Epub;

/**
 * Parses an EPUB 2 toc.ncx file and returns ordered TocEntry list.
 *
 * Uses DOMDocument to walk the navMap/navPoint elements.
 * Isolated, stateless, unit-testable with no I/O side effects beyond reading one file.
 */
final class NcxTocParser
{
    /** @return TocEntry[] ordered by playOrder */
    public function parse(string $ncxPath): array
    {
        if (!is_file($ncxPath)) {
            throw new \RuntimeException("NCX file not found: $ncxPath");
        }

        $xml = file_get_contents($ncxPath);
        if ($xml === false) {
            throw new \RuntimeException("Cannot read NCX file: $ncxPath");
        }

        $dom = new \DOMDocument();
        // Suppress warnings from DTD declaration in the NCX
        if (!@$dom->loadXML($xml)) {
            throw new \RuntimeException("Cannot parse NCX XML: $ncxPath");
        }

        $ns       = 'http://www.daisy.org/z3986/2005/ncx/';
        $xpath    = new \DOMXPath($dom);
        $xpath->registerNamespace('ncx', $ns);

        $navPoints = $xpath->query('//ncx:navMap/ncx:navPoint');

        if ($navPoints === false || $navPoints->length === 0) {
            // Fallback: try without namespace (some NCX files omit it)
            $navPoints = $dom->getElementsByTagName('navPoint');
        }

        $entries = [];
        foreach ($navPoints as $node) {
            /** @var \DOMElement $node */
            $playOrder = (int) ($node->getAttribute('playOrder') ?: count($entries) + 1);

            // navLabel/text
            $labelNodes = $node->getElementsByTagNameNS($ns, 'navLabel');
            if ($labelNodes->length === 0) {
                $labelNodes = $node->getElementsByTagName('navLabel');
            }
            $title = '';
            if ($labelNodes->length > 0) {
                $textNodes = $labelNodes->item(0)->getElementsByTagName('text');
                if ($textNodes->length > 0) {
                    $title = trim($textNodes->item(0)->textContent);
                }
            }

            // content src
            $contentNodes = $node->getElementsByTagNameNS($ns, 'content');
            if ($contentNodes->length === 0) {
                $contentNodes = $node->getElementsByTagName('content');
            }
            $href = '';
            if ($contentNodes->length > 0) {
                /** @var \DOMElement $contentEl */
                $contentEl = $contentNodes->item(0);
                $href = $contentEl->getAttribute('src');
                // Strip fragment anchors if any
                if (str_contains($href, '#')) {
                    $href = substr($href, 0, strpos($href, '#'));
                }
            }

            $entries[] = new TocEntry(order: $playOrder, title: $title, href: $href);
        }

        // Sort by playOrder to guarantee order
        usort($entries, fn(TocEntry $a, TocEntry $b) => $a->order <=> $b->order);

        return $entries;
    }
}
