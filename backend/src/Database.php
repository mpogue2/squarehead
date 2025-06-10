<?php
declare(strict_types=1);

namespace App;

use PDO;
use PDOException;

class Database
{
    private static ?PDO $connection = null;
    
    public static function getConnection(): PDO
    {
        if (self::$connection === null) {
            self::$connection = self::createConnection();
        }
        
        return self::$connection;
    }
    
    private static function createConnection(): PDO
    {
        $dbname = $_ENV['DB_NAME'] ?? '/Users/mpogue/squarehead/backend/database/squarehead.sqlite';
        
        // Determine if we're using SQLite or MySQL
        if (strpos($dbname, '.sqlite') !== false) {
            // SQLite configuration
            $dsn = "sqlite:{$dbname}";
            $username = null;
            $password = null;
        } else {
            // MySQL/MariaDB configuration
            $host = $_ENV['DB_HOST'] ?? 'localhost';
            $username = $_ENV['DB_USER'] ?? 'root';
            $password = $_ENV['DB_PASS'] ?? '';
            $dsn = "mysql:host={$host};dbname={$dbname};charset=utf8mb4";
        }
        
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        
        try {
            return new PDO($dsn, $username, $password, $options);
        } catch (PDOException $e) {
            throw new PDOException(
                "Database connection failed: " . $e->getMessage(),
                (int)$e->getCode()
            );
        }
    }
    
    public static function testConnection(): array
    {
        try {
            $pdo = self::getConnection();
            $dbname = $_ENV['DB_NAME'] ?? '/Users/mpogue/squarehead/backend/database/squarehead.sqlite';
            
            if (strpos($dbname, '.sqlite') !== false) {
                // SQLite test query
                $stmt = $pdo->query("SELECT sqlite_version() as version, datetime('now') as current_time");
                $result = $stmt->fetch();
                
                return [
                    'status' => 'connected',
                    'database_type' => 'SQLite',
                    'sqlite_version' => $result['version'],
                    'current_time' => $result['current_time'],
                    'database_file' => $dbname
                ];
            } else {
                // MySQL test query
                $stmt = $pdo->query("SELECT VERSION() as version, NOW() as current_time");
                $result = $stmt->fetch();
                
                return [
                    'status' => 'connected',
                    'database_type' => 'MySQL',
                    'mysql_version' => $result['version'],
                    'current_time' => $result['current_time'],
                    'host' => $_ENV['DB_HOST'] ?? 'localhost',
                    'database' => $dbname
                ];
            }
        } catch (PDOException $e) {
            return [
                'status' => 'failed',
                'error' => $e->getMessage(),
                'database_type' => strpos($dbname ?? '', '.sqlite') !== false ? 'SQLite' : 'MySQL'
            ];
        }
    }
}
