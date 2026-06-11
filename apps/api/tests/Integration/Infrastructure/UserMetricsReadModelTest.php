<?php

declare(strict_types=1);

namespace App\Tests\Integration\Infrastructure;

use App\Infrastructure\Persistence\UserMetricsReadModel;
use Doctrine\DBAL\DriverManager;
use PHPUnit\Framework\TestCase;

class UserMetricsReadModelTest extends TestCase
{
    private \Doctrine\DBAL\Connection $connection;

    protected function setUp(): void
    {
        $this->connection = DriverManager::getConnection([
            'driver' => 'pdo_sqlite',
            'memory' => true,
        ]);

        $this->connection->executeStatement(
            file_get_contents(__DIR__ . '/../../../migrations/001_create_users.sql')
        );
        $this->connection->executeStatement(
            file_get_contents(__DIR__ . '/../../../migrations/002_create_books.sql')
        );
        $this->connection->executeStatement(
            file_get_contents(__DIR__ . '/../../../migrations/003_user_metrics_and_password_resets.sql')
        );
    }

    private function insertUser(string $email, string $status = 'approved', int $loginCount = 0, ?int $lastReadBookId = null): int
    {
        $this->connection->insert('users', [
            'email'               => $email,
            'password_hash'       => 'hash',
            'role'                => 'user',
            'registration_status' => $status,
            'created_at'          => '2024-01-01 00:00:00',
            'login_count'         => $loginCount,
            'last_read_book_id'   => $lastReadBookId,
        ]);
        return (int) $this->connection->lastInsertId();
    }

    private function insertBook(int $ownerId, string $title = 'Book'): int
    {
        $this->connection->insert('books', [
            'owner_id'    => $ownerId,
            'title'       => $title,
            'author'      => 'Author',
            'status'      => 'ready',
            'created_at'  => '2024-01-01 00:00:00',
            'description' => '',
        ]);
        return (int) $this->connection->lastInsertId();
    }

    private function insertChapter(int $bookId, string $html): void
    {
        $this->connection->insert('chapters', [
            'book_id' => $bookId,
            'ord'     => 0,
            'title'   => 'Ch',
            'html'    => $html,
        ]);
    }

    public function testBookCountCorrectForUserWithKnownBooks(): void
    {
        $userId = $this->insertUser('alice@test.com');
        $this->insertBook($userId);
        $this->insertBook($userId);

        $model = new UserMetricsReadModel($this->connection);
        $metrics = $model->getMetricsForApprovedUsers();

        $this->assertArrayHasKey($userId, $metrics);
        $this->assertSame(2, $metrics[$userId]['bookCount']);
    }

    public function testStorageBytesUsesBlob(): void
    {
        $userId = $this->insertUser('bob@test.com');
        $bookId = $this->insertBook($userId);
        // 4-byte UTF-8 character (each is 4 bytes as BLOB), but as TEXT it's 1 char
        $html = "\xF0\x9F\x90\x94"; // 🐔 = 4 bytes BLOB, but 1 char TEXT
        $this->insertChapter($bookId, $html);

        $model = new UserMetricsReadModel($this->connection);
        $metrics = $model->getMetricsForApprovedUsers();

        // BLOB cast should give 4 bytes not 1
        $this->assertGreaterThanOrEqual(4, $metrics[$userId]['storageBytes']);
    }

    public function testLastReadTitleResolvedCorrectlyWhenBookExists(): void
    {
        $userId = $this->insertUser('carol@test.com');
        $bookId = $this->insertBook($userId, 'Tactics 101');
        // Update last_read_book_id
        $this->connection->update('users', ['last_read_book_id' => $bookId], ['id' => $userId]);

        $model = new UserMetricsReadModel($this->connection);
        $metrics = $model->getMetricsForApprovedUsers();

        $this->assertSame('Tactics 101', $metrics[$userId]['lastReadTitle']);
    }

    public function testLastReadTitleNullWhenBookDeleted(): void
    {
        $userId = $this->insertUser('dan@test.com');
        // last_read_book_id points to non-existent book 99999
        $this->connection->update('users', ['last_read_book_id' => 99999], ['id' => $userId]);

        $model = new UserMetricsReadModel($this->connection);
        $metrics = $model->getMetricsForApprovedUsers();

        $this->assertNull($metrics[$userId]['lastReadTitle']);
    }

    public function testStorageBytesZeroWhenUserHasNoBooks(): void
    {
        $userId = $this->insertUser('empty@test.com');

        $model = new UserMetricsReadModel($this->connection);
        $metrics = $model->getMetricsForApprovedUsers();

        $this->assertSame(0, $metrics[$userId]['storageBytes']);
    }
}
