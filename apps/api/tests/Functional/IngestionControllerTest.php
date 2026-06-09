<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Application\Auth\ApproveUserHandler;
use App\Application\Auth\Command\ApproveUserCommand;
use App\Application\Auth\Command\RegisterUserCommand;
use App\Application\Auth\RegisterUserHandler;
use App\Domain\Auth\UserRepository;
use App\Infrastructure\Auth\JwtTokenIssuer;
use App\Tests\Fixtures\epub\EpubFixture;
use App\Tests\TestCase;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\UploadedFile;
use Slim\Psr7\Stream;

final class IngestionControllerTest extends TestCase
{
    private function seedApprovedUser(string $email = 'uploader@test.com'): array
    {
        $container = $this->buildContainer();
        $settings  = $container->get('settings');

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

    public function test_upload_epub_returns_202_with_book_id(): void
    {
        $app = $this->createApp();
        [, $token] = $this->seedApprovedUser('epub_upload@test.com');

        $epubPath = EpubFixture::create();
        $stream   = new Stream(fopen($epubPath, 'r'));
        $uploaded = new UploadedFile($stream, 'fixture.epub', 'application/epub+zip', filesize($epubPath));

        $req = (new ServerRequestFactory())->createServerRequest('POST', '/api/library/upload')
            ->withHeader('Authorization', 'Bearer ' . $token)
            ->withUploadedFiles(['file' => $uploaded]);

        $res = $app->handle($req);

        self::assertSame(202, $res->getStatusCode());
        $body = json_decode((string) $res->getBody(), true);
        self::assertArrayHasKey('bookId', $body);
        self::assertArrayHasKey('status', $body);
        self::assertSame('ready', $body['status']);

        // File was moved by the controller; suppress if already gone
        @unlink($epubPath);
    }

    public function test_after_upload_book_appears_in_library(): void
    {
        $app = $this->createApp();
        [, $token] = $this->seedApprovedUser('epub_list@test.com');

        $epubPath = EpubFixture::create();
        $stream   = new Stream(fopen($epubPath, 'r'));
        $uploaded = new UploadedFile($stream, 'fixture.epub', 'application/epub+zip', filesize($epubPath));

        // Upload
        $uploadReq = (new ServerRequestFactory())->createServerRequest('POST', '/api/library/upload')
            ->withHeader('Authorization', 'Bearer ' . $token)
            ->withUploadedFiles(['file' => $uploaded]);
        $app->handle($uploadReq);

        // List books
        $listReq = (new ServerRequestFactory())->createServerRequest('GET', '/api/library/books')
            ->withHeader('Authorization', 'Bearer ' . $token);
        $res = $app->handle($listReq);

        $books = json_decode((string) $res->getBody(), true);
        self::assertNotEmpty($books);
        $titles = array_column($books, 'title');
        self::assertContains('Chess Fundamentals', $titles);

        @unlink($epubPath);
    }

    public function test_upload_without_auth_returns_401(): void
    {
        $app = $this->createApp();

        $req = (new ServerRequestFactory())->createServerRequest('POST', '/api/library/upload')
            ->withHeader('Content-Type', 'application/json')
            ->withParsedBody(['url' => 'https://example.com/chess']);

        $res = $app->handle($req);
        self::assertSame(401, $res->getStatusCode());
    }
}
