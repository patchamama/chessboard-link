<?php

declare(strict_types=1);

namespace App\Tests\Functional\Admin;

use App\Application\Auth\ApproveUserHandler;
use App\Application\Auth\Command\ApproveUserCommand;
use App\Application\Auth\Command\RegisterUserCommand;
use App\Application\Auth\RegisterUserHandler;
use App\Domain\Auth\RegistrationStatus;
use App\Domain\Auth\Role;
use App\Domain\Auth\User;
use App\Domain\Auth\UserId;
use App\Domain\Auth\UserRepository;
use App\Infrastructure\Auth\JwtTokenIssuer;
use App\Tests\TestCase;
use Slim\Psr7\Factory\ServerRequestFactory;

class AdminControllerNewEndpointsTest extends TestCase
{
    private function seedAdmin(\Psr\Container\ContainerInterface $container): User
    {
        $repo   = $container->get(UserRepository::class);
        $hasher = $container->get(\App\Application\Auth\Port\PasswordHasher::class);

        $admin = new User(
            new UserId(0),
            'admin@test.com',
            $hasher->hash('adminpass'),
            Role::Admin,
            RegistrationStatus::Approved,
            new \DateTimeImmutable(),
        );

        return $repo->save($admin);
    }

    private function adminToken(\Psr\Container\ContainerInterface $container): string
    {
        $admin    = $this->seedAdmin($container);
        $settings = $container->get('settings');
        $issuer   = new JwtTokenIssuer($settings['jwt']['secret']);
        return $issuer->issue($admin);
    }

    private function userToken(\Psr\Container\ContainerInterface $container): string
    {
        $registerHandler = $container->get(RegisterUserHandler::class);
        $approveHandler  = $container->get(ApproveUserHandler::class);
        $repo            = $container->get(UserRepository::class);
        $settings        = $container->get('settings');

        $registerHandler->handle(new RegisterUserCommand('reguser@test.com', 'pass123'));
        $user = $repo->findByEmail('reguser@test.com');
        $approveHandler->handle(new ApproveUserCommand($user->id()->value()));
        $user = $repo->findByEmail('reguser@test.com');

        $issuer = new JwtTokenIssuer($settings['jwt']['secret']);
        return $issuer->issue($user);
    }

    private function request(string $method, string $uri, ?string $token = null, ?array $body = null): \Psr\Http\Message\ServerRequestInterface
    {
        $factory = new ServerRequestFactory();
        $req = $factory->createServerRequest($method, $uri);
        if ($token) {
            $req = $req->withHeader('Authorization', "Bearer {$token}");
        }
        if ($body !== null) {
            $req = $req->withHeader('Content-Type', 'application/json');
            $req->getBody()->write(json_encode($body));
        }
        return $req;
    }

    public function testGetActiveUsersReturns200ForAdmin(): void
    {
        $app       = $this->createApp();
        $container = $this->buildContainer();
        $token     = $this->adminToken($container);

        $response = $app->handle($this->request('GET', '/api/admin/active-users', $token));
        $this->assertSame(200, $response->getStatusCode());

        $body = json_decode((string) $response->getBody(), true);
        $this->assertArrayHasKey('users', $body);
    }

    public function testGetBlockedUsersReturns200ForAdmin(): void
    {
        $app       = $this->createApp();
        $container = $this->buildContainer();
        $token     = $this->adminToken($container);

        $response = $app->handle($this->request('GET', '/api/admin/blocked-users', $token));
        $this->assertSame(200, $response->getStatusCode());
    }

    public function testGetUserBooksReturns200ForAdmin(): void
    {
        $app       = $this->createApp();
        $container = $this->buildContainer();
        $token     = $this->adminToken($container);

        $registerHandler = $container->get(RegisterUserHandler::class);
        $approveHandler  = $container->get(ApproveUserHandler::class);
        $repo            = $container->get(UserRepository::class);
        $registerHandler->handle(new RegisterUserCommand('booksuser@test.com', 'pass123'));
        $user = $repo->findByEmail('booksuser@test.com');
        $approveHandler->handle(new ApproveUserCommand($user->id()->value()));

        $response = $app->handle($this->request('GET', "/api/admin/users/{$user->id()->value()}/books", $token));
        $this->assertSame(200, $response->getStatusCode());
        $body = json_decode((string) $response->getBody(), true);
        $this->assertArrayHasKey('books', $body);
    }

    public function testSetPasswordReturns200WithValidPassword(): void
    {
        $app       = $this->createApp();
        $container = $this->buildContainer();
        $token     = $this->adminToken($container);

        $registerHandler = $container->get(RegisterUserHandler::class);
        $approveHandler  = $container->get(ApproveUserHandler::class);
        $repo            = $container->get(UserRepository::class);
        $registerHandler->handle(new RegisterUserCommand('setpw@test.com', 'pass123'));
        $user = $repo->findByEmail('setpw@test.com');
        $approveHandler->handle(new ApproveUserCommand($user->id()->value()));

        $response = $app->handle($this->request('POST', "/api/admin/users/{$user->id()->value()}/password", $token, ['password' => 'NewPass1!']));
        $this->assertSame(200, $response->getStatusCode());
    }

    public function testSetPasswordReturns422WithEmptyPassword(): void
    {
        $app       = $this->createApp();
        $container = $this->buildContainer();
        $token     = $this->adminToken($container);

        $registerHandler = $container->get(RegisterUserHandler::class);
        $repo            = $container->get(UserRepository::class);
        $registerHandler->handle(new RegisterUserCommand('emptypass@test.com', 'pass123'));
        $user = $repo->findByEmail('emptypass@test.com');

        $response = $app->handle($this->request('POST', "/api/admin/users/{$user->id()->value()}/password", $token, ['password' => '']));
        $this->assertSame(422, $response->getStatusCode());
    }

    public function testSendResetReturns200ForAdmin(): void
    {
        $app       = $this->createApp();
        $container = $this->buildContainer();
        $token     = $this->adminToken($container);

        $registerHandler = $container->get(RegisterUserHandler::class);
        $approveHandler  = $container->get(ApproveUserHandler::class);
        $repo            = $container->get(UserRepository::class);
        $registerHandler->handle(new RegisterUserCommand('resetuser@test.com', 'pass123'));
        $user = $repo->findByEmail('resetuser@test.com');
        $approveHandler->handle(new ApproveUserCommand($user->id()->value()));

        $response = $app->handle($this->request('POST', "/api/admin/users/{$user->id()->value()}/send-reset", $token));
        $this->assertSame(200, $response->getStatusCode());
    }

    public function testAllNewEndpointsReturn403ForNonAdmin(): void
    {
        $app       = $this->createApp();
        $container = $this->buildContainer();
        $token     = $this->userToken($container);

        $endpoints = [
            ['GET', '/api/admin/active-users'],
            ['GET', '/api/admin/blocked-users'],
            ['GET', '/api/admin/users/1/books'],
            ['POST', '/api/admin/users/1/password'],
            ['POST', '/api/admin/users/1/send-reset'],
        ];

        foreach ($endpoints as [$method, $uri]) {
            $response = $app->handle($this->request($method, $uri, $token));
            $this->assertSame(403, $response->getStatusCode(), "Expected 403 for {$method} {$uri}");
        }
    }
}
