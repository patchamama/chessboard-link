<?php

declare(strict_types=1);

namespace App\Tests\Functional\Auth;

use App\Application\Auth\ApproveUserHandler;
use App\Application\Auth\Command\ApproveUserCommand;
use App\Application\Auth\Command\RegisterUserCommand;
use App\Application\Auth\RegisterUserHandler;
use App\Domain\Auth\PasswordReset;
use App\Domain\Auth\PasswordResetRepository;
use App\Domain\Auth\UserRepository;
use App\Infrastructure\Auth\BcryptPasswordHasher;
use App\Infrastructure\Auth\JwtTokenIssuer;
use App\Tests\TestCase;
use DateTimeImmutable;
use Slim\Psr7\Factory\ServerRequestFactory;

class PasswordResetControllerTest extends TestCase
{
    private function jsonRequest(string $method, string $uri, array $data, ?string $token = null): \Psr\Http\Message\ServerRequestInterface
    {
        $factory = new ServerRequestFactory();
        $req = $factory->createServerRequest($method, $uri);
        $req = $req->withHeader('Content-Type', 'application/json');
        if ($token) {
            $req = $req->withHeader('Authorization', "Bearer {$token}");
        }
        $req->getBody()->write(json_encode($data));
        return $req;
    }

    public function testRequestResetReturns200Generic(): void
    {
        $app = $this->createApp();

        $response = $app->handle($this->jsonRequest('POST', '/api/auth/password-reset/request', ['email' => 'any@test.com']));
        $this->assertSame(200, $response->getStatusCode());

        $body = json_decode((string) $response->getBody(), true);
        $this->assertArrayHasKey('message', $body);
    }

    public function testConfirmWithValidTokenReturns200(): void
    {
        $app       = $this->createApp();
        $container = $this->buildContainer();

        $registerHandler = $container->get(RegisterUserHandler::class);
        $approveHandler  = $container->get(ApproveUserHandler::class);
        $repo            = $container->get(UserRepository::class);
        $resetRepo       = $container->get(PasswordResetRepository::class);

        $registerHandler->handle(new RegisterUserCommand('resetme@test.com', 'OldPass1!'));
        $user = $repo->findByEmail('resetme@test.com');
        $approveHandler->handle(new ApproveUserCommand($user->id()->value()));

        // Store a valid reset record
        $rawToken  = 'testrawtoken123456';
        $tokenHash = hash('sha256', $rawToken);
        $resetRepo->save(new PasswordReset(
            id: 0,
            userId: $user->id()->value(),
            tokenHash: $tokenHash,
            expiresAt: new DateTimeImmutable('+24 hours'),
            consumedAt: null,
            createdAt: new DateTimeImmutable(),
        ));

        $response = $app->handle($this->jsonRequest('POST', '/api/auth/password-reset/confirm', [
            'token'    => $rawToken,
            'password' => 'NewPass1!',
        ]));

        $this->assertSame(200, $response->getStatusCode());
    }

    public function testConfirmWithBadTokenReturns400(): void
    {
        $app = $this->createApp();

        $response = $app->handle($this->jsonRequest('POST', '/api/auth/password-reset/confirm', [
            'token'    => 'badtoken',
            'password' => 'AnyPass1!',
        ]));

        $this->assertSame(400, $response->getStatusCode());
    }
}
