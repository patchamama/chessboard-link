<?php

declare(strict_types=1);

namespace App\Infrastructure\Epub;

/**
 * Parses an EPUB 2/3 content.opf file.
 *
 * Returns:
 *   title    — dc:title string
 *   author   — dc:creator string
 *   manifest — ['id' => 'href', ...]
 *   spine    — ['id1', 'id2', ...] in spine order
 *   images   — ['href', ...] of image items (media-type image/*)
 *   cover    — href of the cover image, or null
 */
final class OpfManifestParser
{
    /**
     * @return array{title:string,author:string,manifest:array<string,string>,spine:list<string>,images:list<string>,cover:?string}
     */
    public function parse(string $opfPath): array
    {
        if (!is_file($opfPath)) {
            throw new \RuntimeException("OPF file not found: $opfPath");
        }

        $xml = file_get_contents($opfPath);
        if ($xml === false) {
            throw new \RuntimeException("Cannot read OPF file: $opfPath");
        }

        return $this->parseXml($xml);
    }

    /**
     * Parse OPF content from a raw XML string (e.g. read straight out of a ZIP).
     *
     * @return array{title:string,author:string,manifest:array<string,string>,spine:list<string>,images:list<string>,cover:?string}
     */
    public function parseXml(string $xml): array
    {
        $dom = new \DOMDocument();
        if (!@$dom->loadXML($xml)) {
            throw new \RuntimeException('Cannot parse OPF XML');
        }

        $xpath = new \DOMXPath($dom);
        $xpath->registerNamespace('opf', 'http://www.idpf.org/2007/opf');
        $xpath->registerNamespace('dc', 'http://purl.org/dc/elements/1.1/');

        // Title
        $titleNodes = $xpath->query('//dc:title');
        $title = ($titleNodes && $titleNodes->length > 0)
            ? trim($titleNodes->item(0)->textContent)
            : '';

        // Author (dc:creator)
        $creatorNodes = $xpath->query('//dc:creator');
        $author = ($creatorNodes && $creatorNodes->length > 0)
            ? trim($creatorNodes->item(0)->textContent)
            : '';

        // Manifest items: id -> href
        $manifest      = [];
        $images        = [];
        $coverByProps  = null; // EPUB3: item with properties="cover-image"
        $itemNodes = $xpath->query('//opf:manifest/opf:item');
        if ($itemNodes === false || $itemNodes->length === 0) {
            // Fallback without namespace
            $itemNodes = $dom->getElementsByTagName('item');
        }
        foreach ($itemNodes as $item) {
            /** @var \DOMElement $item */
            $id        = $item->getAttribute('id');
            $href      = $item->getAttribute('href');
            $mediaType = $item->getAttribute('media-type');
            if ($id !== '' && $href !== '') {
                $manifest[$id] = $href;
                if (str_starts_with($mediaType, 'image/')) {
                    $images[] = $href;
                }
                $props = $item->getAttribute('properties');
                if ($props !== '' && str_contains($props, 'cover-image')) {
                    $coverByProps = $href;
                }
            }
        }

        // Cover detection priority:
        //   1. EPUB3 item with properties="cover-image"
        //   2. EPUB2 <meta name="cover" content="itemId"> → manifest[itemId]
        //   3. first image in the manifest
        $cover = $coverByProps;
        if ($cover === null) {
            $metaCover = $xpath->query('//opf:metadata/opf:meta[@name="cover"]');
            if ($metaCover === false || $metaCover->length === 0) {
                $metaCover = $xpath->query('//*[local-name()="meta"][@name="cover"]');
            }
            if ($metaCover !== false && $metaCover->length > 0) {
                /** @var \DOMElement $meta */
                $meta      = $metaCover->item(0);
                $coverId   = $meta->getAttribute('content');
                if ($coverId !== '' && isset($manifest[$coverId])) {
                    $cover = $manifest[$coverId];
                }
            }
        }
        if ($cover === null && count($images) > 0) {
            $cover = $images[0];
        }

        // Spine: ordered list of idrefs
        $spine     = [];
        $itemrefs  = $xpath->query('//opf:spine/opf:itemref');
        if ($itemrefs === false || $itemrefs->length === 0) {
            $itemrefs = $dom->getElementsByTagName('itemref');
        }
        foreach ($itemrefs as $ref) {
            /** @var \DOMElement $ref */
            $idref = $ref->getAttribute('idref');
            if ($idref !== '') {
                $spine[] = $idref;
            }
        }

        return compact('title', 'author', 'manifest', 'spine', 'images', 'cover');
    }
}
