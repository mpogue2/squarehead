#!/bin/bash

# Test script for the reminder system
# This will test the reminder functionality with current test data

echo "=== Square Dance Club Reminder System Test ==="
echo
echo "Current reminder configuration:"
echo "Reminder Days: 14,7,3,1 (14 days before, 7 days before, 3 days before, 1 day before)"
echo
echo "Testing reminder system..."
echo

# Test the API endpoint directly
echo "1. Testing API endpoint directly:"
RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" http://localhost:8000/api/cron/reminders)
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo

echo "2. Testing via bash script:"
/Users/mpogue/squarehead/send_reminders.sh
echo

echo "3. Checking log files:"
echo "--- Main Log ---"
cat /Users/mpogue/squarehead/logs/reminders.log 2>/dev/null || echo "No log file found"
echo
echo "--- Error Log ---"
cat /Users/mpogue/squarehead/logs/reminders_error.log 2>/dev/null || echo "No error log found"
echo

echo "=== Test Complete ==="
echo
echo "To schedule this as a cron job, add this line to your crontab:"
echo "0 18 * * * /Users/mpogue/squarehead/send_reminders.sh >> /Users/mpogue/squarehead/logs/cron.log 2>&1"
echo
echo "To edit crontab: crontab -e"
echo "To view current crontab: crontab -l"
