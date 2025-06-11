#!/bin/bash
#
# Setup Backup Cron Job
# This script sets up the cron job for automatic database backups
#

# Get the current directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Create the logs directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/logs"

# Create a temporary file for the crontab
TEMP_CRONTAB=$(mktemp)

# Export current crontab
crontab -l > "$TEMP_CRONTAB" 2>/dev/null

# Check if the backup cron job already exists
if grep -q "backup_manager.php" "$TEMP_CRONTAB"; then
    echo "Backup cron job already exists. No changes made."
    rm "$TEMP_CRONTAB"
    exit 0
fi

# Add the backup cron job to run at 2:00 AM every day
echo "# Square Dance Club - Daily database backup at 2:00 AM" >> "$TEMP_CRONTAB"
echo "0 2 * * * cd $SCRIPT_DIR && php backup_manager.php >> $SCRIPT_DIR/logs/cron.log 2>&1" >> "$TEMP_CRONTAB"

# Install the new crontab
crontab "$TEMP_CRONTAB"
rm "$TEMP_CRONTAB"

echo "Backup cron job has been successfully set up!"
echo "The database will be backed up at 2:00 AM daily, respecting the frequency settings in the Admin panel."
echo "Logs will be written to: $SCRIPT_DIR/logs/backup.log and $SCRIPT_DIR/logs/cron.log"