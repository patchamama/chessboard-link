<?php

declare(strict_types=1);

namespace App\Presentation\Middleware;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;

final class AuthMiddleware implements MiddlewareInterface
{
    public function __construct(
        private readonly string $jwtSecret,
        private readonly ResponseFactoryInterface $responseFactory,
        private readonly bool $devBypass = false,
    ) {
    }

    public function process(Request $request, Handler $handler): Response
    {
        $authHeader = $request->getHeaderLine('Authorization');

        if (!str_starts_with($authHeader, 'Bearer ')) {
            if ($this->devBypass) {
                // AUTH_DEV_BYPASS: tokenless local requests act as a synthetic admin.
                $request = $request->withAttribute('auth_user', (object) [
                    'sub'    => 0,
                    'email'  => 'dev@localhost',
                    'role'   => 'admin',
                    'status' => 'approved',
                ]);
                return $handler->handle($request);
            }
            return $this->unauthorized();
        }

        $token = substr($authHeader, 7);

        try {
            $payload = JWT::decode($token, new Key($this->jwtSecret, 'HS256'));
        } catch (\Throwable) {
            return $this->unauthorized();
        }

        $request = $request->withAttribute('auth_user', $payload);
        return $handler->handle($request);
    }

    private function unauthorized(): Response
    {
        $response = $this->responseFactory->createResponse(401);
        $response->getBody()->write(json_encode(['error' => 'Unauthorized']));
        return $response->withHeader('Content-Type', 'application/json');
    }
}
