<?php

declare(strict_types=1);

namespace App\Presentation\Admin;

use App\Application\Admin\GetUserBooksHandler;
use App\Application\Admin\ListUsersByStatusHandler;
use App\Application\Admin\SetUserPasswordCommand;
use App\Application\Admin\SetUserPasswordHandler;
use App\Application\Auth\ApproveUserHandler;
use App\Application\Auth\Command\ApproveUserCommand;
use App\Application\Auth\Command\RejectUserCommand;
use App\Application\Auth\ListPendingUsersHandler;
use App\Application\Auth\RequestPasswordResetCommand;
use App\Application\Auth\RequestPasswordResetHandler;
use App\Application\Auth\RejectUserHandler;
use App\Domain\Auth\RegistrationStatus;
use App\Domain\Auth\UserId;
use App\Domain\Auth\UserRepository;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class AdminController
{
    public function __construct(
        private readonly ListPendingUsersHandler $listHandler,
        private readonly ApproveUserHandler $approveHandler,
        private readonly RejectUserHandler $rejectHandler,
        private readonly ListUsersByStatusHandler $listByStatusHandler,
        private readonly GetUserBooksHandler $getUserBooksHandler,
        private readonly SetUserPasswordHandler $setPasswordHandler,
        private readonly RequestPasswordResetHandler $requestResetHandler,
        private readonly UserRepository $userRepository,
    ) {
    }

    public function pendingUsers(Request $request, Response $response): Response
    {
        $users = $this->listHandler->handle();
        $data  = array_map(fn($u) => [
            'id'     => $u->id()->value(),
            'email'  => $u->email(),
            'status' => $u->status()->value,
        ], $users);

        $response->getBody()->write(json_encode($data));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function approve(Request $request, Response $response, int $id): Response
    {
        $this->approveHandler->handle(new ApproveUserCommand($id));
        $response->getBody()->write(json_encode(['ok' => true]));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function reject(Request $request, Response $response, int $id): Response
    {
        $this->rejectHandler->handle(new RejectUserCommand($id));
        $response->getBody()->write(json_encode(['ok' => true]));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function activeUsers(Request $request, Response $response): Response
    {
        $users = $this->listByStatusHandler->handle(RegistrationStatus::Approved);
        $response->getBody()->write(json_encode(['users' => $users]));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function blockedUsers(Request $request, Response $response): Response
    {
        $users = $this->listByStatusHandler->handle(RegistrationStatus::Rejected);
        $response->getBody()->write(json_encode(['users' => $users]));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function userBooks(Request $request, Response $response, int $id): Response
    {
        $books = $this->getUserBooksHandler->handle($id);
        $response->getBody()->write(json_encode(['books' => $books]));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function setPassword(Request $request, Response $response, int $id): Response
    {
        $body     = (array) json_decode((string) $request->getBody(), true);
        $password = $body['password'] ?? '';

        try {
            $this->setPasswordHandler->handle(new SetUserPasswordCommand($id, $password));
        } catch (\InvalidArgumentException $e) {
            $response->getBody()->write(json_encode(['error' => $e->getMessage()]));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(422);
        }

        $response->getBody()->write(json_encode(['message' => 'Password updated successfully.']));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function sendResetLink(Request $request, Response $response, int $id): Response
    {
        // Look up email from user id
        $user = $this->userRepository->findById(new UserId($id));
        $email = $user?->email() ?? '';

        $this->requestResetHandler->handle(new RequestPasswordResetCommand($email));

        $response->getBody()->write(json_encode([
            'message' => 'If the user exists, a password reset link has been generated.',
        ]));
        return $response->withHeader('Content-Type', 'application/json');
    }
}
