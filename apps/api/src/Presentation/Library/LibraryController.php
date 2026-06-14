<?php

declare(strict_types=1);

namespace App\Presentation\Library;

use App\Application\Library\DeleteBookCommand;
use App\Application\Library\DeleteBookHandler;
use App\Application\Library\GetChapterHandler;
use App\Application\Library\ListBooksHandler;
use App\Application\Library\SetLastReadBookCommand;
use App\Application\Library\SetLastReadBookHandler;
use App\Application\Library\UpdateBookCommand;
use App\Application\Library\UpdateBookHandler;
use App\Domain\Auth\Role;
use App\Infrastructure\Epub\OpfManifestParser;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class LibraryController
{
    public function __construct(
        private readonly ListBooksHandler      $listBooks,
        private readonly GetChapterHandler     $getChapter,
        private readonly UpdateBookHandler     $updateBook,
        private readonly DeleteBookHandler     $deleteBook,
        private readonly SetLastReadBookHandler $setLastReadBook,
        private readonly OpfManifestParser     $opfParser,
    ) {}

    public function books(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $authUser = $request->getAttribute('auth_user');
        $userId   = (int) $authUser->sub;
        $books  = $this->listBooks->handle($userId);

        $response->getBody()->write(json_encode($books));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function chapter(
        ServerRequestInterface $request,
        ResponseInterface $response,
        int $id,
        int $n,
    ): ResponseInterface {
        $result = $this->getChapter->handle($id, $n);

        if ($result === null) {
            $response->getBody()->write(json_encode(['error' => 'Not found']));
            return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
        }

        $response->getBody()->write(json_encode($result));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function updateBook(ServerRequestInterface $request, ResponseInterface $response, int $id): ResponseInterface
    {
        $authUser  = $request->getAttribute('auth_user');
        $ownerId   = (int) $authUser->sub;
        $isAdmin   = isset($authUser->role) && $authUser->role === Role::Admin->value;
        $body      = (array) json_decode((string) $request->getBody(), true);
        $title       = $body['title'] ?? '';
        $author      = $body['author'] ?? '';
        $description = $body['description'] ?? '';

        // If partial update: load existing book to fill missing fields
        // For simplicity, require all fields or use '' as default
        try {
            $book = $this->updateBook->handle(new UpdateBookCommand(
                bookId:      $id,
                ownerId:     $ownerId,
                title:       $title,
                author:      $author,
                description: $description,
                isAdmin:     $isAdmin,
            ));
        } catch (\RuntimeException $e) {
            $msg = $e->getMessage();
            if (str_contains($msg, 'Forbidden') || str_contains($msg, 'not the book owner')) {
                $response->getBody()->write(json_encode(['error' => $msg]));
                return $response->withStatus(403)->withHeader('Content-Type', 'application/json');
            }
            $response->getBody()->write(json_encode(['error' => $msg]));
            return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
        }

        $response->getBody()->write(json_encode([
            'id'          => $book->id,
            'title'       => $book->title,
            'author'      => $book->author,
            'description' => $book->description,
        ]));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function deleteBook(ServerRequestInterface $request, ResponseInterface $response, int $id): ResponseInterface
    {
        $authUser = $request->getAttribute('auth_user');
        $ownerId  = (int) $authUser->sub;
        $isAdmin  = isset($authUser->role) && $authUser->role === Role::Admin->value;

        try {
            $this->deleteBook->handle(new DeleteBookCommand(
                bookId:  $id,
                ownerId: $ownerId,
                isAdmin: $isAdmin,
            ));
        } catch (\RuntimeException $e) {
            $msg    = $e->getMessage();
            $status = (str_contains($msg, 'Forbidden') || str_contains($msg, 'not the book owner')) ? 403 : 404;
            $response->getBody()->write(json_encode(['error' => $msg]));
            return $response->withStatus($status)->withHeader('Content-Type', 'application/json');
        }

        // Best-effort cleanup of the stored EPUB file.
        $epubFile = __DIR__ . '/../../../storage/books/' . $id . '.epub';
        if (is_file($epubFile)) {
            @unlink($epubFile);
        }

        $response->getBody()->write(json_encode(['ok' => true]));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function image(ServerRequestInterface $request, ResponseInterface $response, int $id, string $path): ResponseInterface
    {
        $epubFile = __DIR__ . '/../../../storage/books/' . $id . '.epub';
        if (!is_file($epubFile)) {
            return $response->withStatus(404);
        }

        // path arrives URL-encoded; decode and strip leading slashes/dots for safety
        $innerPath = ltrim(urldecode($path), '/.');
        // Prevent path traversal
        if (str_contains($innerPath, '..')) {
            return $response->withStatus(400);
        }

        $zip = new \ZipArchive();
        if ($zip->open($epubFile) !== true) {
            return $response->withStatus(500);
        }

        // Try the path directly, then try common sub-dirs
        $content = $zip->getFromName($innerPath);
        if ($content === false) {
            // Search for the basename inside the zip
            $basename = basename($innerPath);
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $name = $zip->getNameIndex($i);
                if ($name !== false && basename($name) === $basename) {
                    $content = $zip->getFromIndex($i);
                    break;
                }
            }
        }
        $zip->close();

        if ($content === false) {
            return $response->withStatus(404);
        }

        $ext  = strtolower(pathinfo($innerPath, PATHINFO_EXTENSION));
        $mime = match ($ext) {
            'png'  => 'image/png',
            'gif'  => 'image/gif',
            'webp' => 'image/webp',
            'svg'  => 'image/svg+xml',
            default => 'image/jpeg',
        };

        $response->getBody()->write($content);
        return $response
            ->withHeader('Content-Type', $mime)
            ->withHeader('Cache-Control', 'public, max-age=86400');
    }

    public function cover(ServerRequestInterface $request, ResponseInterface $response, int $id): ResponseInterface
    {
        $epubFile = __DIR__ . '/../../../storage/books/' . $id . '.epub';
        if (!is_file($epubFile)) {
            return $response->withStatus(404);
        }

        $zip = new \ZipArchive();
        if ($zip->open($epubFile) !== true) {
            return $response->withStatus(500);
        }

        // Resolve the OPF path via META-INF/container.xml, then find the cover.
        $opfPath = $this->resolveOpfPathInZip($zip);
        if ($opfPath === null) {
            $zip->close();
            return $response->withStatus(404);
        }

        $opfXml = $zip->getFromName($opfPath);
        if ($opfXml === false) {
            $zip->close();
            return $response->withStatus(404);
        }

        try {
            $opf = $this->opfParser->parseXml($opfXml);
        } catch (\RuntimeException) {
            $zip->close();
            return $response->withStatus(404);
        }

        $coverHref = $opf['cover'] ?? null;
        if ($coverHref === null) {
            $zip->close();
            return $response->withStatus(404);
        }

        // Cover href is relative to the OPF directory.
        $opfDir    = dirname($opfPath);
        $innerPath = ($opfDir === '.' || $opfDir === '')
            ? $coverHref
            : $opfDir . '/' . $coverHref;
        $innerPath = $this->normalizeZipPath($innerPath);

        $content = $zip->getFromName($innerPath);
        if ($content === false) {
            // Fall back to matching by basename.
            $basename = basename($coverHref);
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $name = $zip->getNameIndex($i);
                if ($name !== false && basename($name) === $basename) {
                    $content = $zip->getFromIndex($i);
                    $innerPath = $name;
                    break;
                }
            }
        }
        $zip->close();

        if ($content === false) {
            return $response->withStatus(404);
        }

        $ext  = strtolower(pathinfo($innerPath, PATHINFO_EXTENSION));
        $mime = match ($ext) {
            'png'  => 'image/png',
            'gif'  => 'image/gif',
            'webp' => 'image/webp',
            'svg'  => 'image/svg+xml',
            default => 'image/jpeg',
        };

        $response->getBody()->write($content);
        return $response
            ->withHeader('Content-Type', $mime)
            ->withHeader('Cache-Control', 'public, max-age=86400');
    }

    /** Resolve the content.opf path inside the zip via META-INF/container.xml. */
    private function resolveOpfPathInZip(\ZipArchive $zip): ?string
    {
        $containerXml = $zip->getFromName('META-INF/container.xml');
        if ($containerXml !== false) {
            $dom = new \DOMDocument();
            if (@$dom->loadXML($containerXml)) {
                $rootfiles = $dom->getElementsByTagName('rootfile');
                if ($rootfiles->length > 0) {
                    /** @var \DOMElement $rootfile */
                    $rootfile = $rootfiles->item(0);
                    $fullPath = $rootfile->getAttribute('full-path');
                    if ($fullPath !== '') {
                        return $fullPath;
                    }
                }
            }
        }
        // Fallback: first *.opf entry in the archive.
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            if ($name !== false && str_ends_with(strtolower($name), '.opf')) {
                return $name;
            }
        }
        return null;
    }

    /** Collapse "dir/../" segments so a zip lookup matches stored entry names. */
    private function normalizeZipPath(string $path): string
    {
        $parts = [];
        foreach (explode('/', $path) as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }
            if ($segment === '..') {
                array_pop($parts);
                continue;
            }
            $parts[] = $segment;
        }
        return implode('/', $parts);
    }

    public function touch(ServerRequestInterface $request, ResponseInterface $response, int $id): ResponseInterface
    {
        $authUser = $request->getAttribute('auth_user');
        $userId   = (int) $authUser->sub;

        $this->setLastReadBook->handle(new SetLastReadBookCommand(userId: $userId, bookId: $id));

        $response->getBody()->write(json_encode(['ok' => true]));
        return $response->withHeader('Content-Type', 'application/json');
    }
}
