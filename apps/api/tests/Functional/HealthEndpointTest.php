<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Tests\TestCase;
use Slim\Psr7\Factory\ServerRequestFactory;

class HealthEndpointTest extends TestCase
{
    public function testHealthEndpointReturns200WithExpectedBody(): void
    {
        $app = $this->createApp();

        $request = (new ServerRequestFactory())->createServerRequest('GET', '/api/health');
        $response = $app->handle($request);

        $this->assertSame(200, $response->getStatusCode());

        $body = (string) $response->getBody();
        $decoded = json_decode($body, true);

        $this->assertSame('ok', $decoded['status']);
        $this->assertSame('0.3.0', $decoded['version']);
    }
}
