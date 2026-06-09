<?php

declare(strict_types=1);

namespace App\Tests\Fixtures\epub;

/**
 * Builds a minimal valid EPUB 2 archive programmatically for tests.
 *
 * Structure:
 *   mimetype
 *   META-INF/container.xml
 *   OEBPS/content.opf     (manifest + spine)
 *   OEBPS/toc.ncx         (navMap with 2 navPoints)
 *   OEBPS/Text/ch1.xhtml
 *   OEBPS/Text/ch2.xhtml
 *   OEBPS/Images/g1.jpg   (1-byte placeholder)
 */
final class EpubFixture
{
    /**
     * Create the fixture epub at a temp path and return the path.
     */
    public static function create(): string
    {
        $path = sys_get_temp_dir() . '/fixture_test_' . uniqid() . '.epub';
        $zip  = new \ZipArchive();
        if ($zip->open($path, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            throw new \RuntimeException("Cannot create fixture epub at $path");
        }

        // mimetype — must be first, uncompressed
        $zip->addFromString('mimetype', 'application/epub+zip');
        $zip->setCompressionName('mimetype', \ZipArchive::CM_STORE);

        // META-INF/container.xml
        $zip->addFromString('META-INF/container.xml', <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
XML);

        // OEBPS/content.opf
        $zip->addFromString('OEBPS/content.opf', <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Chess Fundamentals</dc:title>
    <dc:creator>Capablanca</dc:creator>
    <dc:identifier id="bookid">fixture-book-001</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx"  href="toc.ncx"         media-type="application/x-dtbncx+xml"/>
    <item id="ch1"  href="Text/ch1.xhtml"  media-type="application/xhtml+xml"/>
    <item id="ch2"  href="Text/ch2.xhtml"  media-type="application/xhtml+xml"/>
    <item id="img1" href="Images/g1.jpg"   media-type="image/jpeg"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>
XML);

        // OEBPS/toc.ncx
        $zip->addFromString('OEBPS/toc.ncx', <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="fixture-book-001"/>
  </head>
  <docTitle><text>Chess Fundamentals</text></docTitle>
  <navMap>
    <navPoint id="np1" playOrder="1">
      <navLabel><text>Introduction</text></navLabel>
      <content src="Text/ch1.xhtml"/>
    </navPoint>
    <navPoint id="np2" playOrder="2">
      <navLabel><text>Basic Endgames</text></navLabel>
      <content src="Text/ch2.xhtml"/>
    </navPoint>
  </navMap>
</ncx>
XML);

        // OEBPS/Text/ch1.xhtml
        $zip->addFromString('OEBPS/Text/ch1.xhtml', <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Introduction</title></head>
<body><h1>Introduction</h1><p>Chess is a two-player game.</p></body>
</html>
XML);

        // OEBPS/Text/ch2.xhtml
        $zip->addFromString('OEBPS/Text/ch2.xhtml', <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Basic Endgames</title></head>
<body><h1>Basic Endgames</h1><p>King and rook vs king.</p></body>
</html>
XML);

        // OEBPS/Images/g1.jpg  (1-byte placeholder — just needs to exist)
        $zip->addFromString('OEBPS/Images/g1.jpg', "\xFF\xD8\xFF\xD9");

        $zip->close();
        return $path;
    }

    /**
     * Create a corrupt epub (not a zip) at a temp path and return the path.
     */
    public static function createCorrupt(): string
    {
        $path = sys_get_temp_dir() . '/corrupt_test_' . uniqid() . '.epub';
        file_put_contents($path, 'this is not a zip file');
        return $path;
    }
}
