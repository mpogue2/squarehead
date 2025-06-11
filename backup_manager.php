<?php
/**
 * Backup Manager Script
 * 
 * This script reads backup settings from the database and determines whether
 * to perform a backup based on the configured frequency (daily, weekly, monthly).
 * 
 * Designed to be run once per day via cron.
 */

// Set error reporting
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/logs/backup-errors.log');

// Define log file
define('BACKUP_LOG', __DIR__ . '/logs/backup.log');

// Load the required files
require_once __DIR__ . '/backend/vendor/autoload.php';
require_once __DIR__ . '/backend/src/Database.php';
require_once __DIR__ . '/backend/src/models/Settings.php';

// Function to log messages
function logMessage($message) {
    $timestamp = date('Y-m-d H:i:s');
    $logMessage = "[$timestamp] $message" . PHP_EOL;
    file_put_contents(BACKUP_LOG, $logMessage, FILE_APPEND);
    echo $logMessage;
}

// Ensure log directory exists
if (!file_exists(dirname(BACKUP_LOG))) {
    mkdir(dirname(BACKUP_LOG), 0755, true);
}

try {
    // Initialize the database connection
    $db = new Database();
    $settings = new Settings($db);
    
    // Check if automatic backups are enabled
    $backupEnabled = $settings->get('backup_enabled');
    
    if ($backupEnabled !== 'true' && $backupEnabled !== '1') {
        logMessage("Automatic backups are disabled. Exiting.");
        exit(0);
    }
    
    // Get backup frequency setting
    $backupFrequency = $settings->get('backup_frequency') ?: 'weekly';
    logMessage("Backup frequency is set to: $backupFrequency");
    
    // Determine if we should run the backup today based on frequency
    $shouldRunBackup = false;
    $today = new DateTime();
    
    switch ($backupFrequency) {
        case 'daily':
            // Run every day
            $shouldRunBackup = true;
            break;
            
        case 'weekly':
            // Run on Sundays (day of week = 0)
            $shouldRunBackup = ($today->format('w') == 0);
            break;
            
        case 'monthly':
            // Run on the 1st day of the month
            $shouldRunBackup = ($today->format('j') == 1);
            break;
            
        default:
            // Default to weekly if setting is invalid
            $shouldRunBackup = ($today->format('w') == 0);
            break;
    }
    
    if (!$shouldRunBackup) {
        logMessage("Not scheduled to run backup today based on frequency ($backupFrequency). Exiting.");
        exit(0);
    }
    
    // Determine which database we're using
    $dbType = $db->getType();
    logMessage("Database type detected: $dbType");
    
    // Run the appropriate backup script based on DB type
    if ($dbType === 'sqlite') {
        logMessage("Running SQLite backup...");
        include __DIR__ . '/backup_sqlite.php';
    } else {
        // Assume MySQL/MariaDB for any other type
        logMessage("Running MariaDB/MySQL backup...");
        include __DIR__ . '/backup_mariadb.php';
    }
    
    logMessage("Backup process completed successfully.");
    
} catch (Exception $e) {
    $errorMessage = "ERROR: " . $e->getMessage() . " in " . $e->getFile() . " on line " . $e->getLine();
    logMessage($errorMessage);
    exit(1);
}