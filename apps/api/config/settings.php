<?php

declare(strict_types=1);

return [
    'version'            => '0.11.0',
    'displayErrorDetails' => false,
    'db'  => [
        'path' => __DIR__ . '/../storage/chess.sqlite',
    ],
    'jwt' => [
        'secret' => getenv('JWT_SECRET') ?: 'change-this-secret-in-production-min-32-chars!!',
    ],
    'auth' => [
        // Never enable in production: makes login optional (synthetic admin).
        'dev_bypass' => getenv('AUTH_DEV_BYPASS') === '1',
    ],
];
