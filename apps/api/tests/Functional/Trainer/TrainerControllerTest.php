<?php

declare(strict_types=1);

namespace App\Tests\Functional\Trainer;

use App\Application\Auth\ApproveUserHandler;
use App\Application\Auth\Command\ApproveUserCommand;
use App\Application\Auth\Command\RegisterUserCommand;
use App\Application\Auth\RegisterUserHandler;
use App\Domain\Auth\UserRepository;
use App\Infrastructure\Auth\JwtTokenIssuer;
use App\Tests\TestCase;
use Slim\Psr7\Factory\ServerRequestFactory;

final class TrainerControllerTest extends TestCase
{
    private const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    private function seedToken(\Psr\Container\ContainerInterface $container, string $email): string
    {
        $container->get(RegisterUserHandler::class)->handle(new RegisterUserCommand($email, 'pass123'));
        $user = $container->get(UserRepository::class)->findByEmail($email);
        $container->get(ApproveUserHandler::class)->handle(new ApproveUserCommand($user->id()->value()));
        $user = $container->get(UserRepository::class)->findByEmail($email);
        $settings = $container->get('settings');
        return (new JwtTokenIssuer($settings['jwt']['secret']))->issue($user);
    }

    private function json(string $method, string $uri, array $body, string $token): \Psr\Http\Message\ServerRequestInterface
    {
        $req = (new ServerRequestFactory())->createServerRequest($method, $uri)
            ->withHeader('Authorization', "Bearer {$token}")
            ->withHeader('Content-Type', 'application/json');
        $req->getBody()->write(json_encode($body));
        return $req->withParsedBody($body);
    }

    private function auth(string $method, string $uri, string $token): \Psr\Http\Message\ServerRequestInterface
    {
        return (new ServerRequestFactory())->createServerRequest($method, $uri)
            ->withHeader('Authorization', "Bearer {$token}");
    }

    public function test_requires_auth(): void
    {
        $app = $this->createApp();
        $resp = $app->handle((new ServerRequestFactory())->createServerRequest('GET', '/api/trainer/lines'));
        $this->assertSame(401, $resp->getStatusCode());
    }

    public function test_add_then_list_line(): void
    {
        $app       = $this->createApp();
        $container = $this->buildContainer();
        $token     = $this->seedToken($container, 'trainer-add@test.com');

        $addResp = $app->handle($this->json('POST', '/api/trainer/lines', [
            'name'        => 'Italian Game',
            'startFen'    => self::START,
            'movesUci'    => ['e2e4', 'e7e5', 'g1f3'],
            'orientation' => 'white',
        ], $token));

        $this->assertSame(201, $addResp->getStatusCode());
        $created = json_decode((string) $addResp->getBody(), true);
        $this->assertArrayHasKey('id', $created);
        $this->assertSame('Italian Game', $created['name']);

        $listResp = $app->handle($this->auth('GET', '/api/trainer/lines', $token));
        $this->assertSame(200, $listResp->getStatusCode());
        $lines = json_decode((string) $listResp->getBody(), true);
        $this->assertCount(1, $lines);
        $this->assertSame(['e2e4', 'e7e5', 'g1f3'], $lines[0]['movesUci']);
        $this->assertArrayHasKey('dueAt', $lines[0]);
    }

    public function test_lines_are_per_user(): void
    {
        $app       = $this->createApp();
        $container = $this->buildContainer();
        $tokenA    = $this->seedToken($container, 'trainer-a@test.com');
        $tokenB    = $this->seedToken($container, 'trainer-b@test.com');

        $app->handle($this->json('POST', '/api/trainer/lines', [
            'name' => 'A line', 'startFen' => self::START, 'movesUci' => ['e2e4'],
        ], $tokenA));

        $listB = json_decode((string) $app->handle($this->auth('GET', '/api/trainer/lines', $tokenB))->getBody(), true);
        $this->assertCount(0, $listB);
    }

    public function test_review_reschedules_due_date(): void
    {
        $app       = $this->createApp();
        $container = $this->buildContainer();
        $token     = $this->seedToken($container, 'trainer-review@test.com');

        $created = json_decode((string) $app->handle($this->json('POST', '/api/trainer/lines', [
            'name' => 'Line', 'startFen' => self::START, 'movesUci' => ['e2e4'],
        ], $token))->getBody(), true);
        $id = $created['id'];

        $reviewResp = $app->handle($this->json('POST', "/api/trainer/lines/{$id}/review", [
            'grade' => 'good',
        ], $token));

        $this->assertSame(200, $reviewResp->getStatusCode());
        $updated = json_decode((string) $reviewResp->getBody(), true);
        $this->assertSame(1, $updated['reps']);
        $this->assertSame(1, $updated['intervalDays']);
    }

    public function test_delete_line(): void
    {
        $app       = $this->createApp();
        $container = $this->buildContainer();
        $token     = $this->seedToken($container, 'trainer-del@test.com');

        $created = json_decode((string) $app->handle($this->json('POST', '/api/trainer/lines', [
            'name' => 'Line', 'startFen' => self::START, 'movesUci' => ['e2e4'],
        ], $token))->getBody(), true);
        $id = $created['id'];

        $delResp = $app->handle($this->auth('DELETE', "/api/trainer/lines/{$id}", $token));
        $this->assertSame(200, $delResp->getStatusCode());

        $lines = json_decode((string) $app->handle($this->auth('GET', '/api/trainer/lines', $token))->getBody(), true);
        $this->assertCount(0, $lines);
    }
}
