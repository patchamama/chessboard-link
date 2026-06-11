<?php

declare(strict_types=1);

namespace App\Presentation\Auth;

use App\Application\Auth\Command\LoginCommand;
use App\Application\Auth\Command\RegisterUserCommand;
use App\Application\Auth\LoginHandler;
use App\Application\Auth\RegisterUserHandler;
use App\Application\Auth\RequestPasswordResetCommand;
use App\Application\Auth\RequestPasswordResetHandler;
use App\Application\Auth\ResetPasswordCommand;
use App\Application\Auth\ResetPasswordHandler;
use App\Domain\Auth\Exception\DuplicateEmailException;
use App\Domain\Auth\Exception\InvalidCredentialsException;
use App\Domain\Auth\Exception\InvalidResetTokenException;
use App\Domain\Auth\Exception\UserNotApprovedException;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class AuthController
{
    public function __construct(
        private readonly RegisterUserHandler $registerHandler,
        private readonly LoginHandler $loginHandler,
        private readonly RequestPasswordResetHandler $requestResetHandler,
        private readonly ResetPasswordHandler $resetPasswordHandler,
    ) {
    }

    public function register(Request $request, Response $response): Response
    {
        $body  = (array) json_decode((string) $request->getBody(), true);
        $email = trim($body['email'] ?? '');
        $pass  = $body['password'] ?? '';

        try {
            $user = $this->registerHandler->handle(new RegisterUserCommand($email, $pass));
        } catch (DuplicateEmailException $e) {
            return $this->json($response, ['error' => $e->getMessage()], 409);
        }

        return $this->json($response, [
            'id'     => $user->id()->value(),
            'email'  => $user->email(),
            'status' => $user->status()->value,
        ], 201);
    }

    public function login(Request $request, Response $response): Response
    {
        $body  = (array) json_decode((string) $request->getBody(), true);
        $email = trim($body['email'] ?? '');
        $pass  = $body['password'] ?? '';

        try {
            $token = $this->loginHandler->handle(new LoginCommand($email, $pass));
        } catch (UserNotApprovedException $e) {
            return $this->json($response, ['error' => $e->getMessage()], 403);
        } catch (InvalidCredentialsException $e) {
            return $this->json($response, ['error' => $e->getMessage()], 401);
        }

        return $this->json($response, ['token' => $token], 200);
    }

    public function requestReset(Request $request, Response $response): Response
    {
        $body  = (array) json_decode((string) $request->getBody(), true);
        $email = trim($body['email'] ?? '');

        $this->requestResetHandler->handle(new RequestPasswordResetCommand($email));

        return $this->json($response, [
            'message' => 'If the user exists, a password reset link has been generated.',
        ], 200);
    }

    public function resetPassword(Request $request, Response $response): Response
    {
        $body     = (array) json_decode((string) $request->getBody(), true);
        $token    = $body['token'] ?? '';
        $password = $body['password'] ?? '';

        try {
            $this->resetPasswordHandler->handle(new ResetPasswordCommand($token, $password));
        } catch (InvalidResetTokenException $e) {
            return $this->json($response, ['message' => 'Invalid or expired reset token.'], 400);
        }

        return $this->json($response, ['message' => 'Password has been reset successfully.'], 200);
    }

    private function json(Response $response, array $data, int $status): Response
    {
        $response->getBody()->write(json_encode($data));
        return $response->withHeader('Content-Type', 'application/json')->withStatus($status);
    }
}
