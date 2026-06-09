<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Application\Auth\ApproveUserHandler;
use App\Application\Auth\Command\ApproveUserCommand;
use App\Application\Auth\Command\RegisterUserCommand;
use App\Application\Auth\RegisterUserHandler;
use App\Application\Diagram\Port\DiagramRenderer;
use App\Application\Diagram\Port\PngExporter;
use App\Application\Eval\Port\ChessEngine;
use App\Domain\Auth\UserRepository;
use App\Domain\Chess\Evaluation;
use App\Domain\Chess\Fen;
use App\Infrastructure\Auth\JwtTokenIssuer;
use App\Tests\TestCase;
use Slim\Psr7\Factory\ServerRequestFactory;

final class DiagramControllerTest extends TestCase
{
    private const STARTPOS = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    private function makeFakeEngine(): ChessEngine
    {
        $engine = $this->createMock(ChessEngine::class);
        $engine->method('evaluate')->willReturn(
            Evaluation::fromCp(130, 'g1f3', 18)
        );
        return $engine;
    }

    private function makeFakeRenderer(): DiagramRenderer
    {
        $renderer = $this->createMock(DiagramRenderer::class);
        $renderer->method('renderSvg')->willReturn(
            '<svg xmlns="http://www.w3.org/2000/svg"><text>+1.3 best: Nf3</text></svg>'
        );
        return $renderer;
    }

    private function makeFakeExporter(): PngExporter
    {
        $exporter = $this->createMock(PngExporter::class);
        $exporter->method('export')->willReturn("\x89PNG\r\n\x1a\nFAKE_PNG_BYTES");
        return $exporter;
    }

    private function seedAndToken(string $email): string
    {
        $overrides = [
            ChessEngine::class    => fn() => $this->makeFakeEngine(),
            DiagramRenderer::class => fn() => $this->makeFakeRenderer(),
            PngExporter::class    => fn() => $this->makeFakeExporter(),
        ];
        $container = $this->buildContainer($overrides);
        $settings  = $container->get('settings');

        $container->get(RegisterUserHandler::class)->handle(new RegisterUserCommand($email, 'pass'));
        $user = $container->get(UserRepository::class)->findByEmail($email);
        $container->get(ApproveUserHandler::class)->handle(new ApproveUserCommand($user->id()->value()));
        $user = $container->get(UserRepository::class)->findByEmail($email);

        return (new JwtTokenIssuer($settings['jwt']['secret']))->issue($user);
    }

    private function makeApp(): \Slim\App
    {
        return $this->createAppWithOverrides([
            ChessEngine::class    => fn() => $this->makeFakeEngine(),
            DiagramRenderer::class => fn() => $this->makeFakeRenderer(),
            PngExporter::class    => fn() => $this->makeFakeExporter(),
        ]);
    }

    // -----------------------------------------------------------------------
    // POST /api/diagrams/regenerate
    // -----------------------------------------------------------------------

    public function test_regenerate_returns_401_without_token(): void
    {
        $app     = $this->makeApp();
        $factory = new ServerRequestFactory();

        $req = $factory->createServerRequest('POST', '/api/diagrams/regenerate')
            ->withParsedBody(['fen' => self::STARTPOS])
            ->withHeader('Content-Type', 'application/json');

        $this->assertSame(401, $app->handle($req)->getStatusCode());
    }

    public function test_regenerate_returns_svg_and_footer(): void
    {
        $token   = $this->seedAndToken('diag_regen@test.com');
        $app     = $this->makeApp();
        $factory = new ServerRequestFactory();

        $req = $factory->createServerRequest('POST', '/api/diagrams/regenerate')
            ->withParsedBody(['fen' => self::STARTPOS, 'depth' => 18])
            ->withHeader('Content-Type', 'application/json')
            ->withHeader('Authorization', "Bearer {$token}");

        $resp = $app->handle($req);
        $body = json_decode((string) $resp->getBody(), true);

        $this->assertSame(200, $resp->getStatusCode());
        $this->assertArrayHasKey('svg', $body);
        $this->assertStringContainsString('<svg', $body['svg']);
        $this->assertArrayHasKey('footer', $body);
        $this->assertStringContainsString('+1.3', $body['footer']);
    }

    public function test_regenerate_returns_400_for_missing_fen(): void
    {
        $token   = $this->seedAndToken('diag_400@test.com');
        $app     = $this->makeApp();
        $factory = new ServerRequestFactory();

        $req = $factory->createServerRequest('POST', '/api/diagrams/regenerate')
            ->withParsedBody([])
            ->withHeader('Content-Type', 'application/json')
            ->withHeader('Authorization', "Bearer {$token}");

        $this->assertSame(400, $app->handle($req)->getStatusCode());
    }

    public function test_footer_reflects_fake_eval(): void
    {
        $token   = $this->seedAndToken('diag_footer@test.com');
        $app     = $this->makeApp();
        $factory = new ServerRequestFactory();

        $req = $factory->createServerRequest('POST', '/api/diagrams/regenerate')
            ->withParsedBody(['fen' => self::STARTPOS])
            ->withHeader('Content-Type', 'application/json')
            ->withHeader('Authorization', "Bearer {$token}");

        $resp = $app->handle($req);
        $body = json_decode((string) $resp->getBody(), true);

        // The fake engine returns +1.3 best: Nf3
        $this->assertStringContainsString('+1.3', $body['footer']);
        $this->assertStringContainsString('Nf3', $body['footer']);
    }
}
