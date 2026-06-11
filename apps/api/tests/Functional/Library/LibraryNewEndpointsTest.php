<?php

declare(strict_types=1);

namespace App\Tests\Functional\Library;

use App\Application\Auth\ApproveUserHandler;
use App\Application\Auth\Command\ApproveUserCommand;
use App\Application\Auth\Command\RegisterUserCommand;
use App\Application\Auth\RegisterUserHandler;
use App\Domain\Auth\RegistrationStatus;
use App\Domain\Auth\Role;
use App\Domain\Auth\User;
use App\Domain\Auth\UserId;
use App\Domain\Auth\UserRepository;
use App\Domain\Library\Book;
use App\Domain\Library\BookStatus;
use App\Infrastructure\Auth\JwtTokenIssuer;
use App\Infrastructure\Persistence\DbalBookRepository;
use App\Tests\TestCase;
use Slim\Psr7\Factory\ServerRequestFactory;

class LibraryNewEndpointsTest extends TestCase
{
    private function seedApprovedUser(\Psr\Container\ContainerInterface $container, string $email): array
    {
        $registerHandler = $container->get(RegisterUserHandler::class);
        $approveHandler  = $container->get(ApproveUserHandler::class);
        $repo            = $container->get(UserRepository::class);
        $settings        = $container->get('settings');

        $registerHandler->handle(new RegisterUserCommand($email, 'pass123'));
        $user = $repo->findByEmail($email);
        $approveHandler->handle(new ApproveUserCommand($user->id()->value()));
        $user = $repo->findByEmail($email);

        $issuer = new JwtTokenIssuer($settings['jwt']['secret']);
        $token  = $issuer->issue($user);

        return [$user, $token];
    }

    private function seedAdmin(\Psr\Container\ContainerInterface $container): array
    {
        $repo     = $container->get(UserRepository::class);
        $hasher   = $container->get(\App\Application\Auth\Port\PasswordHasher::class);
        $settings = $container->get('settings');

        $admin = new User(
            new UserId(0),
            'admin2@test.com',
            $hasher->hash('adminpass'),
            Role::Admin,
            RegistrationStatus::Approved,
            new \DateTimeImmutable(),
        );
        $admin = $repo->save($admin);

        $issuer = new JwtTokenIssuer($settings['jwt']['secret']);
        $token  = $issuer->issue($admin);

        return [$admin, $token];
    }

    private function jsonRequest(string $method, string $uri, array $body, string $token): \Psr\Http\Message\ServerRequestInterface
    {
        $factory = new ServerRequestFactory();
        $req = $factory->createServerRequest($method, $uri)
            ->withHeader('Authorization', "Bearer {$token}")
            ->withHeader('Content-Type', 'application/json');
        $req->getBody()->write(json_encode($body));
        return $req;
    }

    private function authRequest(string $method, string $uri, string $token): \Psr\Http\Message\ServerRequestInterface
    {
        $factory = new ServerRequestFactory();
        return (new ServerRequestFactory())->createServerRequest($method, $uri)
            ->withHeader('Authorization', "Bearer {$token}");
    }

    public function testUpdateBookByOwnerReturns200(): void
    {
        $app       = $this->createApp();
        $container = $this->buildContainer();
        [$user, $token] = $this->seedApprovedUser($container, 'owner@test.com');

        $bookRepo = new DbalBookRepository($container->get(\Doctrine\DBAL\Connection::class));
        $bookId   = $bookRepo->save(new Book(0, $user->id()->value(), 'Old Title', 'Old Auth', BookStatus::Ready, '2024-01-01 00:00:00'));

        $response = $app->handle($this->jsonRequest('PUT', "/api/library/books/{$bookId}", [
            'title'  => 'New Title',
            'author' => 'New Auth',
            'description' => 'New desc',
        ], $token));

        $this->assertSame(200, $response->getStatusCode());
        $body = json_decode((string) $response->getBody(), true);
        $this->assertSame('New Title', $body['title']);
    }

    public function testUpdateBookByNonOwnerReturns403(): void
    {
        $app       = $this->createApp();
        $container = $this->buildContainer();
        [$owner, $ownerToken] = $this->seedApprovedUser($container, 'owner2@test.com');
        [$other, $otherToken] = $this->seedApprovedUser($container, 'other@test.com');

        $bookRepo = new DbalBookRepository($container->get(\Doctrine\DBAL\Connection::class));
        $bookId   = $bookRepo->save(new Book(0, $owner->id()->value(), 'Title', 'Auth', BookStatus::Ready, '2024-01-01 00:00:00'));

        $response = $app->handle($this->jsonRequest('PUT', "/api/library/books/{$bookId}", [
            'title'  => 'Hacked',
            'author' => 'Hacker',
            'description' => '',
        ], $otherToken));

        $this->assertSame(403, $response->getStatusCode());
    }

    public function testUpdateBookByAdminReturns200(): void
    {
        $app       = $this->createApp();
        $container = $this->buildContainer();
        [$owner, $ownerToken] = $this->seedApprovedUser($container, 'owner3@test.com');
        [, $adminToken]       = $this->seedAdmin($container);

        $bookRepo = new DbalBookRepository($container->get(\Doctrine\DBAL\Connection::class));
        $bookId   = $bookRepo->save(new Book(0, $owner->id()->value(), 'Title', 'Auth', BookStatus::Ready, '2024-01-01 00:00:00'));

        $response = $app->handle($this->jsonRequest('PUT', "/api/library/books/{$bookId}", [
            'title'  => 'Admin Edit',
            'author' => 'Admin',
            'description' => 'Admin desc',
        ], $adminToken));

        $this->assertSame(200, $response->getStatusCode());
    }

    public function testTouchBookReturns200AndSetsLastReadBookId(): void
    {
        $app       = $this->createApp();
        $container = $this->buildContainer();
        [$user, $token] = $this->seedApprovedUser($container, 'reader@test.com');

        $bookRepo = new DbalBookRepository($container->get(\Doctrine\DBAL\Connection::class));
        $bookId   = $bookRepo->save(new Book(0, $user->id()->value(), 'Chess', 'Author', BookStatus::Ready, '2024-01-01 00:00:00'));

        $factory = new ServerRequestFactory();
        $response = $app->handle($this->authRequest('POST', "/api/library/books/{$bookId}/touch", $token));

        $this->assertSame(200, $response->getStatusCode());

        // Verify last_read_book_id was set
        $userRepo = $container->get(UserRepository::class);
        $updated  = $userRepo->findById($user->id());
        $this->assertSame($bookId, $updated->lastReadBookId());
    }
}
