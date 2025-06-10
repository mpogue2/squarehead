#!/bin/bash

# Square Dance Club Reminder System
# Cron script to send reminder emails for upcoming dances
# 
# Schedule this to run daily at 6:00 PM via crontab:
# 0 18 * * * /Users/mpogue/squarehead/send_reminders.sh >> /Users/mpogue/squarehead/logs/cron.log 2>&1

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_URL="http://localhost:8000/api/cron/reminders"
LOG_DIR="${SCRIPT_DIR}/logs"
LOG_FILE="${LOG_DIR}/reminders.log"
ERROR_LOG="${LOG_DIR}/reminders_error.log"

# Ensure log directory exists
mkdir -p "${LOG_DIR}"

# Function to log messages with timestamp
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a "${ERROR_LOG}"
}

# Start reminder process
log_message "Starting reminder check..."

# Check if the backend server is running
if ! curl -s -f "${API_URL%/cron/reminders}/health" > /dev/null; then
    log_error "Backend server is not accessible at ${API_URL%/cron/reminders}"
    log_error "Please ensure the PHP development server is running: cd ${SCRIPT_DIR}/backend && php -S localhost:8000 -t public"
    exit 1
fi

# Make API call to send reminders
RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -w "HTTP_STATUS_CODE:%{http_code}" \
    "${API_URL}" 2>&1)

# Extract HTTP status code
HTTP_STATUS=$(echo "${RESPONSE}" | grep -o "HTTP_STATUS_CODE:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "${RESPONSE}" | sed 's/HTTP_STATUS_CODE:[0-9]*$//')

# Check if request was successful
if [[ "${HTTP_STATUS}" == "200" ]]; then
    log_message "Reminder check completed successfully"
    
    # Parse and log summary information
    EMAILS_SENT=$(echo "${RESPONSE_BODY}" | grep -o '"total_emails_sent":[0-9]*' | cut -d: -f2)
    if [[ -n "${EMAILS_SENT}" ]]; then
        log_message "Total emails sent: ${EMAILS_SENT}"
    fi
    
    # Log full response for debugging (optional - comment out for production)
    # log_message "API Response: ${RESPONSE_BODY}"
    
else
    log_error "API request failed with status code: ${HTTP_STATUS}"
    log_error "Response: ${RESPONSE_BODY}"
    exit 1
fi

log_message "Reminder process completed"

# Optional: Clean up old logs (keep last 30 days)
find "${LOG_DIR}" -name "*.log" -type f -mtime +30 -delete 2>/dev/null

exit 0
