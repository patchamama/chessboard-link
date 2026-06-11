<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence;

use Doctrine\DBAL\Connection;

class UserMetricsReadModel
{
    public function __construct(private readonly Connection $connection)
    {
    }

    /**
     * Returns metrics for all approved users, keyed by user id.
     *
     * @return array<int, array{userId: int, loginCount: int, lastReadTitle: ?string, bookCount: int, storageBytes: int}>
     */
    public function getMetricsForApprovedUsers(): array
    {
        $sql = <<<SQL
SELECT
    u.id                AS user_id,
    u.login_count       AS login_count,
    lrb.title           AS last_read_title,
    COUNT(DISTINCT b.id) AS book_count,
    COALESCE(ch.html_bytes, 0) AS storage_bytes
FROM users u
LEFT JOIN books b   ON b.owner_id = u.id
LEFT JOIN books lrb ON lrb.id = u.last_read_book_id
LEFT JOIN (
    SELECT bk.owner_id AS owner_id,
           SUM(length(CAST(c.html AS BLOB))) AS html_bytes
    FROM chapters c
    JOIN books bk ON bk.id = c.book_id
    GROUP BY bk.owner_id
) ch ON ch.owner_id = u.id
WHERE u.registration_status = 'approved'
GROUP BY u.id
SQL;

        $rows = $this->connection->fetchAllAssociative($sql);

        $result = [];
        foreach ($rows as $row) {
            $userId = (int) $row['user_id'];
            $result[$userId] = [
                'userId'        => $userId,
                'loginCount'    => (int) $row['login_count'],
                'lastReadTitle' => $row['last_read_title'] !== null ? (string) $row['last_read_title'] : null,
                'bookCount'     => (int) $row['book_count'],
                'storageBytes'  => (int) $row['storage_bytes'],
            ];
        }

        return $result;
    }
}
