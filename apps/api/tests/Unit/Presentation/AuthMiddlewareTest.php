<?php

declare(strict_types=1);

namespace App\Tests\Unit\Presentation;

use App\Presentation\Middleware\AuthMiddleware;
use Firebase\JWT\JWT;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Psr7\Factory\ResponseFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

final class AuthMiddlewareTest extends TestCase
{
    private const SECRET = 'test-secret-test-secret-test-secret!!';

    /** @return RequestHandlerInterface&object{captured: ?Request} */
    private function capturingHandler(): RequestHandlerInterface
    {
        return new class implements RequestHandlerInterface {
            public ?Request $captured = null;

            public function handle(Request $request): Response
            {
                $this->captured = $request;
                return (new ResponseFactory())->createResponse(200);
            }
        };
    }

    public function testRejectsMissingTokenWhenBypassDisabled(): void
    {
        $middleware = new AuthMiddleware(self::SECRET, new ResponseFactory(), devBypass: false);
        $request = (new ServerRequestFactory())->createServerRequest('GET', '/api/admin/users/pending');

        $handler = $this->capturingHandler();
        $response = $middleware->process($request, $handler);

        $this->assertSame(401, $response->getStatusCode());
        $this->assertNull($handler->captured);
    }

    public function testAllowsMissingTokenAsAdminWhenBypassEnabled(): void
    {
        $middleware = new AuthMiddleware(self::SECRET, new ResponseFactory(), devBypass: true);
        $request = (new ServerRequestFactory())->createServerRequest('GET', '/api/admin/users/pending');

        $handler = $this->capturingHandler();
        $response = $middleware->process($request, $handler);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertNotNull($handler->captured);
        $user = $handler->captured->getAttribute('auth_user');
        $this->assertSame('admin', $user->role);
        $this->assertSame('approved', $user->status);
    }

    public function testValidTokenStillAuthenticatesWhenBypassEnabled(): void
    {
        $token = JWT::encode(
            ['sub' => 42, 'email' => 'real@user.com', 'role' => 'user', 'status' => 'approved'],
            self::SECRET,
            'HS256',
        );
        $middleware = new AuthMiddleware(self::SECRET, new ResponseFactory(), devBypass: true);
        $request = (new ServerRequestFactory())
            ->createServerRequest('GET', '/api/library/books')
            ->withHeader('Authorization', 'Bearer ' . $token);

        $handler = $this->capturingHandler();
        $response = $middleware->process($request, $handler);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('real@user.com', $handler->captured->getAttribute('auth_user')->email);
    }

    public function testInvalidTokenRejectedEvenWhenBypassEnabled(): void
    {
        $middleware = new AuthMiddleware(self::SECRET, new ResponseFactory(), devBypass: true);
        $request = (new ServerRequestFactory())
            ->createServerRequest('GET', '/api/library/books')
            ->withHeader('Authorization', 'Bearer not-a-jwt');

        $response = $middleware->process($request, $this->capturingHandler());

        $this->assertSame(401, $response->getStatusCode());
    }
}
