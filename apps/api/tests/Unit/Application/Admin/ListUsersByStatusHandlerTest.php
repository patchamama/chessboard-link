<?php

declare(strict_types=1);

namespace App\Tests\Unit\Application\Admin;

use App\Application\Admin\ListUsersByStatusHandler;
use App\Domain\Auth\RegistrationStatus;
use App\Domain\Auth\Role;
use App\Domain\Auth\User;
use App\Domain\Auth\UserId;
use App\Domain\Auth\UserRepository;
use App\Infrastructure\Persistence\UserMetricsReadModel;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

class ListUsersByStatusHandlerTest extends TestCase
{
    private function makeUser(int $id, string $email, RegistrationStatus $status): User
    {
        return new User(
            new UserId($id),
            $email,
            'hash',
            Role::User,
            $status,
            new DateTimeImmutable(),
        );
    }

    public function testApprovedStatusReturnsMergedMetrics(): void
    {
        $user = $this->makeUser(1, 'alice@test.com', RegistrationStatus::Approved);

        $repo = $this->createMock(UserRepository::class);
        $repo->method('findAllApproved')->willReturn([$user]);

        $metricsModel = $this->createMock(UserMetricsReadModel::class);
        $metricsModel->method('getMetricsForApprovedUsers')->willReturn([
            1 => [
                'userId'        => 1,
                'loginCount'    => 7,
                'lastReadTitle' => 'Chess Tactics',
                'bookCount'     => 3,
                'storageBytes'  => 2048,
            ],
        ]);

        $handler = new ListUsersByStatusHandler($repo, $metricsModel);
        $result = $handler->handle(RegistrationStatus::Approved);

        $this->assertCount(1, $result);
        $this->assertSame(7, $result[0]['login_count']);
        $this->assertSame('Chess Tactics', $result[0]['last_read_book_title']);
        $this->assertSame(3, $result[0]['book_count']);
        $this->assertSame(2048, $result[0]['storage_bytes']);
        $this->assertSame('alice@test.com', $result[0]['email']);
    }

    public function testRejectedStatusReturnsBarelist(): void
    {
        $user = $this->makeUser(2, 'bob@test.com', RegistrationStatus::Rejected);

        $repo = $this->createMock(UserRepository::class);
        $repo->method('findAllRejected')->willReturn([$user]);

        $metricsModel = $this->createMock(UserMetricsReadModel::class);
        $metricsModel->expects($this->never())->method('getMetricsForApprovedUsers');

        $handler = new ListUsersByStatusHandler($repo, $metricsModel);
        $result = $handler->handle(RegistrationStatus::Rejected);

        $this->assertCount(1, $result);
        $this->assertSame('bob@test.com', $result[0]['email']);
        $this->assertArrayNotHasKey('login_count', $result[0]);
    }

    public function testPendingStatusReturnsBareList(): void
    {
        $user = $this->makeUser(3, 'carol@test.com', RegistrationStatus::Pending);

        $repo = $this->createMock(UserRepository::class);
        $repo->method('findAllPending')->willReturn([$user]);

        $metricsModel = $this->createMock(UserMetricsReadModel::class);
        $metricsModel->expects($this->never())->method('getMetricsForApprovedUsers');

        $handler = new ListUsersByStatusHandler($repo, $metricsModel);
        $result = $handler->handle(RegistrationStatus::Pending);

        $this->assertCount(1, $result);
        $this->assertArrayNotHasKey('login_count', $result[0]);
    }
}
