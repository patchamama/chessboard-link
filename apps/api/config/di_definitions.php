<?php

declare(strict_types=1);

use App\Application\Diagram\Port\DiagramRenderer;
use App\Application\Diagram\Port\PngExporter;
use App\Application\Diagram\RegenerateDiagramHandler;
use App\Application\Eval\EvaluateGameHandler;
use App\Application\Eval\EvaluatePositionHandler;
use App\Application\Eval\Port\ChessEngine;
use App\Application\Admin\GetUserBooksHandler;
use App\Application\Admin\ListUsersByStatusHandler;
use App\Application\Admin\SetUserPasswordHandler;
use App\Application\Auth\ApproveUserHandler;
use App\Application\Auth\ListPendingUsersHandler;
use App\Application\Auth\LoginHandler;
use App\Application\Auth\Port\PasswordHasher;
use App\Application\Auth\Port\PasswordResetNotifier;
use App\Application\Auth\Port\TokenGenerator;
use App\Application\Auth\Port\TokenIssuer;
use App\Application\Auth\RegisterUserHandler;
use App\Application\Auth\RejectUserHandler;
use App\Application\Auth\RequestPasswordResetHandler;
use App\Application\Auth\ResetPasswordHandler;
use App\Application\Library\SetLastReadBookHandler;
use App\Application\Library\DeleteBookHandler;
use App\Application\Library\UpdateBookHandler;
use App\Domain\Auth\PasswordResetRepository;
use App\Infrastructure\Auth\LoggingPasswordResetNotifier;
use App\Infrastructure\Auth\RandomTokenGenerator;
use App\Infrastructure\Persistence\DbalPasswordResetRepository;
use App\Infrastructure\Persistence\UserMetricsReadModel;
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
use App\Presentation\Notes\NotesController;
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

    PasswordResetRepository::class => function (ContainerInterface $c) {
        return new DbalPasswordResetRepository($c->get(Connection::class));
    },

    PasswordResetNotifier::class => function (ContainerInterface $c) {
        $settings = $c->get('settings');
        $baseUrl  = $settings['app_base_url'] ?? '';
        return new LoggingPasswordResetNotifier($baseUrl);
    },

    TokenGenerator::class => fn() => new RandomTokenGenerator(),

    UserMetricsReadModel::class => function (ContainerInterface $c) {
        return new UserMetricsReadModel($c->get(Connection::class));
    },

    ListUsersByStatusHandler::class => function (ContainerInterface $c) {
        return new ListUsersByStatusHandler($c->get(UserRepository::class), $c->get(UserMetricsReadModel::class));
    },

    GetUserBooksHandler::class => function (ContainerInterface $c) {
        return new GetUserBooksHandler($c->get(BookRepository::class));
    },

    SetUserPasswordHandler::class => function (ContainerInterface $c) {
        return new SetUserPasswordHandler($c->get(UserRepository::class), $c->get(PasswordHasher::class));
    },

    RequestPasswordResetHandler::class => function (ContainerInterface $c) {
        return new RequestPasswordResetHandler(
            $c->get(UserRepository::class),
            $c->get(PasswordResetRepository::class),
            $c->get(TokenGenerator::class),
            $c->get(PasswordResetNotifier::class),
        );
    },

    ResetPasswordHandler::class => function (ContainerInterface $c) {
        return new ResetPasswordHandler(
            $c->get(PasswordResetRepository::class),
            $c->get(UserRepository::class),
            $c->get(PasswordHasher::class),
        );
    },

    UpdateBookHandler::class => function (ContainerInterface $c) {
        return new UpdateBookHandler($c->get(BookRepository::class));
    },

    DeleteBookHandler::class => function (ContainerInterface $c) {
        return new DeleteBookHandler($c->get(BookRepository::class));
    },

    SetLastReadBookHandler::class => function (ContainerInterface $c) {
        return new SetLastReadBookHandler($c->get(UserRepository::class));
    },

    AuthController::class => function (ContainerInterface $c) {
        return new AuthController(
            $c->get(RegisterUserHandler::class),
            $c->get(LoginHandler::class),
            $c->get(RequestPasswordResetHandler::class),
            $c->get(ResetPasswordHandler::class),
        );
    },

    AdminController::class => function (ContainerInterface $c) {
        return new AdminController(
            $c->get(ListPendingUsersHandler::class),
            $c->get(ApproveUserHandler::class),
            $c->get(RejectUserHandler::class),
            $c->get(ListUsersByStatusHandler::class),
            $c->get(GetUserBooksHandler::class),
            $c->get(SetUserPasswordHandler::class),
            $c->get(RequestPasswordResetHandler::class),
            $c->get(UserRepository::class),
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
            $c->get(UpdateBookHandler::class),
            $c->get(DeleteBookHandler::class),
            $c->get(SetLastReadBookHandler::class),
            $c->get(OpfManifestParser::class),
        );
    },

    NotesController::class => function (ContainerInterface $c) {
        $settings   = $c->get('settings');
        $storageDir = $settings['storage_dir'] ?? dirname(__DIR__) . '/storage';
        return new NotesController($storageDir);
    },

    // Position Trainer
    \App\Application\Clock::class => fn() => new \App\Infrastructure\SystemClock(),

    \App\Domain\Trainer\Sm2Scheduler::class => fn() => new \App\Domain\Trainer\Sm2Scheduler(),

    \App\Domain\Trainer\TrainerLineRepository::class => function (ContainerInterface $c) {
        return new \App\Infrastructure\Persistence\DbalTrainerLineRepository($c->get(Connection::class));
    },

    \App\Application\Trainer\AddTrainerLineHandler::class => function (ContainerInterface $c) {
        return new \App\Application\Trainer\AddTrainerLineHandler(
            $c->get(\App\Domain\Trainer\TrainerLineRepository::class),
            $c->get(\App\Application\Clock::class),
        );
    },

    \App\Application\Trainer\ListTrainerLinesHandler::class => function (ContainerInterface $c) {
        return new \App\Application\Trainer\ListTrainerLinesHandler(
            $c->get(\App\Domain\Trainer\TrainerLineRepository::class),
        );
    },

    \App\Application\Trainer\ReviewTrainerLineHandler::class => function (ContainerInterface $c) {
        return new \App\Application\Trainer\ReviewTrainerLineHandler(
            $c->get(\App\Domain\Trainer\TrainerLineRepository::class),
            $c->get(\App\Domain\Trainer\Sm2Scheduler::class),
            $c->get(\App\Application\Clock::class),
        );
    },

    \App\Application\Trainer\DeleteTrainerLineHandler::class => function (ContainerInterface $c) {
        return new \App\Application\Trainer\DeleteTrainerLineHandler(
            $c->get(\App\Domain\Trainer\TrainerLineRepository::class),
        );
    },

    \App\Presentation\Trainer\TrainerController::class => function (ContainerInterface $c) {
        return new \App\Presentation\Trainer\TrainerController(
            $c->get(\App\Application\Trainer\AddTrainerLineHandler::class),
            $c->get(\App\Application\Trainer\ListTrainerLinesHandler::class),
            $c->get(\App\Application\Trainer\ReviewTrainerLineHandler::class),
            $c->get(\App\Application\Trainer\DeleteTrainerLineHandler::class),
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
        $root      = dirname(__DIR__, 3);
        $pieceDir  = $root . '/css/images/pieces/merida';
        $feAssets  = $root . '/apps/web/src/shared/chess/pieces/assets';
        // Selectable piece sets: merida (server) + the inlined FE asset sets.
        $sets = ['merida' => $pieceDir];
        foreach (['cardinal', 'fantasy', 'leipzig', 'maestro', 'staunty'] as $set) {
            $dir = $feAssets . '/' . $set;
            if (is_dir($dir)) {
                $sets[$set] = $dir;
            }
        }
        return new SvgBoardRenderer($pieceDir, $sets);
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
