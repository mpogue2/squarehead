<?php
/**
 * SQLite Backup Script
 * 
 * This script performs backups for SQLite databases.
 * It is included by the main backup_manager.php script.
 */

// Make sure this script is included by the backup manager
if (!defined('BACKUP_LOG')) {
    die('This script cannot be run directly. Please use backup_manager.php');
}

// Function to get SQLite database path
function getSQLiteDatabasePath() {
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
    
    // Get database path from environment or use default
    $dbPath = $_ENV['DB_NAME'] ?? $env['DB_NAME'] ?? '/Users/mpogue/squarehead/backend/database/squarehead.sqlite';
    
    // Make sure the path is absolute
    if (strpos($dbPath, '/') !== 0 && strpos($dbPath, ':') === false) {
        $dbPath = __DIR__ . '/' . $dbPath;
    }
    
    return $dbPath;
}

try {
    // Get database path
    $dbPath = getSQLiteDatabasePath();
    logMessage("Using SQLite database: $dbPath");
    
    // Check if database file exists
    if (!file_exists($dbPath)) {
        throw new Exception("SQLite database file does not exist: $dbPath");
    }
    
    // Define backup directories
    $backupBaseDir = __DIR__ . '/backups';
    $backupDir = $backupBaseDir . '/sqlite';
    
    // Create backup directories if they don't exist
    if (!file_exists($backupBaseDir)) {
        mkdir($backupBaseDir, 0755, true);
        logMessage("Created backup base directory: $backupBaseDir");
    }
    
    if (!file_exists($backupDir)) {
        mkdir($backupDir, 0755, true);
        logMessage("Created SQLite backup directory: $backupDir");
    }
    
    // Generate backup filename with timestamp
    $timestamp = date('Y-m-d-His');
    $dbName = basename($dbPath);
    $backupFile = "$backupDir/{$dbName}_$timestamp";
    
    // Create backup using file copy
    logMessage("Starting SQLite backup to: $backupFile");
    
    // Use the SQLite .backup command if possible (more reliable than file copy)
    $sqliteCmd = "sqlite3";
    $backupCommand = sprintf(
        '%s %s ".backup %s"',
        escapeshellcmd($sqliteCmd),
        escapeshellarg($dbPath),
        escapeshellarg($backupFile)
    );
    
    $output = [];
    $returnVar = 0;
    
    exec($backupCommand, $output, $returnVar);
    
    if ($returnVar !== 0) {
        // If sqlite3 command fails, try a direct file copy as fallback
        logMessage("sqlite3 command failed, trying direct file copy instead.");
        if (!copy($dbPath, $backupFile)) {
            throw new Exception("Failed to copy SQLite database file to backup location");
        }
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
    $oldFiles = glob("$backupDir/{$dbName}_*.gz");
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
    
    logMessage("SQLite backup completed successfully.");
    
} catch (Exception $e) {
    logMessage("ERROR in SQLite backup: " . $e->getMessage());
    throw $e; // Re-throw to let the manager script handle it
}