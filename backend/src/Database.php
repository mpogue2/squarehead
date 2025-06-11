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
        error_log("Database::createConnection: Using database: {$dbname}");
        
        // Determine if we're using SQLite or MySQL
        if (strpos($dbname, '.sqlite') !== false) {
            // SQLite configuration
            $dsn = "sqlite:{$dbname}";
            $username = null;
            $password = null;
            error_log("Database::createConnection: Using SQLite with dsn: {$dsn}");
            
            // Check if the SQLite file exists
            if (!file_exists($dbname)) {
                error_log("Database::createConnection: WARNING - SQLite database file does not exist: {$dbname}");
                
                // Try to create the directory if it doesn't exist
                $dir = dirname($dbname);
                if (!file_exists($dir)) {
                    error_log("Database::createConnection: Creating directory: {$dir}");
                    mkdir($dir, 0777, true);
                }
            } else {
                error_log("Database::createConnection: SQLite database file exists: {$dbname}");
                // Check if file is readable and writable
                error_log("Database::createConnection: SQLite file permissions - Readable: " . 
                    (is_readable($dbname) ? 'Yes' : 'No') . ", Writable: " . 
                    (is_writable($dbname) ? 'Yes' : 'No'));
            }
        } else {
            // MySQL/MariaDB configuration
            $host = $_ENV['DB_HOST'] ?? 'localhost';
            $username = $_ENV['DB_USER'] ?? 'root';
            $password = $_ENV['DB_PASS'] ?? '';
            $dsn = "mysql:host={$host};dbname={$dbname};charset=utf8mb4";
            error_log("Database::createConnection: Using MySQL with host: {$host}, database: {$dbname}");
        }
        
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        
        try {
            error_log("Database::createConnection: Attempting to connect to database");
            $pdo = new PDO($dsn, $username, $password, $options);
            error_log("Database::createConnection: Successfully connected to database");
            return $pdo;
        } catch (PDOException $e) {
            $errorMessage = "Database connection failed: " . $e->getMessage();
            error_log("Database::createConnection: ERROR - {$errorMessage}");
            throw new PDOException($errorMessage, (int)$e->getCode());
        }
    }
    
    /**
     * Get the database type (sqlite or mysql)
     * 
     * @return string The database type: 'sqlite' or 'mysql'
     */
    public function getType(): string
    {
        $dbname = $_ENV['DB_NAME'] ?? '/Users/mpogue/squarehead/backend/database/squarehead.sqlite';
        return (strpos($dbname, '.sqlite') !== false) ? 'sqlite' : 'mysql';
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
                // MySQL/MariaDB test query
                $stmt = $pdo->query("SELECT VERSION() as version");
                $result = $stmt->fetch();
                $result['current_time'] = date('Y-m-d H:i:s');
                
                return [
                    'status' => 'connected',
                    'database_type' => 'MySQL/MariaDB',
                    'mysql_version' => $result['version'] ?? 'unknown',
                    'current_time' => $result['current_time'] ?? date('Y-m-d H:i:s'),
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
