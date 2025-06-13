# Preview Mode Testing Instructions

This document provides instructions for testing the Squarehead application in preview mode, which simulates a production environment while still using the local development database.

## Setup

The application consists of two main components:

1. **Frontend** - React application built with Vite
2. **Backend** - PHP API server

Both components need to be running for the application to work properly.

## Starting the Servers

### Backend Server

```bash
cd /Users/mpogue/squarehead/backend
./run-server.sh
```

This will start the PHP development server on port 8000.

### Frontend Preview Server

```bash
cd /Users/mpogue/squarehead/frontend
npm run build    # Build the production version
npm run preview  # Start the preview server
```

This will compile the frontend application for production and start a preview server on port 4173.

## Testing Script

For convenience, a testing script is provided that checks if all components are running correctly:

```bash
./test-preview.sh
```

This script verifies:
- The backend server is running
- The frontend preview server is accessible
- The API proxy is working correctly
- The database connection is established

## Manual Testing

1. Open http://localhost:4173/ in your browser
2. Login using the admin account or any valid account
3. Verify that the following features work correctly:
   - Dashboard view
   - Members management
   - Current and next schedule
   - Map view
   - Admin settings

## Configuration

The preview mode uses the following configuration:

- Frontend: Built with Vite and served from `/dist` directory
- Backend: PHP development server with MariaDB database
- API Proxy: Requests to `/api/*` are proxied to `http://localhost:8000`

The preview server configuration is defined in `frontend/vite.config.js`.

## Troubleshooting

If you encounter issues:

1. Ensure both servers are running
2. Check the browser console for errors
3. Verify API requests are being properly proxied
4. Check database connectivity with `/db-simple-test.php`

## Database

The application uses a local MariaDB database named `squarehead`. The database credentials are defined in `.env` file in the backend directory.

## Notes

- The reminder system (`send_reminders.sh`) is not tested in this mode
- Local testing uses the same database as development mode