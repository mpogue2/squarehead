# Square Dance Club Reminder System

## Overview

The reminder system automatically sends email reminders to squareheads for upcoming dances based on the "Reminder Days" setting configured in the Admin page.

## How It Works

1. **Configuration**: Reminder days are set in the Admin page (e.g., "14,7,3,1" means send reminders 14, 7, 3, and 1 days before each dance)

2. **Scheduling**: A cron job runs daily at 6:00 PM to check for dances that need reminders

3. **Email Logic**: For each reminder day, the system:
   - Calculates the target dance date (today + reminder days)
   - Finds squareheads assigned to dances on that date
   - Sends personalized reminder emails using the email template from Admin settings

## Files Created

### Backend API Endpoint
- `/Users/mpogue/squarehead/backend/src/routes/cron.php` - API endpoint for processing reminders

### Cron Scripts
- `/Users/mpogue/squarehead/send_reminders.sh` - Main cron script
- `/Users/mpogue/squarehead/test_reminders.sh` - Test script for validation
- `/Users/mpogue/squarehead/cleanup_test_data.sh` - Cleanup script for test data

### Log Directory
- `/Users/mpogue/squarehead/logs/` - Directory for log files
- `/Users/mpogue/squarehead/logs/reminders.log` - Main activity log
- `/Users/mpogue/squarehead/logs/reminders_error.log` - Error log

## Testing

### Manual Testing via curl
```bash
# Test the API endpoint directly
curl -X POST -H "Content-Type: application/json" http://localhost:8000/api/cron/reminders
```

### Using the Test Script
```bash
# Run comprehensive test
/Users/mpogue/squarehead/test_reminders.sh
```

### Expected Output
The API returns JSON with:
- `reminder_days_checked`: Array of reminder days processed
- `emails_sent`: Array of emails sent with recipient details
- `total_emails_sent`: Count of emails sent
- `errors`: Array of any errors encountered
- `timestamp`: When the process ran
- `schedule_id`: ID of the current schedule processed

## Production Setup

### 1. Schedule the Cron Job

Add this line to your crontab to run daily at 6:00 PM:
```bash
0 18 * * * /Users/mpogue/squarehead/send_reminders.sh >> /Users/mpogue/squarehead/logs/cron.log 2>&1
```

To edit crontab:
```bash
crontab -e
```

To view current crontab:
```bash
crontab -l
```

### 2. Ensure Backend Server is Running

The cron job requires the PHP backend server to be running:
```bash
cd /Users/mpogue/squarehead/backend
php -S localhost:8000 -t public &
```

For production, consider using a process manager like systemd or supervisor to keep the server running.

### 3. Email Configuration

Ensure these settings are properly configured in the Admin page:
- **SMTP Settings**: Host, port, username, password
- **Email Templates**: Subject and body templates with placeholders
- **Reminder Days**: Comma-separated list (e.g., "14,7,3,1")

## Email Template Placeholders

The system supports these placeholders in email templates:
- `{club_name}` - Club name from settings
- `{member_name}` - Full name of the squarehead
- `{dance_date}` - Formatted dance date (e.g., "Wednesday, June 11, 2025")

Markdown-style links are also supported:
```
[Link text](https://example.com)
```

## Log Management

### Log Files
- **reminders.log**: Normal operation logs
- **reminders_error.log**: Error-specific logs
- **cron.log**: Output from cron execution (if configured)

### Automatic Cleanup
The script automatically removes log files older than 30 days.

## Troubleshooting

### Common Issues

1. **Backend Server Not Running**
   - Error: "Backend server is not accessible"
   - Solution: Start the PHP server

2. **Email Delivery Failures**
   - Check SMTP settings in Admin page
   - Verify network connectivity
   - Check error logs

3. **No Reminders Sent**
   - Verify "Reminder Days" setting is configured
   - Check if there are assignments for the calculated dates
   - Ensure schedule is marked as "current" and active

### Debug Information

Check logs for detailed information:
```bash
# View recent activity
tail -f /Users/mpogue/squarehead/logs/reminders.log

# View errors
cat /Users/mpogue/squarehead/logs/reminders_error.log
```

### Test Data Cleanup

After testing, run the cleanup script:
```bash
/Users/mpogue/squarehead/cleanup_test_data.sh
```

## Example Workflow

1. **Day 1**: Admin sets reminder days to "14,7,3,1" and assigns squareheads to dances
2. **Day 2**: Cron job runs at 6 PM, finds no reminders needed (no dances 14/7/3/1 days away)
3. **Day X**: Cron job finds a dance 14 days away, sends reminder email
4. **Day Y**: Cron job finds same dance 7 days away, sends another reminder
5. **And so on...**

## Security Considerations

- The cron endpoint has no authentication (it's meant for server-side use only)
- Consider restricting access to localhost only in production
- Log files may contain email addresses - ensure proper file permissions
- Email credentials are stored in the database - ensure database security

## Future Enhancements

Potential improvements:
- Email delivery confirmation tracking
- Retry logic for failed email sends
- Web interface for viewing reminder history
- SMS reminder option
- Customizable reminder schedules per member
