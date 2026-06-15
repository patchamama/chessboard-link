<?php

declare(strict_types=1);

namespace App\Tests;

use DI\Bridge\Slim\Bridge;
use DI\ContainerBuilder;
use Psr\Container\ContainerInterface;
use Slim\App;

abstract class TestCase extends \PHPUnit\Framework\TestCase
{
    private ?ContainerInterface $container = null;

    protected function createApp(): App
    {
        $container = $this->buildContainer();
        $app = Bridge::create($container);
        $routes = require __DIR__ . '/../config/routes.php';
        $routes($app);
        return $app;
    }

    protected function buildContainer(array $extraDefinitions = []): ContainerInterface
    {
        if ($this->container !== null && empty($extraDefinitions)) {
            return $this->container;
        }

        // Override DB to use in-memory SQLite for tests
        $settings = require __DIR__ . '/../config/settings.php';
        $settings['db']['path'] = ':memory:';

        $definitions = require __DIR__ . '/../config/di_definitions.php';

        $builder = new ContainerBuilder();
        $builder->addDefinitions(array_merge($definitions, $extraDefinitions, [
            'settings' => $settings,
        ]));

        $container = $builder->build();

        // Run migrations on the in-memory connection
        $connection = $container->get(\Doctrine\DBAL\Connection::class);
        foreach (['001_create_users.sql', '002_create_books.sql', '003_user_metrics_and_password_resets.sql', '004_position_trainer.sql'] as $migration) {
            $sql = file_get_contents(__DIR__ . '/../migrations/' . $migration);
            $connection->executeStatement($sql);
        }

        if (empty($extraDefinitions)) {
            $this->container = $container;
        }

        return $container;
    }

    protected function createAppWithOverrides(array $extraDefinitions): App
    {
        $container = $this->buildContainer($extraDefinitions);
        $app = Bridge::create($container);
        $routes = require __DIR__ . '/../config/routes.php';
        $routes($app);
        return $app;
    }
}
