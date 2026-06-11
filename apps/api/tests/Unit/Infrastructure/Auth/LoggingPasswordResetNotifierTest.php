<?php

declare(strict_types=1);

namespace App\Tests\Unit\Infrastructure\Auth;

use App\Infrastructure\Auth\LoggingPasswordResetNotifier;
use PHPUnit\Framework\TestCase;

class LoggingPasswordResetNotifierTest extends TestCase
{
    public function testNotifyWritesOutputContainingRawResetUrl(): void
    {
        $notifier = new LoggingPasswordResetNotifier('https://myapp.test');

        ob_start();
        $notifier->notify('user@test.com', 'rawtoken123');
        $output = ob_get_clean();

        $this->assertStringContainsString('rawtoken123', $output);
        $this->assertStringContainsString('user@test.com', $output);
    }
}
