<?php

declare(strict_types=1);

namespace App\Application\Library;

use App\Domain\Library\BookRepository;

final class GetChapterHandler
{
    public function __construct(
        private readonly BookRepository $books,
    ) {}

    /**
     * @return array{title:string,html:string,toc:array<array{order:int,title:string}>}|null
     */
    public function handle(int $bookId, int $order): ?array
    {
        $chapter = $this->books->findChapter($bookId, $order);
        if ($chapter === null) {
            return null;
        }

        $allChapters = $this->books->findChaptersByBook($bookId);
        $toc = array_map(
            fn($c) => ['order' => $c->order, 'title' => $c->title],
            $allChapters,
        );

        return [
            'title' => $chapter->title,
            'html'  => $chapter->html,
            'toc'   => $toc,
        ];
    }
}
