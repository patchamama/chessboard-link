<?php

declare(strict_types=1);

namespace App\Application\Admin;

use App\Domain\Auth\RegistrationStatus;
use App\Domain\Auth\UserRepository;
use App\Infrastructure\Persistence\UserMetricsReadModel;

final class ListUsersByStatusHandler
{
    public function __construct(
        private readonly UserRepository $userRepository,
        private readonly UserMetricsReadModel $metricsReadModel,
    ) {
    }

    public function handle(RegistrationStatus $status): array
    {
        return match ($status) {
            RegistrationStatus::Approved => $this->handleApproved(),
            RegistrationStatus::Rejected => $this->handleRejected(),
            RegistrationStatus::Pending  => $this->handlePending(),
        };
    }

    private function handleApproved(): array
    {
        $users   = $this->userRepository->findAllApproved();
        $metrics = $this->metricsReadModel->getMetricsForApprovedUsers();

        return array_map(function ($user) use ($metrics) {
            $m = $metrics[$user->id()->value()] ?? null;
            return [
                'id'                  => $user->id()->value(),
                'email'               => $user->email(),
                'name'                => $user->email(), // no separate name field
                'registration_status' => $user->status()->value,
                'login_count'         => $m['loginCount'] ?? 0,
                'last_read_book_id'   => $user->lastReadBookId(),
                'last_read_book_title' => $m['lastReadTitle'] ?? null,
                'book_count'          => $m['bookCount'] ?? 0,
                'storage_bytes'       => $m['storageBytes'] ?? 0,
            ];
        }, $users);
    }

    private function handleRejected(): array
    {
        return array_map(fn($u) => [
            'id'                  => $u->id()->value(),
            'email'               => $u->email(),
            'name'                => $u->email(),
            'registration_status' => $u->status()->value,
        ], $this->userRepository->findAllRejected());
    }

    private function handlePending(): array
    {
        return array_map(fn($u) => [
            'id'                  => $u->id()->value(),
            'email'               => $u->email(),
            'name'                => $u->email(),
            'registration_status' => $u->status()->value,
        ], $this->userRepository->findAllPending());
    }
}
