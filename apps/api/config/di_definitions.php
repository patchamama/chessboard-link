<?php

declare(strict_types=1);

use App\Application\Diagram\Port\DiagramRenderer;
use App\Application\Diagram\Port\PngExporter;
use App\Application\Diagram\RegenerateDiagramHandler;
use App\Application\Eval\EvaluateGameHandler;
use App\Application\Eval\EvaluatePositionHandler;
use App\Application\Eval\Port\ChessEngine;
use App\Application\Auth\ApproveUserHandler;
use App\Application\Auth\ListPendingUsersHandler;
use App\Application\Auth\LoginHandler;
use App\Application\Auth\Port\PasswordHasher;
use App\Application\Auth\Port\TokenIssuer;
use App\Application\Auth\RegisterUserHandler;
use App\Application\Auth\RejectUserHandler;
use App\Application\Ingestion\ParseWebsiteHandler;
use App\Application\Ingestion\ProcessEpubHandler;
use App\Application\Recognition\RecognizeMovesHandler;
use App\Infrastructure\Chess\Engine\StockfishDownloader;
use App\Infrastructure\Chess\Engine\UciStockfishEngine;
use App\Infrastructure\Chess\Recognition\SanRecognizer;
use App\Infrastructure\Chess\Recognition\SpanishNotationNormalizer;
use App\Infrastructure\Chess\Recognition\VariationParser;
use App\Application\Webparser\ParseWebpageHandler;
use App\Presentation\Recognition\RecognitionController;
use App\Presentation\Webparser\WebparserController;
use App\Application\Library\GetChapterHandler;
use App\Application\Library\ListBooksHandler;
use App\Domain\Auth\UserRepository;
use App\Domain\Library\BookRepository;
use App\Infrastructure\Diagram\FilenamePreservingWriter;
use App\Infrastructure\Diagram\ResvgPngExporter;
use App\Infrastructure\Diagram\SvgBoardRenderer;
use App\Presentation\Diagram\DiagramController;
use App\Infrastructure\Auth\BcryptPasswordHasher;
use App\Infrastructure\Auth\JwtTokenIssuer;
use App\Infrastructure\Persistence\ConnectionFactory;
use App\Infrastructure\Persistence\DbalBookRepository;
use App\Infrastructure\Persistence\DbalUserRepository;
use App\Infrastructure\Epub\NcxTocParser;
use App\Infrastructure\Epub\OpfManifestParser;
use App\Infrastructure\Epub\ZipEpubExtractor;
use App\Infrastructure\Web\GuzzleHtmlFetcher;
use App\Infrastructure\Web\ReadabilityExtractor;
use App\Presentation\Eval\EvalController;
use App\Presentation\Admin\AdminController;
use App\Presentation\Auth\AuthController;
use App\Presentation\Health\HealthController;
use App\Presentation\Ingestion\IngestionController;
use App\Presentation\Library\LibraryController;
use App\Presentation\Middleware\AuthMiddleware;
use App\Presentation\Middleware\RequireAdminMiddleware;
use App\Presentation\Middleware\RequireApprovedMiddleware;
use Doctrine\DBAL\Connection;
use Psr\Container\ContainerInterface;
use Psr\Http\Message\ResponseFactoryInterface;
use Slim\Psr7\Factory\ResponseFactory;

