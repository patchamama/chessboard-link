<?php

declare(strict_types=1);

use App\Presentation\Admin\AdminController;
use App\Presentation\Auth\AuthController;
use App\Presentation\Diagram\DiagramController;
use App\Presentation\Eval\EvalController;
use App\Presentation\Health\HealthController;
use App\Presentation\Ingestion\IngestionController;
use App\Presentation\Library\LibraryController;
use App\Presentation\Notes\NotesController;
use App\Presentation\Trainer\TrainerController;
use App\Presentation\Recognition\RecognitionController;
use App\Presentation\Webparser\WebparserController;
use App\Presentation\Middleware\AuthMiddleware;
use App\Presentation\Middleware\RequireAdminMiddleware;
use App\Presentation\Middleware\RequireApprovedMiddleware;
use Slim\App;
use Slim\Routing\RouteCollectorProxy;

return function (App $app): void {
    $app->get('/api/health', HealthController::class);

    // Auth routes (public)
    $app->group('/api/auth', function (RouteCollectorProxy $group) {
        $group->post('/register', [AuthController::class, 'register']);
        $group->post('/login', [AuthController::class, 'login']);
        $group->post('/password-reset/request', [AuthController::class, 'requestReset']);
        $group->post('/password-reset/confirm', [AuthController::class, 'resetPassword']);
    });

    // Admin routes (require JWT + Admin role)
    $app->group('/api/admin', function (RouteCollectorProxy $group) {
        $group->get('/pending-users', [AdminController::class, 'pendingUsers']);
        $group->get('/active-users', [AdminController::class, 'activeUsers']);
        $group->get('/blocked-users', [AdminController::class, 'blockedUsers']);
        $group->get('/users/{id:[0-9]+}/books', [AdminController::class, 'userBooks']);
        $group->post('/users/{id:[0-9]+}/approve', [AdminController::class, 'approve']);
        $group->post('/users/{id:[0-9]+}/reject', [AdminController::class, 'reject']);
        $group->post('/users/{id:[0-9]+}/password', [AdminController::class, 'setPassword']);
        $group->post('/users/{id:[0-9]+}/send-reset', [AdminController::class, 'sendResetLink']);
    })->add(RequireAdminMiddleware::class)->add(AuthMiddleware::class);

    // Notes routes (per-user scratch notes; require JWT + Approved)
    $app->group('/api/notes', function (RouteCollectorProxy $group) {
        $group->get('', [NotesController::class, 'get']);
        $group->put('', [NotesController::class, 'save']);
    })->add(RequireApprovedMiddleware::class)->add(AuthMiddleware::class);

    // Position Trainer routes (spaced repetition; require JWT + Approved)
    $app->group('/api/trainer', function (RouteCollectorProxy $group) {
        $group->get('/lines', [TrainerController::class, 'list']);
        $group->post('/lines', [TrainerController::class, 'add']);
        $group->post('/lines/{id:[0-9]+}/review', [TrainerController::class, 'review']);
        $group->delete('/lines/{id:[0-9]+}', [TrainerController::class, 'delete']);
    })->add(RequireApprovedMiddleware::class)->add(AuthMiddleware::class);

    // Recognition route (require JWT + Approved)
    $app->group('/api/recognition', function (RouteCollectorProxy $group) {
        $group->post('/parse', [RecognitionController::class, 'parse']);
    })->add(RequireApprovedMiddleware::class)->add(AuthMiddleware::class);

    // Eval routes (require JWT + Approved)
    $app->group('/api/eval', function (RouteCollectorProxy $group) {
        $group->post('/position', [EvalController::class, 'position']);
        $group->post('/game', [EvalController::class, 'game']);
    })->add(RequireApprovedMiddleware::class)->add(AuthMiddleware::class);

    // Diagram routes (require JWT + Approved)
    $app->group('/api/diagrams', function (RouteCollectorProxy $group) {
        $group->post('/regenerate', [DiagramController::class, 'regenerate']);
    })->add(RequireApprovedMiddleware::class)->add(AuthMiddleware::class);

    // Webparser routes (require JWT + Approved)
    $app->group('/api/webparser', function (RouteCollectorProxy $group) {
        $group->post('/parse', [WebparserController::class, 'parse']);
    })->add(RequireApprovedMiddleware::class)->add(AuthMiddleware::class);

    // Public book cover — served as a plain <img>, which cannot send an auth
    // header. Only exposes the cover image binary (no sensitive data).
    $app->get('/api/library/books/{id:[0-9]+}/cover', [LibraryController::class, 'cover']);

    // Library routes (require JWT + Approved)
    $app->group('/api/library', function (RouteCollectorProxy $group) {
        $group->get('/books', [LibraryController::class, 'books']);
        $group->get('/books/{id:[0-9]+}/chapters/{n:[0-9]+}', [LibraryController::class, 'chapter']);
        $group->get('/books/{id:[0-9]+}/images/{path:.+}', [LibraryController::class, 'image']);
        $group->put('/books/{id:[0-9]+}', [LibraryController::class, 'updateBook']);
        $group->delete('/books/{id:[0-9]+}', [LibraryController::class, 'deleteBook']);
        $group->post('/books/{id:[0-9]+}/touch', [LibraryController::class, 'touch']);
        $group->post('/upload', [IngestionController::class, 'upload']);
    })->add(RequireApprovedMiddleware::class)->add(AuthMiddleware::class);
};
