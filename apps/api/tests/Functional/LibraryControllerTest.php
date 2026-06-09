<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Application\Auth\Command\RegisterUserCommand;
use App\Application\Auth\Command\ApproveUserCommand;
use App\Application\Auth\RegisterUserHandler;
use App\Application\Auth\ApproveUserHandler;
use App\Domain\Auth\UserRepository;
use App\Domain\Library\Book;
use App\Domain\Library\BookStatus;
use App\Infrastructure\Auth\JwtTokenIssuer;
use App\Infrastructure\Persistence\DbalBookRepository;
use App\Tests\TestCase;
use Slim\Psr7\Factory\ServerRequestFactory;

class LibraryControllerTest extends TestCase
{
    public function testBooksWithoutTokenReturns401(): void
    {
        $app = $this->createApp();
        $factory = new ServerRequestFactory();
        $request = $factory->createServerRequest('GET', '/api/library/books');
        $response = $app->handle($request);
        $this->assertSame(401, $response->getStatusCode());
    }

    public function testBooksWithApprovedUserReturnsOnlyReadyBooks(): void
    {
        $app       = $this->createApp();
        $container = $this->buildContainer();
        $settings  = $container->get('settings');

        [$user, $token] = $this->seedApprovedUser($container, 'libuser@test.com', $settings);

        $bookRepo = new DbalBookRepository($container->get(\Doctrine\DBAL\Connection::class));

        // Insert Ready book for this user
        $bookRepo->save(new Book(0, $user->id()->value(), 'Ready Book', 'Auth A', BookStatus::Ready, '2024-01-01 00:00:00'));
        // Insert non-Ready book — should NOT appear
        $bookRepo->save(new Book(0, $user->id()->value(), 'Uploading Book', 'Auth B', BookStatus::Uploaded, '2024-01-02 00:00:00'));
        // Insert Ready book for ANOTHER user — should NOT appear
        $bookRepo->save(new Book(0, 9999, 'Other User Book', 'Auth C', BookStatus::Ready, '2024-01-03 00:00:00'));

        $factory = new ServerRequestFactory();
        $request = $factory->createServerRequest('GET', '/api/library/books')
            ->withHeader('Authorization', "Bearer {$token}");

        $response = $app->handle($request);
        $body = json_decode((string) $response->getBody(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertIsArray($body);
        $this->assertCount(1, $body);
        $this->assertSame('Ready Book', $body[0]['title']);
    }

    public function testChapterReturnsHtmlAndToc(): void
    {
        $app       = $this->createApp();
        $container = $this->buildContainer();
        $settings  = $container->get('settings');

        [$user, $token] = $this->seedApprovedUser($container, 'chapteruser@test.com', $settings);

        $bookRepo = new DbalBookRepository($container->get(\Doctrine\DBAL\Connection::class));
        $bookId   = $bookRepo->save(new Book(0, $user->id()->value(), 'Chess Book', 'Auth', BookStatus::Ready, '2024-01-01 00:00:00'));
        $bookRepo->saveChapter($bookId, 0, 'Introduction', '<p>Intro</p>');
        $bookRepo->saveChapter($bookId, 1, 'Chapter One', '<p>C1</p>');

        $factory = new ServerRequestFactory();
        $request = $factory->createServerRequest('GET', "/api/library/books/{$bookId}/chapters/0")
            ->withHeader('Authorization', "Bearer {$token}");

        $response = $app->handle($request);
        $body = json_decode((string) $response->getBody(), true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('Introduction', $body['title']);
        $this->assertSame('<p>Intro</p>', $body['html']);
        $this->assertCount(2, $body['toc']);
        $this->assertSame(0, $body['toc'][0]['order']);
        $this->assertSame('Introduction', $body['toc'][0]['title']);
    }

    private function seedApprovedUser(
        \Psr\Container\ContainerInterface $container,
        string $email,
        array $settings,
    ): array {
        $registerHandler = $container->get(RegisterUserHandler::class);
        $approveHandler  = $container->get(ApproveUserHandler::class);
        $repo            = $container->get(UserRepository::class);

        $registerHandler->handle(new RegisterUserCommand($email, 'pass123'));
        $user = $repo->findByEmail($email);
        $approveHandler->handle(new ApproveUserCommand($user->id()->value()));
        $user = $repo->findByEmail($email);

        $issuer = new JwtTokenIssuer($settings['jwt']['secret']);
        $token  = $issuer->issue($user);

        return [$user, $token];
    }
}
