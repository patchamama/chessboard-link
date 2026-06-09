<?php

declare(strict_types=1);

use App\Application\Auth\ApproveUserHandler;
use App\Application\Auth\ListPendingUsersHandler;
use App\Application\Auth\LoginHandler;
use App\Application\Auth\Port\PasswordHasher;
use App\Application\Auth\Port\TokenIssuer;
use App\Application\Auth\RegisterUserHandler;
use App\Application\Auth\RejectUserHandler;
use App\Application\Library\GetChapterHandler;
use App\Application\Library\ListBooksHandler;
use App\Domain\Auth\UserRepository;
use App\Domain\Library\BookRepository;
use App\Infrastructure\Auth\BcryptPasswordHasher;
use App\Infrastructure\Auth\JwtTokenIssuer;
use App\Infrastructure\Persistence\ConnectionFactory;
use App\Infrastructure\Persistence\DbalBookRepository;
use App\Infrastructure\Persistence\DbalUserRepository;
use App\Presentation\Admin\AdminController;
use App\Presentation\Auth\AuthController;
use App\Presentation\Health\HealthController;
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
];
