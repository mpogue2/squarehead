#!/bin/bash
# Custom script to run the PHP development server with no timeout
# Usage: ./run-server.sh

# Kill any existing PHP servers on port 8000
pkill -f "php -S localhost:8000" || true

# Print status message
echo "Starting PHP development server on http://localhost:8000"
echo "Press Ctrl+C to stop the server"
echo "==========================================="

# Start the PHP server in the foreground
# This avoids the Composer timeout issue
cd "$(dirname "$0")"
php -S localhost:8000 -t public

# This script should be run directly with ./run-server.sh
# Make sure to chmod +x run-server.sh to make it executable