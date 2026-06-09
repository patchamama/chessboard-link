<?php

declare(strict_types=1);

namespace App\Domain\Library;

enum BookStatus: string
{
    case Uploaded   = 'uploaded';
    case Processing = 'processing';
    case Ready      = 'ready';
    case Failed     = 'failed';
}