return [
    ResponseFactoryInterface::class => fn() => new ResponseFactory(),

    AuthMiddleware::class => function (ContainerInterface $c) {
        return new AuthMiddleware(
            $c->get('settings')['jwt']['secret'],
            $c->get(ResponseFactoryInterface::class),
            $c->get('settings')['auth']['dev_bypass'] ?? false,
        );
    },

    RequireAdminMiddleware::class => function (ContainerInterface $c) {
        return new RequireAdminMiddleware($c->get(ResponseFactoryInterface::class));
    },

    RequireApprovedMiddleware::class => function (ContainerInterface $c) {
        return new RequireApprovedMiddleware($c->get(ResponseFactoryInterface::class));
    },

    HealthController::class => function (ContainerInterface $c) {
        return new HealthController($c->get('settings'));
    },

    Connection::class => function (ContainerInterface $c) {
        $settings = $c->get('settings');
        if ($settings['db']['path'] === ':memory:') {
            return \Doctrine\DBAL\DriverManager::getConnection([
                'driver' => 'pdo_sqlite',
                'memory' => true,
            ]);
        }
        return ConnectionFactory::create($settings);
    },

    UserRepository::class => function (ContainerInterface $c) {
        return new DbalUserRepository($c->get(Connection::class));
    },

    PasswordHasher::class => fn() => new BcryptPasswordHasher(),

    TokenIssuer::class => function (ContainerInterface $c) {
        return new JwtTokenIssuer($c->get('settings')['jwt']['secret']);
    },

    RegisterUserHandler::class => function (ContainerInterface $c) {
        return new RegisterUserHandler($c->get(UserRepository::class), $c->get(PasswordHasher::class));
    },

    LoginHandler::class => function (ContainerInterface $c) {
        return new LoginHandler($c->get(UserRepository::class), $c->get(PasswordHasher::class), $c->get(TokenIssuer::class));
    },

    ApproveUserHandler::class => function (ContainerInterface $c) {
        return new ApproveUserHandler($c->get(UserRepository::class));
    },

    RejectUserHandler::class => function (ContainerInterface $c) {
        return new RejectUserHandler($c->get(UserRepository::class));
    },

    ListPendingUsersHandler::class => function (ContainerInterface $c) {
        return new ListPendingUsersHandler($c->get(UserRepository::class));
    },

    AuthController::class => function (ContainerInterface $c) {
        return new AuthController(
            $c->get(RegisterUserHandler::class),
            $c->get(LoginHandler::class),
        );
    },

    AdminController::class => function (ContainerInterface $c) {
        return new AdminController(
            $c->get(ListPendingUsersHandler::class),
            $c->get(ApproveUserHandler::class),
            $c->get(RejectUserHandler::class),
        );
    },

    BookRepository::class => function (ContainerInterface $c) {
        return new DbalBookRepository($c->get(Connection::class));
    },

    ListBooksHandler::class => function (ContainerInterface $c) {
        return new ListBooksHandler($c->get(BookRepository::class));
    },

    GetChapterHandler::class => function (ContainerInterface $c) {
        return new GetChapterHandler($c->get(BookRepository::class));
    },

    LibraryController::class => function (ContainerInterface $c) {
        return new LibraryController(
            $c->get(ListBooksHandler::class),
            $c->get(GetChapterHandler::class),
        );
    },

    \App\Application\Ingestion\Port\HtmlFetcher::class => fn(ContainerInterface $c) => $c->get(GuzzleHtmlFetcher::class),

    ZipEpubExtractor::class  => fn() => new ZipEpubExtractor(),
    NcxTocParser::class      => fn() => new NcxTocParser(),
    OpfManifestParser::class => fn() => new OpfManifestParser(),
    GuzzleHtmlFetcher::class => fn() => new GuzzleHtmlFetcher(),
    ReadabilityExtractor::class => fn() => new ReadabilityExtractor(),

    ProcessEpubHandler::class => function (ContainerInterface $c) {
        return new ProcessEpubHandler(
            $c->get(BookRepository::class),
            $c->get(ZipEpubExtractor::class),
            $c->get(NcxTocParser::class),
            $c->get(OpfManifestParser::class),
        );
    },

    ParseWebsiteHandler::class => function (ContainerInterface $c) {
        return new ParseWebsiteHandler(
            $c->get(BookRepository::class),
            $c->get(GuzzleHtmlFetcher::class),
            $c->get(ReadabilityExtractor::class),
        );
    },

    IngestionController::class => function (ContainerInterface $c) {
        return new IngestionController(
            $c->get(ProcessEpubHandler::class),
            $c->get(ParseWebsiteHandler::class),
        );
    },

    SpanishNotationNormalizer::class => fn() => new SpanishNotationNormalizer(),
    SanRecognizer::class             => fn() => new SanRecognizer(),
    VariationParser::class           => fn() => new VariationParser(),

    RecognizeMovesHandler::class => function (ContainerInterface $c) {
        return new RecognizeMovesHandler(
            $c->get(SpanishNotationNormalizer::class),
            $c->get(SanRecognizer::class),
            $c->get(VariationParser::class),
        );
    },

    RecognitionController::class => function (ContainerInterface $c) {
        return new RecognitionController($c->get(RecognizeMovesHandler::class));
    },

    // Eval
    ChessEngine::class => function (ContainerInterface $c) {
        $settings   = $c->get('settings');
        $storageDir = $settings['storage_dir'] ?? dirname(__DIR__) . '/storage';
        $downloader = new StockfishDownloader(
            $storageDir,
            fn() => PHP_OS_FAMILY,
            fn() => php_uname('m'),
        );
        // Use system stockfish if available, fallback to storage
        $systemBin = trim(shell_exec('which stockfish 2>/dev/null') ?? '');
        $binPath   = ($systemBin !== '' && is_executable($systemBin))
            ? $systemBin
            : $downloader->binaryPath();
        return new UciStockfishEngine($binPath);
    },

    EvaluatePositionHandler::class => function (ContainerInterface $c) {
        return new EvaluatePositionHandler($c->get(ChessEngine::class));
    },

    EvaluateGameHandler::class => function (ContainerInterface $c) {
        return new EvaluateGameHandler($c->get(ChessEngine::class));
    },

    EvalController::class => function (ContainerInterface $c) {
        return new EvalController(
            $c->get(EvaluatePositionHandler::class),
            $c->get(EvaluateGameHandler::class),
        );
    },

    // Webparser
    ParseWebpageHandler::class => function (ContainerInterface $c) {
        return new ParseWebpageHandler(
            $c->get(\App\Application\Ingestion\Port\HtmlFetcher::class),
            $c->get(ReadabilityExtractor::class),
            $c->get(RecognizeMovesHandler::class),
        );
    },

    WebparserController::class => function (ContainerInterface $c) {
        return new WebparserController($c->get(ParseWebpageHandler::class));
    },

    // Diagram
    DiagramRenderer::class => function (ContainerInterface $c) {
        $pieceDir = dirname(__DIR__, 3) . '/css/images/pieces/merida';
        return new SvgBoardRenderer($pieceDir);
    },

    PngExporter::class => fn() => new ResvgPngExporter(),

    FilenamePreservingWriter::class => fn() => new FilenamePreservingWriter(),

    RegenerateDiagramHandler::class => function (ContainerInterface $c) {
        return new RegenerateDiagramHandler(
            $c->get(ChessEngine::class),
            $c->get(DiagramRenderer::class),
            $c->get(PngExporter::class),
        );
    },

    DiagramController::class => function (ContainerInterface $c) {
        return new DiagramController($c->get(RegenerateDiagramHandler::class));
    },
];
