<?php

declare(strict_types=1);

namespace App\Tests\Functional\Library;

use App\Domain\Auth\RegistrationStatus;
use App\Domain\Auth\Role;
use App\Domain\Auth\User;
use App\Domain\Auth\UserId;
use App\Domain\Auth\UserRepository;
use App\Infrastructure\Auth\JwtTokenIssuer;
use App\Tests\TestCase;
use Slim\Psr7\Factory\ServerRequestFactory;

class BookConfigControllerTest extends TestCase
{
    private string $tmpStorage;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tmpStorage = sys_get_temp_dir() . '/bookcfg-test-' . uniqid('', true);
        mkdir($this->tmpStorage, 0777, true);
    }

    protected function tearDown(): void
    {
        $this->rrmdir($this->tmpStorage);
        parent::tearDown();
    }

    private function rrmdir(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        foreach (scandir($dir) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            $path = $dir . '/' . $entry;
            is_dir($path) ? $this->rrmdir($path) : @unlink($path);
        }
        @rmdir($dir);
    }

    /** @return array{0: \Slim\App, 1: \Psr\Container\ContainerInterface} */
    private function appWithTmpStorage(): array
    {
        $tmp = $this->tmpStorage;
        $container = $this->buildContainer([
            \App\Presentation\Library\BookConfigController::class => fn() =>
                new \App\Presentation\Library\BookConfigController($tmp),
        ]);
        $app    = \DI\Bridge\Slim\Bridge::create($container);
        $routes = require __DIR__ . '/../../../config/routes.php';
        $routes($app);

        return [$app, $container];
    }

    private function seedUser(
        \Psr\Container\ContainerInterface $container,
        string $email,
        Role $role,
    ): string {
        $repo   = $container->get(UserRepository::class);
        $hasher = $container->get(\App\Application\Auth\Port\PasswordHasher::class);

        $user = new User(
            new UserId(0),
            $email,
            $hasher->hash('pass123'),
            $role,
            RegistrationStatus::Approved,
            new \DateTimeImmutable(),
        );
        $saved = $repo->save($user);

        $settings = $container->get('settings');
        return (new JwtTokenIssuer($settings['jwt']['secret']))->issue($saved);
    }

    private function getReq(int $bookId, string $token): \Psr\Http\Message\ServerRequestInterface
    {
        return (new ServerRequestFactory())
            ->createServerRequest('GET', "/api/library/books/{$bookId}/config")
            ->withHeader('Authorization', "Bearer {$token}");
    }

    private function putReq(int $bookId, array $config, string $token): \Psr\Http\Message\ServerRequestInterface
    {
        $req = (new ServerRequestFactory())
            ->createServerRequest('PUT', "/api/library/books/{$bookId}/config")
            ->withHeader('Authorization', "Bearer {$token}")
            ->withHeader('Content-Type', 'application/json');
        $req->getBody()->write(json_encode($config));
        return $req;
    }

    public function testGetReturnsDefaultConfigWhenNoFile(): void
    {
        [$app, $container] = $this->appWithTmpStorage();
        $token = $this->seedUser($container, 'cfg-user@test.com', Role::User);

        $resp = $app->handle($this->getReq(42, $token));

        $this->assertSame(200, $resp->getStatusCode());
        $body = json_decode((string) $resp->getBody(), true);
        $this->assertSame(1, $body['version']);
        $this->assertSame('barra', $body['barClass']['name']);
        $this->assertTrue($body['barClass']['asHr']);
        $this->assertTrue($body['headingSpans']['h3']);
        $this->assertTrue($body['moveLineIndent']['zeroIndent']);
        $this->assertSame('', $body['extraCss']);
    }

    public function testAdminCanSaveThenAnyoneCanRead(): void
    {
        [$app, $container] = $this->appWithTmpStorage();
        $adminToken = $this->seedUser($container, 'cfg-admin@test.com', Role::Admin);
        $userToken  = $this->seedUser($container, 'cfg-reader@test.com', Role::User);

        $config = [
            'version' => 1,
            'headingSpans' => ['h2' => true, 'h3' => true, 'h4' => false, 'h5' => false],
            'barClass' => ['name' => 'separador', 'asHr' => true],
            'moveLineIndent' => ['zeroIndent' => true],
            'extraCss' => '.epub-content p { color: navy; }',
        ];
        $saveResp = $app->handle($this->putReq(7, $config, $adminToken));
        $this->assertSame(200, $saveResp->getStatusCode(), (string) $saveResp->getBody());

        // Any approved user can READ the saved config.
        $getResp = $app->handle($this->getReq(7, $userToken));
        $body = json_decode((string) $getResp->getBody(), true);
        $this->assertSame('separador', $body['barClass']['name']);
        $this->assertFalse($body['headingSpans']['h4']);
        $this->assertSame('.epub-content p { color: navy; }', $body['extraCss']);
    }

    public function testNonAdminCannotSave(): void
    {
        [$app, $container] = $this->appWithTmpStorage();
        $userToken = $this->seedUser($container, 'cfg-noadmin@test.com', Role::User);

        $resp = $app->handle($this->putReq(7, ['version' => 1], $userToken));

        $this->assertSame(403, $resp->getStatusCode());
    }

    public function testConfigIsolatedPerBook(): void
    {
        [$app, $container] = $this->appWithTmpStorage();
        $adminToken = $this->seedUser($container, 'cfg-iso@test.com', Role::Admin);

        $app->handle($this->putReq(1, ['version' => 1, 'extraCss' => 'book one'], $adminToken));
        $app->handle($this->putReq(2, ['version' => 1, 'extraCss' => 'book two'], $adminToken));

        $b1 = json_decode((string) $app->handle($this->getReq(1, $adminToken))->getBody(), true);
        $b2 = json_decode((string) $app->handle($this->getReq(2, $adminToken))->getBody(), true);

        $this->assertSame('book one', $b1['extraCss']);
        $this->assertSame('book two', $b2['extraCss']);
    }

    public function testSaveWritesBookConfigJsonFile(): void
    {
        [$app, $container] = $this->appWithTmpStorage();
        $adminToken = $this->seedUser($container, 'cfg-file@test.com', Role::Admin);

        $resp = $app->handle($this->putReq(99, ['version' => 1, 'extraCss' => 'x'], $adminToken));
        $this->assertSame(200, $resp->getStatusCode(), (string) $resp->getBody());

        $file = $this->tmpStorage . '/book-config/book.99.json';
        $this->assertFileExists($file);
    }
}
