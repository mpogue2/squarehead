<?php
/**
 * MariaDB/MySQL Backup Script
 * 
 * This script performs backups for MariaDB/MySQL databases.
 * It is included by the main backup_manager.php script.
 */

// Make sure this script is included by the backup manager
if (!defined('BACKUP_LOG')) {
    die('This script cannot be run directly. Please use backup_manager.php');
}

// Function to get database credentials from environment or .env file
function getDatabaseCredentials() {
    // Try to load from .env file if it exists
    $envFile = __DIR__ . '/backend/.env';
    $env = [];
    
    if (file_exists($envFile)) {
        $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            if (strpos($line, '=') !== false && strpos($line, '#') !== 0) {
                list($key, $value) = explode('=', $line, 2);
                $env[trim($key)] = trim($value);
            }
        }
    }
    
    return [
        'host' => $_ENV['DB_HOST'] ?? $env['DB_HOST'] ?? 'localhost',
        'name' => $_ENV['DB_NAME'] ?? $env['DB_NAME'] ?? 'squarehead',
        'user' => $_ENV['DB_USER'] ?? $env['DB_USER'] ?? 'squarehead',
        'pass' => $_ENV['DB_PASS'] ?? $env['DB_PASS'] ?? '',
    ];
}

try {
    // Get database credentials
    $credentials = getDatabaseCredentials();
    logMessage("Using database: {$credentials['name']} on host: {$credentials['host']}");
    
    // Define backup directories
    $backupBaseDir = __DIR__ . '/backups';
    $backupDir = $backupBaseDir . '/mariadb';
    
    // Create backup directories if they don't exist
    if (!file_exists($backupBaseDir)) {
        mkdir($backupBaseDir, 0755, true);
        logMessage("Created backup base directory: $backupBaseDir");
    }
    
    if (!file_exists($backupDir)) {
        mkdir($backupDir, 0755, true);
        logMessage("Created MariaDB backup directory: $backupDir");
    }
    
    // Generate backup filename with timestamp
    $timestamp = date('Y-m-d-His');
    $backupFile = "$backupDir/squarehead_$timestamp.sql";
    
    // Create mysqldump command
    $mysqldump = "mysqldump";
    $command = sprintf(
        '%s --host=%s --user=%s --password=%s --opt --skip-lock-tables --add-drop-table --default-character-set=utf8mb4 %s > %s',
        escapeshellcmd($mysqldump),
        escapeshellarg($credentials['host']),
        escapeshellarg($credentials['user']),
        escapeshellarg($credentials['pass']),
        escapeshellarg($credentials['name']),
        escapeshellarg($backupFile)
    );
    
    // Execute the backup command
    logMessage("Starting MariaDB backup to: $backupFile");
    $output = [];
    $returnVar = 0;
    
    // Hide the password in logs by replacing it with ***
    $logCommand = preg_replace('/--password=[^ ]+/', '--password=***', $command);
    logMessage("Executing command: $logCommand");
    
    exec($command, $output, $returnVar);
    
    if ($returnVar !== 0) {
        throw new Exception("mysqldump command failed with status $returnVar: " . implode("\n", $output));
    }
    
    // Compress the backup file
    logMessage("Compressing backup file...");
    $gzipCommand = "gzip " . escapeshellarg($backupFile);
    exec($gzipCommand, $output, $returnVar);
    
    if ($returnVar !== 0) {
        throw new Exception("gzip command failed with status $returnVar: " . implode("\n", $output));
    }
    
    $compressedFile = "$backupFile.gz";
    logMessage("Backup compressed to: $compressedFile");
    
    // Delete old backups (keep last 30 days by default)
    $retention = 30; // days
    $oldFiles = glob("$backupDir/squarehead_*.sql.gz");
    $now = time();
    
    foreach ($oldFiles as $file) {
        if (is_file($file)) {
            $fileTime = filemtime($file);
            $daysOld = round(($now - $fileTime) / (60 * 60 * 24));
            
            if ($daysOld > $retention) {
                unlink($file);
                logMessage("Deleted old backup file: $file (age: $daysOld days)");
            }
        }
    }
    
    logMessage("MariaDB backup completed successfully.");
    
} catch (Exception $e) {
    logMessage("ERROR in MariaDB backup: " . $e->getMessage());
    throw $e; // Re-throw to let the manager script handle it
}