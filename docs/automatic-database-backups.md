# Automatic Database Backups

This guide explains how the automatic database backup system works in the Square Dance Club application and how to set it up in a production environment.

## Overview

The application includes a backup system that can automatically create backups of your database based on settings configured in the Admin panel. The system supports both SQLite and MariaDB/MySQL databases and can create backups at daily, weekly, or monthly intervals.

## How It Works

1. The backup system is controlled by settings in the Admin panel:
   - **Enable Automatic Backups**: Checkbox to enable/disable the backup system
   - **Backup Frequency**: Dropdown to select the backup frequency (Daily, Weekly, Monthly)

2. A daily cron job runs the backup script, which checks these settings and determines whether to create a backup on that day.

3. When a backup is created, it is stored in the `backups` directory with a timestamp and automatically compressed.

4. Old backups (older than 30 days) are automatically cleaned up to prevent disk space issues.

## Backup Scripts

The backup system consists of three main PHP scripts:

1. **backup_manager.php**: The main script that reads settings and decides whether to create a backup.
2. **backup_mariadb.php**: Script for backing up MariaDB/MySQL databases.
3. **backup_sqlite.php**: Script for backing up SQLite databases.

## Setting Up Cron Job

To set up the automated backup system in production, you need to create a cron job that runs the backup manager script once per day.

### Example Cron Job

```bash
# Run database backup at 2:00 AM every day
0 2 * * * cd /path/to/squarehead && php backup_manager.php >> /path/to/squarehead/logs/cron.log 2>&1
```

Replace `/path/to/squarehead` with the actual path to your application installation.

### Installation Steps

1. Log in to your server via SSH.

2. Edit the crontab:
   ```bash
   crontab -e
   ```

3. Add the backup script line (as shown above).

4. Save and exit the editor.

5. Verify the cron job is set up correctly:
   ```bash
   crontab -l
   ```

## Backup Storage

Backups are stored in the following directory structure:

- For MariaDB/MySQL: `/path/to/squarehead/backups/mariadb/`
- For SQLite: `/path/to/squarehead/backups/sqlite/`

Each backup is named with a timestamp (YYYY-MM-DD-HHMMSS) and compressed with gzip.

## Monitoring and Troubleshooting

### Logging

All backup operations are logged to `/path/to/squarehead/logs/backup.log`. This log includes information about when backups ran, whether they were successful, and any errors that occurred.

### Common Issues

1. **Permission errors**: Make sure the user running the cron job has write permissions to the backups directory and the logs directory.

2. **Database credentials**: For MariaDB/MySQL, ensure the credentials in your .env file are correct.

3. **Missing commands**: The backup scripts require external commands like `mysqldump`, `sqlite3`, and `gzip`. Make sure these are installed on your server.

## Manual Backups

You can also run the backup script manually at any time:

```bash
cd /path/to/squarehead
php backup_manager.php
```

This will respect the settings in the Admin panel. If you want to force a backup regardless of settings, you can modify the script temporarily.

## Restoring from Backup

### MariaDB/MySQL Restore

```bash
gunzip -c /path/to/squarehead/backups/mariadb/squarehead_YYYY-MM-DD-HHMMSS.sql.gz | mysql -u username -p database_name
```

### SQLite Restore

```bash
gunzip -c /path/to/squarehead/backups/sqlite/squarehead.sqlite_YYYY-MM-DD-HHMMSS.gz > restored_database.sqlite
```

Then, replace your current database file with the restored one.

## Backup Configuration

The backup system is configured to:

1. Create compressed backups (.gz)
2. Retain backups for 30 days
3. Log all operations
4. Clean up old backups automatically

These parameters can be adjusted by modifying the backup scripts if needed.